-- FLC Academy · Tutorial completion tracking
-- Agents may mark their own tutorials completed; admins may read all records.
-- Completion is agent-confirmed, not independent proof of full playback.
CREATE TABLE IF NOT EXISTS public.tutorial_completions (
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial_id text NOT NULL CHECK (length(tutorial_id) BETWEEN 1 AND 120),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, tutorial_id)
);
ALTER TABLE public.tutorial_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tutorial_completions FROM anon;
GRANT SELECT, INSERT ON public.tutorial_completions TO authenticated;
DROP POLICY IF EXISTS tutorial_completions_agent_read ON public.tutorial_completions;
CREATE POLICY tutorial_completions_agent_read ON public.tutorial_completions FOR SELECT TO authenticated
USING (
  agent_id = (select auth.uid())
  OR EXISTS (SELECT 1 FROM public.agent_profiles p
     WHERE p.id = (select auth.uid()) AND p.role = 'admin')
);
DROP POLICY IF EXISTS tutorial_completions_agent_insert ON public.tutorial_completions;
CREATE POLICY tutorial_completions_agent_insert ON public.tutorial_completions FOR INSERT TO authenticated
WITH CHECK (agent_id = (select auth.uid()));
CREATE INDEX IF NOT EXISTS tutorial_completions_agent_idx ON public.tutorial_completions(agent_id);
