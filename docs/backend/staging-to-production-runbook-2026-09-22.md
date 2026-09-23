# Staging-to-production beta promotion runbook

> Superseded for execution by [the in-place promotion review](in-place-production-promotion-review-2026-09-22.md).
> Keep the backup and validation evidence below. Do not run the replacement,
> runtime-reset or hosted-rehearsal sequence: the working staging database is
> now proposed for retention as production, with its records left in place.

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
- draft GitHub PR #9 passed the repository `checks` job on the reconciled
  release branch.

These checks establish a clean baseline for release preparation. They do not
replace native device smoke tests or the two-device live audio canary.

## Build configuration inventory

The EAS production environment contains the three public values required to
build the client: the expected production Supabase URL/key and an HTTPS API
base URL. Their values were validated without printing them, then copied into
GitHub Actions as the corresponding `PRODUCTION_EXPO_PUBLIC_*` secrets. The
repository already contains the four Android upload-signing secrets.

The manual `Android Production Beta Build` workflow validates the exact
production Supabase project and package identity before generating native code.
It produces a debug APK for smoke testing and, when signing secrets are present,
a signed AAB. It has no automatic trigger and does not upload to Google Play.
The production-configured Expo prebuild and identity check passed locally. The
local Gradle compile could not complete because this Mac had no Android SDK;
the GitHub workflow compile therefore remains a release gate.

Production redirect overrides are absent. Native auth therefore uses the
production app scheme `adhanconnect`. The read-only Auth audit found the
production site URL still set to localhost, only the native callback route
present, and the native password-reset plus production web routes absent. The
exact proposed release state, current rollback values and acceptance matrix are
recorded in
`docs/backend/production-auth-redirect-audit-2026-09-22.md`. Production remains
unchanged; apply that narrow Auth patch only through the controlled release
gate.
EAS preview and production now have non-secret `LIVEKIT_ROOM_NAMESPACE` values
of `staging` and `production`. Server code requires a validated namespace and
prefixes every new room, so identical mosque UUID/prayer/date combinations
cannot collide when environments share one LiveKit service. Production EAS has
`LIVEKIT_URL` but does not currently expose the required `LIVEKIT_API_KEY` and
`LIVEKIT_API_SECRET` names. Keep production broadcasting fail closed until the
namespace-enabled server is deployed and credentials are provisioned for the
production canary.

The production Expo identity resolves to:

- display name `Adhan Connect`;
- scheme `adhanconnect`;
- iOS bundle identifier `com.maksumsdigitalagency.adhanconnect`;
- Android package `com.maksumsdigitalagency.adhanconnect`.

The committed iOS native baseline is now production-specific on the release
branch: project/scheme/target `AdhanConnect`, production bundle identifier and
`adhanconnect` URL scheme. A clean generation and a subsequent non-clean
prebuild both passed in a disposable copy. The `staging` branch retains its
separate `AdhanConnectStaging` native project. Creating the production Xcode
Cloud workflow in App Store Connect remains an owner/UI step; use the exact
manual workflow configuration in
`docs/mobile/xcode-cloud-production-beta-2026-09-22.md`.
The production workspace also completed a signing-disabled Release compile on
Xcode 27.0, including Metro export and Hermes bytecode generation with the
reviewed production public environment values.

## Isolated release-candidate Hosting canary

The release branch was exported with the EAS `preview` environment so that its
server routes target staging Supabase and use the staging LiveKit credentials
and `staging` room namespace. The export produced 40 API routes. A scan against
the four injected server-secret values checked 223 files and found none of
those values embedded in the artifact. EAS dry-run packaging passed; the
185-entry tarball had SHA-256
`7c9a708fe924165fad43b5e1ce8a81d2dd6741a5df5bfdad44de1c1654351112`.

After explicit owner approval, deployment `8tahix06lu` was assigned only to:

```text
https://adhan-connect--production-release-canary-20260922.expo.app
```

The existing demo `preview` alias remained on `ct1o9bkpvl`; the production
alias remained on `b5blckazxb`. Root, callback and password-reset routes
returned HTTP 200. The non-mutating live regression suite passed against the
canary: five listener/staff pages returned 200, all nine unauthenticated
live/rota/admin requests returned 401, malformed playback and location requests
returned 400, and the suite reported zero production data mutations.

This checks Hosting packaging, routing and access guards using the selected
preview environment. It does not independently prove every downstream target.
The canary shares the demo database; authenticated mutations would affect it.
The authenticated
publisher/listener token and physical audio test remains required to prove the
runtime `staging-` room prefix and end/restart behavior; do not create or alter
a staging user solely to bypass that device gate.

## Migration-copy preparation rehearsal

The staging recovery export was restored again into a fresh PostgreSQL 17.6
container with Docker networking disabled. The production-copy preparation and
verification scripts then passed and were rerun successfully to prove that the
operation is idempotent. An intentionally incorrect target project reference
was rejected before the transaction began.

The prepared copy retained:

- 8 Auth users with non-empty password hashes and 8 identities;
- 7 application users, 3 profiles, 1,116 mosques, 2 mosque-admin memberships,
  and 2 muezzin memberships;
- 145 prayer-time rows, 7 mosque-prayer-time rows, and 3 notification preference
  rows;
- both stream configuration rows in an offline state;
- 1 Storage bucket and all 4 Storage metadata objects.

The preparation invalidated Auth sessions, login flows, reusable/legacy tokens
and challenges; cleared staging push devices, notification queues, travel
regions and inbox rows; closed snapshot-time live/scheduled state; removed
upstream health state and environment-specific approvals/counters; cancelled
executable assistant jobs; disabled assistant automation; rotated and
quarantined the notification dispatcher; and removed known outbound cron jobs.
All database constraints remained validated.

Both source exports contained zero `auth.instances` rows. Staging and production
Auth users each referenced one distinct instance identifier, and those identifier
sets matched. The final hosted Auth-service rehearsal remains required because
local PostgreSQL validation cannot prove GoTrue behavior.

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
4. Deploy the namespace-enabled LiveKit server to staging and validate that new
   room names begin with `staging-`. Provision production credentials only with
   the `production-` namespace in place, then run simultaneous isolation tests.
5. Prepare a disposable hosted restore or equivalent supported rehearsal with
   outbound jobs disabled. Validate Auth and Storage through their actual
   services, not only PostgreSQL. Use the bounded logical-restore plan in
   `docs/backend/hosted-supabase-restore-rehearsal-2026-09-22.md`; do not use
   automatic physical cloning because copied external jobs can start before
   they are inspected.
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
