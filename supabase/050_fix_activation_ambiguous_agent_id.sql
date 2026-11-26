-- Fix ambiguous column 'agent_id' in admin-only activation RPC.
-- Replaces function definition only. Does NOT activate any agent.
BEGIN;
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
  ON CONFLICT ON CONSTRAINT flc_distribution_agent_availability_pkey DO UPDATE
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
REVOKE ALL ON FUNCTION public.flc_distribution_set_agent_active(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_set_agent_active(uuid,boolean) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname='flc_distribution_set_agent_active';
