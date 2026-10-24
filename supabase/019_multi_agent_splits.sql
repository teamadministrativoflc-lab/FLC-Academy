-- FLC multi-agent split (3–5 participants), backwards compatible with legacy
-- one/two-agent policies. Run only in the reviewed Preview rollout.
-- No existing sales are deleted or rewritten.
CREATE TABLE IF NOT EXISTS public.flc_policy_multi_credits (
 policy_id uuid NOT NULL REFERENCES public.flc_policy_sales(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 percent numeric(5,2) NOT NULL CHECK(percent>0 AND percent<100),
 PRIMARY KEY(policy_id,agent_id)
);
CREATE INDEX IF NOT EXISTS flc_policy_multi_credits_agent_idx
 ON public.flc_policy_multi_credits(agent_id,policy_id);
ALTER TABLE public.flc_policy_multi_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_policy_multi_credits FROM PUBLIC,anon,authenticated;

-- SECURITY DEFINER functions use this private unified allocation view.
-- Legacy policies use the original columns. Multi-policies use only the
-- normalized rows (not the legacy placeholder of 100% primary credit).
CREATE OR REPLACE VIEW public.flc_policy_allocation AS
 SELECT m.policy_id,m.agent_id,m.percent
 FROM public.flc_policy_multi_credits m
 UNION ALL
 SELECT s.id,s.agent_id,s.split_primary_pct
 FROM public.flc_policy_sales s
 WHERE NOT EXISTS (SELECT 1 FROM public.flc_policy_multi_credits m WHERE m.policy_id=s.id)
 UNION ALL
 SELECT s.id,s.split_agent_id,(100-s.split_primary_pct)
 FROM public.flc_policy_sales s
 WHERE s.split_agent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.flc_policy_multi_credits m WHERE m.policy_id=s.id);
REVOKE ALL ON public.flc_policy_allocation FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_can_view_multi_split_policy(p_policy_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.flc_policy_multi_credits c
  WHERE c.policy_id=p_policy_id
   AND public.flc_can_view_policy_agent(c.agent_id)
 );
$$;
REVOKE ALL ON FUNCTION public.flc_can_view_multi_split_policy(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_can_view_multi_split_policy(uuid) TO authenticated;

DROP POLICY IF EXISTS flc_policy_sales_read ON public.flc_policy_sales;
CREATE POLICY flc_policy_sales_read ON public.flc_policy_sales FOR SELECT TO authenticated
USING(
 public.flc_can_view_policy_agent(agent_id)
 OR split_agent_id=auth.uid()
 OR public.flc_can_view_multi_split_policy(id)
);

-- Names and exact percentages only for policies within the caller's scope.
CREATE OR REPLACE FUNCTION public.flc_policy_participant_credits()
RETURNS TABLE(policy_id uuid,agent_id uuid,full_name text,pct numeric,is_primary boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT c.policy_id,c.agent_id,p.full_name::text,c.percent,(c.agent_id=s.agent_id)
 FROM public.flc_policy_allocation c
 JOIN public.flc_policy_sales s ON s.id=c.policy_id
 JOIN public.agent_profiles p ON p.id=c.agent_id
 WHERE auth.uid() IS NOT NULL AND (
  public.flc_can_view_policy_agent(s.agent_id)
  OR s.split_agent_id=auth.uid()
  OR public.flc_can_view_multi_split_policy(s.id)
 );
$$;
REVOKE ALL ON FUNCTION public.flc_policy_participant_credits() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_policy_participant_credits() TO authenticated;

-- Additional policy creation path for three to five credited agents.
-- p_allocations is [{"agent_id":"uuid","pct":40}, ...], principal first.
CREATE OR REPLACE FUNCTION public.flc_create_policy_multi(
 p_client_name text,p_carrier text,p_product_type text,p_policy_number text,
 p_lead_source text,p_lead_source_other text,p_annual_premium numeric,
 p_submitted_on date,p_allocations jsonb,p_primary_agent_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;v_primary uuid;v_count integer;v_total numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=auth.uid()) THEN
  RAISE EXCEPTION 'Valid agent session required';
 END IF;
 v_primary:=COALESCE(p_primary_agent_id,auth.uid());
 IF NOT public.flc_is_admin() AND v_primary<>auth.uid() THEN
  RAISE EXCEPTION 'Agents can only submit their own policies';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=v_primary) THEN
  RAISE EXCEPTION 'Primary agent does not exist';
 END IF;
 IF jsonb_typeof(p_allocations) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Allocations must be an array';
 END IF;
 v_count:=jsonb_array_length(p_allocations);
 IF v_count<3 OR v_count>5 THEN
  RAISE EXCEPTION 'Multi-split requires 3 to 5 participants';
 END IF;
 SELECT sum(a.pct) INTO v_total
 FROM jsonb_to_recordset(p_allocations) AS a(agent_id uuid,pct numeric);
 IF v_total<>100 THEN RAISE EXCEPTION 'Split percentages must total exactly 100'; END IF;
 IF (SELECT count(DISTINCT a.agent_id)
     FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric))<>v_count THEN
  RAISE EXCEPTION 'Each agent may appear only once';
 END IF;
 IF (SELECT (p_allocations->0->>'agent_id')::uuid) IS DISTINCT FROM v_primary THEN
  RAISE EXCEPTION 'First allocation must be the primary agent';
 END IF;
 IF EXISTS(
  SELECT 1 FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric)
  LEFT JOIN public.agent_profiles p ON p.id=a.agent_id
  WHERE a.agent_id IS NULL OR a.pct IS NULL OR a.pct<=0 OR a.pct>=100
   OR p.id IS NULL OR (p.role='admin' AND a.agent_id<>v_primary)
 ) THEN RAISE EXCEPTION 'Invalid split participant or percentage'; END IF;
 INSERT INTO public.flc_policy_sales(
  agent_id,client_name,carrier,product_type,policy_number,lead_source,
  lead_source_other,annual_premium,split_agent_id,split_primary_pct,submitted_on
 ) VALUES(
  v_primary,btrim(p_client_name),btrim(p_carrier),btrim(p_product_type),
  nullif(btrim(p_policy_number),''),p_lead_source,
  nullif(btrim(p_lead_source_other),''),p_annual_premium,NULL,100,p_submitted_on
 ) RETURNING id INTO v_id;
 INSERT INTO public.flc_policy_multi_credits(policy_id,agent_id,percent)
 SELECT v_id,a.agent_id,a.pct
 FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric);
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_create_policy_multi(text,text,text,text,text,text,numeric,date,jsonb,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_create_policy_multi(text,text,text,text,text,text,numeric,date,jsonb,uuid)
 TO authenticated;

-- Rebuild leader aggregates and timestamp tie-breaks using all participants.
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
 ), admin_roots AS (
  SELECT l.agent_id AS id,0 AS depth,ARRAY[l.agent_id]::uuid[] AS trail
  FROM public.flc_team_leaders l
  WHERE NOT EXISTS(SELECT 1 FROM public.flc_team_assignments a WHERE a.agent_id=l.agent_id)
 ), admin_tree AS (
  SELECT id,depth,trail FROM admin_roots
  UNION ALL
  SELECT a.agent_id,t.depth+1,t.trail||a.agent_id
  FROM admin_tree t JOIN public.flc_team_assignments a ON a.leader_id=t.id
  WHERE NOT a.agent_id=ANY(t.trail)
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
 ), policy_shares AS (
  SELECT a.policy_id,a.agent_id,a.percent FROM public.flc_policy_allocation a
 ), credits AS (
  SELECT u.leader_id,s.id,s.submitted_on,s.issue_paid_on,s.status,
    s.annual_premium * a.percent/100 AS credit
  FROM uniq u JOIN policy_shares a ON a.agent_id=u.agent_id
  JOIN public.flc_policy_sales s ON s.id=a.policy_id
  WHERE p_carrier IS NULL OR p_carrier='' OR s.carrier=p_carrier
 )
 SELECT ls.leader_id,p.full_name::text,
  CASE WHEN public.flc_is_admin()
       THEN COALESCE((SELECT MIN(t.depth) FROM admin_tree t WHERE t.id=ls.leader_id),0)
       WHEN ls.leader_id=auth.uid() THEN 0
       ELSE (SELECT MIN(v.depth) FROM visible v WHERE v.id=ls.leader_id) END AS depth,
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

-- Hierarchy-scoped, split-credited production per leader/subleader.
-- Only admin or an assigned team leader can use this report.
CREATE OR REPLACE FUNCTION public.flc_leader_verified_production_report(p_month text,p_carrier text DEFAULT NULL)
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
 ), admin_roots AS (
  SELECT l.agent_id AS id,0 AS depth,ARRAY[l.agent_id]::uuid[] AS trail
  FROM public.flc_team_leaders l
  WHERE NOT EXISTS(SELECT 1 FROM public.flc_team_assignments a WHERE a.agent_id=l.agent_id)
 ), admin_tree AS (
  SELECT id,depth,trail FROM admin_roots
  UNION ALL
  SELECT a.agent_id,t.depth+1,t.trail||a.agent_id
  FROM admin_tree t JOIN public.flc_team_assignments a ON a.leader_id=t.id
  WHERE NOT a.agent_id=ANY(t.trail)
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
 ), policy_shares AS (
  SELECT a.policy_id,a.agent_id,a.percent FROM public.flc_policy_allocation a
 ), credits AS (
  SELECT u.leader_id,s.id,s.submitted_on,s.issue_paid_on,s.issue_paid_verified_at,s.status,
    s.annual_premium * a.percent/100 AS credit
  FROM uniq u JOIN policy_shares a ON a.agent_id=u.agent_id
  JOIN public.flc_policy_sales s ON s.id=a.policy_id
  WHERE p_carrier IS NULL OR p_carrier='' OR s.carrier=p_carrier
 )
 SELECT ls.leader_id,p.full_name::text,
  CASE WHEN public.flc_is_admin()
       THEN COALESCE((SELECT MIN(t.depth) FROM admin_tree t WHERE t.id=ls.leader_id),0)
       WHEN ls.leader_id=auth.uid() THEN 0
       ELSE (SELECT MIN(v.depth) FROM visible v WHERE v.id=ls.leader_id) END AS depth,
  COUNT(DISTINCT c.id) FILTER(WHERE to_char(c.submitted_on,'YYYY-MM')=p_month),
  COALESCE(SUM(c.credit) FILTER(WHERE to_char(c.submitted_on,'YYYY-MM')=p_month),0),
  COUNT(DISTINCT c.id) FILTER(WHERE c.status='Issue Paid' AND c.issue_paid_verified_at IS NOT NULL AND to_char(c.issue_paid_on,'YYYY-MM')=p_month),
  COALESCE(SUM(c.credit) FILTER(WHERE c.status='Issue Paid' AND c.issue_paid_verified_at IS NOT NULL AND to_char(c.issue_paid_on,'YYYY-MM')=p_month),0)
 FROM leader_scope ls JOIN public.agent_profiles p ON p.id=ls.leader_id
 LEFT JOIN credits c ON c.leader_id=ls.leader_id
 WHERE public.flc_is_admin() OR public.flc_is_team_leader()
 GROUP BY ls.leader_id,p.full_name ORDER BY 3,2;
$$;
REVOKE ALL ON FUNCTION public.flc_leader_verified_production_report(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_leader_verified_production_report(text,text) TO authenticated;

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
 ), policy_shares AS (
  SELECT a.policy_id,a.agent_id,a.percent FROM public.flc_policy_allocation a
 ), qualifying AS (
  SELECT u.leader_id,s.id,s.issue_paid_verified_at,
   s.annual_premium*a.percent/100 AS credited_ap
  FROM uniq u JOIN policy_shares a ON a.agent_id=u.agent_id
  JOIN public.flc_policy_sales s ON s.id=a.policy_id
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
