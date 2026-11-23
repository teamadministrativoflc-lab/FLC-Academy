-- Phase 2: READ-ONLY secure lead list / immutable timeline access for Academy.
-- Requires 038 and 039 migrations. No direct client table grants.
-- REVIEW AND STAGING TEST before execution in production.
-- Visibility: admin, owning leader and upline of owning leader, current assigned agent.
CREATE OR REPLACE FUNCTION public.flc_can_view_lead(p_lead_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH RECURSIVE ancestors(agent_id,trail) AS (
   SELECT l.owner_leader_id,ARRAY[l.owner_leader_id]::uuid[]
   FROM public.flc_leads l WHERE l.id=p_lead_id
   UNION ALL
   SELECT ta.leader_id,a.trail||ta.leader_id
   FROM ancestors a JOIN public.flc_team_assignments ta ON ta.agent_id=a.agent_id
   WHERE NOT ta.leader_id=ANY(a.trail)
 )
 SELECT auth.uid() IS NOT NULL AND (
  public.flc_is_admin()
  OR EXISTS(SELECT 1 FROM ancestors a WHERE a.agent_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.flc_lead_assignments la
    WHERE la.lead_id=p_lead_id AND la.agent_id=auth.uid() AND la.released_at IS NULL)
 );
$$;
REVOKE ALL ON FUNCTION public.flc_can_view_lead(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_can_view_lead(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_my_leads(p_limit integer DEFAULT 100)
RETURNS TABLE(
 lead_id uuid,external_lead_id text,source_campaign text,source_provider text,
 state_code text,timezone_label text,timezone_status text,
 contact_name text,contact_phone text,contact_email text,
 lifecycle_status text,created_at timestamptz,assigned_agent_id uuid,
 assigned_agent_name text,assigned_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT l.id,l.external_lead_id,l.source_campaign,l.source_provider,
 l.state_code,l.timezone_label,l.timezone_status,
   l.contact_name,l.contact_phone,l.contact_email,l.lifecycle_status,l.created_at,
   a.agent_id,p.full_name::text,a.assigned_at
 FROM public.flc_leads l
 LEFT JOIN LATERAL (
   SELECT la.agent_id,la.assigned_at FROM public.flc_lead_assignments la
   WHERE la.lead_id=l.id AND la.released_at IS NULL LIMIT 1
 ) a ON TRUE
 LEFT JOIN public.agent_profiles p ON p.id=a.agent_id
 WHERE public.flc_can_view_lead(l.id)
 ORDER BY l.created_at DESC,l.id
 LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200);
$$;
REVOKE ALL ON FUNCTION public.flc_my_leads(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_my_leads(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_lead_timeline(p_lead_id uuid,p_limit integer DEFAULT 100)
RETURNS TABLE(event_id uuid,event_type text,event_at timestamptz,
 actor_agent_id uuid,actor_name text,source_system text,details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NOT public.flc_can_view_lead(p_lead_id) THEN
  RAISE EXCEPTION 'Lead not accessible' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT e.id,e.event_type,e.event_at,e.actor_agent_id,
  p.full_name::text,e.source_system,e.details
 FROM public.flc_lead_events e LEFT JOIN public.agent_profiles p ON p.id=e.actor_agent_id
 WHERE e.lead_id=p_lead_id
 ORDER BY e.event_at DESC,e.id
 LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),200);
END;
$$;
REVOKE ALL ON FUNCTION public.flc_lead_timeline(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_lead_timeline(uuid,integer) TO authenticated;

-- Secure write RPC and tenant membership validation required in later phase.
-- Do NOT enable direct insert/update into tables from the browser.
