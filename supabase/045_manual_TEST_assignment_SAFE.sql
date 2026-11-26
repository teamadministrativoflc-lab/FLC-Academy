-- FLC Academy MAIN: MANUAL TEST ASSIGNMENT ONLY.
-- Installs a safe RPC. Does NOT assign anything merely by running this SQL.
-- Only admin + invented test contact + verified/authorized agent allowed.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_assign_test_lead(
  p_lead_id uuid,
  p_agent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_lead public.flc_distribution_leads%ROWTYPE;
  v_assigned uuid;
  v_assignment_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.agent_profiles p WHERE p.id=v_actor AND p.role='admin'
  ) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;

  IF p_lead_id IS NULL OR p_agent_id IS NULL THEN
    RAISE EXCEPTION 'missing_lead_or_agent' USING ERRCODE='22023';
  END IF;

  -- FOR UPDATE serializes concurrent requests on a single lead.
  SELECT * INTO v_lead FROM public.flc_distribution_leads
    WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found' USING ERRCODE='22023'; END IF;

  -- Fail closed: cannot ever assign a real lead via this test-only function.
  IF v_lead.source_crm <> 'auraflow'
    OR v_lead.source_contact_id NOT LIKE 'FLC-PRUEBA-%'
  THEN RAISE EXCEPTION 'only_synthetic_test_leads_allowed' USING ERRCODE='42501'; END IF;

  IF v_lead.status <> 'pending' THEN
    RAISE EXCEPTION 'test_lead_not_pending' USING ERRCODE='22023';
  END IF;

  SELECT a.agent_id INTO v_assigned
  FROM public.flc_distribution_assignments a
  WHERE a.lead_id=p_lead_id AND a.ended_at IS NULL;
  IF FOUND THEN
    RAISE EXCEPTION 'lead_already_assigned' USING ERRCODE='23505';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.agent_profiles p
    JOIN public.flc_distribution_agent_availability av ON av.agent_id=p.id
    JOIN public.flc_distribution_agent_campaigns ac
      ON ac.agent_id=p.id AND ac.campaign_code=v_lead.source_campaign AND ac.enabled
    JOIN public.flc_distribution_campaigns camp
      ON camp.code=ac.campaign_code AND camp.enabled
    JOIN public.flc_distribution_agent_states st
      ON st.agent_id=p.id AND st.state_code=v_lead.lead_state
    WHERE p.id=p_agent_id AND p.role='agent'
      AND av.is_verified=true
  ) THEN RAISE EXCEPTION 'agent_not_eligible_or_not_verified' USING ERRCODE='42501'; END IF;

  INSERT INTO public.flc_distribution_assignments
    (lead_id,agent_id,assigned_by)
  VALUES (p_lead_id,p_agent_id,v_actor) RETURNING id INTO v_assignment_id;

  UPDATE public.flc_distribution_leads
  SET status='assigned', updated_at=now() WHERE id=p_lead_id;

  INSERT INTO public.flc_distribution_events (lead_id,agent_id,actor_id,event_type,details)
  VALUES (p_lead_id,p_agent_id,v_actor,'test_lead_assigned',
    jsonb_build_object('assignment_id',v_assignment_id,'manual_test',true));

  RETURN jsonb_build_object('assigned',true,'test_only',true,
    'lead_id',p_lead_id,'agent_id',p_agent_id,'assignment_id',v_assignment_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.flc_distribution_assign_test_lead(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_assign_test_lead(uuid,uuid) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname='flc_distribution_assign_test_lead';
