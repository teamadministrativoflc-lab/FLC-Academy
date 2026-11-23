-- FLC Lead Distribution Center: proposed foundation, NOT deployed.
-- Review Google Sheets/App Script rules and test on staging before executing.
-- Additive objects. No browser permissions. Do not put API credentials here.

CREATE TABLE IF NOT EXISTS public.flc_crm_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 leader_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 provider text NOT NULL CHECK(provider IN ('gohighlevel')),
 external_location_id text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','paused','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,external_location_id)
);

CREATE TABLE IF NOT EXISTS public.flc_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_leader_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 source_system text NOT NULL CHECK(source_system IN ('google_sheets','gohighlevel','meta','tiktok','other')),
 source_account text NOT NULL DEFAULT '',
 external_lead_id text,
 source_provider text,
 source_campaign text,
 contact_name text,
 contact_phone text,
 contact_email text,
 state_code text CHECK(state_code IS NULL OR state_code ~ '^[A-Z]{2} text NOT NULL DEFAULT 'new'
  CHECK(lifecycle_status IN ('new','assigned','working','appointment','sold','recycle_pending','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS flc_leads_external_identity_uq
 ON public.flc_leads(source_system,source_account,external_lead_id)
 WHERE external_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS flc_leads_owner_status_idx
 ON public.flc_leads(owner_leader_id,lifecycle_status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.flc_lead_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES public.flc_leads(id),
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz,
 reason text NOT NULL CHECK(reason IN ('initial','reassignment','recycle','manual','migration')),
 external_crm_contact_id text,
 CHECK(released_at IS NULL OR released_at>=assigned_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS flc_lead_one_active_assignment_uq
 ON public.flc_lead_assignments(lead_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS flc_lead_assignments_agent_idx
 ON public.flc_lead_assignments(agent_id,assigned_at DESC);

CREATE TABLE IF NOT EXISTS public.flc_lead_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES public.flc_leads(id),
 event_type text NOT NULL CHECK(event_type IN
 ('imported','assigned','released','status_changed','crm_synced',
  'recycle_eligible','duplicate_review','sale_linked',
  'call_attempt','note_added','appointment_set','timezone_verified')),
 event_at timestamptz NOT NULL DEFAULT now(),
 timezone_label_at_event text CHECK(timezone_label_at_event IS NULL OR timezone_label_at_event IN ('Eastern','Central','Mountain','Pacific')),
 local_date_at_event date,
 actor_agent_id uuid REFERENCES public.agent_profiles(id),
 source_system text NOT NULL DEFAULT 'flc',
 external_event_id text,
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS flc_lead_events_external_uq
 ON public.flc_lead_events(source_system,external_event_id)
 WHERE external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS flc_lead_events_timeline_idx
 ON public.flc_lead_events(lead_id,event_at DESC);

ALTER TABLE public.flc_crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_lead_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_crm_connections,public.flc_leads,
 public.flc_lead_assignments,public.flc_lead_events FROM PUBLIC,anon,authenticated;
-- No RLS policies/grants for authenticated users in phase one.
-- Before enabling ingestion, server-side workers must enforce tenant
-- and active agent membership and use idempotent external sync.
),
 timezone_label text CHECK(timezone_label IS NULL OR timezone_label IN ('Eastern','Central','Mountain','Pacific')),
 timezone_status text NOT NULL DEFAULT 'unverified'
  CHECK(timezone_status IN ('unverified','state_only','confirmed','ambiguous','out_of_scope')),
 timezone_iana text CHECK(timezone_iana IS NULL OR timezone_iana IN
  ('America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Etc/GMT+7')),
 lifecycle_status text NOT NULL DEFAULT 'new'
  CHECK(lifecycle_status IN ('new','assigned','working','appointment','sold','recycle_pending','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS flc_leads_external_identity_uq
 ON public.flc_leads(source_system,source_account,external_lead_id)
 WHERE external_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS flc_leads_owner_status_idx
 ON public.flc_leads(owner_leader_id,lifecycle_status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.flc_lead_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES public.flc_leads(id),
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz,
 reason text NOT NULL CHECK(reason IN ('initial','reassignment','recycle','manual','migration')),
 external_crm_contact_id text,
 CHECK(released_at IS NULL OR released_at>=assigned_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS flc_lead_one_active_assignment_uq
 ON public.flc_lead_assignments(lead_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS flc_lead_assignments_agent_idx
 ON public.flc_lead_assignments(agent_id,assigned_at DESC);

CREATE TABLE IF NOT EXISTS public.flc_lead_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES public.flc_leads(id),
 event_type text NOT NULL CHECK(event_type IN
 ('imported','assigned','released','status_changed','crm_synced','recycle_eligible','duplicate_review','sale_linked')),
 event_at timestamptz NOT NULL DEFAULT now(),
 actor_agent_id uuid REFERENCES public.agent_profiles(id),
 source_system text NOT NULL DEFAULT 'flc',
 external_event_id text,
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS flc_lead_events_external_uq
 ON public.flc_lead_events(source_system,external_event_id)
 WHERE external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS flc_lead_events_timeline_idx
 ON public.flc_lead_events(lead_id,event_at DESC);

ALTER TABLE public.flc_crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_lead_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_crm_connections,public.flc_leads,
 public.flc_lead_assignments,public.flc_lead_events FROM PUBLIC,anon,authenticated;
-- No RLS policies/grants for authenticated users in phase one.
-- Before enabling ingestion, server-side workers must enforce tenant
-- and active agent membership and use idempotent external sync.
