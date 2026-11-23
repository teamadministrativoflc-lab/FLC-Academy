-- FLC Academy Testing: isolated Zoom attendance pilot
-- Safe to run ONLY in the EMPTY public schema of FLC Academy Testing.
-- Does not import agents, authorize any Zoom meeting, or grant browser access.
-- All tables have Row Level Security enabled and no policies (deny by default).
-- Schema only: the webhook currently verifies events but does NOT write to tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.flc_zoom_test_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_user_id uuid UNIQUE,
  zoom_user_id text UNIQUE,
  zoom_email_normalized text,
  zoom_identity_verified_at timestamptz,
  authorized_by uuid,
  authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flc_zoom_test_identity_pair CHECK (
    zoom_identity_verified_at IS NULL OR zoom_user_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.flc_zoom_test_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_meeting_id text NOT NULL UNIQUE,
  label text NOT NULL,
  authorized boolean NOT NULL DEFAULT false,
  authorized_by uuid,
  authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flc_zoom_test_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.flc_zoom_test_agents(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.flc_zoom_test_meetings(id) ON DELETE CASCADE,
  zoom_participant_id text NOT NULL,
  joined_at timestamptz NOT NULL,
  left_at timestamptz,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  evidence_source text NOT NULL DEFAULT 'zoom_webhook',
  CONSTRAINT flc_zoom_test_attendance_times CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS flc_zoom_test_open_presence_unique
  ON public.flc_zoom_test_attendance(agent_id, meeting_id, zoom_participant_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS flc_zoom_test_attendance_agent_time
  ON public.flc_zoom_test_attendance(agent_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS public.flc_zoom_test_event_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (event_type IN ('meeting.participant_joined','meeting.participant_left')),
  meeting_id uuid REFERENCES public.flc_zoom_test_meetings(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'unprocessed'
    CHECK (outcome IN ('unprocessed','accepted','ignored','identity_unverified','meeting_unauthorized','error'))
);

ALTER TABLE public.flc_zoom_test_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_zoom_test_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_zoom_test_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_zoom_test_event_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.flc_zoom_test_agents,
  public.flc_zoom_test_meetings,
  public.flc_zoom_test_attendance,
  public.flc_zoom_test_event_receipts
  FROM PUBLIC, anon, authenticated;

COMMIT;

-- Expected: four tables, empty.
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'flc_zoom_test_%'
ORDER BY table_name;
