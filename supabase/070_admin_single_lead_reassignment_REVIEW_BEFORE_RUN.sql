-- REVIEW ONLY. Run in MAIN after admin reviews and verifies licensure.
-- Administrative one-lead reassignment does NOT enable an agent's campaign.
BEGIN;

CREATE OR REPLACE FUNCTION public.flc_distribution_reassign_one_admin(
 p_lead_id uuid, p_agent_id uuid, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_actor uuid := auth.uid();
 v_lead public.flc_distribution_leads%ROWTYPE;
 v_previous public.flc_distribution_assignments%ROWTYPE;
 v_new_id uuid;
 v_agent_name text;
 v_reason text := btrim(coalesce(p_reason,''));
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.agent_profiles
  WHERE id=v_actor AND role='admin'
 ) THEN RAISE EXCEPTION 'admin_only' USING ERRCODE='42501'; END IF;
 IF p_lead_id IS NULL OR p_agent_id IS NULL OR
    length(v_reason)<15 OR length(v_reason)>500
 THEN RAISE EXCEPTION 'lead_agent_and_reason_15_to_500_required' USING ERRCODE='22023'; END IF;

 SELECT * INTO v_lead FROM public.flc_distribution_leads
 WHERE id=p_lead_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found' USING ERRCODE='22023'; END IF;

 IF v_lead.status<>'assigned'
 OR lower(coalesce(v_lead.source_crm,'')) <> 'auraflow'
 OR v_lead.source_contact_id LIKE 'FLC-PRUEBA-%'
 OR v_lead.source_contact_id LIKE 'FLC-HISTORIAL-%'
 OR v_lead.source_campaign='FLC_TEST_INTEGRACION'
 OR nullif(btrim(coalesce(v_lead.lead_state,'')),'') IS NULL
 THEN RAISE EXCEPTION 'eligible_assigned_real_lead_required' USING ERRCODE='22023'; END IF;

 SELECT * INTO v_previous FROM public.flc_distribution_assignments
 WHERE lead_id=p_lead_id AND ended_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'active_assignment_not_found' USING ERRCODE='22023'; END IF;
 IF v_previous.agent_id=p_agent_id
 THEN RAISE EXCEPTION 'already_assigned_to_selected_agent' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.flc_distribution_assignments
     WHERE lead_id=p_lead_id AND ended_at IS NULL)<>1
 THEN RAISE EXCEPTION 'multiple_active_assignments' USING ERRCODE='23505'; END IF;

 -- Single-lead exception: state authorization mandatory, campaign opt-in NOT changed.
 -- The administrator must independently confirm the actual current insurance license.
 SELECT p.full_name INTO v_agent_name
 FROM public.agent_profiles p
 JOIN public.flc_distribution_agent_states st
  ON st.agent_id=p.id AND st.state_code=v_lead.lead_state
 WHERE p.id=p_agent_id AND p.role='agent';
 IF NOT FOUND THEN
  RAISE EXCEPTION 'agent_not_authorized_for_lead_state' USING ERRCODE='42501';
 END IF;

 UPDATE public.flc_distribution_assignments
 SET ended_at=now() WHERE id=v_previous.id AND ended_at IS NULL;

 INSERT INTO public.flc_distribution_assignments(lead_id,agent_id,assigned_by)
 VALUES(p_lead_id,p_agent_id,v_actor) RETURNING id INTO v_new_id;

 UPDATE public.flc_distribution_leads
 SET updated_at=now(),status='assigned' WHERE id=p_lead_id;

 INSERT INTO public.flc_distribution_events
 (lead_id,agent_id,actor_id,event_type,details)
 VALUES(p_lead_id,p_agent_id,v_actor,'admin_lead_reassigned',
 jsonb_build_object('from_agent_id',v_previous.agent_id,
 'to_agent_id',p_agent_id,'from_assignment_id',v_previous.id,
 'to_assignment_id',v_new_id,'reason',v_reason,
 'single_lead_campaign_exception',true,'crm_write',false));

 RETURN jsonb_build_object('reassigned',true,'lead_id',p_lead_id,
  'agent_id',p_agent_id,'agent_name',v_agent_name,'crm_write',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_reassign_one_admin(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_reassign_one_admin(uuid,uuid,text) TO authenticated;

-- Admin-only candidate list; campaign not required for a one-lead exception.
CREATE OR REPLACE FUNCTION public.flc_distribution_reassignment_candidates(p_lead_id uuid)
RETURNS TABLE(agent_id uuid,agent_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.agent_profiles WHERE id=auth.uid() AND role='admin'
 ) THEN RAISE EXCEPTION 'admin_only' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT p.id,p.full_name
 FROM public.flc_distribution_leads l
 JOIN public.flc_distribution_agent_states st ON st.state_code=l.lead_state
 JOIN public.agent_profiles p ON p.id=st.agent_id AND p.role='agent'
 WHERE l.id=p_lead_id AND l.status='assigned'
 AND NOT EXISTS(
  SELECT 1 FROM public.flc_distribution_assignments a
  WHERE a.lead_id=l.id AND a.agent_id=p.id AND a.ended_at IS NULL)
 ORDER BY p.full_name
 LIMIT 200;
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_reassignment_candidates(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_reassignment_candidates(uuid) TO authenticated;
COMMIT;

-- Does not transfer agent-entered activities, change lead source, sync CRM,
-- or alter campaign eligibility globally. Verify using an assigned lead in Preview first.
