-- Returns only agent IDs within a selected leader's complete downline, including the leader.
-- Admin-only RPC. No policy/customer information is returned.
CREATE OR REPLACE FUNCTION public.flc_admin_structure_member_ids(p_leader_id uuid)
RETURNS TABLE(agent_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.flc_team_leaders WHERE flc_team_leaders.agent_id=p_leader_id)
 THEN RAISE EXCEPTION 'Selected agent is not a team leader'; END IF;
 RETURN QUERY
 WITH RECURSIVE members(id,trail) AS (
  SELECT p_leader_id,ARRAY[p_leader_id]::uuid[]
  UNION ALL
  SELECT a.agent_id,m.trail||a.agent_id
  FROM members m JOIN public.flc_team_assignments a ON a.leader_id=m.id
  WHERE NOT a.agent_id=ANY(m.trail)
 )
 SELECT DISTINCT m.id FROM members m;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_admin_structure_member_ids(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_structure_member_ids(uuid) TO authenticated;
