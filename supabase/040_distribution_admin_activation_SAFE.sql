-- FLC Lead Distribution Center: admin-only activation and pause.
-- MAIN Supabase project only: fvhbzutxaoujtnnjzhlk.
-- Does not activate agents until an administrator invokes the function.
-- RLS remains enabled; agents receive no direct table write permissions.
BEGIN;

-- Only the admin account that is authenticated in FLC Academy can execute
-- a state change. Never accept an admin id or acting user from the client.
CREATE OR REPLACE FUNCTION public.flc_distribution_set_agent_active(
  p_agent_id uuid,
  p_active boolean
)
RETURNS TABLE(agent_id uuid, is_verified boolean, verified_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.flc_distribution_agent_availability%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.agent_profiles p
    WHERE p.id=v_actor AND p.role='admin'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF p_agent_id IS NULL OR p_active IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.agent_profiles p
    WHERE p.id=p_agent_id AND p.role='agent'
  ) THEN
    RAISE EXCEPTION 'agent_not_found' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.flc_distribution_agent_availability AS a
    (agent_id,is_verified,verified_at,verified_by,paused_at,updated_at)
  VALUES (
    p_agent_id,p_active,
    CASE WHEN p_active THEN now() ELSE NULL END,
    CASE WHEN p_active THEN v_actor ELSE NULL END,
    CASE WHEN p_active THEN NULL ELSE now() END,
    now()
  )
  ON CONFLICT (agent_id) DO UPDATE
  SET is_verified=EXCLUDED.is_verified,
      verified_at=EXCLUDED.verified_at,
      verified_by=EXCLUDED.verified_by,
      paused_at=EXCLUDED.paused_at,
      updated_at=now()
  RETURNING a.* INTO v_row;

  INSERT INTO public.flc_distribution_events (agent_id,actor_id,event_type,details)
  VALUES (p_agent_id,v_actor,CASE WHEN p_active THEN 'agent_verified_manual' ELSE 'agent_paused_manual' END,
          jsonb_build_object('verification_method','admin_manual_zoom_check'));

  RETURN QUERY SELECT v_row.agent_id,v_row.is_verified,v_row.verified_at,v_row.updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.flc_distribution_set_agent_active(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_set_agent_active(uuid,boolean) TO authenticated;
-- Functions run as owner and can write to RLS-protected tables;
-- the explicit profile check above is the access boundary.

-- Allow authenticated users to read ONLY their own availability,
-- and administrators to read agent status, when the UI is introduced.
GRANT SELECT ON public.flc_distribution_agent_availability TO authenticated;
DROP POLICY IF EXISTS flc_distribution_read_availability ON public.flc_distribution_agent_availability;
CREATE POLICY flc_distribution_read_availability
ON public.flc_distribution_agent_availability FOR SELECT TO authenticated
USING (
  agent_id=(SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM public.agent_profiles p
          WHERE p.id=(SELECT auth.uid()) AND p.role='admin')
);

COMMIT;

-- Read-only check. No agent activation is triggered by running the SQL:
SELECT proname FROM pg_proc WHERE proname='flc_distribution_set_agent_active';
