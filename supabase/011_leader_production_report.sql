-- Hierarchy-scoped, split-credited production per leader/subleader.
-- Only admin or an assigned team leader can use this report.
CREATE OR REPLACE FUNCTION public.flc_leader_production_report(p_month text,p_carrier text DEFAULT NULL)
RETURNS TABLE(leader_id uuid,leader_name text,depth integer,policy_count bigint,submitted_ap numeric,paid_count bigint,paid_ap numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH RECURSIVE visible AS (
  SELECT a.agent_id AS id, 1 AS depth, ARRAY[auth.uid(),a.agent_id]::uuid[] AS trail
  FROM public.flc_team_assignments a WHERE a.leader_id=auth.uid()
  UNION ALL
  SELECT a.agent_id,v.depth+1,v.trail||a.agent_id
  FROM visible v JOIN public.flc_team_assignments a ON a.leader_id=v.id
  WHERE NOT a.agent_id=ANY(v.trail)
 ), leader_scope AS (
  SELECT l.agent_id AS leader_id, 0 AS depth FROM public.flc_team_leaders l
  WHERE public.flc_is_admin() OR l.agent_id=auth.uid()
     OR EXISTS(SELECT 1 FROM visible v WHERE v.id=l.agent_id)
 ), members AS (
  SELECT ls.leader_id,ls.leader_id AS agent_id FROM leader_scope ls
  UNION ALL
  SELECT m.leader_id,a.agent_id
  FROM members m JOIN public.flc_team_assignments a ON a.leader_id=m.agent_id
  WHERE m.agent_id<>a.agent_id
 ), uniq AS (
  SELECT DISTINCT leader_id,agent_id FROM members
 ), credits AS (
  SELECT u.leader_id,s.id,s.submitted_on,s.issue_paid_on,s.status,
    s.annual_premium *
    (CASE WHEN s.agent_id=u.agent_id THEN s.split_primary_pct/100 ELSE 0 END +
     CASE WHEN s.split_agent_id=u.agent_id THEN (100-s.split_primary_pct)/100 ELSE 0 END) AS credit
  FROM uniq u JOIN public.flc_policy_sales s ON s.agent_id=u.agent_id OR s.split_agent_id=u.agent_id
  WHERE p_carrier IS NULL OR p_carrier='' OR s.carrier=p_carrier
 )
 SELECT ls.leader_id,p.full_name::text,
  CASE WHEN ls.leader_id=auth.uid() THEN 0
       ELSE (SELECT v.depth FROM visible v WHERE v.id=ls.leader_id LIMIT 1) END AS depth,
  COUNT(DISTINCT c.id) FILTER(WHERE to_char(c.submitted_on,'YYYY-MM')=p_month),
  COALESCE(SUM(c.credit) FILTER(WHERE to_char(c.submitted_on,'YYYY-MM')=p_month),0),
  COUNT(DISTINCT c.id) FILTER(WHERE c.status='Issue Paid' AND to_char(c.issue_paid_on,'YYYY-MM')=p_month),
  COALESCE(SUM(c.credit) FILTER(WHERE c.status='Issue Paid' AND to_char(c.issue_paid_on,'YYYY-MM')=p_month),0)
 FROM leader_scope ls JOIN public.agent_profiles p ON p.id=ls.leader_id
 LEFT JOIN credits c ON c.leader_id=ls.leader_id
 WHERE public.flc_is_admin() OR public.flc_is_team_leader()
 GROUP BY ls.leader_id,p.full_name ORDER BY 3,2;
$$;
REVOKE ALL ON FUNCTION public.flc_leader_production_report(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_leader_production_report(text,text) TO authenticated;
