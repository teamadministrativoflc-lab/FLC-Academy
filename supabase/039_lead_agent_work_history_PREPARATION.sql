-- FLC Lead Distribution Center: never reassign a previously WORKED lead to same agent.
-- DRAFT ONLY. To be installed AFTER phase-one schema and event ingestion are tested.
-- Past ownership is NOT equivalent to worked. Activity must be a verified event.
-- All assignment writers (Sheets sync, CRM webhooks, admin UI) must use the same transaction.

CREATE TABLE IF NOT EXISTS public.flc_lead_agent_work_history (
  lead_id uuid NOT NULL REFERENCES public.flc_leads(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
  first_worked_at timestamptz NOT NULL DEFAULT now(),
  first_event_id uuid REFERENCES public.flc_lead_events(id),
  PRIMARY KEY (lead_id, agent_id)
);
CREATE INDEX IF NOT EXISTS flc_lead_agent_work_history_agent_idx
  ON public.flc_lead_agent_work_history(agent_id,first_worked_at DESC);
ALTER TABLE public.flc_lead_agent_work_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_lead_agent_work_history FROM PUBLIC,anon,authenticated;

-- Require a validated actor/event before inserting into this table.
-- Examples of qualifying activity: completed call attempt, logged contact,
-- note, appointment or status transition performed by assigned agent.
-- Mere assignment or webhook delivery is NOT sufficient.
--
-- In the assignment transaction, reject:
-- EXISTS (SELECT 1 FROM public.flc_lead_agent_work_history h
--         WHERE h.lead_id = p_lead_id AND h.agent_id = p_agent_id)
--
-- IMPORTANT: Also protect concurrency: lock the lead row (SELECT ... FOR UPDATE)
-- and close prior active assignment in same transaction before new insert.
-- Keep a unique partial index on active assignment (defined in 038 migration).
--
-- Until actual activity events and assignment permissions are implemented,
-- do NOT grant writes or deploy this rule. Backfill from verifiable history;
-- never infer "worked" solely from historical agent assignment.
