# AuraFlow results synchronization — safe design (PREPARATION ONLY)

Status: proposed architecture; no live API calls, no contact updates, no secrets committed.

## User requirement
Agents do **not** have individual AuraFlow users. They log calls, follow-ups and outcomes in FLC Academy. The academy must send **outcomes** to the originating AuraFlow contact, not assign an AuraFlow user/owner. Trigger immediately after a committed agent activity; if a transmission fails, enqueue an auditable retry rather than losing the result.

## Existing Academy integration
- LeadDistributionCenter calls the authenticated Supabase RPC `flc_distribution_record_activity`; it currently explicitly warns that AuraFlow sync is not enabled.
- Contacts from AuraFlow have `source_crm` and `source_contact_id`. The contact's native ID should be used for safe targeting; never use a name/phone match.
- Recorded activity types include call, note, appointment, follow-up and result codes including no_answer, interested, not_interested, callback, wrong_number.
- Completed sale status must derive from actual verified production data, not a mere agent assertion. Submitted sale and issue-paid are distinct.

## Security and delivery requirements
1. Audit the deployed RPC, table schemas, RLS and privileges before making DB changes.
2. Supabase transaction should write an outbox record with unique event ID atomically with the activity. No external network call from the browser; no user-supplied contact IDs in outbound writes.
3. Server-side worker invokes AuraFlow/LeadConnector API with `AURAFLOW_API_TOKEN` kept exclusively in Vercel server-side Secret or equivalent secret manager. Never return token to browser; never commit token or full webhook URLs.
4. Require server authorization for queue consumption and revalidate outbound data from database; agent browser must not choose arbitrary contact IDs, notes or sync status.
5. Add deduplication/idempotency and bounded exponential retry, with audit fields attempted_at, succeeded_at, error code, status. For transient failures use queue; for permanent failures require admin review.
6. Preview must not write to production CRM records by default. Explicit allowlist of a dedicated test AuraFlow contact, the native Contact ID captured privately by an administrator, and dedicated staging data. Avoid exposing identifiable data in logs or screenshots.
7. Default outbound payload only to a contact note and, after field mapping is confirmed, a controlled custom field (disposition); do not overwrite contact owner, pipeline, opportunity or phone/email.
8. Assess LeadConnector API scopes, endpoints, rate limits, and potential charges; confirm native contact notes and the client's custom disposition field ID.
9. Keep Zoom and automatic lead distribution untouched.

## Acceptance criteria
- One authenticated activity creates exactly one pending outbox entry.
- Background worker sends a note to an allowlisted test contact and records success without a duplicate.
- Repeat processing does not create a second note.
- Failed calls remain queued, with error visible to Administration, and no token leakage.
- Non-allowlisted contacts cannot be updated during Preview.
- Existing lead distribution and daily quotas remain unaffected.

## Next implementation steps
Inspect deployed Supabase activity RPC and event schema via read-only SQL. Verify the actual API contract and field IDs. Implement an outbox migration and server route behind a no-write/dry-run flag before creating any secret environment variable.
