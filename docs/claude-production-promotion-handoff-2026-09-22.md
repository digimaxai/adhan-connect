# Claude Code execution handover: stable app promotion

Prepared 22 September 2026. Read this entire file before making changes.
This is the primary continuation instruction for production promotion. Read
`docs/backend/in-place-production-promotion-review-2026-09-22.md` for the
supporting review. Historical handovers do not override this decision.

## 1. Owner's objective and fixed decisions

The owner wants today's proven staging app available as production beta, then
wants future prerecorded-adhan changes tested on separate staging. Preserve the
working demo until the coordinated switch. The owner confirms there are no real
production customers to preserve, but both databases contain test accounts and
mosque data: neither database is empty.

Retain Supabase project `zhrucqghrqkjyzmupdyy` IN PLACE as production. Do not
copy its users/passwords/data into another production database. Do not reset,
truncate, recreate or delete this project. Keep accounts, Auth sessions,
passwords, staff access, rota, assignments, prayer times, subscriptions,
notification preferences, Storage files, and mosque settings intact.

Keep old production `yecbsezhwvpdkuzmmziv` during acceptance. After production
passes, prepare a separately reviewed reset/reuse of that project as future
staging. Do not delete the project to achieve this; deletion destroys its project
identity. No third project or temporary hosted rehearsal is required.

Use Xcode Cloud for iOS, GitHub Actions for Android, EAS Hosting for web/API,
Supabase for database/Auth/Storage/Edge Functions, and LiveKit for audio.
Do not substitute EAS Build for the agreed native build systems.

The recorded-adhan feature is excluded from this release. Later requirements
include mosque-admin-selected staff recordings or a five-recording catalogue,
cloud playback, and immediate prayer-time start for recorded-only mosques.
Automatic fallback from missed live broadcasts remains deferred; do not
implement or enable it during promotion. Do not add mosque-assistant automation.

## 2. Exact workspace and revision baseline

| Item | Value |
| --- | --- |
| GitHub repository | `digimaxai/adhan-connect` |
| Working release branch | `release/stable-staging-to-production-2026-09-21` |
| Draft PR | https://github.com/digimaxai/adhan-connect/pull/9 |
| Release worktree | `/private/tmp/adhan-connect-production-promotion` |
| Last review commit before this handover | `c045fb2` |
| Stable source | `520b83da9e47d1b3a2bc019b7e91c572a69b78e7` |
| Stable source tag | `release/stable-beta-source-2026-09-21` |
| Old production recovery branch | `backup/production-before-staging-promotion-2026-09-21` |
| Old production source | `09167118dcb3af43ef6a43f83a2cfd214a7b5b0b` |
| Feature branch | `feature/cloud-recorded-adhan` |
| Feature worktree | `/private/tmp/adhan-connect-cloud-recorded-adhan` |
| Feature committed head at inspection | `51ed0b8b66f304eede001e7ee7857d3d0f3b04a4` |

Start with `git status --short`, `git branch --show-current`,
`git log -5 --oneline`, and `git remote -v` in the release worktree. Fetch remote
refs and compare local/remote heads; reconcile unexpected changes by inspection,
never by reset/force-push. This handover commit will be newer than `c045fb2`.

The original `/Users/mzk/PROJECTS/adhan-connect` checkout is dirty, including
native staging changes and untracked assessment documents. The feature worktree
also has uncommitted handover/assessment documents. Preserve both. Do not assume
untracked material was pushed or use `git add .` across a dirty checkout.

If a `/private/tmp` worktree has disappeared, create a fresh isolated worktree
from the remote release branch and install the lockfile dependencies. Do not
reconstruct code from a prose handover. Read applicable repository instructions.

## 3. Service identities: do not interchange them

| Resource | Exact identity |
| --- | --- |
| Supabase organization | `digimaxai`, `sruotlzkxrhrcqqmhbqj`, Pro plan |
| Retained production candidate | `https://zhrucqghrqkjyzmupdyy.supabase.co` |
| Retained project's current label | `adhan-connect-staging` (label is not routing) |
| Old production/future staging candidate | `https://yecbsezhwvpdkuzmmziv.supabase.co` |
| Region for both | `eu-west-1` |
| EAS account/project | `maksums-digital-agency/adhan-connect` |
| EAS project UUID | `20092fdb-b6af-47f8-891a-42f343175678` |
| Stable demo API | `https://adhan-connect--preview.expo.app`, deployment `ct1o9bkpvl` |
| Current production API | `https://adhan-connect.expo.app`, deployment `b5blckazxb` |
| Existing canary | `https://adhan-connect--production-release-canary-20260922.expo.app`, deployment `8tahix06lu` |
| iOS production app ID | `6792143739` |
| iOS staging app ID | `6811365919` |
| Production bundle/package | `com.maksumsdigitalagency.adhanconnect` |
| Staging bundle/package | `com.maksumsdigitalagency.adhanconnect.staging` |
| Production iOS project/scheme | `ios/AdhanConnect.xcodeproj`, `AdhanConnect` |
| Staging iOS project/scheme | `ios/AdhanConnectStaging.xcodeproj`, `AdhanConnectStaging` |
| Native URL schemes | production `adhanconnect`; staging `adhanconnect-staging` |

Refresh alias mappings before any mutation. An alias's deployment ID here is a
last-observed value, not permission to overwrite subsequent owner changes.

The canary has separate code/URL but SHARES the retained database and LiveKit
service with the demo. Authenticated broadcast, rota, prayer or admin mutations
affect shared data. Do not run concurrent demo/canary broadcast tests. Do not
describe it as an independent test database.

## 4. Completed evidence versus outstanding work

Completed before this handover:

- Stable source recovery refs, private database/Storage backups and checksums.
- Both databases successfully restored locally in network-disabled PG 17.6.
- Production native iOS baseline and signing-disabled Xcode 27 Release compile.
- TypeScript, service tests, notification-safety tests; lint zero errors with
  six existing warnings on the previously tested code.
- Manual Android production workflow prepared, not successfully built on CI yet.
- LiveKit namespace code added (`9209922`); no authenticated two-device namespace
  acceptance has been completed.
- Approved canary upload and route/auth-guard smoke checks; established demo
  and production aliases unchanged after that upload.
- Revision of promotion strategy; no in-place service switch has been executed.

Latest read-only database inspection at review time: 8 Auth users, 1,116 mosques,
93 migrations through `20260917001000`, zero live streams/adhans, two active
staging push registrations, staging push cron every minute and ELM fetch daily.
One assistant-automation row is enabled. No public tables are published through
`supabase_realtime`. Recheck before the switch and investigate material drift.

Pending: code/configuration corrections below; production build environments;
signed native builds; controlled service switch; physical acceptance; new staging.
Do not report this as ready for production based only on compilation or HTTP 401.

## 5. Environment manifest to prepare

Apply these to the release candidate only; retain preview/demo values until the
coordinated switch. EAS environment edits affect subsequent exports/deployments,
not immutable old deployments. Native binaries embed their configuration.

| Name | Production target/source | Consumers |
| --- | --- | --- |
| `APP_VARIANT` | `production` | Xcode Cloud, Android, Expo production export/profile |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://zhrucqghrqkjyzmupdyy.supabase.co` | client builds/export |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | currently working preview client key belonging to retained project | client builds/export |
| `EXPO_PUBLIC_API_BASE_URL` | `https://adhan-connect.expo.app` | native clients |
| `SUPABASE_URL` | same retained-project URL | EAS server only |
| `SUPABASE_SERVICE_ROLE` | currently working preview server key belonging to retained project | EAS server only |
| `LIVEKIT_URL` | verify and reuse working preview provider URL | EAS server only |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | working preview LiveKit credential pair, verified together | EAS server only |
| `LIVEKIT_ROOM_NAMESPACE` | `production` | production EAS server only |
| `LIVE_BROADCAST_START_MODE`, `LIVE_BROADCAST_END_MODE` | verified current preview behavior; last inspection absent, code defaults to `legacy` | EAS server only |
| `LIVE_BROADCAST_START_RPC_MOSQUE_IDS`, `LIVE_BROADCAST_END_RPC_MOSQUE_IDS` | do not retain old production Harrow allowlists if using `legacy`; remove inactive values | EAS server only |
| `EXPO_PUBLIC_APPLE_AUTH_ENABLED`, `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED`, `EXPO_PUBLIC_SOCIAL_LINKING_ENABLED` | `false` | client builds/export |
| `EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB`, `EXPO_PUBLIC_SUPABASE_REDIRECT_URL_NATIVE`, legacy shared override | initially unset; runtime web origin and configured native scheme derive correct URLs | client builds/export |

Do not assume the client key is a JWT anon key merely because of its variable
name. Preview has used newer Supabase keys. Preserve supported working values;
verify target using the selected project's authenticated API, never guess or
print keys. Do not create/rotate Supabase signing keys as part of promotion.

GitHub secret names for client settings are prefixed `PRODUCTION_`, e.g.
`PRODUCTION_EXPO_PUBLIC_SUPABASE_URL`, `PRODUCTION_EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`PRODUCTION_EXPO_PUBLIC_API_BASE_URL`. Audit/remove conflicting redirect secrets.
Xcode Cloud uses the unprefixed names above. Never place service-role, LiveKit or
other server credentials into Xcode Cloud or client build variables.

The four Android signing secrets are `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`.
Decode the keystore only inside CI; never print its contents or passwords.

EAS preview also has `RESEND_API_KEY`, `MOSQUE_REQUEST_ADMIN_URL`,
`MOSQUE_REQUEST_NOTIFY_EMAIL`, `MOSQUE_REQUEST_NOTIFY_FROM`. Preserve the
working integration only after checking recipient/sender ownership and updating
the admin link to the production `/admin/mosque-requests` route. Do not send
test mail to staff without owner permission. Other discovered integrations must
be inventoried by name/scope; no blanket copying of all preview secrets.

## 6. Ordered tasks and required outputs

### A. Finish reversible code/build preparation

1. Update `.github/workflows/android-production-build.yml`: pin the retained
   project and exact production HTTPS API origin, verify explicit production
   variant/package, require all four signing secrets, and build `assembleRelease`
   alongside `bundleRelease`. Use the existing upload keystore and
   `scripts/patch-android-release-signing.py`. Upload the signed release APK.
   A debug APK requiring Metro does not satisfy standalone acceptance. No Play
   Console upload or release; its developer-account approval is outstanding.
2. Add fail-closed production environment/identity assertions before native
   generation in `ios/ci_scripts/ci_post_clone.sh`. Keep non-clean prebuild and
   the working CocoaPods plugin. Do not alter the staging native project.
3. Set explicit `APP_VARIANT=production` in `eas.json`'s production build
   profile. Normal iOS/Android builds still use Xcode Cloud/GitHub, respectively.
4. Validate `app.config.js` with retained URL plus explicit production override,
   and with explicit staging variant. Both identities must resolve correctly.
   Do not globally rewrite app inference without accounting for demo builds.
5. Run `npx tsc --noEmit`, `npm run lint`, `npm run test:services`,
   `npm run test:notifications:safety`, and `git diff --check`. Add meaningful
   validation that rejects swapped project/API/variant settings. Do not update
   safety fingerprints blindly just to obtain a green test.
6. Record the resulting SHA and test results. Inspect external Xcode Cloud
   start conditions and GitHub workflows before proposing a merge. GitHub
   manual workflows may require presence on the default branch; do not merge
   silently to work around that or claim successful CI compilation prematurely.

Output: reviewed code diff/commit, configuration assertion results and exact
build-start procedure. Keep PR #9 draft while these prerequisites are open.

### B. Prepare the concrete switch packet

Produce `docs/backend/production-cutover-manifest.md` containing ALL of:

- Pinned release SHA and proposed immutable production-configured server
  deployment ID; host alias before/after mapping; client bundle project/API IDs.
- Exact native build IDs/numbers, signing/package identities, download locations,
  intended internal testers, and the old binaries they replace. Keep existing
  production Apple signing identity. Do not guess provisioning or increment IDs
  from the old committed `buildNumber`; inspect App Store Connect/Xcode Cloud.
- Safe environment inventory and private recovery-file location for previous
  values, without embedding secrets in Git. Include the Edge Function secret
  variant separately from EAS's `APP_VARIANT` setting.
- Fresh Auth safe-field GET values and exact additive proposed patch, cron job
  names/IDs, function deployment/secret versions, queue preflight counts,
  assistant-automation target row IDs, and time of inspection.
- Fresh backup manifests/checksums, active-broadcast/room checks, test mosque
  selected by owner, exact role/test-device coverage and agreed interruption
  window. Read-only inspection cannot establish that nobody is about to start
  a broadcast: coordinate the window with the owner.
- Forward and reverse commands/scripts with explicit project/host guards,
  expected before-values, bounded timeouts and recorded postconditions. No
  placeholder is executable; replace and verify every placeholder before use.
- Each remaining unknown from section 9 resolved or labelled blocking.

Prepare this packet before asking for cutover approval. Do not infer that prior
approval of an isolated canary upload also approves moving the production alias.

### C. Execute the approved switch, then accept it

Use the manifest from B; do not invent commands during the live window.
Preserve the order below and stop on a failed postcondition:

1. Confirm fresh recovery records, no broadcasts, owner/device availability and
   the freeze on feature work against the retained project.
2. Apply the additive retained-project Auth patch. Add exact URLs:
   `https://adhan-connect.expo.app/callback`,
   `https://adhan-connect.expo.app/new-password`,
   `adhanconnect://callback`, `adhanconnect://new-password`.
   Preserve existing demo redirects during transition. If demo WEB sign-up or
   reset is tested, add its two exact preview HTTPS callbacks too. Do not add
   canary/wildcard URLs without an actual required Auth flow. Set site URL to
   `https://adhan-connect.expo.app` at switch. PATCH only routing fields and
   verify a fresh GET. Do not change SMTP, signup, email confirmation, OAuth,
   CAPTCHA or JWT policy as an incidental side effect.
3. Publish the matched production API/binary combination. Build a fresh server
   export with local dotenv disabled and explicit production environment;
   `8tahix06lu` was exported for preview and is NOT the final production artifact.
   Scan exported client files for server-secret values without logging them.
   Run route/auth-guard checks against the candidate before moving the root alias.
4. Keep shared-data broadcast tests sequential. New production rooms must begin
   `production-adhan-`; token, start/end and cleanup paths must agree. Do not
   rewrite active room rows or switch namespace during an active broadcast.
5. Switch notifications as specified in section 7. Confirm production-device
   registration and real push receipt/tap; API success alone is insufficient.
6. Disable the unwanted assistant-automation configuration under a narrow
   reviewed update. Inspect workers/executable jobs and stop their producer if
   present; a boolean update alone does not cancel already queued work. Preserve
   ELM timetable fetching. Do not reset staff rota, recorded history or sessions.
7. Complete section 8, record results, and obtain owner acceptance of production
   before reusing old production or resuming feature development.

### D. Establish future staging only after C passes

The target is `yecbsezhwvpdkuzmmziv`, subject to a separately approved exact
reset/reuse plan and fresh backup. Do not run destructive migration-copy SQL on
`zhrucqghrqkjyzmupdyy`. Prepare required schema and deliberate fixtures first in
an isolated local restore; do not replay legacy migrations or managed Auth and
Storage schemas blindly over the existing target. Required fixture accounts and
test mosque set must be explicit; if the owner has not selected them, ask then.

Before any resumed feature work, update ALL staging consumers: EAS preview,
GitHub `STAGING_*` secrets, Xcode Cloud staging workflow, local `.env*`, backup
maps and mutating scripts. Search by both database refs across the tracked tree.
Known affected files include:

```text
app.config.js
scripts/start-web-fast.js
scripts/audit-staging-notifications.mjs
scripts/test-staging-email.js
scripts/smoke-staging-notification-dispatcher.mjs
scripts/smoke-event-engagement-staging.js
scripts/services/seed-guidance.js
scripts/services/staging-review.py
scripts/prayer-adjustments/staging-review.py
scripts/mosque-enquiries/staging-review.py
scripts/mosque-messaging/staging-review.py
scripts/mosque-messaging/test-concurrency.py
scripts/release/backup-database.py
scripts/release/backup-storage.mjs
```

Audit file contents: names such as `staging-review` do not prove read-only
behavior. All staging mutation guards must reject retained production, not just
print a warning. Assert new staging client/server URL and keys match; configure
separate push variant/job and `staging` LiveKit namespace. Rebuild both staging
apps and verify their embedded project/API settings. Old staging binaries still
embed production's retained URL and must be removed from development use.

Retire canary/old preview deployments that retain production service credentials
and review key rotation across coordinated consumers. Disabling an alias is not
proof its immutable deployment URL can no longer reach production. Client public
keys are not secrets and rotating them is not a substitute for proper RLS/access
control. Document any accepted residual access by old beta builds explicitly.
Only after this isolation gate can the recorded-adhan branch enter new staging.

## 7. Notification switch details and hazards

There is a singleton `notification_dispatch_config` row and one deployed
`push-dispatch` function in the retained project. Its `APP_VARIANT` comes from
Supabase Edge secrets, not the EAS server environment. Preserve other function
secrets, notably the working `SB_SECRET_KEY` override and any Expo credentials.

The SQL function `configure_notification_dispatch_schedule_v1` only unschedules
the requested variant's job name. Explicitly stop the old
`adhan-connect-push-dispatch-staging` job BEFORE configuring
`adhan-connect-push-dispatch-production`; verify exactly one active push job.
Keep `fetch-elm-timetable-daily` intact.

`scripts/configure-push-dispatch.mjs` calls the Edge Function with
`configureSchedule:true`. That request ALSO enqueues/materialises/claims and
sends eligible notifications. It is not a harmless configuration check. Do not
invoke it until queue recipients/events have been reviewed for the test window.
The live-notification wake trigger can also invoke dispatch independently of cron;
pausing cron alone does not prove dispatch is quiescent. The reviewed procedure
must account for trigger wakes and requests already in flight while switching.

Inspect deployed definitions of `materialize_notification_deliveries_v1` and
`claim_notification_deliveries_v1`, not just the earliest migration. Later
migrations add expiration rules: LIVE 20 minutes, upcoming/duty 5 minutes,
assignment 6 hours, attendance 30 minutes. Existing source events can still be
materialised for newly registered production devices within those windows.
Do not bulk-delete events, preferences or device records to avoid reasoning about
this. Identify unwanted eligible events and quarantine them by an explicit
reviewed change, or schedule the switch after their eligibility expires.

Retain the demo's staging registrations during preparation. Production clients
register their own variant. Once dispatch selects production, the old staging
demo no longer has guaranteed scheduled push delivery: tell the owner at the
switch. Do not promise uninterrupted notifications to both variants.

Rollback must restore the function variant and singleton routing, stop the new
job, restore exactly one staging job, and reconcile any sent/queued notifications.
Never requeue already-sent deliveries blindly.

## 8. Acceptance evidence required

Record build ID, server deployment, project ref, device/OS, timestamp, result and
any defect for each item. Mark unavailable tests BLOCKED, never PASS.

| Test | Required evidence |
| --- | --- |
| Identity/isolation | Production bundle/package/scheme and both client/server retained-project targets verified; no old database key mix |
| iOS | Signed internal TestFlight build installs and opens without Metro; correct App Store Connect app |
| Android | Signed release APK installs and opens without Metro; bundled JS and correct package; AAB build also recorded |
| Auth | Existing account signs in; confirmation/recovery on native and web return to intended routes; reused/expired recovery fails |
| Roles | Main admin, local admin, muezzin and listener reach intended screens; no unexpected access escalation |
| Mosque/prayers/rota | Expected mosque settings; prayer times; one reversible authorised prayer/rota edit on the designated test mosque, then restore original values |
| Live audio | Two physical devices, authorised publisher plus listener: start, audible receive, background receive where supported, end and restart; database state and provider room cleanup consistent |
| Namespace | Actual minted token/room name uses production prefix; no token value in logs/handover |
| Live status | Measure listener start/end status update time; current home/Now polling interval is 15 seconds. Investigate stale status beyond two polling cycles plus network latency; owner accepts observed timing |
| Push | One production dispatcher; correct device variant; real notification arrival and tap; no duplicate or stale alert; record OS conditions |
| Storage | Existing files load; authorised access works and prohibited access remains denied |
| ELM | Existing job retained; latest fetched timetable/source correct, without unnecessary external requests |
| Rollback | Exact compatible demo binary/API/database path documented and available; function/job/Auth reverse steps validated before acceptance |

No public tables were in `supabase_realtime` at review. Do not silently enable
all tables or weaken RLS. Test polling behavior first; if unacceptable, prepare a
minimal publication change for precisely required tables with permission tests.
Do not promise automatic full adhan playback when an OS has terminated the app.

## 9. Explicit unknowns: inspect, then stop if unresolved

| Unknown | How to resolve | If unresolved |
| --- | --- | --- |
| Xcode Cloud workflows/access/triggers | Inspect App Store Connect for the two exact app IDs | Ask owner for the specific UI action; do not guess or alter demo workflow |
| Native latest build numbers/signing | Inspect current build history/profiles | Block native release; preserve signing identity |
| Android signing secrets usable | Check all four secret names and build/signature verification | Block standalone release test; do not silently debug-sign |
| Remote changes since audit | Fetch Git and read aliases/project/config metadata | Reconcile before overwriting any changed value |
| Current provider modes/credentials | Safe EAS inventory and read-only provider auth | Stop broadcast rollout if missing or inconsistent |
| Test account/mosque and two devices | Obtain owner's designated existing accounts/mosque and availability | Keep physical acceptance pending; do not reset passwords/create real staff |
| Snapshot-time queue/jobs/automation | Read aggregate counts, narrow target IDs and live SQL definitions | Prepare bounded changes; no broad cleanup |
| Future staging fixture set | Owner selection after production acceptance | Stop only future-staging data preparation |

Unknowns are intentional gates, not permission to invent values. Routine code
implementation can continue independently while waiting for a specific answer.

## 10. Rollback, approvals and reporting

Existing authorisation covers review, reversible code preparation, tests,
read-only inventory, and maintaining the release branch/draft PR. The owner
approved the isolated EAS canary upload already completed. Do not ask again for
those completed or already authorised actions.

Obtain one concrete cutover approval once B is ready, identifying branch/SHA,
builds, exact aliases/project, changed settings, expected interruption and reverse
path. Obtain separate approval for the later old-production database reset/reuse.
No paid project creation or public App Store/Play release is included.

Rollback uses the retained `zhrucqghrqkjyzmupdyy` data plus the known demo
binary/API combination. Reverting the root alias to old production `b5blckazxb`
alone is not rollback for new binaries, because it targets another database.
Coordinate binary/API/database and dispatch together; preserve intervening writes.
Returning to the old database is not a current-data fallback.

Private recovery root:
`/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-21-production-promotion`.
Use a new private directory for fresh exports. Historical backup scripts have the
OLD name-to-project mapping: `staging` means retained `zhr...`, `production`
means old `yec...`. Assert the manifest's project ref; do not trust a folder label
after environment changes. Keep credentials/data outside Git with restrictive
permissions. Never print hashes of passwords, emails, tokens or secret values.

At each milestone update this handover, the cutover manifest and PR with exact
completed actions, safe evidence, pending blockers and next command/task. If
stopped or credits interrupted, leave this information before ending. Describe
build, upload, alias switch, device acceptance and store release separately.
Do not say the app is proven unbroken on the strength of CI alone.

For the next session: start with task A. Neither task A nor the environment
switch was completed when this handover was written. Historical tests/approvals
do not mark new work done.
