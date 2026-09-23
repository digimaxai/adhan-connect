# Claude Code: remaining production-promotion actions

> Google Play update: the owner now reports developer approval. Follow
> [the Android beta addendum](mobile/google-play-beta-plan-2026-09-23.md) when
> planning internal distribution. GitHub remains the build system. Account/app
> status and signing must be verified; uploads still need the applicable release
> approval. This supersedes the old assumption that Play is unavailable.

> **Current continuation checkpoint:** Claude created
> `docs/backend/production-cutover-manifest.md`; Codex reviewed it in
> `docs/codex-review-cutover-manifest-2026-09-23.md`. The draft is useful but is
> not yet ready for approval. Revise it against every numbered review item and
> the Google Play addendum. Do not create a competing second manifest and do not
> skip directly to merge/configuration/builds.

Prepared 23 September 2026 at the owner's request. This is the current task
order and status entry point. It clarifies sequencing; it does not authorise a
cutover, database reset, public store release or permission-policy changes.

## 1. Start here: objective and what is already finished

Promote the stable staging application to production beta while keeping the
working staging database **in place**. Then establish separate staging before
testing the recorded-adhan work. Preserve the current demo through preparation.

Read these files in order before making changes:

1. This file.
2. `docs/backend/production-cutover-manifest.md` — current DRAFT; revise in place.
3. `docs/codex-review-cutover-manifest-2026-09-23.md` — mandatory corrections to
   the current manifest before a preparation approval request.
4. `docs/mobile/google-play-beta-plan-2026-09-23.md` — confirmed organisation
   account status and first-app/internal-testing requirements.
5. `docs/codex-production-preparation-review-2026-09-23.md` — actual review,
   tests, external inspection and limitations.
6. `docs/claude-production-promotion-handoff-2026-09-22.md` — complete environment
   matrix, notification hazards, acceptance requirements and rollback rules.
7. `docs/backend/in-place-production-promotion-review-2026-09-22.md` — rationale;
   its historical statements that build-source fixes are pending are superseded.
8. `docs/mobile/xcode-cloud-production-beta-2026-09-22.md` — native setup details.

Reviewed implementation commit: `c1b8f57223197bdea5fa7fd753797460d8d3cace`.
GitHub CI passed: https://github.com/digimaxai/adhan-connect/actions/runs/35838600659.
Later documentation commits may sit above this implementation commit.

**Do not repeat Claude's manual Android patch or ask the owner to apply it.**
The Android workflow, mandatory signing, release APK/AAB output, shared production
validation, explicit EAS production variant and identity tests are implemented,
committed and pushed. Normal editing tools succeeded; no permission settings
were changed. Preserve the current implementation instead of replacing it with
the older inline patch. Do not retry historic permission-denied workarounds.

Local checks passed: TypeScript, services, notification safety (18 protected
files unchanged), 24 production guard tests, real Expo identity fixtures, shell
and workflow checks, and diff whitespace. Lint had zero errors and six existing
warnings. These results do not establish signed native or device acceptance.

No merge, new native build, production environment rewrite, alias switch,
notification switch or database reset has been completed. Task A source work is
complete; remaining external setup and Tasks B/C/D are below.

## 2. Fixed resources and protected work

| Resource | Exact value / instruction |
| --- | --- |
| Repository | `digimaxai/adhan-connect` |
| Release worktree | `/private/tmp/adhan-connect-production-promotion` |
| Release branch | `release/stable-staging-to-production-2026-09-21` |
| Draft PR | https://github.com/digimaxai/adhan-connect/pull/9 |
| Retained database, becoming production | `zhrucqghrqkjyzmupdyy`; NEVER reset/copy over/delete |
| Old production, future staging candidate | `yecbsezhwvpdkuzmmziv`; preserve until production acceptance and separate reuse approval |
| Production API | `https://adhan-connect.expo.app`; last seen deployment `b5blckazxb`, targeting old production |
| Working demo API | `https://adhan-connect--preview.expo.app`; last seen `ct1o9bkpvl` |
| Existing canary | `https://adhan-connect--production-release-canary-20260922.expo.app`; `8tahix06lu`, preview-configured, NOT final production artifact |
| EAS project | `maksums-digital-agency/adhan-connect`, UUID `20092fdb-b6af-47f8-891a-42f343175678` |
| Production native ID | `com.maksumsdigitalagency.adhanconnect` for iOS/Android; URL scheme `adhanconnect` |
| Production iOS | App Store Connect `6792143739`; native scheme `AdhanConnect` |
| Existing staging iOS | App Store Connect `6811365919`; native scheme `AdhanConnectStaging`; bundle ends `.staging` |
| Original checkout | `/Users/mzk/PROJECTS/adhan-connect`; contains unrelated uncommitted work, preserve |
| Feature checkout | `/private/tmp/adhan-connect-cloud-recorded-adhan`; branch `feature/cloud-recorded-adhan`, preserve committed AND uncommitted work |
| Private historical recovery root | `/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-21-production-promotion`; secrets/data stay outside Git |

Use Xcode Cloud for iOS, GitHub Actions for Android, EAS Hosting for web/API,
Supabase for data/Auth/Storage/functions, and LiveKit for audio. Do not introduce
EAS Build as an alternative native build process or create a third project.

Exclude recorded-adhan changes, automatic missed-live fallback and new assistant
automation from this release. Keep existing users, passwords, sessions, mosque
settings, prayer times, rota, assignments, notification preferences and Storage.

## 3. First actions: inspect and reconcile without changing services

Run in the release worktree:

```sh
git status --short
git branch --show-current
git log -5 --oneline
git remote -v
git fetch origin
git rev-list --left-right --count HEAD...origin/release/stable-staging-to-production-2026-09-21
git merge-base --is-ancestor c1b8f57223197bdea5fa7fd753797460d8d3cace HEAD
gh pr view 9 --json state,isDraft,headRefOid,baseRefName,statusCheckRollup
```

Inspect unexpected changes; never reset, force-push or discard them. If the
temporary worktree disappeared, use `git worktree list` and reconstruct an
isolated checkout from the remote release branch, not from pasted code. Read
applicable local instructions. Install locked dependencies only if needed.

Refresh read-only inventories of aliases, EAS environment names/scopes, GitHub
workflow registration and secret names, App Store Connect workflows/builds, and
the two Supabase project identities. Record time and drift. Read-only inventory
is authorised; continue independently without asking for confirmation.

Known App Store Connect evidence, to refresh rather than assume unchanged:

- Existing key referenced by `eas.json` was usable for short-lived GET-scoped API
  requests. Inspect availability before asking the owner for access. Never print
  private key contents or bearer tokens. Do not rely on a temporary helper file
  being present in another session.
- No production Xcode Cloud product/workflow was visible.
- Staging product `DD7F1666-B0D0-407B-A0F4-939E8BFF29EC`, workflow
  `D668FCEB-8D07-4128-8C71-B909607C2760`, starts only on exact branch `staging`,
  using `ios/AdhanConnectStaging.xcworkspace` and scheme `AdhanConnectStaging`.
- Latest uploaded build numbers: production **10**, staging **41**. Recheck
  current version/build history before allocating numbers; do not infer the
  owner's installed demo build or signing validity from upload history.
- Workflow environment values, signing and tester groups remain unverified.
- GitHub registered CI and Android Staging Build; production workflow was not
  yet registered on the default branch. Do not dispatch the staging workflow as
  a production workaround.

Output: timestamped current-state inventory with differences reconciled or marked
blocking. No cloud values or workflows changed in this step.

## 4. Revise Task B's manifest and finish the release-preparation proposal

Revise the existing `docs/backend/production-cutover-manifest.md` in place. Keep
status `DRAFT — NOT AUTHORISED FOR EXECUTION` until every item in
`docs/codex-review-cutover-manifest-2026-09-23.md` is resolved, incorporated or
recorded as a tested blocker. Separate observed values, intended values and
unverified values. Every unknown must have a resolution action and owner; never
turn placeholders into guessed resource IDs or executable commands.

Include these sections:

1. Exact release source SHA, current PR/base state, and external trigger review.
2. Before/after map for each client, API alias, database, Auth setting, function,
   cron job and LiveKit namespace. Renaming a project is not a routing change.
3. Per-consumer environment change list, source of each credential, and private
   recovery location for previous values. Record secret names and verification
   outcomes only, never values or password hashes in Git/logs.
4. Production Xcode workflow setup and Android default-branch registration
   sequence; identify which operations require merge, environment mutation or
   owner UI access. Include reversal and unexpected-trigger checks.
5. Native build record slots, candidate server deployment slot, and explicit
   blockers until those artifacts actually exist. Record the final post-merge
   build SHA as well as this reviewed source SHA.
6. Fresh read-only Auth routing, deployed push function definitions/version,
   Edge secret variant, cron IDs/definitions, pending-event eligibility and
   delivery counts, live stream/provider-room checks and automation row IDs.
7. Backup/checksum records and restore evidence; use new private snapshot paths
   for fresh exports. Guard by actual project ref because old backup scripts
   call retained production “staging”. Never execute reset SQL to back up data.
8. Forward/reverse scripts or exact reviewed commands: explicit project/host
   guards, expected before-values, bounded waits, postconditions, and what to do
   after partial failure. Validate locally/read-only where feasible.
9. Acceptance matrix, designated test mosque/accounts/devices, interruption
   window, failure criteria and matched rollback binary/API/database route.
10. Outstanding blockers, permissions needed and next concrete action.

Ask the owner for only information unavailable through inspection: designated
existing test accounts/mosque, two-device availability, installed demo build,
internal testers and an acceptable switch window. Bundle these questions and
continue independent preparation. Never ask for passwords in chat or reset
accounts merely to make testing easier.

For Google Play, the owner has already answered: organisation account; no app
record; no previous upload; Console shows “Create your first app”. Do not ask for
the numeric account ID unless a specific API operation later requires it. Before
proposing app creation, obtain or confirm: default language, store name, app/free
classification, public support email, and which internal tester Google accounts
or group will be used. Proposed defaults are English (United Kingdom), `Adhan
Connect`, app, free. The owner must accept Google's policy/export/signing terms.

### How to guide the owner

The owner has asked for clear step-by-step guidance with no assumed Console or
release knowledge. Follow these communication rules throughout:

1. Perform every safe read-only or repository task available to the agent before
   asking the owner to do anything. Do not hand-edit source through the owner.
2. When owner action is genuinely required, give the exact service, navigation
   path, app/project identity, field names and safe values. Explain what must not
   be pasted into chat. Ask for the smallest non-sensitive confirmation needed.
3. Present no more than one coherent checkpoint at a time. State what the action
   changes, whether it affects the demo, how it is verified and how it is reversed.
4. Distinguish an information question from permission to mutate. An answer about
   account type, tester or window is not approval to create, upload, merge,
   distribute or cut over.
5. After each external action, independently verify the observable result where
   access permits. If only the owner can verify it, state the exact screen/result
   they should report; do not mark it complete from intent alone.
6. Use the exact status vocabulary in §9 below. Never call a build “deployed,” an
   upload “distributed,” or CI “device-tested.”
7. Keep secrets, tester email lists and recovery exports out of Git and chat.
   Never request passwords, OTPs, private keys or identity documents.
8. If an automation/API route is unavailable, establish that from actual access
   or supported capability before asking for a manual Console step. Do not ask
   the owner to change agent permissions to repeat completed source work.

### Resolve the build/approval sequencing explicitly

The earlier handover requests exact build/deployment IDs in the final cutover
packet. Those cannot exist before build/setup operations. Use two checkpoints:

- **Release preparation:** finish the reviewable setup proposal first. Check
  existing authorisation for each operation; where absent, request one bounded
  approval covering the exact merge, production-only configuration, manual
  build/internal distribution and candidate Hosting upload actions needed.
  State effects and reversal. This checkpoint does NOT switch shared Auth,
  production alias, push routing, automation or databases. Keep PR draft until
  prerequisites and merge authorisation are satisfied.
- **Service cutover:** after actual artifacts and preflight evidence exist,
  complete the packet and obtain the existing plan's single concrete approval
  for the shared-service switch. Do not request this with unknown build IDs,
  untested rollback commands or unresolved release blockers.

Do not repeatedly ask for actions already authorised in the session. Do not
interpret this checklist request as approval to execute either checkpoint.
If an owner-only Xcode UI action is necessary, first prepare the exact app,
branch, scheme, settings and expected outcome, then ask only for that action.
Historic permission denials do not justify asking the owner to edit source that
is already committed; do not change agent policies to bypass any fresh denial.

## 5. Reconcile production configuration, then build the artifacts

Execute only within the release-preparation authorisation just established.
Preserve demo/preview configuration and refresh before-values immediately before
each mutation. Follow the complete environment matrix in the primary handover.

Production values must include:

| Setting | Required value / verification |
| --- | --- |
| `APP_VARIANT` | Explicit `production` in native build/export inputs |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://zhrucqghrqkjyzmupdyy.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Existing working retained-project client key; verify ownership without printing; opaque keys cannot be validated by JWT decoding assumptions |
| `EXPO_PUBLIC_API_BASE_URL` | `https://adhan-connect.expo.app` |
| Social login/linking flags | All three remain `false` |
| Redirect overrides | Initially unset; audit conflicting GitHub/EAS/Xcode overrides; verify derived callbacks |
| Server `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE` | Retained URL and its matching working server credential; server only |
| LiveKit URL/key/secret | Verified working preview provider and matching pair; server only |
| `LIVEKIT_ROOM_NAMESPACE` | `production` on production server |
| Start/end rollout modes | Preserve verified working preview behavior; last observed absent/default `legacy`; do not carry stale Harrow-only allowlists blindly |

GitHub client secrets use `PRODUCTION_` prefixes. Xcode variables are unprefixed.
Do not copy server credentials into either native build. Preserve selectively
verified integrations, including mosque-request email settings with production
admin URLs; do not send test mail to real staff without explicit permission.

**iOS:** after the approved merge, configure a separate production Xcode Cloud
workflow against `main`, `ios/AdhanConnect.xcworkspace`, scheme `AdhanConnect`,
app `6792143739`, existing production signing identity, manual initial start and
internal TestFlight distribution only. Select a valid unused build number after
refreshing history. Leave the staging workflow unchanged. Record workflow ID,
run/build ID, commit, version/build number, signing identity, processing status
and internal availability. Failed production target checks must be fixed at
their source; never weaken them to get a green build.

**Android:** after approved default-branch registration and secret reconciliation,
manually run `Android Production Beta Build` for the approved source. Require
all four existing keystore secrets. Record run URL, SHA, APK/AAB artifact names,
checksums, package/version, and verification of the actual release signer.
Check the release APK contains bundled JS and runs without Metro on a phone.
Do not generate a replacement keystore, debug-sign, submit to Play or assume
successful AAB compilation proves installability.

**Web/API:** export afresh from the pinned source with local dotenv disabled and
explicit production configuration. Verify server/client credentials target the
retained project and scan exported public files for secret values without
printing them. Upload only the authorised candidate; record immutable ID/URL,
source and configuration provenance. Test pages and unauthenticated route guards
before root alias movement. The old preview-configured canary cannot substitute.
Do not add candidate Auth callback URLs unless an approved test actually needs
them. All candidate deployments sharing retained data are shared-data tests.

### Important acceptance boundary

Before cutover the root production API still serves the old database. New native
binaries embed the retained database AND the root API URL. Do not perform account,
broadcast or admin acceptance against this mismatched pair. Build/signature/
bundle checks can precede cutover; full connected phone tests must follow the
matched API switch in the agreed window. Do not silently alter the final binary
to use preview/canary merely to make a pre-cutover test pass.

Complete the final manifest with actual artifacts and candidate smoke evidence;
mark connected device tests `PENDING — REQUIRES MATCHED CUTOVER`, never PASS.

## 6. Final preflight and approved service cutover (Task C)

Before asking for the cutover approval, supply the complete manifest, exact
before/after routing, artifacts, expected demo impact, window, failure criteria
and rollback. Refresh backups and confirm the owner is available for the device
checks. A zero-live-row query alone cannot prove nobody is about to start audio.

After approval, execute the reviewed sequence; stop at failed postconditions:

1. Freeze feature changes, coordinate no new broadcasts, verify no active streams
   or provider rooms, and reconfirm recovery evidence and selected devices.
2. Patch ONLY retained-project Auth routing additively. Add
   `https://adhan-connect.expo.app/callback`,
   `https://adhan-connect.expo.app/new-password`,
   `adhanconnect://callback`, `adhanconnect://new-password`; preserve needed demo
   callbacks. Set site URL to the production root at switch. Preserve unrelated
   Auth/SMTP/signup/OAuth/CAPTCHA/JWT settings; verify a fresh GET.
3. Move the production API alias to the verified production-configured candidate
   and make the matched production builds available to the agreed internal
   testers. Retire incompatible old production beta clients from test use.
4. Switch notifications using the EXACT reviewed deployed definitions. Supabase
   Edge `APP_VARIANT` is separate from EAS `APP_VARIANT`; preserve other function
   secrets, including `SB_SECRET_KEY`. Stop the old staging cron explicitly:
   configuring a production schedule does not automatically remove it. Account
   for live wake triggers and in-flight requests as well as cron. Specifically,
   stop `adhan-connect-push-dispatch-staging` before configuring
   `adhan-connect-push-dispatch-production`; preserve `fetch-elm-timetable-daily`.
   `scripts/configure-push-dispatch.mjs` also materialises/claims/sends eligible
   notifications: do not use it as a harmless configuration check. Verify exactly
   one intended production dispatcher and no inappropriate historical alerts.
5. Disable only the reviewed unwanted assistant-automation configuration and
   any actual worker/producer/queued work identified in preflight. Do not assume
   changing a boolean cancels queued jobs. Preserve ELM fetching and rota.
6. Run and record the acceptance tests below. Production rooms must begin
   `production-adhan-`; tokens/start/end/cleanup must agree. Test sequentially
   because old demo and new production share database state.

Read section 7 of the primary handover in full before preparing notification
SQL. Deployed eligibility windows last reviewed were LIVE 20 minutes,
upcoming/duty 5 minutes, assignment 6 hours and attendance 30 minutes. Recheck
definitions; old source events can become eligible for newly registered devices.
Do not bulk-delete events, devices or preferences, or blindly requeue sent items.

Tell the owner that once dispatch selects production, scheduled push delivery
to the old staging demo is no longer guaranteed. This is a real switch effect.

## 7. Required physical acceptance and rollback evidence

Record each result with build ID, API deployment, database ref, timestamp,
device/OS, tester role and defect/evidence. Missing device evidence is BLOCKED.

| Check | Pass condition |
| --- | --- |
| iOS installation | Correct production TestFlight app installs and opens without Metro |
| Android installation | Signed production release APK installs/opens without Metro; AAB also recorded |
| Environment | Client and API both use retained database with correct identity/signing |
| Authentication | Existing users sign in; native/web confirmation and recovery return correctly; expired/reused recovery fails |
| Permissions | Main admin, local admin, muezzin and listener screens/access behave correctly |
| Mosque/prayers/rota | Expected data/settings; authorised reversible test edit restored afterwards |
| Live audio | Publisher plus listener on two physical devices; audible start, supported background reception, end, restart and room cleanup |
| Live status | Measure listener start/end propagation; investigate beyond two 15-second polling cycles plus network latency |
| Push | Correct production registration, actual notification arrival/tap, no duplicates/stale alerts, exactly one dispatcher |
| Storage | Existing objects load; permitted and denied access both behave correctly |
| ELM | Existing job retained and expected timetable/source verified without unnecessary external requests |
| Rollback | Compatible demo binary/API/retained-data route and captured Auth/function/cron reversal verified |

Do not promise playback after the OS terminates an app. Do not enable all
Realtime tables or weaken RLS if propagation is slow. Any narrowly necessary
fix needs its own review and relevant regression checks.

If a critical test fails, stop expansion/distribution and follow the manifest's
reviewed rollback or obtain approval for a changed recovery plan. Preserve all
intervening data. Reverting the API alias to `b5blckazxb` alone is NOT a rollback
for new retained-project binaries. The old database is not a current-data replica.
Return to a compatible demo/API configuration on the retained data, including
Auth and exactly one staging dispatcher, when that is the approved reverse path.

Obtain explicit owner acceptance before treating production as complete or
starting destructive future-staging preparation.

## 8. Separate future staging only after production acceptance (Task D)

Prepare a separately reviewed reset/reuse plan for `yecbsezhwvpdkuzmmziv`, with
fresh backup, exact schema/fixture set, disabled outbound jobs and local restore
validation. Obtain the separate reset approval before executing it. Do not run
`prepare-production-migration-copy.sql` against retained `zhr...`; do not delete
either project or blindly replay managed Auth/Storage schemas.

Update every staging consumer: EAS preview, GitHub `STAGING_*`, Xcode staging
workflow, local environment files, `app.config.js` inference, backup maps and
mutating scripts. Search tracked source for BOTH project refs, then inspect actual
behavior; a filename containing “staging” is not a safety guard. The primary
handover lists known affected scripts. Every staging mutation must reject retained
production, not merely warn.

Verify matching new-staging URL/keys, correct native staging identities, staging
API, separate notification routing and `staging` LiveKit namespace. Rebuild both
staging apps. Remove old staging binaries from development use: editing cloud
settings does not retarget their embedded production database URL.

Inventory/retire old preview and canary deployments still holding production
server credentials. Removing an alias alone does not prove an immutable URL
cannot reach production. Review coordinated credential rotation where required;
do not break production consumers or mistake public client keys for server
secrets. Record any accepted residual old-beta access explicitly.

Only after environment isolation is verified may the recorded-adhan branch be
reviewed and integrated into new staging. Its committed and uncommitted work
must be assessed on its own merits; this promotion does not approve it wholesale.
Keep automatic missed-live fallback deferred and mosque-admin audio selection
as the agreed future requirement.

## 9. Reporting, validation and completion rules

At each milestone update this file's status, the cutover manifest and PR #9 with
exact commits, safe evidence, changed resources, open blockers and next action.
Keep a continuation record before stopping; do not rely on chat context alone.

Run checks appropriate to code changes: `npx tsc --noEmit`, `npm run lint`,
`npm run test:services`, `npm run test:notifications:safety`,
`npm run test:production-build-guards`, `npm run validate:app-identity`, and
`git diff --check`. Do not change protected notification fingerprints to hide
regressions. Documentation-only changes need diff/link checks, not repeated
native builds. Rerun relevant checks if source/configuration changes invalidate
earlier evidence.

Use distinct status terms: source prepared; CI passed; native build produced;
internally distributed; service switched; devices accepted; staging isolated.
Never substitute one for another or claim the app cannot break based on CI.

**Next action now:** recheck repository/service drift, then revise the existing
draft cutover manifest against the full Codex review and Google Play addendum.
Finish the environment/recovery map and exact preparation forward/reverse steps;
ask the bundled owner choices while continuing independent work. Do not redo
completed Android edits or ask the owner to paste patches, change agent
permissions, supply secrets or delete production. Present a bounded preparation
approval request only after the draft satisfies the review.
