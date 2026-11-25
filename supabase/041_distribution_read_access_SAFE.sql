-- FLC Academy MAIN: read-only views of distribution leads and history.
-- Run in fvhbzutxaoujtnnjzhlk only. No assignment or outbound messages.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_my_leads(p_limit integer DEFAULT 100)
RETURNS TABLE(
  lead_id uuid,
  contact_name text,
  external_lead_id text,
  source_campaign text,
  lead_state text,
  lifecycle_status text,
  assigned_agent_id uuid,
  assigned_agent_name text,
  phone text,
  email text,
  received_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
SELECT l.id,
  trim(concat_ws(' ', l.first_name, l.last_name)) AS contact_name,
  l.source_contact_id,
  l.source_campaign,
  l.lead_state,
  l.status,
  a.agent_id,
  p.full_name,
  l.phone,
  l.email,
  l.received_at
FROM public.flc_distribution_leads l
LEFT JOIN public.flc_distribution_assignments a
  ON a.lead_id=l.id AND a.ended_at IS NULL
LEFT JOIN public.agent_profiles p ON p.id=a.agent_id
WHERE auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.agent_profiles admin_p
      WHERE admin_p.id=auth.uid() AND admin_p.role='admin'
    )
    OR a.agent_id=auth.uid()
  )
ORDER BY l.received_at DESC
LIMIT least(greatest(coalesce(p_limit,100),1),200);
$fn$;

CREATE OR REPLACE FUNCTION public.flc_distribution_lead_timeline(
  p_lead_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  event_id uuid, event_type text, event_at timestamptz,
  actor_name text, details jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
SELECT e.id,e.event_type,e.created_at,
  COALESCE(p.full_name,'Sistema'),e.details
FROM public.flc_distribution_events e
LEFT JOIN public.agent_profiles p ON p.id=e.actor_id
WHERE e.lead_id=p_lead_id
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.agent_profiles ap
            WHERE ap.id=auth.uid() AND ap.role='admin')
    OR EXISTS (
      SELECT 1 FROM public.flc_distribution_assignments a
      WHERE a.lead_id=e.lead_id AND a.agent_id=auth.uid() AND a.ended_at IS NULL
    )
  )
ORDER BY e.created_at DESC
LIMIT least(greatest(coalesce(p_limit,100),1),200);
$fn$;

REVOKE ALL ON FUNCTION public.flc_distribution_my_leads(integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.flc_distribution_lead_timeline(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_my_leads(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flc_distribution_lead_timeline(uuid,integer) TO authenticated;
COMMIT;
SELECT proname
FROM pg_proc WHERE proname IN ('flc_distribution_my_leads','flc_distribution_lead_timeline')
ORDER BY proname;