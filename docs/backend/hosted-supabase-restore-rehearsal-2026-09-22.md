# Hosted Supabase restore rehearsal

Status at 22 September 2026: plan prepared; no hosted rehearsal project has
been created.

## Purpose

The local PostgreSQL restore proved database integrity and the migration-copy
transformation. It cannot prove that hosted Supabase Auth accepts imported
password hashes, Storage serves the restored objects, or the platform services
operate correctly against the restored managed schemas. Complete this isolated
hosted rehearsal before replacing production.

## Target and cost boundary

- Organization: `digimaxai` (`sruotlzkxrhrcqqmhbqj`), verified Pro plan.
- Proposed project name: `adhan-connect-migration-rehearsal-20260922`.
- Region: `eu-west-1`, matching staging and production.
- Compute: default Micro only.
- Maximum intended lifetime: eight hours; delete after evidence is captured.

Supabase currently bills Micro compute at USD 0.01344 per hour, rounded up to a
full hour. Eight hours would therefore cost approximately USD 0.11 in compute,
plus any minimal metered Storage/egress. Project creation and later deletion
each require explicit owner approval.

References:

- <https://supabase.com/docs/guides/platform/manage-your-usage/compute>
- <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
- <https://supabase.com/docs/guides/platform/clone-project>
- <https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects>

## Why not use automatic project cloning

Supabase's physical “Restore to a new project” feature copies the whole
database and warns that cron jobs, webhooks and external extensions can begin
running as soon as the restore completes. The staging source contains scheduled
and outbound-capable state. Use the already rehearsed logical preparation path
so that notification dispatch, assistant automation, live markers and outbound
jobs are disabled before any data reaches a networked target.

## Controlled sequence

1. Recreate the staging-source restore in the network-disabled PostgreSQL 17.6
   container from the checksum-verified private backup.
2. Run `prepare-production-migration-copy.sql` and
   `verify-production-migration-copy.sql` with the exact production target
   guard. Confirm the transformation remains idempotent.
3. Add one synthetic rehearsal-only Auth identity with a known password hash
   to the disposable copy. Do not create or modify this identity in staging or
   production. This proves hosted password authentication after import without
   needing an owner's real password.
4. Export new roles, schema and prepared data files from the disposable copy.
   Exclude executable cron data and compute SHA-256 checksums.
5. After explicit owner approval, create the Micro rehearsal project in
   `eu-west-1` with a generated database password held only in a `0600`
   temporary file outside Git.
6. Wait for `ACTIVE_HEALTHY`, enable only the extensions required by the
   prepared schema, and restore through the supported session-pooler/direct
   PostgreSQL path in a single transaction with `ON_ERROR_STOP=1`.
7. Before application testing, verify that notification dispatch, assistant
   automation, live state, provider callbacks and executable cron jobs remain
   disabled or absent. Stop immediately if any outbound state is active.
8. Configure only the minimum temporary Auth routing required for API tests.
   Do not copy SMTP, social providers, LiveKit, notification or production
   secrets into the rehearsal project.
9. Upload the four checksum-verified staging Storage objects to the restored
   bucket, then download and hash them again from the hosted Storage API.
10. Verify hosted service behavior:
    - Auth Admin can enumerate the eight imported source users;
    - the synthetic imported user signs in with its known password and receives
      a token issued by the rehearsal project;
    - imported source sessions and refresh tokens remain invalid;
    - expected application/Auth/Storage counts, constraints, RLS policies,
      function privileges, Realtime membership and migration history match the
      prepared-copy manifest;
    - anonymous and authenticated reads/writes obey the intended policies;
    - no request reaches staging or production services.
11. Save only non-secret counts, hashes, timestamps and pass/fail evidence in
    the release record. Remove temporary credentials and local prepared export
    files after the evidence is complete.
12. Request explicit owner approval to delete the rehearsal project. Confirm
    deletion and the end of its compute billing before closing this gate.

## Stop conditions

Stop without attempting production if the project is created outside
`digimaxai` or `eu-west-1`, any dump checksum changes unexpectedly, a restore
runs outside one controlled transaction, outbound jobs become executable, an
imported session remains valid, the synthetic password hash cannot authenticate,
Storage hashes differ, managed-service counts differ, or cleanup cannot be
confirmed.
