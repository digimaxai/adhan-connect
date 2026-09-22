# Staging-to-production beta promotion runbook

Status at 22 September 2026: backup and local restore rehearsal complete;
production unchanged. This document records preparation evidence and does not
authorise the final database replacement or public release.

## Agreed source and scope

- Stable application/data source: staging commit
  `520b83da9e47d1b3a2bc019b7e91c572a69b78e7`.
- Staging mosque settings are authoritative for the replacement. Known
  production-only mosque-setting differences will not be merged automatically.
- Staging Auth users and their password hashes are the proposed production-beta
  users. User UUID relationships must remain intact.
- The cloud recorded-adhan feature is excluded. Its branch remains separate and
  automatic live fallback remains deferred.
- Existing production app identities and signing identities remain the release
  identities. Staging returns to feature/UAT use only after production passes.

## Recovery references

- GitHub branch `backup/production-before-staging-promotion-2026-09-21`
  preserves production source commit `09167118dcb3af43ef6a43f83a2cfd214a7b5b0b`.
- Annotated tag `release/stable-beta-source-2026-09-21` resolves to stable
  staging commit `520b83d`.
- Existing branch `backup/staging-before-recorded-adhan-2026-09-19` also
  preserves `520b83d`.
- Preparation branch:
  `release/stable-staging-to-production-2026-09-21`.

Do not move the backup references or force-push `main` as part of promotion.

## Backup evidence

Private local recovery root:

```text
/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-21-production-promotion
```

This path is outside Git and contains sensitive Auth and application data. Its
directory permission is `0700`; checked manifest files are `0600`.

Staging export:

- roles, application schema/data, managed Auth/Storage schema, migration
  history, and cron metadata;
- seven database files with recorded SHA-256 checksums;
- one Storage bucket, four downloaded objects, 11,547,192 bytes total;
- every recorded file size and checksum reverified locally.

Production recovery export:

- roles, application schema/data, managed Auth/Storage schema, and migration
  history;
- six database files with recorded SHA-256 checksums;
- one empty Storage bucket and no object payloads;
- every recorded file size and checksum reverified locally.

At inspection time, each cloud project also had eight completed daily physical
backups. The latest observed staging backup completed at
`2026-09-22T00:58:35.979Z`; production completed at
`2026-09-22T02:45:42.193Z`. Both projects reported region `eu-west-1`, WAL-G
enabled, and PITR disabled. Supabase database backups do not contain Storage
object payloads, which is why the separate Storage download is required.

The CLI files are not one atomic multi-file snapshot. Take a fresh snapshot
after write quiescence for final cutover, while retaining these recovery copies.

## Restore rehearsal evidence

Both backups were restored into fresh databases in a dedicated local Supabase
PostgreSQL 17.6 container with Docker networking disabled. The container was
labelled for this rehearsal, inspected, and removed after verification.

Staging-source restore:

- 8 Auth users, all 8 retaining a non-empty password hash;
- 7 application users, 1,116 mosques, 145 prayer-time rows, 4 Storage metadata
  objects, and 93 migration-history rows;
- aggregate counts matched every exported Auth, application and Storage table;
- all constraints validated;
- live-versus-restored catalogue matched exactly: 92 inspected tables, 209 RLS
  policies, 119 public functions and privileges, 51 custom triggers, 138 foreign
  keys, and 9 extensions;
- public Realtime publication membership matched the source (no public tables).

Production rollback restore:

- aggregate counts matched every exported Auth, application and Storage table;
- live-versus-restored catalogue matched exactly: 68 inspected tables, 181 RLS
  policies, 68 public functions and privileges, 43 custom triggers, 102 foreign
  keys, and 7 extensions;
- the four production Realtime tables were restored in the publication;
- Storage metadata and migration history matched.

The local image required normal platform bootstrapping for managed schemas and
the Realtime publication. `pg_cron` also had to target the rehearsal database.
These are rehearsal-environment details, not commands to run against the hosted
production project. The final hosted restore procedure must be rehearsed through
the exact supported target path before cutover.

## Stable-tree validation

The isolated preparation worktree was installed from the committed lockfile and
validated against the staging environment without production data mutations:

- TypeScript completed with no errors;
- ESLint completed with no errors and six existing warnings;
- service-rule tests passed;
- notification-safety contracts passed after refreshing stale fingerprints for
  the later ELM rota fallback and reviewed muezzin screen changes, and after
  following the admin dashboard's later move to `admin-home`;
- the Expo server built successfully with staging configuration;
- live regression contracts returned HTTP 200 for five listener/staff pages,
  HTTP 401 for all nine unauthenticated protected API checks, and HTTP 400 for
  unsigned playback and invalid-location checks;
- the live regression run reported zero production data mutations.

These checks establish a clean baseline for release preparation. They do not
replace native device smoke tests or the two-device live audio canary.

## Data transfer rules

The recovery copies remain complete and immutable. Build a separate migration
copy for the final replacement.

Transfer with IDs and relationships intact:

- staging Auth users, password hashes and required identities;
- application users/profiles and active staff memberships;
- mosque catalogue/settings, prayer configuration and reviewed content;
- subscriptions/preferences and required historical records;
- Storage bucket configuration, metadata and verified payload bytes.

Reset or reconfigure for production:

- active Auth sessions, refresh tokens, one-time tokens and incomplete Auth
  flows, so testers sign in once against production;
- staging push-device tokens, pending notification jobs/deliveries, and the
  staging notification endpoint;
- active stream markers and executable scheduled-job state;
- EAS/API/Edge Function secrets, Auth redirects, SMTP, LiveKit and other
  provider configuration;
- production Realtime publication membership required by the app.

Do not infer staff access by matching email or name. Preserve UUIDs and verify
main-admin, local-admin and muezzin paths after restore. Existing source
Auth/application-row anomalies remain a required acceptance check; none of the
staff/default-muezzin relationships inspected earlier depended on an orphaned
identity.

## Remaining preparation sequence

1. Reconcile `main` history into the preparation branch while retaining the
   stable staging tree as the reviewed source. Run CI and release checks.
2. Prepare production-specific Android and iOS build configuration using
   `com.maksumsdigitalagency.adhanconnect`. Keep `.staging` identities for UAT.
3. Inventory and stage production API, Edge Function, Auth redirect, email,
   Realtime, notification and provider configuration without copying staging
   endpoints or secrets wholesale.
4. Isolate LiveKit before simultaneous staging and production tests. Current
   deterministic room names use mosque UUID, prayer and date; both environments
   currently reference the same LiveKit service.
5. Prepare a disposable hosted restore or equivalent supported rehearsal with
   outbound jobs disabled. Validate Auth and Storage through their actual
   services, not only PostgreSQL.
6. Run production-build smoke tests and the two-device broadcaster/listener
   physical canary while existing production remains recoverable.
7. Take fresh quiesced database and Storage snapshots and produce the exact
   cutover/rollback command sheet.
8. Switch to GPT-6 Astra High for the final migration review. Present exact
   target, SHA, snapshots, planned resets, downtime, acceptance evidence and
   rollback point for owner approval before replacing production.
9. After approved cutover, test accounts, roles, prayer times, rota edits, live
   start/audio/end/restart, notifications, ELM timetable fetching and Storage
   access before enabling scheduled work.
10. Only after acceptance, resume recorded-adhan work on staging.

## Stop conditions

Do not replace production if any backup checksum fails, the hosted rehearsal is
not recoverable, a required production setting points to staging, LiveKit test
rooms can collide, staff access is unresolved, production notification routing
is unverified, or the physical-device live canary fails.

After production writes reopen, restoring the pre-cutover snapshot can discard
new records. Stop writes and reconcile post-cutover changes before any rollback.
Git rollback alone does not restore databases, Storage, hosted APIs, provider
configuration, or installed native builds.
