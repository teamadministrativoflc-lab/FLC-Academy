-- FLC Lead Distribution Center — transaction-safe pilot engine (DRAFT ONLY)
-- Depends on 007, 038, 039, 040. Run only on staging after security review.
-- Uses real activity evidence (not mere assignment) to prohibit returning a lead
-- to an agent who previously WORKED it. No Google Sheets operational dependency.
-- This pilot deliberately does NOT automate call dialing or CRM synchronization.

CREATE TABLE IF NOT EXISTS public.flc_lead_campaign_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_leader_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 campaign_name text NOT NULL CHECK(length(trim(campaign_name))>0),
 assignment_batch_size integer CHECK(assignment_batch_size IS NULL OR assignment_batch_size>=0),
 max_active_per_agent integer CHECK(max_active_per_agent IS NULL OR max_active_per_agent>0),
 reassignment_after_days integer CHECK(reassignment_after_days IS NULL OR reassignment_after_days>=0),
 management_window_days integer CHECK(management_window_days IS NULL OR management_window_days>=0),
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_leader_id,campaign_name)
);
CREATE TABLE IF NOT EXISTS public.flc_lead_campaign_agents (
 campaign_rule_id uuid NOT NULL REFERENCES public.flc_lead_campaign_rules(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 excluded_states text[] NOT NULL DEFAULT ARRAY[]::text[],
 enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(campaign_rule_id,agent_id),
 CHECK(array_position(excluded_states,NULL) IS NULL)
);
CREATE INDEX IF NOT EXISTS flc_lead_campaign_agents_agent_idx
 ON public.flc_lead_campaign_agents(agent_id);
ALTER TABLE public.flc_lead_campaign_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_lead_campaign_agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_lead_campaign_rules,public.flc_lead_campaign_agents
 FROM PUBLIC,anon,authenticated;

-- Validate the agent is in the leader's actual team, including subleaders.
CREATE OR REPLACE FUNCTION public.flc_agent_in_owner_team(p_owner uuid,p_agent uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $
 WITH RECURSIVE members(id,path) AS (
  SELECT p_owner,ARRAY[p_owner]::uuid[]
  UNION ALL
  SELECT a.agent_id,m.path||a.agent_id
  FROM public.flc_team_assignments a JOIN members m ON a.leader_id=m.id
  WHERE NOT a.agent_id=ANY(m.path)
 )
 SELECT EXISTS(SELECT 1 FROM members WHERE id=p_agent);
$;
REVOKE ALL ON FUNCTION public.flc_agent_in_owner_team(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_agent_in_owner_team(uuid,uuid) TO authenticated;

-- One transaction + lead row lock + campaign advisory lock ensures concurrent
-- workers cannot both assign the same lead or overfill a campaign's agent cap.
-- NULL cap: intentionally unlimited; "Lead por Periodo" is a distinct concept.
CREATE OR REPLACE FUNCTION public.flc_assign_lead(
 p_lead_id uuid,
 p_agent_id uuid DEFAULT NULL,
 p_reason text DEFAULT 'initial'
) RETURNS TABLE(outcome text,assigned_agent_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_lead public.flc_leads%ROWTYPE;
 v_rule public.flc_lead_campaign_rules%ROWTYPE;
 v_agent uuid;
 v_old_agent uuid;
 v_active_count integer;
 v_permission boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_reason NOT IN ('initial','reassignment','recycle','manual','migration') THEN
  RAISE EXCEPTION 'Invalid assignment reason';
 END IF;

 SELECT * INTO v_lead FROM public.flc_leads WHERE id=p_lead_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
 v_permission := public.flc_is_admin() OR v_lead.owner_leader_id=auth.uid();
 IF NOT v_permission THEN RAISE EXCEPTION 'Not authorized for this lead' USING ERRCODE='42501'; END IF;
 IF v_lead.lifecycle_status IN ('sold','archived') THEN
  RAISE EXCEPTION 'Closed lead cannot be assigned';
 END IF;

 SELECT * INTO v_rule
 FROM public.flc_lead_campaign_rules r
 WHERE r.owner_leader_id=v_lead.owner_leader_id
   AND r.campaign_name=v_lead.source_campaign AND r.enabled=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign rules are not enabled for this lead'; END IF;
 -- Serialize assignments against same rule across different leads.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_rule.id::text,0));

 SELECT a.agent_id INTO v_old_agent
 FROM public.flc_lead_assignments a
 WHERE a.lead_id=p_lead_id AND a.released_at IS NULL
 FOR UPDATE;
 IF v_old_agent IS NOT NULL AND p_reason='initial' THEN
  RETURN QUERY SELECT 'already_assigned'::text,v_old_agent;
  RETURN;
 END IF;

 IF p_agent_id IS NOT NULL THEN
  SELECT ca.agent_id INTO v_agent
  FROM public.flc_lead_campaign_agents ca
  WHERE ca.campaign_rule_id=v_rule.id AND ca.agent_id=p_agent_id
    AND ca.enabled
    AND EXISTS (
      SELECT 1 FROM public.flc_lead_agent_presence pr
      WHERE pr.agent_id=ca.agent_id AND pr.is_available=true
        AND pr.lease_expires_at > clock_timestamp()
        AND public.flc_zoom_presence_verified(ca.agent_id,v_lead.owner_leader_id)
    )
    AND public.flc_agent_in_owner_team(v_lead.owner_leader_id,ca.agent_id)
    AND (v_lead.state_code IS NULL OR
         NOT (v_lead.state_code=ANY(ca.excluded_states)))
    AND NOT EXISTS (
      SELECT 1 FROM public.flc_lead_agent_work_history wh
      WHERE wh.lead_id=p_lead_id AND wh.agent_id=ca.agent_id
    );
  IF v_agent IS NULL THEN
   RAISE EXCEPTION 'Agent ineligible: campaign, state or worked history';
  END IF;
 ELSE
  SELECT ca.agent_id INTO v_agent
  FROM public.flc_lead_campaign_agents ca
  WHERE ca.campaign_rule_id=v_rule.id AND ca.enabled
    AND EXISTS (
      SELECT 1 FROM public.flc_lead_agent_presence pr
      WHERE pr.agent_id=ca.agent_id AND pr.is_available=true
        AND pr.lease_expires_at > clock_timestamp()
        AND public.flc_zoom_presence_verified(ca.agent_id,v_lead.owner_leader_id)
    )
    AND public.flc_agent_in_owner_team(v_lead.owner_leader_id,ca.agent_id)
    AND ca.agent_id IS DISTINCT FROM v_old_agent
    AND (v_lead.state_code IS NULL OR NOT (v_lead.state_code=ANY(ca.excluded_states)))
    AND NOT EXISTS (
      SELECT 1 FROM public.flc_lead_agent_work_history wh
      WHERE wh.lead_id=p_lead_id AND wh.agent_id=ca.agent_id
    )
    AND (v_rule.max_active_per_agent IS NULL OR
       (SELECT count(*) FROM public.flc_lead_assignments aa
        JOIN public.flc_leads ll ON ll.id=aa.lead_id
        WHERE aa.agent_id=ca.agent_id AND aa.released_at IS NULL
          AND ll.owner_leader_id=v_rule.owner_leader_id
          AND ll.source_campaign=v_rule.campaign_name) < v_rule.max_active_per_agent)
  ORDER BY
    (SELECT count(*) FROM public.flc_lead_assignments aa
     JOIN public.flc_leads ll ON ll.id=aa.lead_id
     WHERE aa.agent_id=ca.agent_id AND aa.released_at IS NULL
       AND ll.owner_leader_id=v_rule.owner_leader_id
       AND ll.source_campaign=v_rule.campaign_name),
    (SELECT max(aa.assigned_at) FROM public.flc_lead_assignments aa
     WHERE aa.agent_id=ca.agent_id) NULLS FIRST,
    ca.agent_id
  LIMIT 1;
 END IF;

 -- Recheck app lease AND verified Zoom presence immediately before handoff.
 IF v_agent IS NOT NULL THEN
   PERFORM 1 FROM public.flc_lead_agent_presence pr
   WHERE pr.agent_id=v_agent AND pr.is_available=true
     AND pr.lease_expires_at>clock_timestamp()
     AND public.flc_zoom_presence_verified(v_agent,v_lead.owner_leader_id)
   FOR UPDATE;
   IF NOT FOUND THEN
      RAISE EXCEPTION 'Agent is not connected, Disponible and verified in authorized Zoom';
   END IF;
 END IF;

 -- Explicit assignments are also subject to cap; do not allow manual bypass.
 IF v_agent IS NOT NULL AND v_rule.max_active_per_agent IS NOT NULL THEN
  SELECT count(*) INTO v_active_count
  FROM public.flc_lead_assignments aa
  JOIN public.flc_leads ll ON ll.id=aa.lead_id
  WHERE aa.agent_id=v_agent AND aa.released_at IS NULL
    AND ll.owner_leader_id=v_rule.owner_leader_id
    AND ll.source_campaign=v_rule.campaign_name
    AND aa.lead_id<>p_lead_id;
  IF v_active_count>=v_rule.max_active_per_agent THEN
   RAISE EXCEPTION 'Agent is at campaign capacity';
  END IF;
 END IF;

 IF v_agent IS NULL THEN
  -- No eligible alternative: release current assignment and queue for admin.
  IF v_old_agent IS NOT NULL THEN
   UPDATE public.flc_lead_assignments
      SET released_at=clock_timestamp()
    WHERE lead_id=p_lead_id AND released_at IS NULL;
   INSERT INTO public.flc_lead_events(lead_id,event_type,actor_agent_id,source_system,details)
   VALUES(p_lead_id,'released',auth.uid(),'flc',jsonb_build_object('prior_agent_id',v_old_agent,'reason','no_eligible_agent'));
  END IF;
  UPDATE public.flc_leads SET lifecycle_status='recycle_pending',updated_at=now() WHERE id=p_lead_id;
  INSERT INTO public.flc_lead_events(lead_id,event_type,actor_agent_id,source_system,details)
  VALUES(p_lead_id,'recycle_eligible',auth.uid(),'flc',jsonb_build_object('reason','no_eligible_agent'));
  RETURN QUERY SELECT 'pending_no_eligible_agent'::text,NULL::uuid;
  RETURN;
 END IF;

 IF v_agent=v_old_agent THEN
  RETURN QUERY SELECT 'already_assigned'::text,v_old_agent;
  RETURN;
 END IF;

 IF v_old_agent IS NOT NULL THEN
  UPDATE public.flc_lead_assignments SET released_at=clock_timestamp()
   WHERE lead_id=p_lead_id AND released_at IS NULL;
  INSERT INTO public.flc_lead_events(lead_id,event_type,actor_agent_id,source_system,details)
   VALUES(p_lead_id,'released',auth.uid(),'flc',jsonb_build_object('prior_agent_id',v_old_agent,'reason',p_reason));
 END IF;

 INSERT INTO public.flc_lead_assignments(lead_id,agent_id,reason)
 VALUES(p_lead_id,v_agent,p_reason);
 UPDATE public.flc_leads SET lifecycle_status='assigned',updated_at=now() WHERE id=p_lead_id;
 INSERT INTO public.flc_lead_events(lead_id,event_type,actor_agent_id,source_system,details)
 VALUES(p_lead_id,'assigned',auth.uid(),'flc',
  jsonb_build_object('agent_id',v_agent,'prior_agent_id',v_old_agent,'reason',p_reason));
 RETURN QUERY SELECT 'assigned'::text,v_agent;
END;$$;
REVOKE ALL ON FUNCTION public.flc_assign_lead(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_assign_lead(uuid,uuid,text) TO authenticated;

-- Agent activity is the source of truth for "worked". This RPC may be called only
-- by the current assignee; a leader/admin may assign but cannot forge agent activity.
CREATE OR REPLACE FUNCTION public.flc_log_lead_activity(
 p_lead_id uuid,
 p_event_type text,
 p_details jsonb DEFAULT '{}'::jsonb,
 p_idempotency_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event_id uuid;v_source text := 'academy_activity';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_event_type NOT IN ('call_attempt','note_added','appointment_set','status_changed') THEN
  RAISE EXCEPTION 'Invalid activity type';
 END IF;
 IF jsonb_typeof(p_details) <> 'object' OR length(p_details::text)>4000 THEN
  RAISE EXCEPTION 'Activity details must be an object smaller than 4000 characters';
 END IF;
 PERFORM 1 FROM public.flc_leads l WHERE l.id=p_lead_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.flc_lead_assignments a
  WHERE a.lead_id=p_lead_id AND a.agent_id=auth.uid() AND a.released_at IS NULL) THEN
  RAISE EXCEPTION 'Only current assigned agent can record work' USING ERRCODE='42501';
 END IF;
 IF p_idempotency_key IS NOT NULL THEN
  SELECT id INTO v_event_id FROM public.flc_lead_events
  WHERE source_system=v_source AND external_event_id=p_idempotency_key;
  IF v_event_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.flc_lead_events e
                 WHERE e.id=v_event_id AND e.lead_id=p_lead_id AND e.actor_agent_id=auth.uid()) THEN
     RAISE EXCEPTION 'Idempotency key belongs to another event';
   END IF;
   RETURN v_event_id;
  END IF;
 END IF;
 INSERT INTO public.flc_lead_events(lead_id,event_type,actor_agent_id,source_system,details,external_event_id)
 VALUES(p_lead_id,p_event_type,auth.uid(),v_source,p_details,p_idempotency_key)
 RETURNING id INTO v_event_id;
 INSERT INTO public.flc_lead_agent_work_history(lead_id,agent_id,first_event_id)
 VALUES(p_lead_id,auth.uid(),v_event_id)
 ON CONFLICT(lead_id,agent_id) DO NOTHING;
 UPDATE public.flc_leads SET lifecycle_status=CASE WHEN p_event_type='appointment_set' THEN 'appointment'
 ELSE 'working' END,updated_at=now() WHERE id=p_lead_id;
 RETURN v_event_id;
END;$$;
REVOKE ALL ON FUNCTION public.flc_log_lead_activity(uuid,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_log_lead_activity(uuid,text,jsonb,text) TO authenticated;

-- The blocker also applies to future alternative write paths (service users,
-- CRM webhooks, admin tools) unless an authorized migration explicitly bypasses
-- it. RLS alone is not sufficient to enforce this business rule.
CREATE OR REPLACE FUNCTION public.flc_block_worked_agent_reassignment()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.flc_lead_agent_work_history w
  WHERE w.lead_id=NEW.lead_id AND w.agent_id=NEW.agent_id) THEN
  RAISE EXCEPTION 'Lead cannot return to an agent who worked it';
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS flc_block_worked_agent_reassignment_trigger ON public.flc_lead_assignments;
CREATE TRIGGER flc_block_worked_agent_reassignment_trigger
BEFORE INSERT OR UPDATE OF agent_id,lead_id ON public.flc_lead_assignments
FOR EACH ROW EXECUTE FUNCTION public.flc_block_worked_agent_reassignment();

-- Final production requirement: every import/integration must use the SAME
-- transactional service, and agent membership/opt-in must be verified.
-- Pending: campaign configuration APIs, expiration worker, GHL webhooks,
-- timezone-based local_date snapshot and migration/backfill from prior Sheets.
