-- Step 617: Scope-accurate split producer counts for agency and team reporting.
-- Replaces only the existing reporting RPC. No policy, award or lead rows changed.
-- Keep split AP credited by allocation percentage; distinct producing agents
-- are counted within each scope, not borrowed from another team.
CREATE OR REPLACE FUNCTION public.flc_period_team_metrics(
 p_start date,p_end date,p_carrier text DEFAULT NULL
) RETURNS TABLE(
 scope text,leader_id uuid,leader_name text,depth integer,
 submitted_ap numeric,verified_ap numeric,
 submitting_agents bigint,verified_agents bigint,
 submitted_policies bigint,verified_policies bigint,
 verified_reached_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH RECURSIVE visible AS (
  SELECT a.agent_id AS id,1 AS depth,ARRAY[auth.uid(),a.agent_id]::uuid[] AS trail
  FROM public.flc_team_assignments a WHERE a.leader_id=auth.uid()
  UNION ALL
  SELECT a.agent_id,v.depth+1,v.trail||a.agent_id
  FROM visible v JOIN public.flc_team_assignments a ON a.leader_id=v.id
  WHERE NOT a.agent_id=ANY(v.trail)
 ), roots AS (
  SELECT l.agent_id AS id,0 AS depth,ARRAY[l.agent_id]::uuid[] AS trail
  FROM public.flc_team_leaders l
  WHERE NOT EXISTS(SELECT 1 FROM public.flc_team_assignments a WHERE a.agent_id=l.agent_id)
 ), admin_tree AS (
  SELECT id,depth,trail FROM roots
  UNION ALL
  SELECT a.agent_id,t.depth+1,t.trail||a.agent_id
  FROM admin_tree t JOIN public.flc_team_assignments a ON a.leader_id=t.id
  WHERE NOT a.agent_id=ANY(t.trail)
 ), leaders AS (
  SELECT l.agent_id AS id,p.full_name::text AS name,
   CASE WHEN public.flc_is_admin() THEN COALESCE((SELECT MIN(t.depth) FROM admin_tree t WHERE t.id=l.agent_id),0)
    WHEN l.agent_id=auth.uid() THEN 0 ELSE COALESCE((SELECT MIN(v.depth) FROM visible v WHERE v.id=l.agent_id),1) END AS depth
  FROM public.flc_team_leaders l JOIN public.agent_profiles p ON p.id=l.agent_id
  WHERE public.flc_is_admin() OR l.agent_id=auth.uid()
   OR EXISTS(SELECT 1 FROM visible v WHERE v.id=l.agent_id)
 ), members AS (
  SELECT l.id AS leader_id,l.id AS agent_id,ARRAY[l.id]::uuid[] AS trail FROM leaders l
  UNION ALL
  SELECT m.leader_id,a.agent_id,m.trail||a.agent_id
  FROM members m JOIN public.flc_team_assignments a ON a.leader_id=m.agent_id
  WHERE NOT a.agent_id=ANY(m.trail)
 ), scopes AS (
  SELECT 'team'::text AS scope,m.leader_id,m.agent_id FROM members m
  UNION ALL
  SELECT 'agency'::text,NULL::uuid AS leader_id,a.id
  FROM public.agent_profiles a WHERE (public.flc_is_admin() OR EXISTS(
  SELECT 1 FROM public.flc_team_leaders owner_root
  WHERE owner_root.agent_id=auth.uid()
   AND NOT EXISTS(SELECT 1 FROM public.flc_team_assignments parent WHERE parent.agent_id=owner_root.agent_id)
   AND EXISTS(SELECT 1 FROM public.flc_team_assignments child WHERE child.leader_id=owner_root.agent_id)
 ))
 ), distinct_scopes AS (
  SELECT DISTINCT scope,leader_id,agent_id FROM scopes
 ), credited AS (
  SELECT d.scope,d.leader_id,d.agent_id,s.id AS policy_id,s.submitted_on,s.issue_paid_on,
   s.issue_paid_verified_at,s.status,s.annual_premium*c.percent/100 AS credit
  FROM distinct_scopes d
  JOIN public.flc_policy_allocation c ON c.agent_id=d.agent_id
  JOIN public.flc_policy_sales s ON s.id=c.policy_id
  WHERE (p_carrier IS NULL OR p_carrier='' OR s.carrier=p_carrier)
   AND ((s.submitted_on>=p_start AND s.submitted_on<=p_end)
    OR (s.issue_paid_on>=p_start AND s.issue_paid_on<=p_end))
 ), participant_counts AS (
  -- Count each credited agent exactly once IN THE SELECTED SCOPE.
  -- A split has multiple producers agency-wide, but a different team's
  -- participant must never inflate this team's producer denominator.
  SELECT scope,leader_id,
   COUNT(DISTINCT agent_id) FILTER(WHERE submitted_on BETWEEN p_start AND p_end) AS submitting_agents,
   COUNT(DISTINCT agent_id) FILTER(WHERE status='Issue Paid' AND issue_paid_verified_at IS NOT NULL AND issue_paid_on BETWEEN p_start AND p_end) AS verified_agents
  FROM credited GROUP BY scope,leader_id
 ), aggregates AS (
  SELECT c.scope,c.leader_id,
   COALESCE(SUM(c.credit) FILTER(WHERE c.submitted_on BETWEEN p_start AND p_end),0) AS submitted_ap,
   COALESCE(SUM(c.credit) FILTER(WHERE c.status='Issue Paid' AND c.issue_paid_verified_at IS NOT NULL AND c.issue_paid_on BETWEEN p_start AND p_end),0) AS verified_ap,
   COUNT(DISTINCT c.policy_id) FILTER(WHERE c.submitted_on BETWEEN p_start AND p_end) AS submitted_policies,
   COUNT(DISTINCT c.policy_id) FILTER(WHERE c.status='Issue Paid' AND c.issue_paid_verified_at IS NOT NULL AND c.issue_paid_on BETWEEN p_start AND p_end) AS verified_policies,
   MAX(c.issue_paid_verified_at) FILTER(WHERE c.status='Issue Paid' AND c.issue_paid_verified_at IS NOT NULL AND c.issue_paid_on BETWEEN p_start AND p_end) AS verified_reached_at
  FROM credited c GROUP BY c.scope,c.leader_id
 )
 SELECT 'team'::text,l.id,l.name,l.depth,
  COALESCE(a.submitted_ap,0),COALESCE(a.verified_ap,0),
  COALESCE(pc.submitting_agents,0),COALESCE(pc.verified_agents,0),
  COALESCE(a.submitted_policies,0),COALESCE(a.verified_policies,0),a.verified_reached_at
 FROM leaders l LEFT JOIN aggregates a ON a.scope='team' AND a.leader_id=l.id
 LEFT JOIN participant_counts pc ON pc.scope='team' AND pc.leader_id=l.id
 WHERE auth.uid() IS NOT NULL AND (public.flc_is_admin() OR public.flc_is_team_leader())
 UNION ALL
 SELECT 'agency'::text,NULL::uuid,'Toda FLC'::text,-1,
  COALESCE(a.submitted_ap,0),COALESCE(a.verified_ap,0),
  COALESCE(pc.submitting_agents,0),COALESCE(pc.verified_agents,0),
  COALESCE(a.submitted_policies,0),COALESCE(a.verified_policies,0),a.verified_reached_at
 FROM (SELECT 1) x LEFT JOIN aggregates a ON a.scope='agency'
 LEFT JOIN participant_counts pc ON pc.scope='agency'
 WHERE auth.uid() IS NOT NULL AND (public.flc_is_admin() OR EXISTS(
  SELECT 1 FROM public.flc_team_leaders owner_root
  WHERE owner_root.agent_id=auth.uid()
   AND NOT EXISTS(SELECT 1 FROM public.flc_team_assignments parent WHERE parent.agent_id=owner_root.agent_id)
   AND EXISTS(SELECT 1 FROM public.flc_team_assignments child WHERE child.leader_id=owner_root.agent_id)
 ));
$$;
REVOKE ALL ON FUNCTION public.flc_period_team_metrics(date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_period_team_metrics(date,date,text) TO authenticated;
