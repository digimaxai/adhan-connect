# Production cutover manifest

**Status: DRAFT — NOT AUTHORISED FOR EXECUTION. REQUIRES REVISION.**

Codex reviewed this first draft after it was written. Before requesting any
release-preparation approval, revise every item in
`docs/codex-review-cutover-manifest-2026-09-23.md` and incorporate the confirmed
Google Play state in `docs/mobile/google-play-beta-plan-2026-09-23.md`. Statements
below that conflict with those reviews are pending corrections, not instructions
to execute. Preserve useful evidence and label changed conclusions explicitly.

Prepared 23 September 2026 (Claude), per
`docs/claude-remaining-production-actions-2026-09-23.md` §4. This is the Task
B manifest referenced by `docs/claude-production-promotion-handoff-2026-09-22.md`
§6.B. It does not authorise any service mutation, merge, native build start,
Auth patch, notification switch, or database action. Two checkpoints remain
separate and are both still open:

- **Release preparation** (§4–5 below): merge PR #9, configure production
  Xcode Cloud, register/run the Android workflow, publish a matched production
  API export. Needs its own bounded approval (§10).
- **Service cutover** (§6 of the primary handover, restated in §9 below):
  the shared-database switch — Auth routing, alias move, notification
  dispatcher, assistant-automation. Needs the single approval described in
  the primary handover §10, only after release preparation produces real
  artifacts.

Every value below is labelled **OBSERVED** (verified this session or cited
from a dated source), **INTENDED** (the target state, not yet applied), or
**UNRESOLVED** (a real gap with a named resolution action). Nothing here is a
guess. Where a resource ID does not exist yet (a build number, a deployment
ID), the row says so explicitly instead of inventing one.

## 1. Source, PR and trigger state

**OBSERVED**, verified 2026-09-23 in `/private/tmp/adhan-connect-production-promotion`:

| Item | Value |
| --- | --- |
| Branch | `release/stable-staging-to-production-2026-09-21` |
| HEAD | `223f95edac0ab5bcbdfefa1cc40f26a218d6379b` |
| Local vs. `origin/release/...` | `0` ahead, `0` behind (`git rev-list --left-right --count`) |
| Task A implementation commit | `c1b8f57223197bdea5fa7fd753797460d8d3cace` — confirmed ancestor of HEAD |
| PR #9 | `OPEN`, `isDraft: true`, base `main`, `headRefOid` = current HEAD |
| PR #9 CI | `checks` (workflow `CI`) — `SUCCESS`, completed `2026-09-23T09:16:05Z` |
| Registered GitHub Actions workflows (default branch `main`) | `CI` (`ci.yml`), `Android Staging Build` (`android-staging-build.yml`) only |
| `Android Production Beta Build` | **Not registered on `main`.** Exists only on this unmerged branch; cannot be `workflow_dispatch`-triggered until merged (GitHub requires `workflow_dispatch` workflows to exist on the default branch to be dispatchable via UI/API) |

This reconfirms `docs/claude-remaining-production-actions-2026-09-23.md`'s
"GitHub registered CI and Android Staging Build; production workflow was not
yet registered on the default branch" — independently checked, not copied.

The release worktree was clean before this draft was created. This draft and its
Codex review were initially uncommitted and are preserved together for revision;
do not describe the current worktree as clean without rechecking it.

## 2. Before/after map

**OBSERVED** current values (re-verified 2026-09-23) next to **INTENDED**
targets. No row here has been applied.

| Resource | Observed now | Intended after cutover |
| --- | --- | --- |
| Supabase `zhrucqghrqkjyzmupdyy` (`adhan-connect-staging` label) | `ACTIVE_HEALTHY`, `eu-west-1`, currently the working demo/staging backend | **Retained in place** as production; same project ID, same data — this is a config/alias switch, not a data migration |
| Supabase `yecbsezhwvpdkuzmmziv` (`adhan_connect` label) | `ACTIVE_HEALTHY`, `eu-west-1`, currently the old production backend | Preserved untouched until production acceptance passes; then a **separately approved** reset/reuse plan for future staging (Task D) |
| `https://adhan-connect.expo.app` (root/production alias) | HTTP 200; last known deployment `b5blckazxb`, targets **old** project `yecbsezhwvpdkuzmmziv` (confirmed live via EAS `production` env inventory below — not yet re-pointed) | New deployment exported with explicit production config targeting `zhrucqghrqkjyzmupdyy`, alias moved only at cutover (§9) |
| `https://adhan-connect--preview.expo.app` (demo) | HTTP 200; deployment `ct1o9bkpvl`, targets `zhrucqghrqkjyzmupdyy` (staging config) | **Unchanged** through release preparation; preserved as the working demo per the owner's explicit instruction |
| `https://adhan-connect--production-release-canary-20260922.expo.app` | Deployment `8tahix06lu`, preview-configured (staging LiveKit namespace, staging DB) | Test evidence only, not a production artifact; retire after acceptance |
| EAS `production` environment `EXPO_PUBLIC_SUPABASE_URL` | **`https://yecbsezhwvpdkuzmmziv.supabase.co`** (verified via `eas env:list --environment production`, 2026-09-23) — this is the **old** project | `https://zhrucqghrqkjyzmupdyy.supabase.co` |
| EAS `production` environment `EXPO_PUBLIC_API_BASE_URL` | `https://adhan-connect.expo.app` (already correct — the alias itself, not the DB, is what's stale) | Unchanged |
| EAS `production` environment `SUPABASE_URL` / server | `https://yecbsezhwvpdkuzmmziv.supabase.co` (old project) | `https://zhrucqghrqkjyzmupdyy.supabase.co`, matching working server credential |
| EAS `production` environment `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | **Absent entirely** (not just hidden — `eas env:list --environment production` does not list these keys at all, unlike `preview` which has them redacted-but-present) | Must be provisioned from the verified working preview pair before any production broadcast test |
| EAS `production` `LIVEKIT_ROOM_NAMESPACE` | `production` (already set) | Unchanged — correct |
| EAS `production` `LIVE_BROADCAST_START_MODE` / `END_MODE` | `allowlist`, with `LIVE_BROADCAST_START_RPC_MOSQUE_IDS` / `END_RPC_MOSQUE_IDS` = `52fbe3bf-2d08-4009-9921-208afb5b3169` (old-production-era Harrow-only allowlist) | Per primary handover: "do not retain old production Harrow allowlists if using `legacy`" — needs explicit reconciliation, not blind carry-forward (§3, UNRESOLVED) |
| EAS `production` — `RESEND_API_KEY`, `MOSQUE_REQUEST_*` | **Absent** from `eas env:list --environment production` (present, redacted, under `preview`) | Carry forward only after recipient/sender ownership check and admin-link update to `/admin/mosque-requests`, per primary handover §5 |
| iOS production app `6792143739` | Bundle `com.maksumsdigitalagency.adhanconnect`; **no Xcode Cloud product/workflow visible** (per Codex's 2026-09-23 App Store Connect inspection, see §6) | New Xcode Cloud workflow on `main`, manual start, internal TestFlight only (§4) |
| Android production workflow | Implemented, committed (`c1b8f57`), **not registered on `main`** (§1) | Registered via merge; manually dispatched after registration |
| Retained project's Auth `site_url` / redirect allowlist | **Not freshly audited this session** — the only captured audit (`docs/backend/production-auth-redirect-audit-2026-09-22.md`) is explicitly for the **old** project `yecbsezhwvpdkuzmmziv` and its own header says do not apply that patch here (UNRESOLVED, §6) | Additive PATCH per primary handover §6.C.2: add `https://adhan-connect.expo.app/callback`, `https://adhan-connect.expo.app/new-password`, `adhanconnect://callback`, `adhanconnect://new-password`; preserve existing demo redirects; set site URL to `https://adhan-connect.expo.app` only at switch |
| Notification dispatcher | Retained project runs `adhan-connect-push-dispatch-staging` on a 1-minute cron (per 2026-09-22 SQL audit, not refreshed this session — UNRESOLVED) | Stop the staging job explicitly, configure `adhan-connect-push-dispatch-production`, verify exactly one active job |
| Assistant automation | One enabled configuration row (per 2026-09-22 audit, not refreshed — UNRESOLVED) | Disable via narrow reviewed update; verify no queued worker separately (a boolean flip does not cancel in-flight jobs) |

## 3. Per-consumer environment change list

**INTENDED** changes, none applied. Every credential's source and the private
recovery location for its previous value:

| Consumer | Variables to change | Source of new value | Previous-value recovery |
| --- | --- | --- | --- |
| EAS `production` environment | `EXPO_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` → retained project; `SUPABASE_SERVICE_ROLE` → retained project's working server key; `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` → provisioned from verified working `preview` pair | Copy from EAS `preview` environment (already verified working against the same retained project) via `eas env:create`/`eas env:update`, never printed | `eas env:list --environment production --include-sensitive` captured to a `0600` file under the private recovery root **before** any change (not yet done — UNRESOLVED, blocking) |
| GitHub Actions secrets `PRODUCTION_EXPO_PUBLIC_SUPABASE_URL`, `PRODUCTION_EXPO_PUBLIC_SUPABASE_ANON_KEY` | Verify these already match the retained project (set 2026-09-22, per `gh secret list`) — **their values cannot be read back via `gh`, only confirmed by consequence (a production build passing `scripts/validate-production-build.js`)** | Same retained-project values as EAS production | GitHub does not expose secret values for recovery; the only "previous value" record is this manifest's before-state table (§2) |
| GitHub Actions secrets `PRODUCTION_EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB` / `_NATIVE` | **Not present at all** in `gh secret list` output (verified 2026-09-23) — the Android workflow references them but they resolve empty | Confirm intentional: primary handover says redirects are "initially unset; runtime web origin and configured native scheme derive correct URLs" — this appears to be by design, not a gap, but should be confirmed rather than assumed |
| Xcode Cloud production workflow (once created) | `APP_VARIANT=production`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL`, three auth-flag `false` values | Copy public client values from the reconciled EAS `production` environment (above), never placed in Git | N/A — first-time creation, no previous value |
| Supabase retained project Edge Function secrets | `SB_SECRET_KEY` variant and other function secrets — **preserve, do not touch** except the dispatcher's `APP_VARIANT`-equivalent switch (§2, §9) | N/A — existing working values | Supabase does not expose secret values; verify via a dry authenticated check only, per primary handover §5 |

Private recovery root: `/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-21-production-promotion`
(0700 dir permission per `docs/backend/staging-to-production-runbook-2026-09-22.md`).
**No fresh export has been taken this session.** A new dated subdirectory
must be created for pre-mutation snapshots of every value in this section
before any EAS/GitHub/Xcode/Supabase write — this is an UNRESOLVED,
blocking prerequisite for §5's environment reconciliation step.

## 4. Native build workflow setup sequence

**INTENDED**, sequenced, not yet started. Per
`docs/mobile/xcode-cloud-production-beta-2026-09-22.md` and the primary
handover:

### iOS (owner/UI action required — App Store Connect)

1. Merge PR #9 to `main` (release-preparation approval, §10).
2. In App Store Connect, create a **new** Xcode Cloud workflow for app
   `6792143739`: branch `main`, scheme `AdhanConnect`,
   `ios/AdhanConnect.xcworkspace`.
3. Manual start condition only — **do not** enable an automatic
   TestFlight-release trigger during migration.
4. Archive action, internal TestFlight distribution only.
5. Xcode-managed signing for `com.maksumsdigitalagency.adhanconnect`;
   confirm the archive attaches to app `6792143739`.
6. Set workflow environment values per §3's reconciled production values —
   client-only, never `SUPABASE_SERVICE_ROLE` or LiveKit secrets.
7. Select a build number **greater than the last known upload, 10** (per
   Codex's 2026-09-23 App Store Connect inspection — builds 8, 9, 10 exist,
   build 10 dated 18 July 2026, `VALID`/unexpired). **Re-verify this number
   immediately before configuring the workflow**, not from this manifest —
   it is already hours old by the time of execution and Codex's own review
   flags it as something to recheck, not assume.
8. Keep the existing staging workflow (`D668FCEB-8D07-4128-8C71-B909607C2760`,
   branch-exact `staging`, `AdhanConnectStaging`) completely unchanged.

This is an **owner/UI action** — I cannot create Xcode Cloud workflows via
CLI/API; the existing App Store Connect API key referenced by `eas.json`
supports read-only (`GET`) inspection only, per Codex's review. I have not
independently re-run that inspection this session (UNRESOLVED — see §6 for
why, and what should be re-checked immediately before this step rather than
trusted from either Codex's or this document's timestamp).

### Android

1. Merge PR #9 to `main` — this registers `Android Production Beta Build`
   as a dispatchable `workflow_dispatch` workflow (confirmed not yet
   registered, §1).
2. Confirm all four signing secrets present (`gh secret list` confirms all
   four `ANDROID_KEYSTORE_BASE64`/`ANDROID_KEYSTORE_PASSWORD`/
   `ANDROID_KEY_ALIAS`/`ANDROID_KEY_PASSWORD` exist, set 2026-09-13 —
   **their validity as a real signing identity is unverified**, only their
   presence).
3. Confirm `PRODUCTION_EXPO_PUBLIC_*` GitHub secrets target the retained
   project (§3, currently unverifiable by value — only by consequence).
4. Manually dispatch `Android Production Beta Build` from `main` at the
   pinned merge SHA.
5. Record: run URL, SHA, APK/AAB artifact names and checksums, package name
   from the built artifact, and — critically — **verify the actual release
   signer** (e.g. `apksigner verify --print-certs`), not just that the build
   succeeded.
6. Install the signed release APK on a physical device without Metro running
   and confirm it opens and reaches the sign-in screen before any further
   acceptance step.

## 5. Native build record slots and candidate server deployment

**No artifacts exist yet.** Per the primary handover's own sequencing note
(§9 of the primary handover, restated in
`docs/claude-remaining-production-actions-2026-09-23.md` §4's "Resolve the
build/approval sequencing explicitly"), these slots cannot be filled before
the operations in §4 actually run:

| Slot | Status |
| --- | --- |
| Production iOS build number/run ID | BLOCKED — no Xcode Cloud production workflow exists yet (§4) |
| Production Android run URL/SHA/artifact checksums | BLOCKED — workflow not registered on `main` yet (§1, §4) |
| Candidate production Hosting deployment ID | BLOCKED — no production-configured export has been produced; `8tahix06lu` is preview-configured and explicitly **not** a production artifact (§2) |
| Final post-merge build SHA | Will be `main`'s HEAD after PR #9 merges — **not yet known**, since the merge has not happened |

Do not fill these with guessed values. Each becomes a manifest amendment
when the corresponding §4 step actually completes.

## 6. Fresh read-only service state

**PARTIALLY REFRESHED this session (2026-09-23); partially UNRESOLVED.**

Refreshed this session, by me, independently:

- Git/PR/CI state — §1.
- GitHub Actions workflow registration — §1.
- GitHub Actions secret names (not values) — §3.
- EAS `preview` and `production` environment variable names, and values for
  non-sensitive (`EXPO_PUBLIC_*`/plain) entries — §2. This is how the stale
  `yecbsezhwvpdkuzmmziv` production target and the missing LiveKit
  credentials were confirmed independently, not merely copied from an
  earlier document.
- Supabase project list (`supabase projects list`): both projects
  `ACTIVE_HEALTHY`, `eu-west-1`, matching the primary handover exactly.
- Root/preview alias HTTP reachability (`200` on both, no further detail
  available from headers alone).

**Not refreshed this session — cited from the dated sources below, and must
be re-run immediately before any mutation, not trusted from these
timestamps:**

| Item | Last known value | Source | Age at manifest time |
| --- | --- | --- | --- |
| Auth Users / mosques / migrations count | 8 Auth users, 1,116 mosques, 93 migrations (latest `20260917001000`) | `docs/backend/in-place-production-promotion-review-2026-09-22.md` fresh SQL audit | ~1 day |
| Live stream/adhan markers | Zero at inspection | Same | ~1 day |
| Active push registrations / dispatcher | 2 active staging registrations; dispatcher configured for staging; cron every minute | Same | ~1 day |
| Assistant-automation row | 1 enabled configuration row | Same | ~1 day |
| Realtime publication membership | No public tables | Same | ~1 day |
| Retained project's actual Auth `site_url`/allowlist | **Never audited** — only the old project was audited (`production-auth-redirect-audit-2026-09-22.md`, explicitly marked as not applicable here) | N/A | N/A — genuine gap, not staleness |
| App Store Connect: production app `6792143739` Xcode Cloud product, latest build numbers (10/8/9), staging workflow ID/config | Detailed findings incl. resource IDs | `docs/codex-production-preparation-review-2026-09-23.md` §"Xcode Cloud read-only inspection" | Same day, hours old |

I did not re-run the App Store Connect inspection or a fresh SQL audit
myself this session: the former needs the `.p8` key Codex already used
successfully through normal tools in its session (I have not attempted it
independently and have no reason to believe it would behave differently now,
but "would likely work" is not the same as "verified now"); the latter needs
direct database credentials I have not obtained in this session. Both are
named as explicit **UNRESOLVED** prerequisites to close immediately before
executing §4/§9, not before drafting this manifest.

## 7. Backup and restore evidence

**OBSERVED**, cited from `docs/backend/staging-to-production-runbook-2026-09-22.md`
(dated 2026-09-21/22, not refreshed this session):

- Private recovery root: `/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-21-production-promotion`,
  `0700`, checksummed manifest files `0600`.
- Staging-source export: 7 database files, SHA-256 checksums recorded; 1
  Storage bucket, 4 objects, 11,547,192 bytes; restored and verified in a
  network-disabled local PostgreSQL 17.6 container — aggregate counts and
  full catalogue (92 tables, 209 RLS policies, 119 functions, 51 triggers,
  138 foreign keys, 9 extensions) matched exactly.
- Production (old project) recovery export: 6 database files, checksummed;
  1 empty Storage bucket; restored and verified similarly (68 tables, 181
  RLS policies, 68 functions, 43 triggers, 102 foreign keys, 7 extensions).
- Both projects had 8 completed daily physical backups at inspection
  (staging latest `2026-09-22T00:58:35.979Z`; old production latest
  `2026-09-22T02:45:42.193Z`), region `eu-west-1`, WAL-G enabled, PITR
  disabled.

**UNRESOLVED, blocking**: no fresh snapshot has been taken since
2026-09-21/22, and the existing docs already say a fresh snapshot "after
write quiescence" is required for the actual cutover, not this ~2-day-old
one. A new dated export under a fresh private recovery subdirectory is a
prerequisite for §9, not yet done.

Because this is an **in-place retention**, not a data migration, the
migration-copy preparation/verification scripts
(`prepare-production-migration-copy.sql`, `verify-production-migration-copy.sql`)
and the hosted-restore-rehearsal plan
(`docs/backend/hosted-supabase-restore-rehearsal-2026-09-22.md`) are both
explicitly superseded for this release. They remain relevant only to Task D
(future staging reset of the old project) — do not run them against
`zhrucqghrqkjyzmupdyy`.

## 8. Forward/reverse commands

No command below is to be executed without the release-preparation or
cutover approval it belongs to (§10 / primary handover §10). Each has an
explicit project/host guard; none contains a live secret value.

### Release preparation (§4–5) — forward

```sh
# Merge only after PR #9's prerequisites in this manifest are satisfied.
gh pr view 9 --json mergeable,mergeStateStatus,statusCheckRollup
# (owner/reviewer merges via GitHub UI or `gh pr merge 9 --merge`, not scripted here)

# Reconcile EAS production environment (guarded — refuses if not targeting the retained project):
node -e "
  const expected = 'zhrucqghrqkjyzmupdyy.supabase.co';
  const url = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || '');
  if (url.hostname !== expected) { console.error('REFUSING: wrong target ' + url.hostname); process.exit(1); }
  console.log('Guard passed for ' + url.hostname);
"
# Then: eas env:update --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://zhrucqghrqkjyzmupdyy.supabase.co --non-interactive
# (and the matched SUPABASE_URL / SUPABASE_SERVICE_ROLE / LIVEKIT_* — values from the verified working `preview` pair, never typed in chat/logs)

# Production export (after merge, from the pinned production SHA):
EXPO_NO_DOTENV=1 eas env:exec production "npx expo export --platform web --clear"
eas deploy --environment production --id <NEW_DEPLOYMENT_ID_NOT_YET_KNOWN>
# Do NOT move the root alias here — export/deploy an ID only; alias move is a §9 cutover step.
```

### Release preparation — reverse

- EAS production environment: restore from the `0600` recovery file
  captured immediately before the change (§3) — no destructive action taken
  by export/deploy alone since the root alias is untouched.
- Any candidate Hosting deployment created here is inert until aliased; no
  reverse action needed beyond leaving it unaliased or deleting the
  candidate deployment.

### Cutover (§9 / primary handover §6.C) — forward and reverse

Both are already fully specified, in order, with exact guarded PATCH fields,
in the primary handover §6.C (numbered steps 1–7) and §7 (notification
hazards). This manifest does not restate them to avoid drift between two
copies — **execute from the primary handover directly**, using this
manifest's §2 before/after values as the guard inputs, and this manifest's
§6 to identify which "fresh read-only" checks must be re-run first.

## 9. Acceptance matrix, test window, and rollback

The full acceptance matrix (12 checks: identity/isolation, iOS, Android,
Auth, roles, mosque/prayers/rota, live audio, namespace, live status, push,
storage, ELM, rollback) is already fully specified in the primary handover
§8 and restated in `docs/claude-remaining-production-actions-2026-09-23.md`
§7. This manifest does not duplicate it.

**UNRESOLVED — owner input required, not derivable from inspection:**

- Designated existing test account(s) and test mosque for the reversible
  prayer/rota edit check.
- Two physical devices and their availability window for the live-audio
  canary.
- Acceptable interruption/switch window (the primary handover requires
  coordinating this directly with the owner — "A zero-live-row query alone
  cannot prove nobody is about to start audio").
- Which internal testers receive the production TestFlight/APK builds.

These four questions should be bundled and asked together once release
preparation (§4) has produced real artifacts to test — asking now, before
artifacts exist, would not be actionable.

**Rollback route** (already specified, restated for this manifest's
completeness): return the retained database to its captured demo
API/notification configuration and reinstall the known demo build if
production acceptance fails. Reverting only the root alias to old
deployment `b5blckazxb` is **not** a rollback for new retained-project
binaries — it targets the wrong database for those binaries. Coordinate
binary, API, and database together, per primary handover §10.

## 10. Outstanding blockers and next concrete action

Ranked by what blocks what:

1. **Blocking everything in §4/§5**: PR #9 merge. This itself needs the
   bounded "release-preparation" approval described at the top of this
   document — merge, production-only environment reconciliation (§3),
   manual build/internal distribution, candidate Hosting export. This has
   not been requested from the owner yet; this manifest is what makes that
   request concrete rather than open-ended.
2. **Blocking §3's environment reconciliation**: a fresh private-recovery
   snapshot of current EAS production values before they're overwritten
   (§3, §7) — not yet taken.
3. **Blocking §9's Auth cutover step specifically**: a fresh, retained-
   project-specific Auth safe-field audit (§6) — the only existing audit is
   for the wrong project and explicitly disclaims applicability here.
4. **Blocking §9's notification cutover step specifically**: a fresh
   re-check of pending/eligible notification deliveries and the exact
   deployed `materialize_notification_deliveries_v1` /
   `claim_notification_deliveries_v1` definitions (primary handover §7) —
   last checked 2026-09-22, not this session.
5. **Blocking §4's iOS step**: owner/UI action in App Store Connect to
   create the production Xcode Cloud workflow — cannot be done via CLI/API
   from this session.
6. **Blocking §9's acceptance evidence**: the four owner-input questions
   listed in §9, to be asked together once §4 produces real artifacts.

**Next concrete action**: request the bounded release-preparation approval
(item 1) from the owner, scoped exactly as described at the top of this
document — merge PR #9, reconcile production-only EAS/GitHub environment
values per §3 (after taking the §7 recovery snapshot), and produce the
first real native build/candidate Hosting deployment per §4/§5. This
explicitly does **not** request or imply approval for §9's service cutover,
which needs its own separate approval once real artifacts and fresh
preflight evidence (items 2–4) exist.
