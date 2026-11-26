-- 059 FLC Academy MAIN: Zoom identity mapping foundation. No permissions or leads changed.
BEGIN;
CREATE TABLE IF NOT EXISTS public.flc_zoom_identity_links (
 academy_user_id uuid PRIMARY KEY REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
 zoom_user_id text UNIQUE,
 zoom_email_normalized text,
 zoom_identity_verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT flc_zoom_link_consistency CHECK (zoom_identity_verified_at IS NULL OR zoom_user_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.flc_zoom_identity_oauth_states (
 state_hash text PRIMARY KEY,
 academy_user_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT flc_zoom_state_valid_hash CHECK (state_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS flc_zoom_identity_states_expiry ON public.flc_zoom_identity_oauth_states(expires_at);
ALTER TABLE public.flc_zoom_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_zoom_identity_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_zoom_identity_links,public.flc_zoom_identity_oauth_states FROM PUBLIC,anon,authenticated;
COMMIT;
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('flc_zoom_identity_links','flc_zoom_identity_oauth_states') ORDER BY table_name;