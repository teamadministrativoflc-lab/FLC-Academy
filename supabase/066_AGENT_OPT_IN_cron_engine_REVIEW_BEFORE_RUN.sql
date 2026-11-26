-- 066: INTEGRATE agent-initiated presence into existing quota-aware cron engine.
-- DO NOT RUN until admin presence is OFF for test agent, 065 installed,
-- SQL/function backup retained, and the production release is approved.
-- Fail closed: agents without an explicit "Estoy disponible" request receive no
-- automatic leads; requires BOTH agent opt-in and admin Zoom verification.
-- No automatic CRM writes; old lead assignments unaffected; no cron alterations.
-- This is a replacement based on successfully tested 064, including all
-- original eligible campaign/state, round robin, daily caps, and internal guard.
-- Reviewer checklist: verify existing cron target and all agent availability.
BEGIN;
CREATE OR REPLACE FUNCTION flc_internal.distribute_one()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  v_lead public.flc_distribution_leads%ROWTYPE;
  v_last uuid;
  v_agent uuid;
  v_agent_name text;
  v_assign uuid;
  v_count bigint;
  v_quota_day date;
  v_limit integer;
  v_used integer;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Internal executor only' USING ERRCODE='42501';
  END IF;

  -- The whole round robin + quota check + assignment is a single
  -- serialized transaction. This lock is acquired before any reads.
  PERFORM pg_catalog.pg_advisory_xact_lock(501260, 20261126);

  IF NOT EXISTS(
    SELECT 1 FROM public.flc_distribution_automation_control ctl
    WHERE ctl.id=true AND ctl.enabled=true
  ) THEN
    RETURN jsonb_build_object('assigned',false,'reason','automation_disabled');
  END IF;

  v_quota_day := (pg_catalog.now() AT TIME ZONE 'America/New_York')::date;

  -- Oldest REAL pending contact with at least one eligible agent under quota.
  -- If all eligible agents are at quota, this contact stays queued and the
  -- engine may process other eligible campaign/state contacts.
  SELECT l.* INTO v_lead
  FROM public.flc_distribution_leads l
  JOIN public.flc_distribution_campaigns c
    ON c.code=l.source_campaign AND c.enabled
  WHERE l.status='pending'
    AND lower(l.source_crm)='auraflow'
    AND l.source_contact_id NOT LIKE 'FLC-PRUEBA-%'
    AND l.source_contact_id NOT LIKE 'FLC-HISTORIAL-%'
    AND l.source_campaign<>'FLC_TEST_INTEGRACION'
    AND l.lead_state IS NOT NULL
    AND NOT EXISTS(
      SELECT 1 FROM public.flc_distribution_assignments a
      WHERE a.lead_id=l.id AND a.ended_at IS NULL
    )
    AND EXISTS(
      SELECT 1
      FROM public.agent_profiles p
      JOIN public.flc_distribution_agent_availability av
        ON av.agent_id=p.id AND av.is_verified
      JOIN public.flc_distribution_agent_self_presence sp
        ON sp.agent_id=p.id AND sp.wants_leads=true
      JOIN public.flc_distribution_agent_self_presence sp
      ON sp.agent_id=p.id AND sp.wants_leads=true
    JOIN public.flc_distribution_agent_campaigns ac
        ON ac.agent_id=p.id AND ac.enabled AND ac.campaign_code=l.source_campaign
      JOIN public.flc_distribution_agent_states st
        ON st.agent_id=p.id AND st.state_code=l.lead_state
      LEFT JOIN public.flc_distribution_daily_quotas q
        ON q.agent_id=p.id AND q.campaign_code=l.source_campaign
      WHERE p.role='agent'
        AND (SELECT count(*)
             FROM public.flc_distribution_auto_quota_ledger lg
             WHERE lg.agent_id=p.id
               AND lg.campaign_code=l.source_campaign
               AND lg.quota_day=v_quota_day) < coalesce(q.daily_limit,10)
    )
  ORDER BY l.received_at,l.id
  FOR UPDATE OF l SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('assigned',false,'reason','no_eligible_pending_lead_or_daily_quota_reached');
  END IF;

  INSERT INTO public.flc_distribution_rr_cursor(campaign_code,state_code)
  VALUES(v_lead.source_campaign,v_lead.lead_state)
  ON CONFLICT(campaign_code,state_code) DO NOTHING;
  SELECT rr.last_agent_id INTO v_last
  FROM public.flc_distribution_rr_cursor rr
  WHERE rr.campaign_code=v_lead.source_campaign
    AND rr.state_code=v_lead.lead_state
  FOR UPDATE;

  WITH eligible AS (
    SELECT p.id,p.full_name,
      coalesce(q.daily_limit,10)::integer AS quota_limit,
      (SELECT count(*)::integer
       FROM public.flc_distribution_auto_quota_ledger lg
       WHERE lg.agent_id=p.id
         AND lg.campaign_code=v_lead.source_campaign
         AND lg.quota_day=v_quota_day) AS used_today,
      row_number() OVER(ORDER BY p.full_name,p.id) AS rn
    FROM public.agent_profiles p
    JOIN public.flc_distribution_agent_availability av
      ON av.agent_id=p.id AND av.is_verified
    JOIN public.flc_distribution_agent_campaigns ac
      ON ac.agent_id=p.id AND ac.enabled
      AND ac.campaign_code=v_lead.source_campaign
    JOIN public.flc_distribution_agent_states st
      ON st.agent_id=p.id AND st.state_code=v_lead.lead_state
    LEFT JOIN public.flc_distribution_daily_quotas q
      ON q.agent_id=p.id AND q.campaign_code=v_lead.source_campaign
    WHERE p.role='agent'
  ), available AS(
    SELECT * FROM eligible WHERE used_today < quota_limit
  ), previous AS(
    SELECT coalesce((SELECT rn FROM eligible WHERE id=v_last),0) AS rn
  )
  SELECT a.id,a.full_name,a.quota_limit,a.used_today,
         (SELECT count(*) FROM available)
  INTO v_agent,v_agent_name,v_limit,v_used,v_count
  FROM available a CROSS JOIN previous prev
  ORDER BY CASE WHEN a.rn > prev.rn THEN 0 ELSE 1 END,a.rn
  LIMIT 1;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('assigned',false,'reason','daily_quota_reached_or_agent_unavailable');
  END IF;

  INSERT INTO public.flc_distribution_assignments(lead_id,agent_id,assigned_by)
  VALUES(v_lead.id,v_agent,NULL)
  RETURNING id INTO v_assign;

  -- Reserve the daily quota in the SAME transaction as the assignment.
  INSERT INTO public.flc_distribution_auto_quota_ledger
    (assignment_id,agent_id,campaign_code,quota_day)
  VALUES(v_assign,v_agent,v_lead.source_campaign,v_quota_day);

  UPDATE public.flc_distribution_leads
  SET status='assigned',updated_at=pg_catalog.now()
  WHERE id=v_lead.id;

  UPDATE public.flc_distribution_rr_cursor
  SET last_agent_id=v_agent,updated_at=pg_catalog.now()
  WHERE campaign_code=v_lead.source_campaign
    AND state_code=v_lead.lead_state;

  INSERT INTO public.flc_distribution_events
    (lead_id,agent_id,actor_id,event_type,details)
  VALUES(
    v_lead.id,v_agent,NULL,'round_robin_real_assigned',
    jsonb_build_object('assignment_id',v_assign,
      'campaign',v_lead.source_campaign,
      'state',v_lead.lead_state,
      'quota_day',v_quota_day,
      'quota_limit',v_limit,
      'used_before',v_used,
      'execution','pg_cron',
      'crm_write',false)
  );

  RETURN jsonb_build_object(
    'assigned',true,'lead_id',v_lead.id,
    'agent_id',v_agent,'agent_name',v_agent_name,
    'eligible_count',v_count,
    'quota_day',v_quota_day,'quota_limit',v_limit,
    'quota_used_after',v_used+1
  );
END;
$fn$;
REVOKE ALL ON FUNCTION flc_internal.distribute_one()
  FROM PUBLIC,anon,authenticated;
COMMIT;

-- Report effective eligibility dynamically to the agent UI only after 066.
CREATE OR REPLACE FUNCTION public.flc_distribution_my_self_presence()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_user uuid := auth.uid();v_wants boolean;v_verified boolean;v_last timestamptz;
BEGIN
 IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.agent_profiles p
      WHERE p.id=v_user AND p.role='agent') THEN
   RAISE EXCEPTION 'agent_only' USING ERRCODE='42501'; END IF;
 SELECT s.wants_leads,s.updated_at INTO v_wants,v_last
 FROM public.flc_distribution_agent_self_presence s WHERE s.agent_id=v_user;
 SELECT coalesce(av.is_verified,false) INTO v_verified
 FROM public.flc_distribution_agent_availability av WHERE av.agent_id=v_user;
 RETURN jsonb_build_object(
   'wants_leads',coalesce(v_wants,false),
   'admin_verified',coalesce(v_verified,false),
   'effective_receiving',coalesce(v_wants,false) AND coalesce(v_verified,false),
   'enforcement_status','active',
   'updated_at',v_last);
END;
$fn$;
CREATE OR REPLACE FUNCTION public.flc_distribution_set_my_self_presence(p_wants_leads boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_user uuid := auth.uid();v_verified boolean;
BEGIN
 IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.agent_profiles p
      WHERE p.id=v_user AND p.role='agent') THEN
   RAISE EXCEPTION 'agent_only' USING ERRCODE='42501'; END IF;
 IF p_wants_leads IS NULL THEN
   RAISE EXCEPTION 'invalid_wants_leads' USING ERRCODE='22023'; END IF;
 INSERT INTO public.flc_distribution_agent_self_presence(agent_id,wants_leads,updated_at)
 VALUES(v_user,p_wants_leads,now())
 ON CONFLICT(agent_id) DO UPDATE
 SET wants_leads=excluded.wants_leads,updated_at=excluded.updated_at;
 SELECT coalesce(av.is_verified,false) INTO v_verified
 FROM public.flc_distribution_agent_availability av WHERE av.agent_id=v_user;
 RETURN jsonb_build_object(
   'wants_leads',p_wants_leads,'admin_verified',coalesce(v_verified,false),
   'effective_receiving',p_wants_leads AND coalesce(v_verified,false),
   'enforcement_status','active'
 );
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_my_self_presence() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.flc_distribution_set_my_self_presence(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_my_self_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flc_distribution_set_my_self_presence(boolean) TO authenticated;
COMMIT;

-- READ ONLY validation after installing:
-- SELECT (pg_get_functiondef('flc_internal.distribute_one()'::regprocedure)
--         LIKE '%flc_distribution_agent_self_presence%') AS wired;
-- SELECT agent_id,wants_leads,updated_at FROM public.flc_distribution_agent_self_presence;
