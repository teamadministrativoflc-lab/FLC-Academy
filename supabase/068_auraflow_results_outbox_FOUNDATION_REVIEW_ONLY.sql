-- 068: AuraFlow outbound results queue foundation. REVIEW ONLY.
-- NOT deployed by adding this file to GitHub. Do not execute until
-- integration security review is complete and an authorized dry-run test
-- and rollback plan exist.
--
-- No direct CRM writes. No HTTP calls. No secrets.
-- Existing agent recording RPC remains unchanged.
--
-- In production, the transactionally inserted event is the authoritative
-- source, not a browser-provided contact ID.
BEGIN;

CREATE TABLE IF NOT EXISTS public.flc_distribution_auraflow_results_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.flc_distribution_events(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.flc_distribution_leads(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','retry','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  remote_note_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flc_auraflow_results_outbox_due_idx
 ON public.flc_distribution_auraflow_results_outbox
 (next_attempt_at,created_at)
 WHERE status IN ('pending','retry');

-- The table must never be reachable directly by the browser.
ALTER TABLE public.flc_distribution_auraflow_results_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.flc_distribution_auraflow_results_outbox
 FROM PUBLIC, anon, authenticated;
-- RLS: no permissive policies for these roles.

-- Insert a queue row in the SAME transaction that stores an agent's
-- activity. Only genuine AuraFlow source contact IDs are accepted.
-- This trigger does NOT send, edit, or delete anything in AuraFlow.
CREATE OR REPLACE FUNCTION public.flc_distribution_queue_auraflow_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NEW.event_type NOT IN
   ('agent_call_logged','agent_note_logged','agent_follow_up_logged',
    'agent_appointment_logged') THEN
   RETURN NEW;
 END IF;
 IF NEW.actor_id IS NULL OR NEW.agent_id IS DISTINCT FROM NEW.actor_id THEN
   RETURN NEW;
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.flc_distribution_leads l
   WHERE l.id=NEW.lead_id
     AND lower(l.source_crm)='auraflow'
     AND nullif(btrim(l.source_contact_id),'') IS NOT NULL
     AND l.source_contact_id NOT LIKE 'FLC-PRUEBA-%'
     AND l.source_contact_id NOT LIKE 'FLC-HISTORIAL-%'
     AND l.source_campaign <> 'FLC_TEST_INTEGRACION'
 ) THEN
   RETURN NEW;
 END IF;
 INSERT INTO public.flc_distribution_auraflow_results_outbox(event_id,lead_id)
 VALUES(NEW.id, NEW.lead_id)
 ON CONFLICT(event_id) DO NOTHING;
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_queue_auraflow_result()
 FROM PUBLIC, anon, authenticated;

-- The trigger queues future activity only, not existing historical events.
DROP TRIGGER IF EXISTS flc_queue_auraflow_result_after_insert
 ON public.flc_distribution_events;
CREATE TRIGGER flc_queue_auraflow_result_after_insert
 AFTER INSERT ON public.flc_distribution_events
 FOR EACH ROW
 EXECUTE FUNCTION public.flc_distribution_queue_auraflow_result();

COMMIT;

-- REVIEW CHECKS (read-only):
-- SELECT count(*) FROM public.flc_distribution_auraflow_results_outbox;
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid='public.flc_distribution_events'::regclass
--    AND NOT tgisinternal;
--
-- IMPORTANT: No credential, worker, retry processor, API endpoint, mapping,
-- or CRM write is provided by this foundational migration.
-- Before installation ensure event-writing role policies, permissions,
-- native AuraFlow ID provenance, trigger behavior, and Supabase role/RLS
-- security have been audited.
