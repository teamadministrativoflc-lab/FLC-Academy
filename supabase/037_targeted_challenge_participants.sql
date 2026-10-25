-- SQL 037 · Participantes seleccionados en Retos FLC — ejecutar antes del PR de interfaz.
-- Aditivo, no edita pólizas ni splits. Preview comparte Supabase con producción:
-- ejecutar solo tras validación y aprobación explícita.
ALTER TABLE public.flc_production_challenges
 ADD COLUMN IF NOT EXISTS audience_mode text NOT NULL DEFAULT 'all'
 CHECK(audience_mode IN ('all','selected'));
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='flc_challenge_selected_only_individual') THEN
  ALTER TABLE public.flc_production_challenges
   ADD CONSTRAINT flc_challenge_selected_only_individual
   CHECK(audience_mode <> 'selected' OR participant_scope='individual');
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.flc_challenge_selected_agents (
 challenge_id uuid NOT NULL REFERENCES public.flc_production_challenges(id),
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 PRIMARY KEY(challenge_id,agent_id)
);
CREATE INDEX IF NOT EXISTS flc_selected_challenges_agent_idx
 ON public.flc_challenge_selected_agents(agent_id,challenge_id);
ALTER TABLE public.flc_challenge_selected_agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_challenge_selected_agents FROM PUBLIC,anon,authenticated;

-- Seguridad por reto: aunque la URL/ID sea conocido, la lista privada se valida en servidor.
CREATE OR REPLACE FUNCTION public.flc_can_view_challenge_id(p_challenge_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.flc_production_challenges c
  WHERE c.id=p_challenge_id
   AND (public.flc_is_admin() OR c.created_by=auth.uid()
     OR (c.status='active' AND public.flc_can_view_challenge(c.owner_agent_id)
      AND (c.audience_mode='all' OR EXISTS (
       SELECT 1 FROM public.flc_challenge_selected_agents m
       WHERE m.challenge_id=c.id AND m.agent_id=auth.uid()
      ))))
 );
$$;
REVOKE ALL ON FUNCTION public.flc_can_view_challenge_id(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_can_view_challenge_id(uuid) TO authenticated;

DROP POLICY IF EXISTS flc_challenges_read ON public.flc_production_challenges;
CREATE POLICY flc_challenges_read ON public.flc_production_challenges
 FOR SELECT TO authenticated USING(public.flc_can_view_challenge_id(id));

-- Lista de posibles participantes: el líder solo ve su equipo y a sí mismo.
CREATE OR REPLACE FUNCTION public.flc_challenge_candidates()
RETURNS TABLE(id uuid,full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH RECURSIVE descendants AS (
  SELECT auth.uid() AS id,ARRAY[auth.uid()]::uuid[] AS trail
  WHERE auth.uid() IS NOT NULL AND public.flc_is_team_leader()
  UNION ALL
  SELECT a.agent_id,d.trail||a.agent_id
  FROM descendants d JOIN public.flc_team_assignments a ON a.leader_id=d.id
  WHERE NOT a.agent_id=ANY(d.trail) AND cardinality(d.trail)<50
 )
 SELECT p.id,p.full_name::text
 FROM public.agent_profiles p
 WHERE auth.uid() IS NOT NULL AND p.role<>'admin'
  AND (public.flc_is_admin() OR EXISTS (SELECT 1 FROM descendants d WHERE d.id=p.id))
 ORDER BY p.full_name,p.id LIMIT 1000;
$$;
REVOKE ALL ON FUNCTION public.flc_challenge_candidates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_challenge_candidates() TO authenticated;

-- Para abrir un borrador: solo su creador (o admin) puede leer la selección.
CREATE OR REPLACE FUNCTION public.flc_challenge_selected_for(p_challenge_id uuid)
RETURNS TABLE(agent_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT m.agent_id FROM public.flc_challenge_selected_agents m
 JOIN public.flc_production_challenges c ON c.id=m.challenge_id
 WHERE m.challenge_id=p_challenge_id AND auth.uid() IS NOT NULL
  AND (public.flc_is_admin() OR c.created_by=auth.uid())
 ORDER BY m.agent_id;
$$;
REVOKE ALL ON FUNCTION public.flc_challenge_selected_for(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_challenge_selected_for(uuid) TO authenticated;

-- Guarda configuración y participantes en una sola transacción.
-- Se usan las RPC existentes para conservar sus validaciones y auditoría.
CREATE OR REPLACE FUNCTION public.flc_save_targeted_challenge(
 p_id uuid,p_title text,p_description text,p_scope text,p_metric text,
 p_target numeric,p_starts_on date,p_ends_on date,p_status text,
 p_audience_mode text,p_agent_ids uuid[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;v_owner uuid;v_creator uuid;v_old_status text;v_old_mode text;
 v_ids uuid[];v_total integer;v_valid integer;v_before jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida'; END IF;
 IF p_audience_mode IS NULL OR p_audience_mode NOT IN ('all','selected')
  OR (p_audience_mode='selected' AND p_scope<>'individual')
 THEN RAISE EXCEPTION 'Selecciona un modo válido; la selección individual solo admite agentes'; END IF;
 SELECT COALESCE(array_agg(DISTINCT x),ARRAY[]::uuid[]) INTO v_ids
 FROM unnest(COALESCE(p_agent_ids,ARRAY[]::uuid[])) x WHERE x IS NOT NULL;
 v_total:=cardinality(v_ids);
 IF (p_audience_mode='selected' AND (v_total=0 OR v_total>200))
   OR (p_audience_mode='all' AND v_total<>0)
 THEN RAISE EXCEPTION 'Debes seleccionar entre 1 y 200 agentes para un reto privado'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT c.owner_agent_id,c.created_by,c.status,c.audience_mode,to_jsonb(c)
   INTO v_owner,v_creator,v_old_status,v_old_mode,v_before
  FROM public.flc_production_challenges c WHERE c.id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reto no encontrado'; END IF;
  IF NOT public.flc_is_admin() AND (v_owner<>auth.uid() OR v_creator<>auth.uid()) THEN
   RAISE EXCEPTION 'No puedes modificar este reto'; END IF;
  -- Mantener íntegros los premios ya atribuidos a retos en marcha.
  IF v_old_status='active' AND (v_old_mode<>p_audience_mode OR
   EXISTS (
    SELECT m.agent_id FROM public.flc_challenge_selected_agents m WHERE m.challenge_id=p_id
    EXCEPT SELECT unnest(v_ids)
   ) OR EXISTS (
    SELECT unnest(v_ids)
    EXCEPT SELECT m.agent_id FROM public.flc_challenge_selected_agents m WHERE m.challenge_id=p_id
   ))
  THEN RAISE EXCEPTION 'Archiva o finaliza el reto activo antes de cambiar participantes'; END IF;
 END IF;
 IF p_audience_mode='selected' THEN
  SELECT COUNT(*) INTO v_valid FROM public.flc_challenge_candidates() a
  WHERE a.id=ANY(v_ids);
  IF v_valid<>v_total THEN RAISE EXCEPTION 'Hay participantes fuera de tu estructura autorizada'; END IF;
 END IF;
 IF public.flc_is_admin() THEN
  v_id:=public.flc_admin_save_challenge(p_id,p_title,p_description,p_scope,p_metric,
      p_target,p_starts_on,p_ends_on,p_status);
 ELSE
  v_id:=public.flc_leader_save_challenge(p_id,p_title,p_description,p_scope,p_metric,
      p_target,p_starts_on,p_ends_on,p_status);
 END IF;
 UPDATE public.flc_production_challenges SET audience_mode=p_audience_mode WHERE id=v_id;
 DELETE FROM public.flc_challenge_selected_agents WHERE challenge_id=v_id;
 IF p_audience_mode='selected' THEN
  INSERT INTO public.flc_challenge_selected_agents(challenge_id,agent_id)
   SELECT v_id,unnest(v_ids);
 END IF;
 INSERT INTO public.flc_challenge_audit(challenge_id,changed_by,old_state,new_state)
 VALUES(v_id,auth.uid(),jsonb_build_object('previous',v_before),
  jsonb_build_object('audience_mode',p_audience_mode,'selected_agent_ids',to_jsonb(v_ids)));
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_save_targeted_challenge(uuid,text,text,text,text,numeric,date,date,text,text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_save_targeted_challenge(uuid,text,text,text,text,numeric,date,date,text,text,uuid[]) TO authenticated;

-- Ranking aplica exactamente la lista de participantes; cálculo AP/splits permanece intacto.
CREATE OR REPLACE FUNCTION public.flc_challenge_leaderboard(p_challenge_id uuid)
RETURNS TABLE(
 participant_id uuid,participant_name text,metric_value numeric,target_value numeric,
 progress_pct numeric,place bigint,first_reported_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH RECURSIVE challenge AS (
 SELECT c.* FROM public.flc_production_challenges c
 WHERE c.id=p_challenge_id AND auth.uid() IS NOT NULL
  AND (
   public.flc_is_admin() OR c.created_by=auth.uid()
   OR (c.status='active' AND public.flc_can_view_challenge_id(c.id))
  )
),
agency_roots AS (
 SELECT l.agent_id FROM public.flc_team_leaders l
 WHERE NOT EXISTS(SELECT 1 FROM public.flc_team_assignments a WHERE a.agent_id=l.agent_id)
),
direct_managers AS (
 SELECT DISTINCT c.owner_agent_id,a.agent_id AS id
 FROM challenge c JOIN public.flc_team_assignments a
  ON a.leader_id=c.owner_agent_id
 JOIN public.flc_team_leaders l ON l.agent_id=a.agent_id
 WHERE c.owner_agent_id IS NOT NULL
 UNION
 SELECT DISTINCT c.owner_agent_id,a.agent_id
 FROM challenge c JOIN agency_roots r ON c.owner_agent_id IS NULL
 JOIN public.flc_team_assignments a ON a.leader_id=r.agent_id
 JOIN public.flc_team_leaders l ON l.agent_id=a.agent_id
),
team_tree AS (
 SELECT d.id AS root_id,d.id AS agent_id,ARRAY[d.id]::uuid[] AS visited
 FROM direct_managers d
 UNION ALL
 SELECT t.root_id,a.agent_id,t.visited||a.agent_id
 FROM team_tree t JOIN public.flc_team_assignments a ON a.leader_id=t.agent_id
 WHERE NOT a.agent_id=ANY(t.visited) AND cardinality(t.visited)<50
),
leader_tree AS (
 SELECT c.owner_agent_id AS id,ARRAY[c.owner_agent_id]::uuid[] AS trail
 FROM challenge c WHERE c.owner_agent_id IS NOT NULL
 UNION ALL
 SELECT a.agent_id,t.trail||a.agent_id
 FROM leader_tree t JOIN public.flc_team_assignments a ON a.leader_id=t.id
 WHERE NOT a.agent_id=ANY(t.trail) AND cardinality(t.trail)<50
),
credit_owners AS (
 SELECT DISTINCT 'individual'::text AS kind,p.id AS participant_id,
  p.full_name::text AS name,p.id AS agent_id
 FROM public.agent_profiles p
 JOIN challenge c ON c.participant_scope='individual'
 WHERE p.role<>'admin' AND (
   (c.owner_agent_id IS NULL
    OR EXISTS(SELECT 1 FROM leader_tree lt WHERE lt.id=p.id))
   AND (c.audience_mode='all' OR EXISTS (SELECT 1 FROM public.flc_challenge_selected_agents m WHERE m.challenge_id=c.id AND m.agent_id=p.id))
 )
 UNION ALL
 SELECT DISTINCT 'team'::text,t.root_id,p.full_name::text,t.agent_id
 FROM team_tree t JOIN public.agent_profiles p ON p.id=t.root_id
 JOIN challenge c ON c.participant_scope='team'
),
credits AS (
 SELECT o.kind,o.participant_id,o.name,s.id AS policy_id,
  s.submitted_on,s.issue_paid_on,s.issue_paid_verified_at,s.status,s.created_at,
  s.annual_premium*a.percent/100 AS credited_ap
 FROM credit_owners o
 LEFT JOIN public.flc_policy_allocation a ON a.agent_id=o.agent_id
 LEFT JOIN public.flc_policy_sales s ON s.id=a.policy_id
),
values_by_participant AS (
 SELECT o.participant_id,o.name,
  COALESCE(
   CASE c.metric
    WHEN 'submitted_ap' THEN SUM(cr.credited_ap) FILTER(WHERE cr.submitted_on BETWEEN c.starts_on AND c.ends_on)
    WHEN 'verified_ap' THEN SUM(cr.credited_ap) FILTER(WHERE cr.status='Issue Paid' AND cr.issue_paid_verified_at IS NOT NULL
     AND cr.issue_paid_on BETWEEN c.starts_on AND c.ends_on)
    WHEN 'submitted_policies' THEN COUNT(DISTINCT cr.policy_id) FILTER(WHERE cr.submitted_on BETWEEN c.starts_on AND c.ends_on)::numeric
   END,0)::numeric AS value,
  c.target AS goal,
  MIN(cr.created_at) FILTER(WHERE cr.submitted_on BETWEEN c.starts_on AND c.ends_on) AS reported_at
 FROM (SELECT DISTINCT kind,participant_id,name FROM credit_owners) o
 JOIN challenge c ON c.participant_scope=o.kind
 LEFT JOIN credits cr ON cr.kind=o.kind AND cr.participant_id=o.participant_id
 GROUP BY o.participant_id,o.name,c.metric,c.target,c.starts_on,c.ends_on
),
ranked AS (
 SELECT v.*, ROW_NUMBER() OVER(ORDER BY v.value DESC,v.reported_at ASC NULLS LAST,v.name ASC) AS position
 FROM values_by_participant v WHERE v.value>0 OR EXISTS(
  SELECT 1 FROM challenge c WHERE c.participant_scope='team'
 )
)
SELECT r.participant_id,r.name,r.value,r.goal,
 LEAST(100,ROUND(100*r.value/NULLIF(r.goal,0),2)),r.position,r.reported_at
FROM ranked r ORDER BY r.position LIMIT 200;
$$;


-- Visibilidad restringida para flc_reconcile_challenge_rewards.
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
       OR public.flc_can_view_challenge_id(c.id));
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

-- Visibilidad restringida para flc_challenge_rewards_for.
CREATE OR REPLACE FUNCTION public.flc_challenge_rewards_for(p_challenge_id uuid)
RETURNS TABLE(participant_id uuid,earned_at timestamptz,achieved_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT r.participant_id,r.earned_at,r.achieved_value
 FROM public.flc_challenge_rewards r
 JOIN public.flc_production_challenges c ON c.id=r.challenge_id
 WHERE r.challenge_id=p_challenge_id AND auth.uid() IS NOT NULL
  AND (public.flc_is_admin() OR c.created_by=auth.uid()
       OR (c.status='active' AND public.flc_can_view_challenge_id(c.id)))
 ORDER BY r.earned_at ASC;
$$;

-- Visibilidad restringida para flc_visible_challenge_celebrations.
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
   OR (c.status='active' AND public.flc_can_view_challenge_id(c.id))
  )
 ORDER BY r.earned_at DESC,r.id DESC LIMIT 30;
$$;

-- Visibilidad restringida para flc_challenge_hall_of_fame.
CREATE OR REPLACE FUNCTION public.flc_challenge_hall_of_fame()
RETURNS TABLE(
 challenge_id uuid,challenge_title text,starts_on date,ends_on date,
 participant_scope text,metric text,place integer,participant_name text,
 metric_value numeric,target_value numeric,finalized_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT c.id,c.title,c.starts_on,c.ends_on,c.participant_scope,c.metric,
        h.place,h.participant_name,h.metric_value,h.target_value,h.finalized_at
 FROM public.flc_challenge_podium_history h
 JOIN public.flc_production_challenges c ON c.id=h.challenge_id
 WHERE auth.uid() IS NOT NULL
  AND (public.flc_is_admin() OR c.created_by=auth.uid()
       OR (c.status IN ('active','archived') AND public.flc_can_view_challenge(c.owner_agent_id) AND (c.audience_mode='all' OR EXISTS (SELECT 1 FROM public.flc_challenge_selected_agents m WHERE m.challenge_id=c.id AND m.agent_id=auth.uid()))))
 ORDER BY c.ends_on DESC,c.id,h.place LIMIT 150;
$$;
