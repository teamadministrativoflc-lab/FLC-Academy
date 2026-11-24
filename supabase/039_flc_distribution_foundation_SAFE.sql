-- FLC Lead Distribution Center: foundation only.
-- Run in the MAIN FLC Academy Supabase project after reviewing.
-- Creates four NEW tables; does not touch existing agents, sales, or Google Sheets.
-- No API integration or automatic assignments are enabled by this migration.
BEGIN;

CREATE TABLE IF NOT EXISTS public.flc_distribution_agent_availability (
  agent_id uuid PRIMARY KEY REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flc_availability_verified_consistency CHECK (
    (is_verified = false) OR (verified_at IS NOT NULL AND verified_by IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.flc_distribution_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_crm text NOT NULL,
  source_contact_id text NOT NULL,
  source_campaign text NOT NULL DEFAULT 'PENDIENTE_IDENTIFICAR',
  first_name text,
  last_name text,
  phone text,
  email text,
  lead_state text,
  status text NOT NULL DEFAULT 'pending',
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flc_dist_leads_source_unique UNIQUE(source_crm, source_contact_id),
  CONSTRAINT flc_dist_leads_status_check CHECK (status IN ('pending','assigned','paused','closed','invalid')),
  CONSTRAINT flc_dist_leads_source_nonempty CHECK(length(trim(source_crm)) > 0 AND length(trim(source_contact_id)) > 0)
);

CREATE TABLE IF NOT EXISTS public.flc_distribution_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.flc_distribution_leads(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ended_at timestamptz,
  ended_reason text,
  CONSTRAINT flc_dist_assignment_end_check CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS flc_dist_one_current_agent_per_lead
  ON public.flc_distribution_assignments(lead_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS flc_dist_assignments_agent_current
  ON public.flc_distribution_assignments(agent_id, assigned_at DESC) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS public.flc_distribution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.flc_distribution_leads(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flc_dist_events_lead_created
  ON public.flc_distribution_events(lead_id, created_at DESC);

-- Closed by default until access policies, administrator authorization
-- and source validation are implemented and tested.
ALTER TABLE public.flc_distribution_agent_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_distribution_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_distribution_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_distribution_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.flc_distribution_agent_availability FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.flc_distribution_leads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.flc_distribution_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.flc_distribution_events FROM PUBLIC, anon, authenticated;

COMMIT;

-- Post-creation verification (returns four rows, table names only):
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN (
    'flc_distribution_agent_availability',
    'flc_distribution_leads',
    'flc_distribution_assignments',
    'flc_distribution_events'
  )
ORDER BY table_name;
