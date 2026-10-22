# FLC Academy — Supabase tracking (development only)

Branch: `feature/supabase-agent-tracking`

## Verified current behavior
- `Login.jsx`: shared password checked client-side; name and email are supplied by the visitor.
- `app.jsx`: user and module progress stored in browser `localStorage`.
- `Progress.jsx`: opening a module sets 50%; a button sets completion to 100%. This is not proof that a video was watched.
- `Quiz.jsx`, `Certificate.jsx`, `WelcomeVideo.jsx`: additional browser-local records.
- Supabase tables exist but the production app is not connected.

## Security and roll-out
1. Keep current `main` running during development. Do not merge this branch before end-to-end tests.
2. Apply `supabase/001_read_policies.sql` through Supabase SQL Editor after review. This grants client users read-only access to their own rows; administrative read access requires a server-provisioned admin profile. Writes remain blocked for browser users.
3. Build a safe invitation acceptance / password setup route. The current academy login does not handle Supabase invitations. A redirect to its home page does not prove account activation.
4. Replace the client-side shared password with Supabase Auth; rotate/remove the exposed fallback password and assess Git history exposure.
5. Build authenticated server write endpoints with role/ownership verification, input validation, quiz scoring on the server and authorization checks; never expose Supabase service-role secrets to the browser.
6. Store events as observable behavior, not proof of watching: video play/pause/seek/end and heartbeat while playing. A completed video event is stronger than a manual "Complete" button but cannot prove attention.
7. Migrate existing browser-local progress only after agents sign in and consent to link the stored data with their account. Mark historical entries as self-reported/unverified.
8. Implement admin dashboard with per-agent reports; test RLS with two agents and one admin before deploying.

## Known prerequisites
- New Supabase project `flc-academy` already created with empty tables.
- Configure Site URL and redirect URLs for the final deployed authentication callback.
- Never paste database passwords, service_role keys or invitation tokens into GitHub/ChatGPT.
- Confirm production-hosting terms; Vercel Hobby is not intended for commercial use.

## Next implementation stage
Add browser Supabase client using public URL + publishable/anon key, invitation callback/password setup, and separately authenticated backend for event writes. Keep secrets in deployment environment variables.
