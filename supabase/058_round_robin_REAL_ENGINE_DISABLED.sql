-- 058 · Real-lead Round Robin ENGINE, OFF BY DEFAULT.
-- Installation NEVER distributes, activates or modifies existing leads.
-- Before live use: Zoom availability integration, supervised tests, separate enable decision.
BEGIN;
CREATE TABLE IF NOT EXISTS public.flc_distribution_automation_control(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 enabled_by uuid REFERENCES auth.users(id)
);
REVOKE ALL ON public.flc_distribution_automation_control FROM PUBLIC,anon,authenticated;
ALTER TABLE public.flc_distribution_automation_control ENABLE ROW LEVEL SECURITY;
INSERT INTO public.flc_distribution_automation_control(id,enabled)
 VALUES(true,false) ON CONFLICT(id) DO NOTHING;

-- Checks eligibility at assignment time and advances campaign/state cursor
-- in the SAME transaction. Does not touch AuraFlow.
CREATE OR REPLACE FUNCTION public.flc_distribution_round_robin_real_step()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_lead public.flc_distribution_leads%ROWTYPE;
 v_last uuid;v_agent uuid;v_agent_name text;
 v_assign uuid;v_count bigint;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.agent_profiles p WHERE p.id=v_actor AND p.role='admin'
 ) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.flc_distribution_automation_control ctl
  WHERE ctl.id=true AND ctl.enabled=true)
 THEN RETURN jsonb_build_object('assigned',false,'reason','automation_disabled');END IF;

 -- Stable oldest eligible source contact first. No synthetic leads.
 -- Skip locked rows to avoid double assignment across workers.
 SELECT l.* INTO v_lead
 FROM public.flc_distribution_leads l
 JOIN public.flc_distribution_campaigns c ON c.code=l.source_campaign AND c.enabled
 WHERE l.status='pending' AND lower(l.source_crm)='auraflow'
   AND l.source_contact_id NOT LIKE 'FLC-PRUEBA-%'
   AND l.source_contact_id NOT LIKE 'FLC-HISTORIAL-%'
   AND l.source_campaign<>'FLC_TEST_INTEGRACION'
   AND l.lead_state IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.flc_distribution_assignments a
     WHERE a.lead_id=l.id AND a.ended_at IS NULL)
   AND EXISTS(
     SELECT 1 FROM public.agent_profiles p
     JOIN public.flc_distribution_agent_availability av ON av.agent_id=p.id AND av.is_verified
     JOIN public.flc_distribution_agent_campaigns ac ON ac.agent_id=p.id
        AND ac.enabled AND ac.campaign_code=l.source_campaign
     JOIN public.flc_distribution_agent_states st ON st.agent_id=p.id AND st.state_code=l.lead_state
     WHERE p.role='agent'
   )
 ORDER BY l.received_at,l.id FOR UPDATE OF l SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('assigned',false,'reason','no_eligible_pending_lead');
 END IF;

 INSERT INTO public.flc_distribution_rr_cursor(campaign_code,state_code)
 VALUES(v_lead.source_campaign,v_lead.lead_state)
 ON CONFLICT(campaign_code,state_code) DO NOTHING;
 SELECT rr.last_agent_id INTO v_last FROM public.flc_distribution_rr_cursor rr
 WHERE rr.campaign_code=v_lead.source_campaign AND rr.state_code=v_lead.lead_state
 FOR UPDATE;

 WITH eligible AS(
  SELECT p.id,p.full_name,
    row_number() OVER(ORDER BY p.full_name,p.id) AS rn
  FROM public.agent_profiles p
  JOIN public.flc_distribution_agent_availability av ON av.agent_id=p.id AND av.is_verified
  JOIN public.flc_distribution_agent_campaigns ac ON ac.agent_id=p.id
    AND ac.enabled AND ac.campaign_code=v_lead.source_campaign
  JOIN public.flc_distribution_agent_states st ON st.agent_id=p.id AND st.state_code=v_lead.lead_state
  WHERE p.role='agent'
 ), previous AS (
  SELECT COALESCE((SELECT rn FROM eligible WHERE id=v_last),0) AS rn
 )
 SELECT q.id,q.full_name,(SELECT count(*) FROM eligible)
 INTO v_agent,v_agent_name,v_count
 FROM eligible q CROSS JOIN previous prev
 ORDER BY CASE WHEN q.rn>prev.rn THEN 0 ELSE 1 END,q.rn
 LIMIT 1;
 IF v_agent IS NULL THEN
  RETURN jsonb_build_object('assigned',false,'reason','no_available_agent');
 END IF;
 INSERT INTO public.flc_distribution_assignments(lead_id,agent_id,assigned_by)
 VALUES(v_lead.id,v_agent,v_actor) RETURNING id INTO v_assign;
 UPDATE public.flc_distribution_leads SET status='assigned',updated_at=now()
 WHERE id=v_lead.id;
 UPDATE public.flc_distribution_rr_cursor
 SET last_agent_id=v_agent,updated_at=now()
 WHERE campaign_code=v_lead.source_campaign AND state_code=v_lead.lead_state;
 INSERT INTO public.flc_distribution_events(lead_id,agent_id,actor_id,event_type,details)
 VALUES(v_lead.id,v_agent,v_actor,'round_robin_real_assigned',
 jsonb_build_object('assignment_id',v_assign,'campaign',v_lead.source_campaign,
 'state',v_lead.lead_state,'crm_write',false));
 RETURN jsonb_build_object('assigned',true,'lead_id',v_lead.id,
   'agent_id',v_agent,'agent_name',v_agent_name,'eligible_count',v_count);
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_round_robin_real_step() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_round_robin_real_step() TO authenticated;
COMMIT;
SELECT enabled FROM public.flc_distribution_automation_control WHERE id=true;