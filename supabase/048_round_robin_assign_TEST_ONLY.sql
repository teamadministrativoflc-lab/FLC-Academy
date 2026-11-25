-- FLC Academy MAIN: transactional Round Robin for SYNTHETIC TEST LEADS ONLY.
-- Installation does not assign any leads, activate agents or send messages.
-- Run SQL in main project fvhbzutxaoujtnnjzhlk after review.
BEGIN;

CREATE OR REPLACE FUNCTION public.flc_distribution_round_robin_assign_test(
  p_lead_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_lead public.flc_distribution_leads%ROWTYPE;
  v_last_agent uuid;
  v_agent uuid;
  v_agent_name text;
  v_eligible_count bigint := 0;
  v_assignment uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.agent_profiles ap WHERE ap.id=v_actor AND ap.role='admin'
  ) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;

  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'lead_id_required' USING ERRCODE='22023';
  END IF;

  -- Row lock makes repeated submissions idempotently fail closed.
  SELECT * INTO v_lead FROM public.flc_distribution_leads l
  WHERE l.id=p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found' USING ERRCODE='22023'; END IF;

  -- Never assign a real lead with this function.
  IF v_lead.source_crm <> 'auraflow'
     OR v_lead.source_contact_id NOT LIKE 'FLC-PRUEBA-%'
     OR v_lead.source_contact_id IS NULL THEN
    RAISE EXCEPTION 'only_synthetic_test_leads_allowed' USING ERRCODE='42501';
  END IF;
  IF v_lead.status <> 'pending' THEN
    RETURN jsonb_build_object('assigned',false,'reason','not_pending','test_only',true);
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.flc_distribution_assignments a
    WHERE a.lead_id=p_lead_id AND a.ended_at IS NULL
  ) THEN
    RETURN jsonb_build_object('assigned',false,'reason','already_assigned','test_only',true);
  END IF;
  IF v_lead.lead_state IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.flc_distribution_campaigns c
    WHERE c.code=v_lead.source_campaign AND c.enabled
  ) THEN
    RETURN jsonb_build_object('assigned',false,'reason','invalid_campaign_or_state','test_only',true);
  END IF;

  -- Serialize Round Robin per campaign+state. Cursor advances ONLY
  -- after the assignment transaction succeeds.
  INSERT INTO public.flc_distribution_rr_cursor(campaign_code,state_code)
  VALUES(v_lead.source_campaign,v_lead.lead_state)
  ON CONFLICT(campaign_code,state_code) DO NOTHING;
  SELECT rr.last_agent_id INTO v_last_agent
  FROM public.flc_distribution_rr_cursor rr
  WHERE rr.campaign_code=v_lead.source_campaign AND rr.state_code=v_lead.lead_state
  FOR UPDATE;

  -- Calculate stable alphabetical turns among agents eligible NOW.
  WITH eligible AS (
    SELECT p.id,p.full_name,
           row_number() OVER(ORDER BY p.full_name,p.id) AS turn_num
    FROM public.agent_profiles p
    JOIN public.flc_distribution_agent_availability av
      ON av.agent_id=p.id AND av.is_verified=true
    JOIN public.flc_distribution_agent_campaigns ac
      ON ac.agent_id=p.id AND ac.campaign_code=v_lead.source_campaign AND ac.enabled
    JOIN public.flc_distribution_agent_states st
      ON st.agent_id=p.id AND st.state_code=v_lead.lead_state
    WHERE p.role='agent'
  ),
  previous AS (
    SELECT coalesce((SELECT e.turn_num FROM eligible e WHERE e.id=v_last_agent),0) AS last_turn
  )
  SELECT e.id,e.full_name,
         (SELECT count(*) FROM eligible)
  INTO v_agent,v_agent_name,v_eligible_count
  FROM eligible e CROSS JOIN previous prev
  ORDER BY CASE WHEN e.turn_num>prev.last_turn THEN 0 ELSE 1 END,e.turn_num
  LIMIT 1;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('assigned',false,'reason','hold_no_available_agent',
                              'eligible_count',0,'test_only',true);
  END IF;

  INSERT INTO public.flc_distribution_assignments(lead_id,agent_id,assigned_by)
  VALUES (p_lead_id,v_agent,v_actor)
  RETURNING id INTO v_assignment;

  UPDATE public.flc_distribution_leads
  SET status='assigned',updated_at=now()
  WHERE id=p_lead_id;

  UPDATE public.flc_distribution_rr_cursor
  SET last_agent_id=v_agent,updated_at=now()
  WHERE campaign_code=v_lead.source_campaign AND state_code=v_lead.lead_state;

  INSERT INTO public.flc_distribution_events
     (lead_id,agent_id,actor_id,event_type,details)
  VALUES (p_lead_id,v_agent,v_actor,'round_robin_test_assigned',
      jsonb_build_object('test_only',true,'assignment_id',v_assignment,
                         'campaign',v_lead.source_campaign,'state',v_lead.lead_state));

  RETURN jsonb_build_object('assigned',true,'test_only',true,'lead_id',p_lead_id,
                            'agent_id',v_agent,'agent_name',v_agent_name,
                            'eligible_count',v_eligible_count,
                            'assignment_id',v_assignment);
END;
$fn$;

REVOKE ALL ON FUNCTION public.flc_distribution_round_robin_assign_test(uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_round_robin_assign_test(uuid)
TO authenticated;
COMMIT;

SELECT proname FROM pg_proc WHERE proname='flc_distribution_round_robin_assign_test';
