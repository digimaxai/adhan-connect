# Claude handoff: cloud recordings and live fallback

## Request to the next agent

Continue implementing cloud-managed prerecorded adhans and live fallback for Adhan Connect. Preserve the currently working app: the mosque demo was postponed to next weekend (the user said this on 20 September 2026). The user explicitly requested a complete handoff if Codex credits run short. Codex cannot see the credit balance, so this document was created proactively. **Read the working tree and test results before assuming the unfinished implementation is correct.**

Start by reading `CLAUDE.md`, `docs/codex-worklog.md`, and `docs/backend/recorded-adhan-assessment-2026-09-19.md`. Follow repository rules for protected live/rota code and physical-device canaries. Do not ask the user to repeat decisions already recorded here. Do not merge, deploy to shared staging, or enable automatic playback merely because the branch builds successfully.

## User decisions and scope

- The mosque's local admin chooses the recording for all that mosque's listeners. Listeners do not choose among the five catalogue recordings.
- Offer live only, recorded only, and live with recorded fallback. Live only remains the default and preserves existing behaviour.
- Recorded only starts at the mosque's adhan time with no intentional grace delay. Live with fallback waits 5–10 seconds; the proposed first release uses a fixed 10 seconds, avoiding another configuration field.
- Audio may be a staff recording uploaded by the mosque, or one of five centrally curated worldwide recordings. No actual catalogue files or reproduction permissions have been supplied. Do not invent/download copyrighted recordings to populate the catalogue.
- Optional separate Fajr recording; use the default recording if not selected. Allow selection of the five daily prayers. Other prayers remain live only. Do not treat sunrise or iqamah/Jumu'ah congregations as additional automatic adhans.
- Store recordings, schedules and fallback decisions in the cloud. No listener download button or offline audio library. Normal transient streaming buffers are fine. An admin choosing a file for upload is not the rejected listener-download design.
- Keep live broadcasting, staff rota, assignment authorization, mosque prayer times, local admin access and the existing demo app safe.
- The user originally delayed implementation for the demo, then explicitly authorized starting on 20 September after postponement. Continue on the isolated feature branch.

## Important platform limit

Remaining signed in does not mean an app is running. Foreground, background-playing, background-idle/suspended, OS-terminated, and user-force-closed are different cases. A cloud scheduler can make a broadcast available but cannot guarantee full automatic audio starts on a suspended/terminated iPhone. Do not promise that cloud hosting fixes this. Test foreground opt-in autoplay and ongoing playback separately; notification-tap-to-listen is the reliable entry mechanism to design for idle/closed apps. No silent-audio keepalive or misuse of VoIP/background APIs. Platform-specific acceptance and honest product wording remain necessary before rollout.

## Branches, working directories and deployment state

Repository: `https://github.com/digimaxai/adhan-connect`.

- Original working directory: `/Users/mzk/PROJECTS/adhan-connect`, still on `staging` at `520b83da9e47d1b3a2bc019b7e91c572a69b78e7` when work began.
- **Implement here:** `/private/tmp/adhan-connect-cloud-recorded-adhan`, a separate Git worktree on `feature/cloud-recorded-adhan` tracking the same remote branch. It has its own installed `node_modules`, not a symlink into staging. Temporary directories may be cleared eventually; ensure all intended source is committed/pushed before ending work.
- Recovery branch: `backup/staging-before-recorded-adhan-2026-09-19`, fixed at `520b83d`. Do not move it.
- Feature branch initially had `70d72d0` (the assessment document only). Inspect `git log` for newer commits.
- **No database migration, cron job, hosted API, listener app, Xcode Cloud workflow, Android build or staging environment has been deployed/changed for this feature.** Do not interpret local code as deployed functionality.
- A branch protects committed source only, not shared database, storage, server configuration or installed binaries. Keep feature testing separate; disabling new code is preferable to destructive database rollback.
- CI runs for PRs to staging/main and pushes to staging and the feature branch. Android builds are manually dispatched. Existing Xcode Cloud configuration is hosted on Apple; its branch triggers have not been independently verified. Never assume a feature push cannot trigger an Apple workflow without checking it.
- Use `gh` CLI for GitHub writes if needed: connector reads work but its branch write returned 403. CLI network and shared Git metadata operations require the environment's approval mechanism. Never print tokens.

The original staging checkout contains unrelated user work. Leave all of it untouched:

```
 M docs/auth/listener-no-login-review-2026-09-08.md
 M ios/AdhanConnectStaging.xcodeproj/project.pbxproj
 M ios/AdhanConnectStaging/Info.plist
?? docs/auth/listener-no-signup-assessment-2026-09-18.md
?? docs/backend/recorded-adhan-assessment-2026-09-19.md
?? ios/AdhanConnectStaging.xcodeproj/xcshareddata/xcodecloud/
?? ios/AdhanConnectStaging/PrivacyInfo.xcprivacy
?? ios/Podfile.lock
```

## Current implementation milestone

The first milestone is **admin preparation only**, behind disabled-by-default flags. This is deliberately not the full user requirement yet. Draft settings have no live or listener consumers. Complete and validate this milestone before implementing scheduling/fallback. The screen explicitly states that automatic playback is inactive.

Files added/changed:

- `lib/adhanAudio.ts`: shared modes, prayer names, asset/workspace types, draft validation, file limits, UUID/text validation.
- `lib/server/adhanAudioPolicy.ts`: server flag plus exact mosque allowlist and mosque/catalogue authorization.
- `lib/server/validateAdhanAudio.ts`: parses actual uploaded bytes using server-only `music-metadata`; permits supported MP3/AAC M4A/PCM WAV, mono/stereo, 1–600 seconds, maximum 20 MiB. Metadata validation is not full decoding, transcoding or human review.
- `lib/server/adhanAudioAdmin.ts` and `app/api/admin/adhan-audio+api.ts`: authenticated admin workspace, reserve signed upload, verify upload, sign short-lived preview, save draft, archive unused asset. No-store responses; bounded JSON requests; existing account-consent and admin access checks. Client-supplied user identity is ignored.
- `lib/api/admin/adhanAudio.ts`: authenticated API calls and direct PUT to a server-issued signed storage upload URL, then server verification. Explicit timeouts. Does not obtain a second session from the auth lock.
- `app/(admin)/adhan-audio.tsx`: draft settings, library, preview, optional Fajr, upload permission details, main-admin catalogue management, archive/retry unfinished uploads. Preview stops when leaving screen/backgrounding. Settings are clearly inactive.
- `app/(admin)/admin-settings.tsx`: gated entry; `_layout.tsx`: hidden route, preserving existing five visible tabs.
- `supabase/migrations/20260920001000_adhan_audio_setup.sql`: additive private assets/settings/audit tables; private bucket; service-role-only RPCs; authorization checked again in SQL; optimistic revision guard; serial admin mutation lock for save/archive/quota races; max 20 mosque assets and 5 catalogue assets including unfinished uploads. Existing live tables untouched. No scheduled jobs.
- `package.json` / lock: `music-metadata@11.13.0` added. Installed dependencies with `--ignore-scripts`, then ran `npx patch-package` successfully for existing LiveKit and slider patches. No native package added.

The legacy `recorded_adhans` table has public read policies. We used new private `adhan_audio_assets` for preparation so unfinished uploads are not inadvertently exposed, instead of modifying deployed legacy policies without an audit. Reassess integration/mapping later, not by applying permissive policies to the new table.

Flags (do not edit existing `.env`/`.env.local`):

```
EXPO_PUBLIC_RECORDED_ADHAN_SETUP_ENABLED=true  # compiled client entry
RECORDED_ADHAN_SETUP_ENABLED=true              # server gate
RECORDED_ADHAN_SETUP_MOSQUE_IDS=<uuid,...>      # exact allowlist, empty = deny
```

All flags are absent/off by default. A client flag alone grants nothing. These are **setup flags**, not playback activation. A future activation flag/state must be separate. No client or scheduler should treat a draft mode as effective.

Private storage notes: signed upload URL is valid for two hours, upsert false, random immutable object name; preview is valid for five minutes. Turning off setup does not revoke already issued URLs, but they cannot activate broadcasts. Archive keeps objects for now; future cleanup must wait for upload/preview expiry. Implement cleanup before broad rollout; do not delete an object while a valid outstanding upload token could recreate it.

## Current continuation status

The first implementation checkpoint is committed and pushed as `c2248234cf70b18e68aa6f0f77f03cd2435b1036`.
GitHub CI passed: https://github.com/digimaxai/adhan-connect/actions/runs/35515478398.
Fresh iOS and Android Hermes/JavaScript exports also passed with setup enabled;
these are bundle checks, not installed native builds or physical playback tests.
The user then explicitly said “continue please”. Work has moved on to scheduling
and fallback foundations; inspect uncommitted changes and later commits before
assuming this checkpoint describes the entire tree.

New finding: the existing prayer-time fallback code interprets bare clock values
as Europe/London even when a mosque has another timezone. Do not change the current
app's prayer calculations incidentally. New automatic scheduling must use explicit
timestamps and the mosque timezone, refuse unresolved/nonmatching times, respect
`prayers_not_offered`, and conservatively block unverified non-London fallback times.
A live stream being marked live precedes published microphone audio, so this flag
alone cannot count as confirmed live delivery for fallback arbitration.

## Second checkpoint: schedule preview and transactional decision core

The continuation adds the following feature-only code. None of this has been
applied to shared staging or production, and no worker/cron is configured.

- `lib/adhanDelivery.ts`: stable `(mosque, local date, prayer)` identity, explicit UTC/offset timestamp validation, mosque-local calendar operations, Fajr/default audio selection, availability/recording checks, zero intentional delay for recorded-only, fixed 10-second hybrid grace, 30-second maximum job lateness, and a pure decision contract. Confirmed live from up to three minutes early suppresses fallback even if that live adhan already finished. The previous winner is immutable and bound to its occurrence; late proof, wrong-prayer evidence or disconnect cannot cause a second adhan.
- `lib/server/adhanSchedulePreview.ts`: authenticated read-only preview of today's/tomorrow's **saved drafts**. It calls the unchanged existing prayer-times read handler in process (no user-controlled URL), applies no second adjustment, and requires exact draft agreement. Non-London prayers only qualify when their resolved time matches an explicit saved canonical timestamp; this conservatively blocks the existing London-only fallbacks. Inactive mosques, missing times/audio, date mismatches and `prayers_not_offered` get explicit reasons. Local browser/device timezone never controls planning.
- `app/(admin)/adhan-audio.tsx`: on-demand saved schedule preview; editing the draft clears the old preview. API action is `preview_schedule` on the same authenticated, allowlisted setup endpoint. It always reports `automaticPlaybackActive: false`.
- `supabase/migrations/20260920002000_adhan_delivery_core.sql`: private `adhan_delivery_occurrences` plus service-only plan/confirm/claim/cancel RPCs. No consumer, trigger or timer calls these in the app yet. Rows snapshot recording path/duration and keep a unique occurrence through timetable edits. Plan revisions protect against out-of-order planners/jobs, settings revisions cannot go backwards, and snapshots freeze once live is confirmed or the original prayer time arrives. Confirming qualified live selects it atomically; duplicate confirmation is idempotent. Other workers cannot replace its winner. Late jobs expire rather than replay. Admin cancellation is mosque-scoped and sticky. Archive protection now covers pending/active recording snapshots. The migration also explicitly removes service-role direct table writes that Supabase default privileges could otherwise grant; writes use the RPCs.
- `scripts/test-adhan-delivery.cjs`: deterministic boundaries, DST repeated hours, local midnight/UTC previous day, source trust, wrong/future/stale live evidence, saved-draft preview and no handover/replay.
- `scripts/test-adhan-audio-db.cjs`: expanded disposable-cluster tests with Supabase-style permissive default grants, actual concurrent claims, late confirmation, early live plus later timetable edit, idempotent live confirmation, stale/null revisions, exclusion cancellation, active asset archive protection and deletion. No external service or database URL is accepted.

Second-checkpoint local verification passed: TypeScript, lint (the same six
baseline warnings), audio/API and delivery domain tests, expanded PostgreSQL
concurrency/security tests, and fresh web/iOS/Android bundle exports. Protected
live/rota files and both existing prayer resolvers still match `520b83d` byte for
byte. The updated web client bundle contains no private worker RPC, service-role
setting, allowlist or metadata parser. Check the latest GitHub CI for the pushed
checkpoint; no physical-device or authenticated storage round-trip is implied.

**Important integration boundary:** The SQL confirmation RPC assumes its trusted
server caller has verified actual provider publisher/track presence. Matching an
active `streams` row is an additional scope check, not that media verification.
There is no such provider bridge wired yet. The current live start/token paths
have not been altered to honour a recorded winner. Do not enable a scheduler just
because the core tests pass: that would permit conflicting old live behaviour.

The worker must use separately activated effective configuration, never consume
the current draft settings as an activation signal. A future runtime config and
activation API, schedule refresh/version strategy, provider readiness bridge,
coordinated live-start/publisher-token guards, single notification outbox and
listener playback/consent are still required. All existing live, prayer, rota and
assignment source files remain unchanged. Preserve that boundary until the
integration can be canary-tested on real devices.

## Checkpoint validation — 20 September 2026

The private admin preparation implementation is now written. An automatic worker, integrated live fallback, listener playback and recording notifications are **not implemented**. The second checkpoint adds planning and a tested transaction core only.
No migration or build has been deployed to shared staging or production.

Completed locally:

- `npx tsc --noEmit` passed.
- `npm run lint` passed with six existing warnings confined to unchanged prayer/iqamah screens; no new warnings.
- `npm run test:services` passed.
- `npm run test:adhan-audio` passed: modes/prayers, malformed requests, fail-closed flags/allowlist, role/scope isolation, server-derived actor identity, stale revision HTTP status, pending/archived previews, retry idempotency and actual WAV/MP3/AAC M4A parsing. Synthetic fixtures contain no real adhan or third-party audio.
- `npm run test:adhan-audio:db` passed on a disposable local PostgreSQL 17 instance: RLS/grants, restrictive storage isolation even in the presence of an old permissive policy, local/main admin access, catalogue quota, concurrent revision conflict, archive-versus-selection race, audit trail and deletion cascades/anonymized actor references. The script creates/destroys its own cluster and never accepts a remote database URL.
- Existing `npm run test:live:contracts` passed against a localhost export with placeholder configuration: five pages returned 200, nine protected APIs rejected missing auth with 401, invalid playback/location requests returned 400. The first run lacked the public placeholder key in the local server process; rerun with it supplied passed. This is route/access regression coverage, **not a physical audio canary**.
- Fresh web/server export passed with the client setup flag enabled and placeholder local Supabase values. Client bundle scan found no `music-metadata`, `parseBuffer`, server allowlist, reserve-upload RPC or service-role variable. No real secret files were read/copied.
- `git diff --check` passed. All 18 files protected by the historical notification safety script are byte-for-byte identical to staging baseline `520b83d`.

Known baseline test failure: `npm run test:notifications:safety` fails on historical
hashes for `app/api/muezzin/rota-workspace+api.ts`,
`screens/muezzin/live-broadcast.tsx` and `screens/muezzin/my-rota.tsx`.
The same three mismatches exist in `520b83d`; this feature changes none of them.
Do not update the stored hashes just to make this feature appear green.

The in-app browser runtime reported no available browser connections after its
documented discovery checks. Visual review, actual authenticated cloud-storage
upload/preview, and physical iOS/Android playback remain unverified. The full
permission/storage flow needs an isolated Supabase test environment before any
shared staging migration. Metadata parsing does not prove full decodability;
preview/listening and a normalization/transcoding decision remain release work.

CI now also checks pushes to `feature/cloud-recorded-adhan`, running the new unit/API
and disposable database tests alongside existing checks. Inspect the latest GitHub
run for the authoritative remote result. Android dispatch and Xcode Cloud workflows
were not changed or started. **Confirmed 2026-09-20 in App Store Connect:** the
`AdhanConnectStaging` Xcode Cloud "Default" workflow's Branch Changes start condition
is scoped to Custom Branches → `staging` only, so pushes to `feature/*` do not trigger
an iOS build. This was checked directly in the dashboard, not inferred.

## Verification checkpoint — 20 September 2026 (continued by Claude)

Items 2–4 below (the original "Next actions" 2–4) were completed:

- **Item 3 (real Supabase round-trip):** stood up a genuine local Supabase stack
  (Postgres + Auth + Storage + PostgREST via `supabase start`/Docker, same Postgres
  image Supabase hosts) and ran the actual `handleAdhanAudioAdmin` handler against
  it — not mocks. All checks passed: real signed upload URL, real PUT of actual
  bytes, real download + `music-metadata` parse + RPC confirmation, real signed
  preview URL serving back byte-identical audio, cross-mosque rejection via real
  RLS, unaffiliated-user rejection, local-admin-blocked-from-catalogue-scope, and
  archive. Captured as `scripts/verify-adhan-audio-live-stack.cjs` (Docker-dependent,
  intentionally **not** wired into `npm run test:*`/CI — run manually before any
  future storage/RLS change to this feature). Full replay of the other 93 tracked
  migrations was not attempted: it hits the genesis migration's PostGIS-not-yet-
  enabled issue immediately, and CLAUDE.md documents a second known ordering bug
  further down the chain (`profiles` created too late) — both pre-existing and out
  of scope for this feature. Worked around locally only via a throwaway, uncommitted
  bootstrap migration (parking the other 93 files during the test run, restoring them
  after); nothing about this touched the real tracked migration history.
- **Item 4 (account export/deletion):** reviewed `lib/server/accountDeletion.ts` and
  `lib/server/accountExport.ts` against the new tables. SQL is safe — `created_by`/
  `actor_id` are `on delete set null`, so deleting a user anonymizes attribution
  rather than orphaning rows or cascading into a mosque's recordings/settings. Gap:
  neither file's authored-content sections/warnings include the new
  `adhan_audio_assets`/`adhan_audio_audit` tables yet. Not a leak (both use an
  explicit column allowlist, never `select *`) — just an incompleteness versus the
  existing `authoredOperationalRecordCount` pattern for events/campaigns/etc. Low
  severity since account deletion remains gated off platform-wide regardless; worth
  a small follow-up before that gate ever opens.
- **Item 2 (visual review):** deliberately deferred, by the user's explicit choice
  after weighing the cost. Rendering the real screen needs the app's full boot
  sequence (role resolution, session-access, etc. touch many tables beyond this
  feature's four), which runs into the same two pre-existing migration-replay bugs
  above. Chosen path: verify via code review + the real-stack test above, and do
  visual QA once this reaches an actual feature-branch device build rather than
  spending more time working around unrelated known bugs, or provisioning new cloud
  infrastructure, for a screenshot.

## Third checkpoint: automatic delivery dispatcher (pushed as `7f2aad2`)

The decision core (`plan`/`confirm`/`claim`/`cancel` RPCs, second checkpoint) had
no caller — nothing actually invoked `claim_adhan_delivery_v1` on a schedule. This
checkpoint adds exactly that piece, reusing the existing `pg_cron` pattern this repo
already relies on for push dispatch (see `20260903143000_notification_dispatch_schedule.sql`),
but deliberately **not** the HTTP/Edge-Function half of that pattern:

- `supabase/migrations/20260921000000_adhan_delivery_dispatch_schedule.sql`: a new
  `dispatch_due_adhan_deliveries_v1()` function, called directly by `pg_cron` every
  10 seconds (`cron.schedule('adhan-connect-delivery-dispatch', '10 seconds', ...)`)
  — pure in-database SQL, no `pg_net.http_post`, no Edge Function invocation on the
  poll itself. It scans `adhan_delivery_occurrences` for `state='planned'` rows past
  `recording_due_at` (the existing partial index already covers this) and calls
  `claim_adhan_delivery_v1` on each; one occurrence's error can't abort the batch.
  Fail-closed: revoked from `anon`/`authenticated`/`service_role`, callable only in
  the migration-owning/cron execution context.
- **Why no Edge Function for the poll:** the original design draft would have had
  `pg_cron` call an Edge Function every 10 seconds via `pg_net.http_post`, which
  bills/costs an invocation every tick forever, whether or not anything is due. The
  user asked whether a cheaper option was still viable long-term; the answer is yes,
  and better than "cheaper" — genuinely zero added cost as mosque count grows, since
  `claim_adhan_delivery_v1` is already pure SQL and needs no HTTP round-trip at all.
  Edge Function/push work only happens at genuine prayer occurrences (mosques × 5
  prayers/day), never from idle polling.
- **Verified for real, not just unit-tested:** confirmed `pg_cron` 1.6.4 is what
  ships in Supabase's own Postgres image (same one used here), actually scheduled
  and watched a `'10 seconds'` test job execute. Then, against the same real local
  Supabase stack, inserted real due rows directly via SQL and let the actual cron
  job (not a manual RPC call) claim them — all three cases fired correctly with zero
  manual intervention: recorded-only claimed at T, hybrid-with-live-confirmed-before-
  deadline stayed `live_selected` untouched past the deadline, hybrid-with-no-live
  fell back to `recording_selected` at exactly T+10s with the right reason string.
- `scripts/test-adhan-delivery-dispatch.cjs` (`npm run test:adhan-delivery:dispatch`,
  now in CI): a fast, disposable-Postgres unit test of `dispatch_due_adhan_deliveries_v1`'s
  own logic only — pg_cron itself isn't installed on this machine's or CI's plain
  Postgres (only Supabase's hosted/Docker Postgres bundles it), so this test extracts
  just the function+revoke statements from the real migration file (regex match, not
  hand-copied, so it can't silently drift from the shipped SQL) and calls it directly.
  Covers: batches multiple due rows in one call, ignores not-yet-due rows, idempotent
  on repeat invocation, fail-closed direct execute. The genuine end-to-end tick above
  is the real proof of the scheduling mechanism; this test is regression coverage for
  the function's own logic, not a re-test of pg_cron's reliability.
- Local verification passed: `npx tsc --noEmit`, `npm run lint` (same 6 pre-existing
  warnings, no new ones), all of `test:services`/`test:adhan-audio`/`test:adhan-delivery`/
  `test:adhan-audio:db`/`test:adhan-delivery:dispatch`. Protected live/rota files
  (`app/api/muezzin/rota-workspace+api.ts`, `screens/muezzin/live-broadcast.tsx`,
  `screens/muezzin/my-rota.tsx`, `app/api/muezzin/live-broadcast+api.ts`,
  `lib/hooks/useLiveBroadcastEngine.ts`) confirmed byte-identical to `origin/staging`
  via `git diff --stat`. Pushed and CI green: https://github.com/digimaxai/adhan-connect/actions/runs/35535868411.

**Still not wired (explicitly deferred, not forgotten):**

- **Planning ahead:** nothing yet calls `plan_adhan_delivery_v1` from resolved prayer
  times. Needs a separate, lower-frequency job (minutes, not seconds) reusing the
  existing JS prayer-time resolution the same way `adhanSchedulePreview.ts` already
  does read-only, then calling the RPC to actually create/update occurrence rows
  ahead of each prayer.
- **Listener notifications on a real fire:** a fire today only changes
  `adhan_delivery_occurrences.state`/`reason` — which is already a complete,
  queryable delivery-outcome audit trail on its own (matching the assessment's
  "Live"/"Scheduled recording"/"Fallback used"/"Cancelled" outcomes) — but nothing
  notifies listeners yet. Deliberately not folded into this checkpoint: wiring it
  correctly means adding a new listener "automatic audio" opt-in preference (does
  not exist yet — existing notification consent is explicitly not automatic-audio
  consent per the assessment) and integrating with the existing
  `notification_events` materialization/preference pipeline across several
  migrations (`20260903120000`, `20260904231500`, `20260907190000`), which deserves
  its own careful pass rather than being conflated with the scheduler.
- **Live confirmation wiring:** nothing yet calls `confirm_adhan_delivery_live_v1`
  from the real live-broadcast start path — that's protected live code
  (`app/api/muezzin/live-broadcast+api.ts` and its transactional START migration)
  and needs its own deliberate, carefully reviewed change, not a same-session patch
  alongside the scheduler.
- **Listener playback itself:** still nothing on the listener side consumes a
  recorded/live delivery session at all.

## Fourth checkpoint: planning-ahead job and explicit activation gate (pushed as `45f4dab`)

The third checkpoint's dispatcher had nothing to act on outside manual test
inserts — nothing called `plan_adhan_delivery_v1` from real prayer times. This
checkpoint closes that gap and adds the activation gate the second checkpoint's
own migration comment required before any scheduler could safely exist.

- `supabase/migrations/20260922000000_adhan_audio_activation.sql`: new
  `mosque_adhan_audio_activation` table — the **only** thing a planner/scheduler
  may read to decide a mosque is live. `mosque_adhan_audio_settings` remains
  draft-only; editing it never silently changes live behaviour.
  `activate_adhan_audio_v1` validates current settings revision, non-empty
  enabled prayers, and that the selected recording(s) are still `ready` before
  turning on. `deactivate_adhan_audio_v1` turns off and cancels any
  still-`planned` (not yet started) occurrences for that mosque, so nothing an
  admin just turned off can still fire; it never touches an occurrence already
  claimed/started.
- `lib/server/adhanDeliveryPlanner.ts`: reuses the exact same
  `resolveAdhanScheduleSlots`/`planAdhanDay` logic the admin schedule preview
  already used (refactored out of `adhanSchedulePreview.ts` so both paths can
  never diverge on "today's resolved prayer time"), then calls
  `plan_adhan_delivery_v1` for each `ready` slot of every mosque the
  activation table says is active. A mosque whose draft has since been edited
  back to `live_only` is safely skipped rather than trusted from a stale
  activation row.
- `supabase/functions/adhan-delivery-plan/index.ts` +
  `supabase/migrations/20260922001000_adhan_delivery_plan_schedule.sql`: runs
  every 15 minutes via the exact same `pg_cron`+`pg_net`+shared-secret pattern
  as `push-dispatch`. **Important:** this Edge Function runs on Deno and
  cannot import an Expo Router `+api.ts` route directly (different runtime,
  incompatible dependency graph — it imports `expo-router/server` and other
  Node-oriented modules). It calls the existing `/api/prayer-times-daily`
  route over **real HTTP** instead, exactly the way any other client does,
  via a new required env var `ADHAN_DELIVERY_PLAN_API_BASE_URL` pointing at
  the hosted API deployment. This guarantees the planner sees exactly what
  listeners/admins see, with zero duplicated prayer-time logic — do not try
  to shortcut this with an in-process import again.
- **Deno also requires explicit extensions on relative imports**, which
  `lib/adhanAudio.ts`, `lib/adhanDelivery.ts` and
  `lib/server/adhanSchedulePreview.ts` (all reused by the Edge Function)
  didn't have. Fixed by adding `allowImportingTsExtensions` to
  `tsconfig.json` (already compatible with the existing
  `moduleResolution:"bundler"` + `noEmit:true` from `expo/tsconfig.base`) and
  adding `.ts` extensions **only** to the imports actually reached by the
  Edge Function's module graph. `adhanSchedulePreview.ts` was decoupled from
  `./adminAccess` (which pulls in `./accountConsentAccess` and a much larger
  tree) — it only ever needed `context.supabaseAdmin`, so it now takes a
  small structural type instead of the full `AdminAccessContext`. Do not
  casually add `.ts` extensions to other files' imports elsewhere in the repo
  without a reason; this was a narrow, deliberate fix for exactly the files
  Deno's graph builder touches.
- **Verified for real, not just unit-tested:** ran the actual Edge Function
  locally via `supabase functions serve` against a real local Supabase stack,
  with a stub HTTP server standing in for the hosted API's
  `/api/prayer-times-daily`. Confirmed the full chain end-to-end with zero
  manual RPC calls: an inactive mosque contributes zero database writes;
  activating requires a valid settings revision/mode/ready-recording; the
  real HTTP fetch resolves prayer times; `plan_adhan_delivery_v1` creates real
  occurrence rows (a past-due time correctly lands as `expired`, not
  `planned`, matching the RPC's own tombstone logic — this is not a bug); a
  second planner run is idempotent (`planned: 0, unchanged: 10`);
  deactivation cancels the still-pending occurrences and the next planner run
  excludes that mosque entirely (`mosques: 0`).
- Added a minimal "Automatic playback" on/off control to the existing admin
  screen (`app/(admin)/adhan-audio.tsx`) — the smallest UI needed to make
  this checkpoint usable end-to-end from an admin's perspective, not only
  backend-verified. It calls the new `activate`/`deactivate` actions added to
  `lib/server/adhanAudioAdmin.ts`, which also now returns `active`/
  `activatedAt` in its `GET` response.
- New tests: `scripts/test-adhan-delivery-planner.cjs`
  (`npm run test:adhan-delivery:planner`, mocked db, matches
  `test-adhan-delivery.cjs`'s style — activation gating, reverted-draft skip,
  per-mosque error isolation) and expanded `scripts/test-adhan-audio-db.cjs`
  with activation RPC coverage (fail-closed grants, stale revision, asset
  readiness, deactivation-cancels-pending). Both in CI.
- Local verification passed: `npx tsc --noEmit`, `npm run lint` (same 6
  pre-existing warnings — 2 new ones were introduced by this checkpoint's UI
  text and fixed before commit), all seven `test:*` scripts for this feature,
  fresh web/iOS/Android bundle exports with the client-facing bundle scanned
  clean of every server-only identifier this checkpoint introduced. Protected
  live/rota files confirmed byte-identical to `origin/staging` via
  `git diff --stat`. Pushed and CI green:
  https://github.com/digimaxai/adhan-connect/actions/runs/35541318652.

**Still not wired (explicitly deferred, not forgotten):** listener push
notifications on a real fire (needs a new opt-in preference — see the third
checkpoint's note, unchanged), `confirm_adhan_delivery_live_v1` integration
with the real live-broadcast start path (protected live code, its own
deliberate change), and any listener-side playback at all.

## Next actions

1. Read the current Git status/history and latest CI run. If any feature changes are uncommitted, preserve them and complete their verification before pushing. Work only in the feature worktree/branch.
2. Before relying on the planning-ahead job in a real environment: set `ADHAN_DELIVERY_PLAN_API_BASE_URL` for the `adhan-delivery-plan` function, and call it once with `{"configureSchedule": true}` (authenticated as service role) to register its `pg_cron` job — mirroring how `configure-push-dispatch.mjs` does this for push-dispatch. No such operator step has been run against any real environment yet.
3. Wire `confirm_adhan_delivery_live_v1` into the real live-broadcast start path — protected live code, needs its own careful, isolated change and physical-device testing before merge consideration.
4. Design and build the listener "automatic audio" opt-in preference and its notification_events/materialization integration — a separate milestone from the scheduler, not a quick add-on.
5. Build listener-side playback (single audio owner arbitration, source-aware playback response, "Recorded adhan" vs "LIVE" labeling, late-join seek).
6. Stop at a reviewable deployment decision with exact environment/SHA and rollback evidence before any shared staging migration; do not silently activate unfinished playback.
7. Keep this document and its convenience copy in the original checkout's `docs/` updated. The original checkout's copy is intentionally untracked; do not commit it to staging or include unrelated iOS/auth changes.

## Subsequent milestones: full requirement still to implement

### Cloud decision and scheduling

- One durable delivery session per `(mosque_id, mosque-local prayer date, prayer name)` with a unique database key. Resolve canonical mosque prayer times through existing `getDailyPrayerTimes` rules and adjustments; mosque timezone/date, not phone timezone. Inspect prayer source precedence before coding. Prayer time edits, midnight, DST and late jobs need explicit tests.
- Separate planned/effective config and rollout switch; default all existing mosques to live only. A missing/unusable recording must not enable recorded mode or block live. Treat live-only flow as a regression boundary.
- Idempotent server job creates/claims the session. Recorded-only has no intentional delay. Hybrid chooses verified live readiness before the fixed 10-second deadline or atomically claims the recording afterwards. A minute-based push cron cannot provide 5–10-second precision; design and measure a seconds-resolution scheduler, retries and recovery. Do not claim exact device playback timing from server timing.
- Current live API marks a stream live before the microphone publication is confirmed. Distinguish requested/connecting from verified readiness before using it to suppress fallback. Handle transaction races with late live starts; once recording wins, prevent a second overlapping adhan and explain status to the muezzin/admin. No automatic midstream rescue or switching back to live in the initial design.
- Store immutable selected audio/duration/start/end in each delivery session; do not let a mid-session edit change what different listeners hear. Expire old sessions; never replay missed adhans hours late. Signed playback access should be session-scoped with a bounded lifetime and server authorization.
- Never fake `streams.is_live` or `adhans.status='live'` for recorded playback: existing live notification triggers would mislabel/duplicate it.

### Listener and notification behaviour

- Single audio owner arbitration so live and recording cannot overlap. Determine priority/interrupt policy versus Quran/manual playback explicitly and test it.
- Follow primary mosque only for automatic audio; user opt-in and per-prayer controls; avoid overlapping broadcasts from multiple followed mosques. Do not silently change subscriptions or notification consent.
- Show “Recorded adhan”/fallback status and reciter, never “LIVE”. Late join seeks to elapsed server session position; expired session does not start from zero. Handle signed URL renewal/network loss without duplicate playback.
- Deduplicate live/recorded push/session events; suppressed live notification if fallback wins. Device tap route handles active/expired session truthfully.
- Test iOS and Android foreground, lock screen during playback, background idle, suspended/terminated, force closed, network loss, mute/DND and denied notifications. Explicitly state limits. No listener offline library.

### Rota, assignments, settings

- Hybrid retains existing duty/assignment permission. Recorded-only can mark the adhan delivery automated without silently deleting staff duties or other responsibilities. Rota needs a clear read-only badge/indicator before changing duty reminders.
- Local admins can manage only their own mosque settings and audio; only main admins can curate shared recordings. Staff cannot change mosque mode by default. Audit who changed config, selected audio and activation.
- Keep primary source of prayer times; do not introduce a competing schedule in the recording UI. Admin setting changes should have documented effect on future sessions and no retroactive replay.

### Release/rollback and acceptance

- Use the existing Xcode Cloud iOS / GitHub Android tooling only with explicitly selected feature branch builds and verified server/environment routing. Same staging backend is a shared dependency: a separate feature branch alone is insufficient isolation.
- Before demo-critical rollout, show evidence from automated tests and at least a two-device live canary: one broadcaster, one listener, actual audio audible, safe start/stop/reconnect. Require fallback/recorded canaries on physical iOS and Android too. Leave new flags off for all non-test mosques.
- Prepare rollback by disabling new activation/allowlist, stopping new scheduler dispatch and using the known working demo binary/server. Do not reverse shared database changes destructively as the first rollback step.
- Keep deployment approval a concrete final decision with reviewed diff, test results, exact branch/SHA, target environment and rollback instructions. Ordinary reversible implementation and tests are already authorized.

## Suggested next-agent opening

“I’ll continue on `feature/cloud-recorded-adhan` at `45f4dab`. Activation, planning-ahead and the automatic dispatcher are all built and verified for real end-to-end (a real local Supabase stack, real pg_cron ticking, a real Deno Edge Function resolving real HTTP-fetched prayer times), but nothing yet wires live confirmation into the real broadcast path, notifies listeners, or plays anything for listeners. I’ll pick one of those as its own isolated milestone rather than combining them, and keep the demo’s staging deployment unchanged until each is tested and ready for review.”
