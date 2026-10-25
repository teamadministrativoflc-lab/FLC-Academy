-- SQL 023 · Primera fase de rangos FLC (Preview).
-- Cálculo solo lectura; NO ejecuta descensos ni ascensos automáticos todavía.
-- Ejecutar en Supabase SQL Editor antes de probar el panel.
CREATE TABLE IF NOT EXISTS public.flc_rank_profiles (
 agent_id uuid PRIMARY KEY REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
 current_rank text CHECK (current_rank IS NULL OR current_rank IN
  ('SM','SSM','VP','SVP','EVP','BM','SBM','EBM','CM','SCM','ECM','CCM','SP','EP','MP')),
 assigned_at timestamptz,
 assignment_reason text,
 reviewed_through date
);
ALTER TABLE public.flc_rank_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_rank_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_rank_profiles TO authenticated;
DROP POLICY IF EXISTS flc_rank_profiles_read ON public.flc_rank_profiles;
CREATE POLICY flc_rank_profiles_read ON public.flc_rank_profiles FOR SELECT TO authenticated
 USING (public.flc_is_admin() OR agent_id=auth.uid());

-- Baseline de VP confirmado por Efraysa Ramos.
-- Se aplica solamente si hay UN perfil de agente con ese nombre exacto.
-- La cuenta administrativa de FLC puede ser distinta de la cuenta de Efraysa.
-- No sobreescribe ningún título existente.
INSERT INTO public.flc_rank_profiles(agent_id,current_rank,assigned_at,assignment_reason)
SELECT p.id,'VP',now(),'VP inicial confirmado por la CEO'
FROM public.agent_profiles p
WHERE lower(btrim(p.full_name))='efraysa ramos'
 AND (SELECT count(*) FROM public.agent_profiles z
      WHERE lower(btrim(z.full_name))='efraysa ramos')=1
ON CONFLICT(agent_id) DO NOTHING;

-- Reporte mensual: la producción total incluye la personal, pero nunca duplica
-- los porcentajes de una misma póliza. Cada direct report es una leg distinta.
CREATE OR REPLACE FUNCTION public.flc_rank_preview(p_month date)
RETURNS TABLE(
 agent_id uuid,full_name text,current_rank text,candidate_rank text,
 team_verified_ap numeric,personal_verified_ap numeric,
 top_leg_verified_ap numeric,outside_top_leg_ap numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH RECURSIVE subjects AS (
 SELECT l.agent_id AS id FROM public.flc_team_leaders l
 UNION
 SELECT p.id FROM public.agent_profiles p
  WHERE lower(btrim(p.full_name))='efraysa ramos'
),
structure AS (
 SELECT s.id AS root_id,s.id AS member_id,NULL::uuid AS leg_id,
  ARRAY[s.id]::uuid[] AS path
 FROM subjects s
 UNION ALL
 SELECT t.root_id,a.agent_id,COALESCE(t.leg_id,a.agent_id),
  t.path||a.agent_id
 FROM structure t JOIN public.flc_team_assignments a ON a.leader_id=t.member_id
 WHERE NOT a.agent_id=ANY(t.path) AND cardinality(t.path)<50
),
credits AS (
 SELECT t.root_id,t.leg_id,t.member_id,
  COALESCE(SUM(s.annual_premium*c.percent/100),0)::numeric AS ap
 FROM structure t
 LEFT JOIN public.flc_policy_allocation c ON c.agent_id=t.member_id
 LEFT JOIN public.flc_policy_sales s ON s.id=c.policy_id
  AND s.status='Issue Paid' AND s.issue_paid_verified_at IS NOT NULL
  AND s.issue_paid_on>=date_trunc('month',p_month)::date
  AND s.issue_paid_on<(date_trunc('month',p_month)+interval '1 month')::date
 GROUP BY t.root_id,t.leg_id,t.member_id
),
totals AS (
 SELECT c.root_id,
  SUM(c.ap)::numeric AS team_ap,
  SUM(c.ap) FILTER(WHERE c.leg_id IS NULL)::numeric AS personal_ap
 FROM credits c GROUP BY c.root_id
),
legs AS (
 SELECT root_id,leg_id,SUM(ap)::numeric AS leg_ap
 FROM credits WHERE leg_id IS NOT NULL GROUP BY root_id,leg_id
),
highest_leg AS (
 SELECT root_id,MAX(leg_ap)::numeric AS top_ap FROM legs GROUP BY root_id
),
numbers AS (
 SELECT t.root_id,t.team_ap,COALESCE(t.personal_ap,0)::numeric AS personal_ap,
  COALESCE(h.top_ap,0)::numeric AS top_ap,
  (t.team_ap-COALESCE(h.top_ap,0))::numeric AS outside_ap
 FROM totals t LEFT JOIN highest_leg h ON h.root_id=t.root_id
),
levels AS (
 SELECT * FROM (VALUES
  ('SM'::text,1,50000::numeric,10000::numeric,0::numeric),
  ('SSM',2,100000,25000,0),
  ('VP',3,150000,0,50000),
  ('SVP',4,300000,0,100000),
  ('EVP',5,500000,0,150000),
  ('BM',6,1000000,0,250000),
  ('SBM',7,2000000,0,350000),
  ('EBM',8,3000000,0,450000),
  ('CM',9,4000000,0,500000),
  ('SCM',10,5000000,0,750000),
  ('ECM',11,6000000,0,1000000),
  ('CCM',12,7000000,0,1500000),
  ('SP',13,10000000,0,1750000),
  ('EP',14,15000000,0,2000000),
  ('MP',15,20000000,0,3000000)
 ) v(rank_code,rank_order,min_team_ap,min_personal_ap,min_outside_ap)
)
SELECT n.root_id,p.full_name::text,r.current_rank,
 (SELECT l.rank_code FROM levels l
  WHERE n.team_ap>=l.min_team_ap
   AND n.personal_ap>=l.min_personal_ap
   AND n.outside_ap>=l.min_outside_ap
  ORDER BY l.rank_order DESC LIMIT 1),
 n.team_ap,n.personal_ap,n.top_ap,n.outside_ap
FROM numbers n JOIN public.agent_profiles p ON p.id=n.root_id
LEFT JOIN public.flc_rank_profiles r ON r.agent_id=n.root_id
WHERE public.flc_is_admin()
ORDER BY n.team_ap DESC,p.full_name;
$$;
REVOKE ALL ON FUNCTION public.flc_rank_preview(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_rank_preview(date) TO authenticated;
