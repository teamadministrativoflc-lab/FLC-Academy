-- FLC self-service lead readiness: isolated opt-in groundwork.
-- Does not change the live distributor, admin approval, Zoom integration,
-- quota engine, existing assignments or cron schedule.
BEGIN;
CREATE TABLE IF NOT EXISTS public.flc_distribution_agent_self_presence (
 agent_id uuid PRIMARY KEY REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
 wants_leads boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flc_distribution_agent_self_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.flc_distribution_agent_self_presence FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.flc_distribution_my_self_presence()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
 v_user uuid := auth.uid();
 v_wants boolean;
 v_verified boolean;
 v_last timestamptz;
BEGIN
 IF v_user IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.agent_profiles p
   WHERE p.id=v_user AND p.role='agent'
 ) THEN RAISE EXCEPTION 'agent_only' USING ERRCODE='42501'; END IF;
 SELECT s.wants_leads,s.updated_at INTO v_wants,v_last
 FROM public.flc_distribution_agent_self_presence s WHERE s.agent_id=v_user;
 SELECT coalesce(av.is_verified,false) INTO v_verified
 FROM public.flc_distribution_agent_availability av WHERE av.agent_id=v_user;
 RETURN jsonb_build_object(
   'wants_leads',coalesce(v_wants,false),
   'admin_verified',coalesce(v_verified,false),
   'effective_receiving',false,
   'enforcement_status','pending_engine_integration',
   'updated_at',v_last
 );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.flc_distribution_set_my_self_presence(
 p_wants_leads boolean
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
 v_user uuid := auth.uid();
 v_verified boolean;
BEGIN
 IF v_user IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.agent_profiles p
   WHERE p.id=v_user AND p.role='agent'
 ) THEN RAISE EXCEPTION 'agent_only' USING ERRCODE='42501'; END IF;
 IF p_wants_leads IS NULL THEN
   RAISE EXCEPTION 'invalid_wants_leads' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.flc_distribution_agent_self_presence(agent_id,wants_leads,updated_at)
 VALUES(v_user,p_wants_leads,now())
 ON CONFLICT(agent_id) DO UPDATE
   SET wants_leads=excluded.wants_leads, updated_at=excluded.updated_at;
 SELECT coalesce(av.is_verified,false) INTO v_verified
 FROM public.flc_distribution_agent_availability av WHERE av.agent_id=v_user;
 RETURN jsonb_build_object(
   'wants_leads',p_wants_leads,'admin_verified',coalesce(v_verified,false),
   'effective_receiving',false,
   'enforcement_status','pending_engine_integration'
 );
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_my_self_presence() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.flc_distribution_set_my_self_presence(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_my_self_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flc_distribution_set_my_self_presence(boolean) TO authenticated;
COMMIT;
-- IMPORTANT: This stage only saves a request; the scheduled distribution
-- engine does NOT consume the new table until a separate reviewed migration.
