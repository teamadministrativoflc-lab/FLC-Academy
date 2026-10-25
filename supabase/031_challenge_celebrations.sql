-- SQL 031 · Insignias y celebraciones de retos (PREVIEW).
-- Sólo lectura de recompensas ya ganadas; no altera pólizas ni asigna premios.
-- Requiere SQL 030.
CREATE OR REPLACE FUNCTION public.flc_agent_challenge_awards(p_agent_id uuid)
RETURNS TABLE(
 reward_id uuid,challenge_id uuid,challenge_title text,
 participant_scope text,metric text,target_value numeric,
 achieved_value numeric,earned_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT r.id,c.id,c.title,c.participant_scope,c.metric,
        r.goal_value,r.achieved_value,r.earned_at
 FROM public.flc_challenge_rewards r
 JOIN public.flc_production_challenges c ON c.id=r.challenge_id
 WHERE auth.uid() IS NOT NULL
   AND (p_agent_id=auth.uid() OR public.flc_is_admin())
   AND r.participant_id=p_agent_id
 ORDER BY r.earned_at DESC,r.id DESC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.flc_agent_challenge_awards(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_agent_challenge_awards(uuid) TO authenticated;

-- Feed: únicamente logros de retos activos que el usuario puede consultar.
-- Los borradores y retos ajenos de otra estructura no se anuncian.
CREATE OR REPLACE FUNCTION public.flc_visible_challenge_celebrations()
RETURNS TABLE(
 reward_id uuid,participant_id uuid,participant_name text,
 challenge_id uuid,challenge_title text,participant_scope text,
 metric text,goal_value numeric,achieved_value numeric,earned_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT r.id,r.participant_id,p.full_name::text,c.id,c.title,
        c.participant_scope,c.metric,r.goal_value,r.achieved_value,r.earned_at
 FROM public.flc_challenge_rewards r
 JOIN public.flc_production_challenges c ON c.id=r.challenge_id
 JOIN public.agent_profiles p ON p.id=r.participant_id
 WHERE auth.uid() IS NOT NULL
  AND (
   public.flc_is_admin()
   OR (c.status='active' AND public.flc_can_view_challenge(c.owner_agent_id))
  )
 ORDER BY r.earned_at DESC,r.id DESC LIMIT 30;
$$;
REVOKE ALL ON FUNCTION public.flc_visible_challenge_celebrations() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_visible_challenge_celebrations() TO authenticated;
