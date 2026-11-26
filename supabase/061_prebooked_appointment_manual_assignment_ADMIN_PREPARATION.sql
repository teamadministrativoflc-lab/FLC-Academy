-- FLC Academy MAIN — ADMIN ONLY: prebooked AuraFlow appointment assignment.
-- PREPARATION ONLY: committing this SQL does NOT run it in Supabase.
-- A previously scheduled appointment must be verified by Administration.
-- Does NOT mark an agent active, change round-robin state, call CRM, or modify quotas.
BEGIN;

CREATE OR REPLACE FUNCTION public.flc_distribution_assign_prebooked_appointment(
  p_lead_id uuid, p_agent_id uuid, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_lead public.flc_distribution_leads%ROWTYPE;
  v_name text;
  v_assignment uuid;
  v_reason text := btrim(coalesce(p_reason,''));
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.agent_profiles p
    WHERE p.id = v_actor AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  IF p_lead_id IS NULL OR p_agent_id IS NULL THEN
    RAISE EXCEPTION 'missing_arguments' USING ERRCODE = '22023';
  END IF;
  IF length(v_reason) < 10 OR length(v_reason) > 500 THEN
    RAISE EXCEPTION 'appointment_reason_required_10_to_500_chars' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lead
  FROM public.flc_distribution_leads l
  WHERE l.id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found' USING ERRCODE = '22023'; END IF;

  IF lower(coalesce(v_lead.source_crm,'')) <> 'auraflow'
     OR v_lead.source_contact_id LIKE 'FLC-PRUEBA-%'
     OR v_lead.source_contact_id LIKE 'FLC-HISTORIAL-%'
     OR v_lead.source_campaign = 'FLC_TEST_INTEGRACION'
  THEN RAISE EXCEPTION 'real_auraflow_leads_only' USING ERRCODE = '22023'; END IF;

  IF v_lead.status <> 'pending'
     OR EXISTS(SELECT 1 FROM public.flc_distribution_assignments a
               WHERE a.lead_id = p_lead_id AND a.ended_at IS NULL)
  THEN RAISE EXCEPTION 'lead_not_pending_or_already_assigned' USING ERRCODE = '23505'; END IF;

  -- Permission and eligibility checks remain mandatory, even for an inactive agent.
  -- An authorized state entry is NOT proof of a currently valid insurance license;
  -- Administration must independently verify licensure before assignment.
  SELECT p.full_name INTO v_name
  FROM public.agent_profiles p
  JOIN public.flc_distribution_agent_campaigns ac
    ON ac.agent_id = p.id AND ac.campaign_code = v_lead.source_campaign AND ac.enabled
  JOIN public.flc_distribution_campaigns c
    ON c.code = ac.campaign_code AND c.enabled
  JOIN public.flc_distribution_agent_states st
    ON st.agent_id = p.id AND st.state_code = v_lead.lead_state
  WHERE p.id = p_agent_id AND p.role = 'agent';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent_campaign_or_state_not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.flc_distribution_assignments(lead_id,agent_id,assigned_by)
  VALUES (p_lead_id,p_agent_id,v_actor)
  RETURNING id INTO v_assignment;

  UPDATE public.flc_distribution_leads
  SET status = 'assigned',updated_at = now()
  WHERE id = p_lead_id;

  INSERT INTO public.flc_distribution_events(lead_id,agent_id,actor_id,event_type,details)
  VALUES (
    p_lead_id,p_agent_id,v_actor,'prebooked_appointment_assigned_manual',
    jsonb_build_object(
      'assignment_id',v_assignment,
      'reason',v_reason,
      'manual_exception','prebooked_auraflow_appointment',
      'agent_availability_overridden',true,
      'crm_write',false
    )
  );

  RETURN jsonb_build_object(
    'assigned',true,'agent_id',p_agent_id,'agent_name',v_name,
    'assignment_id',v_assignment,'agent_activated',false,'crm_write',false
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.flc_distribution_assign_prebooked_appointment(uuid,uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_assign_prebooked_appointment(uuid,uuid,text)
  TO authenticated;
COMMIT;

-- READ ONLY post-install verification:
-- SELECT proname, prosecdef FROM pg_proc
-- WHERE oid = 'public.flc_distribution_assign_prebooked_appointment(uuid,uuid,text)'::regprocedure;
