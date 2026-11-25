-- 054 · Safe administrator manual assignment of REAL leads.
-- Installation does not assign leads; no automatic routing or outbound CRM updates.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_assign_real_lead_manual(p_lead_id uuid,p_agent_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();v_lead public.flc_distribution_leads%ROWTYPE;v_assignment uuid;v_name text;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.agent_profiles p WHERE p.id=v_actor AND p.role='admin')
 THEN RAISE EXCEPTION 'admin_only' USING ERRCODE='42501';END IF;
 IF p_lead_id IS NULL OR p_agent_id IS NULL THEN RAISE EXCEPTION 'missing_arguments'; END IF;
 SELECT * INTO v_lead FROM public.flc_distribution_leads l WHERE l.id=p_lead_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found';END IF;
 IF lower(coalesce(v_lead.source_crm,''))<>'auraflow'
 OR v_lead.source_contact_id LIKE 'FLC-PRUEBA-%'
 OR v_lead.source_contact_id LIKE 'FLC-HISTORIAL-%'
 OR v_lead.source_campaign='FLC_TEST_INTEGRACION'
 THEN RAISE EXCEPTION 'real_auraflow_leads_only';END IF;
 IF v_lead.status<>'pending' OR EXISTS(SELECT 1 FROM public.flc_distribution_assignments a
 WHERE a.lead_id=p_lead_id AND a.ended_at IS NULL)
 THEN RAISE EXCEPTION 'lead_not_pending_or_already_assigned';END IF;
 SELECT p.full_name INTO v_name FROM public.agent_profiles p
 JOIN public.flc_distribution_agent_availability av ON av.agent_id=p.id AND av.is_verified
 JOIN public.flc_distribution_agent_campaigns ac ON ac.agent_id=p.id
 AND ac.campaign_code=v_lead.source_campaign AND ac.enabled
 JOIN public.flc_distribution_campaigns c ON c.code=ac.campaign_code AND c.enabled
 JOIN public.flc_distribution_agent_states s ON s.agent_id=p.id AND s.state_code=v_lead.lead_state
 WHERE p.id=p_agent_id AND p.role='agent';
 IF NOT FOUND THEN RAISE EXCEPTION 'agent_not_active_or_ineligible' USING ERRCODE='42501';END IF;
 INSERT INTO public.flc_distribution_assignments(lead_id,agent_id,assigned_by)
 VALUES(p_lead_id,p_agent_id,v_actor) RETURNING id INTO v_assignment;
 UPDATE public.flc_distribution_leads SET status='assigned',updated_at=now() WHERE id=p_lead_id;
 INSERT INTO public.flc_distribution_events(lead_id,agent_id,actor_id,event_type,details)
 VALUES(p_lead_id,p_agent_id,v_actor,'real_lead_assigned_manual',
 jsonb_build_object('assignment_id',v_assignment,'crm_write',false));
 RETURN jsonb_build_object('assigned',true,'agent_id',p_agent_id,'agent_name',v_name);
END;$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_assign_real_lead_manual(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_assign_real_lead_manual(uuid,uuid) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname='flc_distribution_assign_real_lead_manual';