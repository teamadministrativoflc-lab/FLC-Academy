-- SQL 029 · Retos de líderes por estructura (PREVIEW, requiere SQL 028).
-- Aditivo y sin tocar pólizas. Cada líder gestiona solo los retos propios.
ALTER TABLE public.flc_production_challenges
 ADD COLUMN IF NOT EXISTS owner_agent_id uuid REFERENCES public.agent_profiles(id);
CREATE INDEX IF NOT EXISTS flc_challenges_owner_idx
 ON public.flc_production_challenges(owner_agent_id,status);

-- Un reto global (owner NULL) es de la agencia. Uno con owner solo se muestra
-- a ese líder y a agentes descendientes en el organigrama vigente.
CREATE OR REPLACE FUNCTION public.flc_can_view_challenge(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH RECURSIVE tree AS (
  SELECT p_owner AS id,ARRAY[p_owner]::uuid[] AS trail
  WHERE p_owner IS NOT NULL
  UNION ALL
  SELECT a.agent_id,t.trail||a.agent_id
  FROM tree t JOIN public.flc_team_assignments a ON a.leader_id=t.id
  WHERE NOT a.agent_id=ANY(t.trail) AND cardinality(t.trail)<50
 )
 SELECT auth.uid() IS NOT NULL AND (
   p_owner IS NULL OR public.flc_is_admin()
   OR EXISTS(SELECT 1 FROM tree WHERE id=auth.uid())
 );
$$;
REVOKE ALL ON FUNCTION public.flc_can_view_challenge(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_can_view_challenge(uuid) TO authenticated;
DROP POLICY IF EXISTS flc_challenges_read ON public.flc_production_challenges;
CREATE POLICY flc_challenges_read ON public.flc_production_challenges
 FOR SELECT TO authenticated USING(
  public.flc_is_admin()
  OR created_by=auth.uid()
  OR (status='active' AND public.flc_can_view_challenge(owner_agent_id))
 );

-- Versión exclusiva para líderes; NO permite administrar retos globales
-- ni de otra estructura. Todos los cambios dejan registro en audit.
CREATE OR REPLACE FUNCTION public.flc_leader_save_challenge(
 p_id uuid,p_title text,p_description text,p_scope text,p_metric text,
 p_target numeric,p_starts_on date,p_ends_on date,p_status text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;v_old jsonb;v_new jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.flc_is_team_leader()
  OR NOT EXISTS(SELECT 1 FROM public.flc_team_assignments a WHERE a.leader_id=auth.uid())
 THEN RAISE EXCEPTION 'Solo líderes con equipo pueden gestionar sus retos'; END IF;
 IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 5 AND 100
  OR p_scope IS NULL OR p_scope NOT IN ('individual','team')
  OR p_metric IS NULL OR p_metric NOT IN ('submitted_ap','verified_ap','submitted_policies')
  OR p_status IS NULL OR p_status NOT IN ('draft','active','archived')
  OR p_target IS NULL OR p_target<=0 OR p_target>1000000000
  OR (p_metric='submitted_policies' AND p_target<>trunc(p_target))
  OR p_starts_on IS NULL OR p_ends_on IS NULL OR p_ends_on<p_starts_on
  OR p_ends_on-p_starts_on>366 OR length(COALESCE(p_description,''))>500
 THEN RAISE EXCEPTION 'Datos inválidos del reto'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.flc_production_challenges(
   title,description,participant_scope,metric,target,starts_on,ends_on,status,created_by,owner_agent_id)
  VALUES(btrim(p_title),COALESCE(btrim(p_description),''),
   p_scope,p_metric,p_target,p_starts_on,p_ends_on,p_status,auth.uid(),auth.uid())
  RETURNING id INTO v_id;
 ELSE
  SELECT to_jsonb(c) INTO v_old FROM public.flc_production_challenges c
   WHERE c.id=p_id AND c.owner_agent_id=auth.uid()
    AND c.created_by=auth.uid() FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Reto no autorizado'; END IF;
  UPDATE public.flc_production_challenges
  SET title=btrim(p_title),description=COALESCE(btrim(p_description),''),
   participant_scope=p_scope,metric=p_metric,target=p_target,
   starts_on=p_starts_on,ends_on=p_ends_on,status=p_status,updated_at=now()
  WHERE id=p_id RETURNING id INTO v_id;
 END IF;
 SELECT to_jsonb(c) INTO v_new FROM public.flc_production_challenges c WHERE c.id=v_id;
 INSERT INTO public.flc_challenge_audit(challenge_id,changed_by,old_state,new_state)
 VALUES(v_id,auth.uid(),v_old,v_new);
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_leader_save_challenge(uuid,text,text,text,text,numeric,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_leader_save_challenge(uuid,text,text,text,text,numeric,date,date,text) TO authenticated;

-- Reemplaza únicamente la consulta agregada. La producción individual queda
-- dentro de su propio equipo y mantiene los porcentajes de split.
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
   OR (c.status='active' AND public.flc_can_view_challenge(c.owner_agent_id))
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
   c.owner_agent_id IS NULL
   OR EXISTS(SELECT 1 FROM leader_tree lt WHERE lt.id=p.id)
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
REVOKE ALL ON FUNCTION public.flc_challenge_leaderboard(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_challenge_leaderboard(uuid) TO authenticated;
