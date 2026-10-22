-- Tracking de segmentos reproducidos (5 segundos por segmento)
CREATE TABLE IF NOT EXISTS public.tutorial_watch_progress (
 agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 tutorial_id text NOT NULL CHECK (length(tutorial_id) BETWEEN 1 AND 120),
 watched_segments integer[] NOT NULL DEFAULT '{}'::integer[],
 duration_seconds integer NOT NULL DEFAULT 0 CHECK(duration_seconds BETWEEN 0 AND 86400),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(agent_id,tutorial_id)
);
ALTER TABLE public.tutorial_watch_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutorial_watch_progress FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.tutorial_watch_progress TO authenticated;
DROP POLICY IF EXISTS tutorial_watch_select ON public.tutorial_watch_progress;
CREATE POLICY tutorial_watch_select ON public.tutorial_watch_progress FOR SELECT TO authenticated USING(agent_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.agent_profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));
DROP POLICY IF EXISTS tutorial_watch_insert ON public.tutorial_watch_progress;
CREATE POLICY tutorial_watch_insert ON public.tutorial_watch_progress FOR INSERT TO authenticated WITH CHECK(agent_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS tutorial_watch_update ON public.tutorial_watch_progress;
CREATE POLICY tutorial_watch_update ON public.tutorial_watch_progress FOR UPDATE TO authenticated USING(agent_id=(SELECT auth.uid())) WITH CHECK(agent_id=(SELECT auth.uid()));
-- Existing completion rows are retained. Remove direct INSERT from authenticated clients:
REVOKE INSERT ON public.tutorial_completions FROM authenticated;
DROP POLICY IF EXISTS tutorial_completions_agent_insert ON public.tutorial_completions;
-- Finalization function checks coverage stored in progress, not just a UI button.
CREATE OR REPLACE FUNCTION public.flc_complete_watched_tutorial(p_tutorial_id text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_uid uuid:=auth.uid(); v_progress public.tutorial_watch_progress%ROWTYPE;
 v_total integer; v_count integer; v_result timestamptz;
BEGIN
 IF v_uid IS NULL OR p_tutorial_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO v_progress FROM public.tutorial_watch_progress
 WHERE agent_id=v_uid AND tutorial_id=p_tutorial_id FOR UPDATE;
 IF NOT FOUND OR v_progress.duration_seconds<10 THEN RAISE EXCEPTION 'Video progress missing'; END IF;
 v_total:=CEIL(v_progress.duration_seconds::numeric / 5);
 SELECT COUNT(DISTINCT seg) INTO v_count FROM unnest(v_progress.watched_segments) AS seg WHERE seg>=0 AND seg<v_total;
 IF v_count::numeric / GREATEST(v_total,1) < 0.95 THEN RAISE EXCEPTION 'Video not yet watched'; END IF;
 INSERT INTO public.tutorial_completions(agent_id,tutorial_id) VALUES (v_uid,p_tutorial_id)
 ON CONFLICT(agent_id,tutorial_id) DO NOTHING;
 SELECT completed_at INTO v_result FROM public.tutorial_completions WHERE agent_id=v_uid AND tutorial_id=p_tutorial_id;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.flc_complete_watched_tutorial(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_complete_watched_tutorial(text) TO authenticated;
-- Browser-provided watch segments cannot prove attention; this is an integrity check against ordinary seek/skip behavior.
