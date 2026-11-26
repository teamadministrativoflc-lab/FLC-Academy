# FLC Lead Distribution — Pilot acceptance tests (not yet run)

## Deployment order / dependencies
007 (leader hierarchy) -> 038 (leads, assignments, event log) -> 039 (worked-agent ledger) -> 040 (secure read-only RPCs) -> 040a (approved participation, Academy availability, Zoom presence) -> 041 (assignment/activity RPCs) -> 042 (append-only daily log).
All files contain PREPARATION and are **not installed** by a GitHub commit. Deploy only on isolated staging after reviewing compatibility with existing production Supabase schema.

## New hard distribution gate: EVERY condition must be true
- Admin explicitly enrolled agent in the specific campaign.
- Agent authenticated in Academy and pressed Disponible; server lease renewed every 45s, expires after 90s absent heartbeat.
- Agent has verified current presence in the correct leader-authorized Zoom session (trusted webhook/API, not self-report).
- Agent in the owning leader's team, eligible state, campaign capacity, and never previously worked same lead.
- Assignment blocked if Zoom is not verified or stale. No automatic distribution to offline/unapproved staff.

**Not implemented yet:** real Zoom API/webhook verifier (including participant-to-Academy identity matching) and actual staged tests. Without it, assignment must fail closed rather than guessing attendance.

## Test scenarios before going live
1. **Tenant isolation**: Agent A does not see lead owned by another leader unless currently assigned; subleaders see only authorized downline; admin visibility audited.
2. **Single assignment**: two parallel attempts on one lead result in a single active assignment.
3. **No repeat after work**: A receives lead, logs call -> work history(A) -> lead reassigned to B -> request assign back to A must fail, even by admin.
4. **Assigned but untouched**: A receives a lead with no verified activity; assignment is not added to work history. Policy allows eventual reuse only by controlled procedure; the auto selector currently excludes the immediately prior agent.
5. **Capacity**: campaign cap=2; a third assignment to same agent is rejected. Explicit assignments obey cap too.
6. **Geography**: excluded state code blocks assignment; ambiguous geographic state should be verified before outbound contact; timezone is always one of Eastern/Central/Mountain/Pacific. Pacific maps internally to America/Los_Angeles.
7. **Different campaign**: previously worked A is not re-eligible even if source_campaign changes (lead UUID is permanent).
8. **No eligible agent**: the lead moves to recycle_pending and remains unassigned; does not loop indefinitely.
9. **Event log**: activity by current agent succeeds; by former agent fails; duplicate idempotency key does not duplicate event.
10. **Daily grouping**: local_date_at_event is saved using verified IANA and stays unchanged if lead's timezone changes.
11. **Immutability**: attempts to UPDATE or DELETE a lead event fail.
12. **Working status**: a completed call event or appointment is recorded; only auditable events mark the lead as worked.
13. **Fail-safe**: invalid/unconfigured campaign cannot be assigned.
14. **Migration**: import historical leads with stable IDs; review duplicate IDs and activity evidence; never label someone 'worked' solely because they received a lead.
15. **Call compliance**: do not use four-zone classification alone as permission to dial. Unverified, exception and out-of-scope contacts require review.
16. **Operations**: do not disable Google Sheets until sample counts, assignment ownership, and reconciliation pass.

## Features still required
- Secure campaign administration API (leader agents, campaign participation, exclusions).
- Recurring expiration/reassignment worker with period controls, last real activity and idempotency.
- Production migration job, deduplication review, privacy controls and audited leadership.
- GHL OAuth/connectors and webhook security, per-location tenant ownership.
- Real-world integration tests, query plan/performance/load tests and Supabase staging deployment.
