-- SQL 030 · Recompensas por meta de retos (PREVIEW).
-- Aditiva: no modifica pólizas, retos, splits ni insignias anteriores.
-- Requiere SQL 028 y SQL 029. Ejecutar SOLO tras revisar PR en Preview.
CREATE TABLE IF NOT EXISTS public.flc_challenge_rewards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 challenge_id uuid NOT NULL REFERENCES public.flc_production_challenges(id),
 participant_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 participant_scope text NOT NULL CHECK(participant_scope IN ('individual','team')),
 goal_value numeric NOT NULL CHECK(goal_value > 0),
 achieved_value numeric NOT NULL CHECK(achieved_value >= goal_value),
 earned_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (challenge_id, participant_id)
);
CREATE INDEX IF NOT EXISTS flc_challenge_rewards_participant_idx
 ON public.flc_challenge_rewards(participant_id,earned_at DESC);
ALTER TABLE public.flc_challenge_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_challenge_rewards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_challenge_rewards TO authenticated;
DROP POLICY IF EXISTS flc_challenge_rewards_read ON public.flc_challenge_rewards;
CREATE POLICY flc_challenge_rewards_read ON public.flc_challenge_rewards
 FOR SELECT TO authenticated USING(
  public.flc_is_admin() OR participant_id=auth.uid()
  OR EXISTS(
   SELECT 1 FROM public.flc_production_challenges c
   WHERE c.id=challenge_id AND c.created_by=auth.uid()
  )
 );

-- Reconciliación idempotente a partir de la clasificación calculada en el servidor.
-- Solo retos activos y fechas de inicio ya alcanzadas (hora de Nueva York).
-- La recompensa se registra una sola vez aun con múltiples visitas simultáneas.
CREATE OR REPLACE FUNCTION public.flc_reconcile_challenge_rewards(p_challenge_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_scope text; v_count integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida'; END IF;
 SELECT c.participant_scope INTO v_scope
 FROM public.flc_production_challenges c
 WHERE c.id=p_challenge_id AND c.status='active'
  AND c.starts_on <= (now() AT TIME ZONE 'America/New_York')::date
  AND (public.flc_is_admin() OR c.created_by=auth.uid()
       OR public.flc_can_view_challenge(c.owner_agent_id));
 IF v_scope IS NULL THEN RETURN 0; END IF;
 INSERT INTO public.flc_challenge_rewards(
  challenge_id,participant_id,participant_scope,goal_value,achieved_value
 )
 SELECT p_challenge_id,l.participant_id,v_scope,l.target_value,l.metric_value
 FROM public.flc_challenge_leaderboard(p_challenge_id) l
 WHERE l.metric_value>=l.target_value AND l.target_value>0
 ON CONFLICT(challenge_id,participant_id) DO NOTHING;
 GET DIAGNOSTICS v_count = ROW_COUNT;
 RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_reconcile_challenge_rewards(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_reconcile_challenge_rewards(uuid) TO authenticated;

-- Consulta de recompensas de un reto visible, sin exponer pólizas/clientes.
CREATE OR REPLACE FUNCTION public.flc_challenge_rewards_for(p_challenge_id uuid)
RETURNS TABLE(participant_id uuid,earned_at timestamptz,achieved_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT r.participant_id,r.earned_at,r.achieved_value
 FROM public.flc_challenge_rewards r
 JOIN public.flc_production_challenges c ON c.id=r.challenge_id
 WHERE r.challenge_id=p_challenge_id AND auth.uid() IS NOT NULL
  AND (public.flc_is_admin() OR c.created_by=auth.uid()
       OR (c.status='active' AND public.flc_can_view_challenge(c.owner_agent_id)))
 ORDER BY r.earned_at ASC;
$$;
REVOKE ALL ON FUNCTION public.flc_challenge_rewards_for(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_challenge_rewards_for(uuid) TO authenticated;
