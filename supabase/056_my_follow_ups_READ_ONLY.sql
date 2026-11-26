-- 056 · Secure read-only upcoming follow-ups for currently assigned agent.
-- No assignments, outbound sync, or changes to existing records.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_my_follow_ups(p_limit integer DEFAULT 100)
RETURNS TABLE (
 event_id uuid,lead_id uuid,contact_name text,source_campaign text,
 due_at timestamptz,activity_type text,note text,created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT e.id,e.lead_id,
 btrim(concat_ws(' ',l.first_name,l.last_name))::text,
 l.source_campaign,
 (e.details->>'follow_up_at')::timestamptz,
 e.event_type,e.details->>'note',e.created_at
 FROM public.flc_distribution_events e
 JOIN public.flc_distribution_leads l ON l.id=e.lead_id
 JOIN public.flc_distribution_assignments a
   ON a.lead_id=e.lead_id AND a.ended_at IS NULL AND a.agent_id=auth.uid()
 WHERE auth.uid() IS NOT NULL
   AND e.event_type IN ('agent_follow_up_logged','agent_appointment_logged')
   AND e.details->>'follow_up_at' IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.flc_distribution_events void_event
     WHERE void_event.lead_id=e.lead_id
       AND void_event.event_type='agent_activity_voided'
       AND void_event.details->>'voided_event_id'=e.id::text
   )
 ORDER BY (e.details->>'follow_up_at')::timestamptz ASC,e.created_at DESC
 LIMIT least(greatest(coalesce(p_limit,100),1),200);
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_my_follow_ups(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_my_follow_ups(integer) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname='flc_distribution_my_follow_ups';