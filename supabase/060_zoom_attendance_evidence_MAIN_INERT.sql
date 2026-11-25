-- 060 — Zoom attendance evidence foundation in MAIN.
-- INERT: No event processors or triggers; no lead assignment or availability updates.
-- Zoom webhook remains in isolated testing until a reviewed secure relay is built.
BEGIN;
CREATE TABLE IF NOT EXISTS public.flc_zoom_attendance_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_event_hash text NOT NULL UNIQUE CHECK (source_event_hash ~ '^[0-9a-f]{64}$'),
 academy_user_id uuid NOT NULL REFERENCES public.flc_zoom_identity_links(academy_user_id),
 meeting_alias text NOT NULL CHECK (length(trim(meeting_alias)) BETWEEN 1 AND 120),
 event_type text NOT NULL CHECK (event_type IN ('meeting.participant_joined','meeting.participant_left')),
 source_event_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 evidence_status text NOT NULL DEFAULT 'unverified'
   CHECK (evidence_status IN ('unverified','identity_verified','needs_review','ignored')),
 CHECK (source_event_at <= received_at + interval '5 minutes')
);
CREATE INDEX IF NOT EXISTS flc_zoom_attendance_evidence_agent_time
 ON public.flc_zoom_attendance_evidence(academy_user_id,source_event_at DESC);
ALTER TABLE public.flc_zoom_attendance_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_zoom_attendance_evidence FROM PUBLIC,anon,authenticated;
-- Only privileged backend services may write authenticated evidence.
GRANT SELECT,INSERT ON public.flc_zoom_attendance_evidence TO service_role;
COMMIT;
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name='flc_zoom_attendance_evidence';
