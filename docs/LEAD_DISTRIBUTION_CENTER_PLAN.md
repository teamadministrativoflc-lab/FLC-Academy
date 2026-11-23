# FLC Lead Distribution Center — phase 1

**Draft only. Not deployed.**

## Existing FLC Academy resources
- `flc_team_assignments` and `flc_team_leaders`: hierarchy.
- `flc_lead_investments`: financial tracking, not individual lead inventory.
- `flc_policy_sales`: verified production registry.

## Proposed workflow
1. Read existing Google Sheets rows without modifying Apps Script or its triggers.
2. Use a stable source-specific external lead ID for idempotent ingestion.
3. Flag suspected duplicate contacts for review; do not merge automatically.
4. Before assigning, validate agent membership under the correct leader.
5. Maintain a single active agent assignment, plus an event history.
6. Connect each GHL location with securely stored tokens outside SQL tables.
7. Sync to GHL through trusted server workers; reconcile and deduplicate webhooks.
8. Link policy sales only after explicit verified matching.

## Gate before any production deployment
- Obtain current Sheets column names and all Apps Scripts, triggers and recycle rules.
- Validate tenant isolation, RLS policies, assignment transaction atomicity, data retention and deletion rules.
- Test on staging with synthetic leads, then limited read-only pilot.
- Avoid dual assignment engines until verified cutover.
- No direct browser access to client PII in this draft.

## Non-goals in this migration
No UI, cron jobs, API credential provisioning, live CRM connection, lead imports, or changes to live assignments.
