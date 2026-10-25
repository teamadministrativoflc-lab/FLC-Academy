-- SQL 028 · Retos FLC Gamification Center — PREVIEW.
-- Requiere SQL 019 (splits) y estructuras de equipo.
-- MIGRACIÓN ADITIVA: no cambia, elimina ni recategoriza pólizas existentes.
-- ADVERTENCIA: Supabase compartido entre Preview y Producción.
CREATE TABLE IF NOT EXISTS public.flc_production_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 100),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 participant_scope text NOT NULL CHECK(participant_scope IN ('individual','team')),
 metric text NOT NULL CHECK(metric IN ('submitted_ap','verified_ap','submitted_policies')),
 target numeric(14,2) NOT NULL CHECK(target>0),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 created_by uuid NOT NULL REFERENCES public.agent_profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on),
 CHECK(ends_on-starts_on<=366),
 CHECK(metric<>'submitted_policies' OR target=trunc(target))
);
CREATE INDEX IF NOT EXISTS flc_challenges_schedule_idx
 ON public.flc_production_challenges(status,starts_on,ends_on);
ALTER TABLE public.flc_production_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_production_challenges FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_production_challenges TO authenticated;
DROP POLICY IF EXISTS flc_challenges_read ON public.flc_production_challenges;
CREATE POLICY flc_challenges_read ON public.flc_production_challenges FOR SELECT TO authenticated
 USING(public.flc_is_admin() OR status='active');

-- Histórico administrativo de cambios: nunca se borra un reto creado.
CREATE TABLE IF NOT EXISTS public.flc_challenge_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 challenge_id uuid NOT NULL REFERENCES public.flc_production_challenges(id),
 changed_by uuid NOT NULL REFERENCES public.agent_profiles(id),
 happened_at timestamptz NOT NULL DEFAULT now(),
 old_state jsonb,
 new_state jsonb NOT NULL
);
ALTER TABLE public.flc_challenge_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_challenge_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_challenge_audit TO authenticated;
DROP POLICY IF EXISTS flc_challenge_audit_admin ON public.flc_challenge_audit;
CREATE POLICY flc_challenge_audit_admin ON public.flc_challenge_audit FOR SELECT TO authenticated
 USING(public.flc_is_admin());

-- Único canal de escritura. Borradores no son visibles a agentes.
-- Retos activos se pueden actualizar por administración; cada cambio se audita.
CREATE OR REPLACE FUNCTION public.flc_admin_save_challenge(
 p_id uuid,p_title text,p_description text,p_scope text,p_metric text,
 p_target numeric,p_starts_on date,p_ends_on date,p_status text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;v_old jsonb;v_new jsonb;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Solo administración puede crear o editar retos'; END IF;
 IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 5 AND 100
  OR p_scope NOT IN ('individual','team')
  OR p_metric NOT IN ('submitted_ap','verified_ap','submitted_policies')
  OR p_status NOT IN ('draft','active','archived')
  OR p_target IS NULL OR p_target<=0 OR p_target>1000000000
  OR (p_metric='submitted_policies' AND p_target<>trunc(p_target))
  OR p_starts_on IS NULL OR p_ends_on IS NULL OR p_ends_on<p_starts_on
  OR p_ends_on-p_starts_on>366
  OR length(COALESCE(p_description,''))>500
 THEN RAISE EXCEPTION 'Datos inválidos del reto'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.flc_production_challenges(
    title,description,participant_scope,metric,target,starts_on,ends_on,status,created_by)
  VALUES(btrim(p_title),COALESCE(btrim(p_description),''),
    p_scope,p_metric,p_target,p_starts_on,p_ends_on,p_status,auth.uid())
  RETURNING id INTO v_id;
 ELSE
  SELECT to_jsonb(c) INTO v_old
  FROM public.flc_production_challenges c WHERE c.id=p_id FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Reto no encontrado'; END IF;
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
REVOKE ALL ON FUNCTION public.flc_admin_save_challenge(uuid,text,text,text,text,numeric,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_save_challenge(uuid,text,text,text,text,numeric,date,date,text) TO authenticated;

-- Resultado de solo lectura; las cuotas se atribuyen por porcentaje del split.
-- Pólizas sometidas: 1 póliza por agente participante (aunque tenga menos de 100%).
-- Equipos: managers directos de las raíces de la agencia y toda su estructura;
-- cada líder incluye su producción personal, no se suman dos veces sus pólizas.
CREATE OR REPLACE FUNCTION public.flc_challenge_leaderboard(p_challenge_id uuid)
RETURNS TABLE(
 participant_id uuid,participant_name text,metric_value numeric,target_value numeric,
 progress_pct numeric,place bigint,first_reported_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH RECURSIVE challenge AS (
 SELECT * FROM public.flc_production_challenges c
 WHERE c.id=p_challenge_id AND auth.uid() IS NOT NULL
  AND (c.status='active' OR public.flc_is_admin())
),
agency_roots AS (
 SELECT l.agent_id FROM public.flc_team_leaders l
 WHERE NOT EXISTS(SELECT 1 FROM public.flc_team_assignments a WHERE a.agent_id=l.agent_id)
),
direct_managers AS (
 SELECT DISTINCT a.agent_id AS id
 FROM agency_roots r JOIN public.flc_team_assignments a ON a.leader_id=r.agent_id
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
credit_owners AS (
 SELECT DISTINCT 'individual'::text AS kind,p.id AS participant_id,p.full_name::text AS name,p.id AS agent_id
 FROM public.agent_profiles p WHERE p.role<>'admin'
 UNION ALL
 SELECT DISTINCT 'team'::text,t.root_id,p.full_name::text,t.agent_id
 FROM team_tree t JOIN public.agent_profiles p ON p.id=t.root_id
),
credits AS (
 SELECT o.kind,o.participant_id,o.name,s.id AS policy_id,
  s.submitted_on,s.issue_paid_on,s.issue_paid_verified_at,s.status,s.created_at,
  s.annual_premium*a.percent/100 AS credited_ap
 FROM credit_owners o
 JOIN challenge c ON c.participant_scope=o.kind
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
