-- Step 620: Read-only agency standings for every signed-in agent.
-- Displays only aggregate submissions; no client or policy identifiers are returned.
-- One split policy counts for every credited agent, while AP follows split %.
CREATE OR REPLACE FUNCTION public.flc_agency_submitted_standings(
 p_start date,p_end date
) RETURNS TABLE(
 agent_id uuid,full_name text,submitted_policies bigint,submitted_ap numeric,
 rank_policies bigint,rank_ap bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH shares AS (
  SELECT c.agent_id,s.id AS policy_id,s.created_at,s.annual_premium*c.percent/100 AS credited_ap,
   CASE WHEN s.agent_id=c.agent_id THEN 0 ELSE 1 END AS primary_order
  FROM public.flc_policy_allocation c
  JOIN public.flc_policy_sales s ON s.id=c.policy_id
  WHERE auth.uid() IS NOT NULL
   AND p_start IS NOT NULL AND p_end>=p_start
   AND s.submitted_on BETWEEN p_start AND p_end
 ), aggregate AS (
  SELECT agent_id,
   COUNT(DISTINCT policy_id)::bigint AS policies,
   COALESCE(SUM(credited_ap),0)::numeric AS ap,
   MIN(created_at) AS first_reported_at,
   MIN(primary_order) AS primary_order
  FROM shares GROUP BY agent_id
 ), standing AS (
  SELECT a.agent_id,p.full_name::text AS full_name,a.policies,a.ap,
   ROW_NUMBER() OVER (ORDER BY a.policies DESC,a.first_reported_at ASC,a.primary_order ASC,p.full_name ASC,a.agent_id ASC)::bigint AS position_policies,
   ROW_NUMBER() OVER (ORDER BY a.ap DESC,a.first_reported_at ASC,a.primary_order ASC,p.full_name ASC,a.agent_id ASC)::bigint AS position_ap
  FROM aggregate a JOIN public.agent_profiles p ON p.id=a.agent_id
 )
 SELECT agent_id,full_name,policies,ap,position_policies,position_ap
 FROM standing ORDER BY position_policies;
$$;
REVOKE ALL ON FUNCTION public.flc_agency_submitted_standings(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_agency_submitted_standings(date,date) TO authenticated;
