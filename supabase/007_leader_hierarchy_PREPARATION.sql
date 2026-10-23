-- FLC Academy: hierarchy-scoped leader reporting. Execute in Supabase SQL Editor.
-- Existing user accounts and tracking rows remain unchanged.
CREATE TABLE IF NOT EXISTS public.flc_team_leaders (
 agent_id uuid PRIMARY KEY REFERENCES public.agent_profiles(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.flc_team_assignments (
 agent_id uuid PRIMARY KEY REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
 leader_id uuid NOT NULL REFERENCES public.flc_team_leaders(agent_id) ON DELETE RESTRICT,
 CHECK (agent_id<>leader_id)
);
CREATE INDEX IF NOT EXISTS flc_team_assignments_leader_idx ON public.flc_team_assignments(leader_id);
ALTER TABLE public.flc_team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_team_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_team_leaders,public.flc_team_assignments FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_is_team_leader()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS(SELECT 1 FROM public.flc_team_leaders l WHERE l.agent_id=auth.uid()); $$;
REVOKE ALL ON FUNCTION public.flc_is_team_leader() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_is_team_leader() TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_admin_set_team_leader(p_agent_id uuid,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=p_agent_id AND role<>'admin') THEN RAISE EXCEPTION 'Invalid agent'; END IF;
 IF p_enabled THEN
  INSERT INTO public.flc_team_leaders(agent_id) VALUES(p_agent_id) ON CONFLICT DO NOTHING;
 ELSE
  IF EXISTS(SELECT 1 FROM public.flc_team_assignments WHERE leader_id=p_agent_id) THEN
   RAISE EXCEPTION 'First reassign leader descendants';
  END IF;
  DELETE FROM public.flc_team_leaders WHERE agent_id=p_agent_id;
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.flc_admin_set_team_leader(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_set_team_leader(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_admin_assign_team_member(p_agent_id uuid,p_leader_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_cycle boolean;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=p_agent_id AND role<>'admin') THEN RAISE EXCEPTION 'Invalid member'; END IF;
 IF p_leader_id IS NULL THEN DELETE FROM public.flc_team_assignments WHERE agent_id=p_agent_id; RETURN; END IF;
 IF p_agent_id=p_leader_id THEN RAISE EXCEPTION 'Self assignment'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.flc_team_leaders WHERE agent_id=p_leader_id) THEN RAISE EXCEPTION 'Invalid leader'; END IF;
 PERFORM pg_advisory_xact_lock(7159026);
 WITH RECURSIVE descendants(id,path) AS (
  SELECT p_agent_id,ARRAY[p_agent_id]::uuid[]
  UNION ALL SELECT x.agent_id,d.path||x.agent_id FROM public.flc_team_assignments x JOIN descendants d ON x.leader_id=d.id
  WHERE NOT x.agent_id=ANY(d.path)
 )
 SELECT EXISTS(SELECT 1 FROM descendants WHERE id=p_leader_id) INTO v_cycle;
 IF v_cycle THEN RAISE EXCEPTION 'Cycle prohibited'; END IF;
 INSERT INTO public.flc_team_assignments(agent_id,leader_id) VALUES(p_agent_id,p_leader_id)
 ON CONFLICT(agent_id) DO UPDATE SET leader_id=excluded.leader_id;
END;$$;
REVOKE ALL ON FUNCTION public.flc_admin_assign_team_member(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_assign_team_member(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_admin_team_roster()
RETURNS TABLE(id uuid,full_name text,is_leader boolean,leader_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT p.id,p.full_name::text,(l.agent_id IS NOT NULL),a.leader_id FROM public.agent_profiles p
LEFT JOIN public.flc_team_leaders l ON l.agent_id=p.id
LEFT JOIN public.flc_team_assignments a ON a.agent_id=p.id
WHERE public.flc_is_admin() AND p.role<>'admin' ORDER BY p.full_name; $$;
REVOKE ALL ON FUNCTION public.flc_admin_team_roster() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_team_roster() TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_my_team_report()
RETURNS TABLE(agent_id uuid,full_name text,direct_leader_id uuid,depth integer,
 last_login timestamptz,module_percent integer,tutorial_count integer,
 quiz_attempts integer,best_score numeric,passed boolean,certificate_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH RECURSIVE downline(id,leader,depth,path) AS (
 SELECT a.agent_id,a.leader_id,1,ARRAY[auth.uid(),a.agent_id]::uuid[] FROM public.flc_team_assignments a WHERE a.leader_id=auth.uid()
 UNION ALL
 SELECT a.agent_id,a.leader_id,d.depth+1,d.path||a.agent_id FROM public.flc_team_assignments a JOIN downline d ON d.id=a.leader_id
 WHERE d.depth<30 AND NOT a.agent_id=ANY(d.path)
)
SELECT p.id,p.full_name::text,d.leader,d.depth,
 (SELECT MAX(x.logged_in_at) FROM public.login_activity x WHERE x.agent_id=p.id),
 COALESCE((SELECT ROUND(SUM(x.progress_percent)::numeric/3)::integer FROM public.module_progress x WHERE x.agent_id=p.id AND x.module_id IN ('m1','m2','m3')),0),
 (SELECT COUNT(*)::integer FROM public.tutorial_completions x WHERE x.agent_id=p.id),
 (SELECT COUNT(*)::integer FROM public.quiz_attempts x WHERE x.agent_id=p.id),
 (SELECT MAX(x.score_percent) FROM public.quiz_attempts x WHERE x.agent_id=p.id),
 COALESCE((SELECT BOOL_OR(x.passed) FROM public.quiz_attempts x WHERE x.agent_id=p.id),false),
 (SELECT x.certificate_code::text FROM public.certificates x WHERE x.agent_id=p.id ORDER BY x.issued_at DESC LIMIT 1)
FROM downline d JOIN public.agent_profiles p ON p.id=d.id
WHERE public.flc_is_team_leader() ORDER BY d.depth,p.full_name;
$$;
REVOKE ALL ON FUNCTION public.flc_my_team_report() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_my_team_report() TO authenticated;
