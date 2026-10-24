-- Step 544: timestamp at which each leader's verified monthly AP total was reached.
-- Run in Supabase SQL Editor before enabling the Preview tie-break.
-- This is based on the final qualifying verification event for the month,
-- not a client-provided submitted timestamp.
CREATE OR REPLACE FUNCTION public.flc_leader_verified_rank_times(p_month text,p_carrier text DEFAULT NULL)
RETURNS TABLE(leader_id uuid,reached_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH RECURSIVE visible AS (
  SELECT a.agent_id AS id, ARRAY[auth.uid(),a.agent_id]::uuid[] AS trail
  FROM public.flc_team_assignments a WHERE a.leader_id=auth.uid()
  UNION ALL
  SELECT a.agent_id,v.trail||a.agent_id
  FROM visible v JOIN public.flc_team_assignments a ON a.leader_id=v.id
  WHERE NOT a.agent_id=ANY(v.trail)
 ), leader_scope AS (
  SELECT l.agent_id AS leader_id
  FROM public.flc_team_leaders l
  WHERE public.flc_is_admin() OR l.agent_id=auth.uid()
     OR EXISTS(SELECT 1 FROM visible v WHERE v.id=l.agent_id)
 ), members AS (
  SELECT ls.leader_id,ls.leader_id AS agent_id,ARRAY[ls.leader_id]::uuid[] AS trail
  FROM leader_scope ls
  UNION ALL
  SELECT m.leader_id,a.agent_id,m.trail||a.agent_id
  FROM members m JOIN public.flc_team_assignments a ON a.leader_id=m.agent_id
  WHERE NOT a.agent_id=ANY(m.trail)
 ), uniq AS (
  SELECT DISTINCT leader_id,agent_id FROM members
 ), qualifying AS (
  SELECT u.leader_id,s.id,s.issue_paid_verified_at,
   s.annual_premium *
   (CASE WHEN s.agent_id=u.agent_id THEN s.split_primary_pct/100 ELSE 0 END +
    CASE WHEN s.split_agent_id=u.agent_id THEN (100-s.split_primary_pct)/100 ELSE 0 END) AS credited_ap
  FROM uniq u JOIN public.flc_policy_sales s
   ON s.agent_id=u.agent_id OR s.split_agent_id=u.agent_id
  WHERE s.status='Issue Paid' AND s.issue_paid_verified_at IS NOT NULL
    AND to_char(s.issue_paid_on,'YYYY-MM')=p_month
    AND (p_carrier IS NULL OR p_carrier='' OR s.carrier=p_carrier)
 )
 SELECT ls.leader_id,
   MAX(q.issue_paid_verified_at) FILTER(WHERE q.credited_ap>0) AS reached_at
 FROM leader_scope ls
 LEFT JOIN qualifying q ON q.leader_id=ls.leader_id
 WHERE public.flc_is_admin() OR public.flc_is_team_leader()
 GROUP BY ls.leader_id;
$$;
REVOKE ALL ON FUNCTION public.flc_leader_verified_rank_times(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_leader_verified_rank_times(text,text) TO authenticated;
