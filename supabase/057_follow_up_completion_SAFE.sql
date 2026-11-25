-- 057 · Completed follow-ups, audited and scoped to current assigned agent.
-- Installing does not complete any task or change existing data.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_complete_follow_up(
  p_lead_id uuid,p_event_id uuid,p_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_source public.flc_distribution_events%ROWTYPE;
 v_event_id uuid;
 v_note text:=nullif(btrim(coalesce(p_note,'')),'');
BEGIN
 IF v_actor IS NULL OR p_lead_id IS NULL OR p_event_id IS NULL THEN
  RAISE EXCEPTION 'Missing session, lead or follow-up' USING ERRCODE='22023'; END IF;
 IF length(coalesce(v_note,''))>1000 THEN
  RAISE EXCEPTION 'Completion note too long' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.flc_distribution_assignments a
   JOIN public.agent_profiles p ON p.id=a.agent_id
   WHERE a.lead_id=p_lead_id AND a.agent_id=v_actor AND a.ended_at IS NULL AND p.role='agent'
 ) THEN RAISE EXCEPTION 'Lead not assigned to your account' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.flc_distribution_leads l WHERE l.id=p_lead_id FOR UPDATE;
 SELECT * INTO v_source FROM public.flc_distribution_events e
 WHERE e.id=p_event_id AND e.lead_id=p_lead_id AND e.actor_id=v_actor
 AND e.event_type IN('agent_follow_up_logged','agent_appointment_logged');
 IF NOT FOUND THEN RAISE EXCEPTION 'Follow-up does not belong to current agent' USING ERRCODE='42501';END IF;
 IF EXISTS (SELECT 1 FROM public.flc_distribution_events e
  WHERE e.lead_id=p_lead_id AND e.event_type='agent_activity_voided'
    AND e.details->>'voided_event_id'=p_event_id::text)
 THEN RAISE EXCEPTION 'Follow-up was voided';END IF;
 IF EXISTS (SELECT 1 FROM public.flc_distribution_events e
  WHERE e.lead_id=p_lead_id AND e.event_type='agent_follow_up_completed'
    AND e.details->>'completed_event_id'=p_event_id::text)
 THEN RAISE EXCEPTION 'Follow-up already completed';END IF;
 INSERT INTO public.flc_distribution_events (lead_id,agent_id,actor_id,event_type,details)
 VALUES (p_lead_id,v_actor,v_actor,'agent_follow_up_completed',
 jsonb_build_object('completed_event_id',p_event_id,'note',v_note,
 'completed_at',now(),'crm_synced',false))
 RETURNING id INTO v_event_id;
 RETURN jsonb_build_object('completed',true,'event_id',v_event_id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_complete_follow_up(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_complete_follow_up(uuid,uuid,text) TO authenticated;

-- Replace existing read-only list, preserving its signature and columns.
-- Completed and voided follow-ups are omitted from the pending queue.
CREATE OR REPLACE FUNCTION public.flc_distribution_my_follow_ups(p_limit integer DEFAULT 100)
RETURNS TABLE (
 event_id uuid,lead_id uuid,contact_name text,source_campaign text,
 due_at timestamptz,activity_type text,note text,created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT e.id,e.lead_id,
 btrim(concat_ws(' ',l.first_name,l.last_name))::text,
 l.source_campaign,(e.details->>'follow_up_at')::timestamptz,
 e.event_type,e.details->>'note',e.created_at
 FROM public.flc_distribution_events e
 JOIN public.flc_distribution_leads l ON l.id=e.lead_id
 JOIN public.flc_distribution_assignments a
   ON a.lead_id=e.lead_id AND a.ended_at IS NULL AND a.agent_id=auth.uid()
 WHERE auth.uid() IS NOT NULL
   AND e.event_type IN('agent_follow_up_logged','agent_appointment_logged')
   AND e.details->>'follow_up_at' IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.flc_distribution_events z WHERE z.lead_id=e.lead_id
     AND ((z.event_type='agent_activity_voided' AND z.details->>'voided_event_id'=e.id::text)
        OR (z.event_type='agent_follow_up_completed' AND z.details->>'completed_event_id'=e.id::text))
   )
 ORDER BY (e.details->>'follow_up_at')::timestamptz ASC,e.created_at DESC
 LIMIT least(greatest(coalesce(p_limit,100),1),200);
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_my_follow_ups(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_my_follow_ups(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_distribution_my_completed_follow_ups(p_limit integer DEFAULT 100)
RETURNS TABLE (
 event_id uuid,lead_id uuid,contact_name text,
 due_at timestamptz,completed_at timestamptz,completion_note text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT e.id,e.lead_id,btrim(concat_ws(' ',l.first_name,l.last_name))::text,
 (e.details->>'follow_up_at')::timestamptz,
 completed.created_at,
 completed.details->>'note'
 FROM public.flc_distribution_events completed
 JOIN public.flc_distribution_events e
  ON e.id=(completed.details->>'completed_event_id')::uuid
  AND e.lead_id=completed.lead_id
 JOIN public.flc_distribution_leads l ON l.id=e.lead_id
 JOIN public.flc_distribution_assignments a
  ON a.lead_id=e.lead_id AND a.agent_id=auth.uid() AND a.ended_at IS NULL
 WHERE auth.uid() IS NOT NULL
  AND completed.event_type='agent_follow_up_completed'
 ORDER BY completed.created_at DESC
 LIMIT least(greatest(coalesce(p_limit,100),1),200);
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_my_completed_follow_ups(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_my_completed_follow_ups(integer) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname IN
 ('flc_distribution_complete_follow_up','flc_distribution_my_follow_ups',
  'flc_distribution_my_completed_follow_ups') ORDER BY proname;