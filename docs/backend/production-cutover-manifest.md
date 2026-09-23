# Production cutover manifest

**Status: DRAFT — NOT AUTHORISED FOR EXECUTION.**

Revision 3 (23 September 2026, Claude), addressing every numbered item in
`docs/codex-review-cutover-manifest-r2-2026-09-23.md`, on top of revision
2's response to `docs/codex-review-cutover-manifest-2026-09-23.md` and
`docs/mobile/google-play-beta-plan-2026-09-23.md`. Earlier revisions'
useful evidence is preserved; corrected conclusions are labelled
**REVISED** inline rather than silently replaced, so drift across review
passes stays visible — including one correction of a previous correction
(§4's Xcode Cloud role/connection findings). This document still does not
authorise any service mutation, merge, native build start, Auth patch,
notification switch, database action, Play app creation, or upload.

Two checkpoints remain separate and are both still open:

- **Release preparation** (§4–5 below): merge PR #9, configure production
  Xcode Cloud, register/run the Android workflow, publish a matched
  production API export, prepare (not execute) Google Play internal
  testing. Needs its own bounded approval (§10).
- **Service cutover** (§6 of the primary handover, restated in §9 below):
  the shared-database switch — Auth routing, alias move, notification
  dispatcher, assistant-automation. Needs the single approval described in
  the primary handover §10, only after release preparation produces real
  artifacts.

Every value below is labelled **OBSERVED** (verified this session or cited
from a dated source, with its age stated), **INTENDED** (the target state,
not yet applied), or **UNRESOLVED** (a real gap with a named resolution
action and owner). Nothing here is a guess.

## 1. Source, PR and trigger state

**OBSERVED**, re-verified 2026-09-23 (this revision):

| Item | Value |
| --- | --- |
| Branch | `release/stable-staging-to-production-2026-09-21` |
| HEAD | `5dc057793bb00b33fce5c1d5a9c8b5937d2162cc` |
| Local vs. `origin/release/...` | clean, matches origin |
| Task A implementation commit | `c1b8f57223197bdea5fa7fd753797460d8d3cace` — ancestor of HEAD |
| PR #9 | `OPEN`, `isDraft: true`, base `main`, `headRefOid` = current HEAD, **`mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`** |
| PR #9 CI | `checks` (workflow `CI`) — `SUCCESS`, completed `2026-09-23T09:56:56Z`, run `35845836188` |
| Registered GitHub Actions workflows (default branch `main`) | `CI` (`ci.yml`), `Android Staging Build` (`android-staging-build.yml`) only |
| `Android Production Beta Build` | Not registered on `main`; cannot be `workflow_dispatch`-triggered until merged |

**REVISED (accuracy correction, review r2 item 7):** the worktree is
**not** clean while this manifest is being actively revised — that is
expected mid-edit, not a defect. State the actual current condition rather
than a snapshot from before edits started: as of this revision,
`docs/backend/production-cutover-manifest.md` and
`docs/claude-remaining-production-actions-2026-09-23.md` are modified, and
`docs/codex-review-cutover-manifest-r2-2026-09-23.md` is untracked. Nothing
else in the worktree is touched. This will be true again the moment these
are committed or reverted — read `git status --short` fresh rather than
trusting either this note or revision 1's superseded claim.

## 2. Before/after map and concrete per-value decisions

**REVISED per review item 1**: every row below now states a concrete
retain/change/unset decision, not just "needs reconciliation."

| Resource | Observed now | Decision | Why |
| --- | --- | --- | --- |
| Supabase `zhrucqghrqkjyzmupdyy` | `ACTIVE_HEALTHY`, `eu-west-1`, working demo/staging backend | **Retain in place**, becomes production | Owner's in-place decision; same project ID, same data |
| Supabase `yecbsezhwvpdkuzmmziv` | `ACTIVE_HEALTHY`, `eu-west-1`, old production | **Preserve untouched** | Future staging candidate (Task D), separately approved |
| `https://adhan-connect.expo.app` | HTTP 200; deployment `b5blckazxb` (**last observed**, not reconfirmed which deployment currently serves it — see note below) | Move alias only at cutover (§9), not release preparation | Root alias move is the cutover trigger, not a prep step |
| `https://adhan-connect--preview.expo.app` | HTTP 200; deployment `ct1o9bkpvl` (**last observed**) | **Unchanged** throughout | Preserves working demo per owner instruction |
| `https://adhan-connect--production-release-canary-20260922.expo.app` | Deployment `8tahix06lu`, preview-configured | Retire after acceptance | Test evidence only |
| EAS `production` — `EXPO_PUBLIC_SUPABASE_URL` | `https://yecbsezhwvpdkuzmmziv.supabase.co` (old project) — **scope confirmed `production`-only**, safe to change without affecting preview/development | **Change** to `https://zhrucqghrqkjyzmupdyy.supabase.co` | Target correction |
| EAS `production` — `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_trDnsnBi_...` (old project's key) — **scope confirmed `production`-only** | **Change** to the retained project's working client key, sourced from `preview`'s matching value | Must pair with the URL change; **added to this list per review item 1**, omitted in revision 1 |
| EAS `production` — `EXPO_PUBLIC_API_BASE_URL` | `https://adhan-connect.expo.app` — scope `production`-only | **Unchanged** | Already correct; the alias itself, not this value, is what's stale |
| EAS `production` — `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE` | Old project URL; service role scope `production`-only, visibility `SENSITIVE` | **Change** both to retained project + its matching working server key | Server pair, never in client bundle |
| EAS `production` — `LIVEKIT_URL` | `wss://adhanconnect-6117gia9.livekit.cloud` — **scope is `development, preview, production` (SHARED record, same ID `edc18972-...` across all three)** | **Do not touch this record.** Value is already correct and appropriately shared (one LiveKit service, namespace differentiates rooms) | Editing a shared-scope variable would also change `preview`/`development`; confirmed via `--format long` this revision |
| EAS `production` — `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | **Confirmed absent** (not merely hidden) from `eas env:list --environment production --format long`, re-verified this revision with the same result as revision 1 | **Create** (not update — no existing record), scoped `production`-only, `--visibility sensitive` (matching how `preview`'s equivalent pair is stored) | See §3 for source and verification method |
| EAS `production` — `LIVEKIT_ROOM_NAMESPACE` | `production`, own record (`655c2212-...`), scope `production`-only, distinct ID from preview's `2b1cc0c6-...` | **Unchanged — already correct** | Already isolated per-environment |
| EAS `production` — `LIVE_BROADCAST_START_MODE`/`END_MODE`/`START_RPC_MOSQUE_IDS`/`END_RPC_MOSQUE_IDS` | `allowlist` mode, mosque ID `52fbe3bf-2d08-4009-9921-208afb5b3169` (old-production Harrow-only allowlist); scope `production`-only for all four | **Unset all four** | `preview` has none of these four set at all — its working behavior is the code default (`legacy`), not `allowlist`. Primary handover: "do not retain old production Harrow allowlists if using legacy." Matching preview's proven-working mode means removing these, not keeping them |
| EAS `production` — `EXPO_PUBLIC_APPLE_AUTH_ENABLED` / `GOOGLE_AUTH_ENABLED` / `SOCIAL_LINKING_ENABLED` | **Not present in EAS environment for either `preview` or `production`** | **Leave unset in EAS.** Set literal `'false'` only in the two native build systems (Android workflow already does; Xcode Cloud workflow must set explicitly, §4) | These gate client UI at build time; unset resolves falsy, matching the required off-by-default state. EAS env is not the mechanism that currently sets them anywhere |
| EAS `production` — `EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB`/`_NATIVE` | **Absent from both `preview` and `production`** | **Leave unset** | Matches primary handover: "initially unset; runtime web origin and configured native scheme derive correct URLs" — confirmed by symmetry with the working preview, not assumed |
| EAS `production` — `RESEND_API_KEY`, `MOSQUE_REQUEST_NOTIFY_EMAIL`, `MOSQUE_REQUEST_NOTIFY_FROM` | Absent from production; present (visibility `SENSITIVE`) in `preview` | **Carry forward by copy** from `preview`'s working values | Primary handover: preserve selectively verified mosque-request integration. **UNRESOLVED, owner confirmation needed** (not a value question): confirm the same staff/recipients should keep receiving production mosque-request notifications — this is a yes/no policy confirmation, not a request to reveal the address |
| EAS `production` — `MOSQUE_REQUEST_ADMIN_URL` | Absent from production; preview's value points at the preview admin route | **New value, not copied**: `https://adhan-connect.expo.app/admin/mosque-requests` | Primary handover explicitly requires updating this to the production admin link, not reusing preview's |
| `EXPO_FORCE_WEBCONTAINER_ENV` | `0`, scope `development, preview, production` (shared record `d02f7283-...`) | **Do not touch** | Shared, already correctly `0` everywhere |
| iOS production app `6792143739` | Bundle `com.maksumsdigitalagency.adhanconnect`; GitHub repo already connected to Xcode Cloud (`GITHUB_CLOUD`, `digimaxai/adhan-connect`); **no `ciProduct`/workflow exists for this specific app yet** — product onboarding is the actual gap, not a GitHub connection (Codex's r2 inspection, not independently re-verified by me — see §6) | Product onboarding + new Xcode Cloud workflow on `main` (§4) | Owner/UI action (default path; API path unresolved, §4) |
| Android production workflow | Implemented, committed, not registered on `main` | Registered via merge | — |
| Retained project's Auth `site_url`/redirect allowlist | **Still not freshly audited** — confirmed again this revision there is no `supabase` CLI subcommand for reading Auth config directly (checked `supabase --help`, no `auth` command in v2.115.0); the Management API route needs a bearer token this session has not extracted from the CLI's local credential store | Additive PATCH per primary handover §6.C.2 (unchanged from revision 1) | UNRESOLVED — see §6 |
| Notification dispatcher / assistant automation | Per 2026-09-22 SQL audit, not refreshed this session | Per primary handover §6.C.4–5 | UNRESOLVED — see §6 |

**Note on alias-to-deployment mapping (review item, "manifest accuracy"
bullet 2):** `b5blckazxb` and `ct1o9bkpvl` are **last-observed** deployment
IDs for the root and preview aliases, cited from earlier documents. `eas`
CLI has no `deploy:list`/`alias:list` read command in the installed version
(checked `eas deploy --help` and `eas deploy:alias --help` this revision —
neither lists existing deployments or current alias targets). HTTP 200 on
both aliases (checked this revision) proves reachability, not which
immutable deployment currently serves them or what configuration that
deployment embeds. Treat both IDs as last-observed until reconfirmed
through the Expo dashboard or a request that surfaces deployment metadata
directly — I do not currently have a CLI path to that confirmation.

## 3. Per-consumer environment change list

**REVISED per review items 1, 2, 4, 5.**

### EAS `production` environment

All target variables confirmed `production`-only scope this revision
(§2) — safe to change without a preview/production entanglement risk,
**except** `LIVEKIT_URL` and `EXPO_FORCE_WEBCONTAINER_ENV`, which are
shared records and must not be touched (§2).

Exact command (current, non-deprecated CLI syntax — `eas env:update`/
`env:create` are deprecated per their own `--help` output; `eas env:set`
both creates and updates):

```sh
eas env:set production --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://zhrucqghrqkjyzmupdyy.supabase.co \
  --visibility plaintext --non-interactive
# repeat per variable: EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL (plaintext),
# SUPABASE_SERVICE_ROLE, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (--visibility sensitive)
```

**Source of each new value**, per review item 2 — "a passing build does
not prove key/project matching," so provenance and an authenticated check
replace that assumption. **REVISED (r2 item 2):** the original probe was
wrong for the current key format — `sb_publishable_*`/`sb_secret_*` keys
are not JWTs and Supabase documents sending them in `apikey`, not
`Authorization: Bearer`. The PostgREST root can also reject a valid public
key for unrelated reasons, so a non-401 root response isn't reliable. The
RLS positive/negative pair is removed — unnecessary, table-specific, and
a data-disclosure risk. Corrected, no-data-output checks:

| Variable | Source | Non-mutating authenticated verification |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Literal, publicly known project URL | N/A — not a secret |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Copy from EAS `preview`'s existing value (already proven working against the same retained project by the live demo) | `GET https://zhrucqghrqkjyzmupdyy.supabase.co/auth/v1/health` with **only** the `apikey` header set to the value. Require HTTP `200`; discard the body. This is Supabase's documented health endpoint for a publishable key |
| `SUPABASE_URL` (server) | Literal | N/A |
| `SUPABASE_SERVICE_ROLE` | Copy from EAS `preview`'s existing working value | `GET https://zhrucqghrqkjyzmupdyy.supabase.co/rest/v1/` with **only** the server key in `apikey`. Require HTTP `200`; discard the OpenAPI response body. If the current server credential turns out to be a legacy JWT rather than `sb_secret_*`, record only that fact (type, not claims) and use the same `apikey`-header request — do not decode or log the JWT |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Copy from EAS `preview`'s existing working pair (already proven working by the demo's live broadcasts) | LiveKit server SDK token mint (`AccessToken` + `toJwt()`) is local/offline and only confirms the pair is well-formed. A full non-mutating confirmation needs a LiveKit server REST call (e.g. room listing) with the candidate credentials; not attempted this session — **UNRESOLVED**, run during reconciliation, not before |

Every check discards its response body and never logs the header value —
only the HTTP status code is meaningful output. This is a **specified
procedure**, not yet executed — running it requires the actual secret
values as CI-injected env vars, which this session does not hold (they
are `SENSITIVE`-visibility EAS values I have not requested
`--include-sensitive` for, since I have no approved reason to view them
outside an actual reconciliation step).

### GitHub Actions secrets

**REVISED (r2 item 4):** dropped the "confirmed by consequence" framing —
a passing build proves the values are non-empty and well-formed, not that
they're the *intended* ones, so that language was circular. The corrected
procedure verifies the authoritative source first, independent of what's
currently in GitHub, then **sets** the GitHub secrets from that verified
source rather than treating their unreadable existing values as trusted:

| Secret | Status | Procedure during reconciliation |
| --- | --- | --- |
| `PRODUCTION_EXPO_PUBLIC_SUPABASE_URL`, `PRODUCTION_EXPO_PUBLIC_SUPABASE_ANON_KEY` | Set 2026-09-22 (`gh secret list`); **value unreadable via `gh`, and this is a platform limitation with no read-back path at all, not a tooling gap** | Do not trust the existing value. Take the same verified-good values used for EAS `production` (§3's `apikey`-header checks), and `gh secret set` them fresh into GitHub. Record the mutation time. Then validate the resulting Android build without ever logging the key |
| `PRODUCTION_EXPO_PUBLIC_API_BASE_URL` | Set 2026-09-22 | Not secret (a public URL) — confirm by echo if useful, then `gh secret set` fresh from the same literal value used in EAS |
| `PRODUCTION_EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB`/`_NATIVE` | Confirmed absent | Intentional per §2's redirect decision, not a gap |

**There is no rollback value for unreadable GitHub secrets** unless an
independent authoritative record exists (here, the EAS `production`
values captured in the recovery file are that record). If reconciliation
needs to be reversed, the action is to `gh secret set` a newly verified
*intended* value (from the recovery file) — not to pretend the old bytes
in GitHub can be restored, since they never could be read to begin with.

### Recoverable vs. unrecoverable previous values (review item 5)

| Value | Recoverable? | How |
| --- | --- | --- |
| EAS `production` `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`SUPABASE_URL` (current, stale) | **Yes** | `eas env:list --environment production --include-sensitive --format long` captured to a `0600` file before the change — plaintext/non-sensitive values, straightforward |
| EAS `production` `SUPABASE_SERVICE_ROLE` (current, stale, old project's) | **Yes, but visibility-gated** | `--include-sensitive` reveals it in CLI output; must be captured to the private recovery root, never printed in chat/logs, before the change |
| EAS `production` `LIVEKIT_API_KEY`/`SECRET` | **N/A — do not exist yet**, nothing to recover |
| GitHub `PRODUCTION_*` secrets (current values) | **No** — GitHub Actions secrets are write-only once set; there is no read-back path at all, by design of the platform | If reconciliation changes them, the only "previous state" record is this manifest and the 2026-09-22 creation timestamp |
| Retained project's current Auth `site_url`/allowlist | **Recoverable in principle** via a fresh `GET` immediately before the PATCH (not yet performed — §6) | Standard Supabase Management API safe-field read |

**Visibility for new production entries**: `preview`'s existing sensitive
values (`LIVEKIT_API_KEY/SECRET`, `SUPABASE_SERVICE_ROLE`, `RESEND_API_KEY`,
`MOSQUE_REQUEST_*`) all use `Visibility: SENSITIVE`, not `SECRET` — checked
via `--format long` this revision. Per Expo's documented distinction
(review item 5's citation), `SECRET`-visibility variables cannot be used
by Hosting deployments; `SENSITIVE` can, and `preview`'s already-working
Hosting deployment proves this in practice. New production entries must
therefore also use `--visibility sensitive`, explicitly, not `secret` —
using `secret` would silently make server credentials unusable by the
production Hosting export.

### Xcode Cloud production workflow (once created)

Same as revision 1: `APP_VARIANT=production` plus the four
`EXPO_PUBLIC_*` client values copied from the reconciled EAS `production`
environment above, entered directly in App Store Connect's workflow UI —
first-time creation, no previous value to recover.

**REVISED (r2 item 3):** revision 2's proposed command redirected sensitive
output into a file and only afterward ran `chmod 600` — that leaves a
window where the file exists at the process's default (permissive) umask
before the chmod runs. Corrected procedure, secure from the first byte:

```sh
umask 077
mkdir -m 0700 -p /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation
eas env:list --environment production --include-sensitive --format long \
  > /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation/eas-production-before.txt
ls -la /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation
# Verify: directory mode 0700, file mode 0600 (umask 077 applied before the file existed, not after).
```

The directory
`/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation`
has been **created this session** (empty, mode `0700`, verified with
`ls -la`) so this command has a concrete real path, not a placeholder —
per r2's explicit instruction that no executable command in the final
packet may retain one. It contains no data yet; the `eas env:list`
capture itself is deferred to the approved reconciliation step, not run
during this read-only revision pass.

For each individual `eas env:set ... --value <secret>` call during
reconciliation, the value must come from a secure, non-history-logged
mechanism (an interactively piped value or a value read from a `0600`
file), never typed as a literal in a command that lands in shell history
or process listing.

**No fresh full-database/Storage export taken this session** — still an
UNRESOLVED, blocking prerequisite to cutover specifically (§9), separate
from the EAS-reconciliation recovery file above.

## 4. Native build workflow setup sequence

### iOS (owner/UI action for product onboarding — review r2 item 1)

**REVISED (r2):** `Admin` is a broad App Store Connect API-key role, but
it is **not** Apple's highest role — `Account Holder` is a separate role
with exclusive agreement/renewal/some-certificate responsibilities that
`Admin` does not carry. Revision 2's "Admin is Apple's highest role" claim
was wrong and is retracted; the key is assigned `Admin` and has broad API
permissions, nothing stronger is established.

What's actually known now, per Codex's fresh GET-only inspection this
session (r2 review):

- One connected source-control provider, type `GITHUB_CLOUD`.
- Repository `digimaxai/adhan-connect` is **already visible to Xcode
  Cloud** — repository ID `b14af416-8f9c-469f-ac5f-1e13247baa46`, last
  accessed 18 September 2026. **The GitHub connection itself is not the
  gap.** Revision 2's inference that the missing `ciProduct` implied an
  unconnected repository was incorrect — do not ask the owner to
  reauthorize GitHub access on that basis.
- What's actually missing is **product onboarding**: app `6792143739` has
  no `ciProduct` because Xcode Cloud has never been used for this app.
  Apple exposes `ciProducts` as products *detected* once Xcode Cloud is
  first used for an app/repo pairing — no public API endpoint creates one
  directly. Apple's documented `POST /v1/ciWorkflows` creates a workflow
  *for an existing product*, not the product itself.
- I still have not attempted any write call, and will not without
  explicit authorization for that specific step.

**Practical conclusion (revised)**: the remaining gap is product
onboarding, most likely done through Xcode's own "Create Workflow" flow
(which onboards the product as part of creating the first workflow) rather
than a separate GitHub reauthorization or an API call. The manual path
below remains the default because no public create-product API endpoint
was found — not because of any GitHub connection gap or key-role limit.

Manual path (unchanged from revision 1, still the default):

1. Merge PR #9 to `main` (release-preparation approval, §10).
2. In App Store Connect, create a **new** Xcode Cloud workflow for app
   `6792143739`: branch `main`, scheme `AdhanConnect`,
   `ios/AdhanConnect.xcworkspace`.
3. Manual start condition only.
4. Archive action, internal TestFlight distribution only.
5. Xcode-managed signing for `com.maksumsdigitalagency.adhanconnect`;
   confirm the archive attaches to app `6792143739`.
6. Set workflow environment values per §3's reconciled production values.
7. Select a build number greater than the last known upload (**last
   observed as 10** per Codex's 2026-09-23 inspection — re-verify this
   immediately before configuring the workflow, it is stale by the time
   this step runs, not a number to trust from this document).
8. Keep the existing staging workflow (`D668FCEB-8D07-4128-8C71-B909607C2760`,
   branch-exact `staging`) completely unchanged.

### Android

Unchanged from revision 1 (Codex review did not flag this section):

1. Merge PR #9 — registers the workflow on `main`.
2. Confirm all four signing secrets present (confirmed again this
   revision via `gh secret list`, unchanged since 2026-09-13).
3. Confirm `PRODUCTION_EXPO_PUBLIC_*` GitHub secrets target the retained
   project (verifiable only by consequence — §3).
4. Manually dispatch `Android Production Beta Build` from `main` at the
   pinned merge SHA.
5. Record run URL, SHA, APK/AAB artifact names/checksums, and verify the
   actual release signer (e.g. `apksigner verify --print-certs`).
6. Install the signed release APK on a physical device without Metro and
   confirm it reaches sign-in.

**Version code (added, r2 item 6):** the committed `app.json` has
`android.versionCode: 2` (confirmed this revision, `grep versionCode
app.json`). Since no Play upload exists yet, there is no Console history
to conflict with — the first artifact will simply build as version code
**2**. `eas.json`'s `autoIncrement` on the `production` build profile does
**not** affect this: that setting only applies to EAS Build, and this
workflow builds through GitHub Actions' own Gradle invocation, which
reads the committed value directly. Record version code 2 in §5 once the
first artifact exists, verify it from the built APK/AAB (not just the
source file), and before producing a *second* production artifact, define
an explicit increment step (e.g. bumping `app.json` in the release commit,
or a workflow-computed value) — do not wait for a Play upload rejection to
discover there's no increment mechanism.

### Google Play internal testing (new — from
`docs/mobile/google-play-beta-plan-2026-09-23.md`)

**Confirmed status**: organisation developer account, approved. Console
shows "Create your first app" — **no Adhan Connect app record exists, no
AAB/APK has ever been uploaded.** This is account onboarding, not app or
release approval. GitHub Actions remains the build system; Play is an
*additional* distribution route for the signed AAB the Android workflow
already produces, not a replacement for the APK-based acceptance path.

**Proposed first-app values** (owner must confirm each, not assume):

| Field | Proposed default | Confirmed? |
| --- | --- | --- |
| Default language | English (United Kingdom) | **UNRESOLVED — ask owner** |
| Store listing name | `Adhan Connect` (Google limits 30 characters) | **UNRESOLVED — ask owner** |
| App vs. game, free vs. paid | App, Free | **UNRESOLVED — ask owner** (changing free→paid later is restricted, so this needs deliberate confirmation, not silent assumption) |
| Public app-support email | — | **UNRESOLVED — ask owner.** Must be a public-facing address; do not place a private login address in Git or chat |
| Policy/export-law/Play App Signing declarations | — | **Owner-only** — these are account-holder legal declarations; I cannot and will not accept them on the owner's behalf |
| Internal tester Google accounts or existing tester group | — | **UNRESOLVED — ask owner**, bundled with the physical-device tester questions already pending in §9 |

**Signing verification required before any upload** (not yet performed,
no upload exists to verify): once the Android workflow produces a signed
AAB, compare its signing certificate against whatever Play App Signing
registers on first enrolment. For a brand-new app record, Play presents an
explicit app-signing-key-vs-upload-key choice at first upload — this
manifest does not pre-select one; present the choice to the owner when
that step is actually reached, per the addendum's explicit instruction not
to replace or reset a signing key as a routine action.

**Sequencing constraint** (from the addendum, restated because it
interacts with §9's acceptance boundary): do not make an internal Play
build available to testers while the retained-project database and the
root production API still disagree (i.e., before cutover) — an uploaded
test build is not proven inert once testers can install it. Offline,
no-network-action checks (install, cold launch to the sign-in screen,
uninstall) can precede cutover; anything that would authenticate or read
live data cannot.

**Not started**: no app record created, no AAB uploaded, no track
configured, no testers invited. All of §4's Google Play content is
planning only, per the addendum's own closing line: "No merge, build,
upload, track rollout, signing change or cloud mutation occurred as part
of writing this update" — equally true of this manifest revision.

## 5. Native build record slots and candidate server deployment

Unchanged from revision 1 — still genuinely blocked, nothing to fill:

| Slot | Status |
| --- | --- |
| Production iOS build number/run ID | BLOCKED — no workflow exists (product onboarding needed first, §4) |
| Production Android run URL/SHA/checksums | BLOCKED — not registered on `main`; version code will be **2** (committed `app.json` value, confirmed this revision, §4) |
| Candidate production Hosting deployment ID | BLOCKED — no production-configured export produced |
| Google Play app record / internal-track release ID | BLOCKED — no app record exists (§4) |
| Final post-merge build SHA | Unknown until PR #9 merges |

## 6. Fresh read-only service state

**REVISED**: this revision re-confirmed the same production/LiveKit gaps
independently (§2), and added the EAS scope/visibility findings that
review items 4–5 required. Still not refreshed, and now with a more
precise statement of *why*, per review item 6's standard of not overstating
what's actually established:

| Item | Status | Why not resolved this session |
| --- | --- | --- |
| Retained project's Auth `site_url`/allowlist | Never audited | No `supabase` CLI subcommand exists for it (checked `supabase --help`, v2.115.0 — confirmed no `auth` command); the Management API route needs a bearer token not extracted from the CLI's local credential store this session |
| App Store Connect: production Xcode Cloud product/workflow, build history, GitHub provider connection | Cited from Codex's 2026-09-23 inspections (both the original and the r2 follow-up confirming `digimaxai/adhan-connect` is already connected, repo ID `b14af416-8f9c-469f-ac5f-1e13247baa46`) — not independently re-run by me | I have not attempted the `.p8`-signed request path myself this session; deferred as redundant rather than a hard blocker, but genuinely not re-verified by me directly |
| EAS account-scope production variables | **Resolved (r2)**: Codex queried account scope read-only — no account-wide production variables exist, so no precedence conflict with the project-scope inventory in §2 | Recheck both scopes immediately before mutation; absence now is evidence, not a permanent guarantee |
| Auth Users/mosques/migrations/live markers/push registrations/assistant-automation counts | Cited from 2026-09-22 SQL audit, ~1 day stale | No direct database credentials available in this shell session |

**Boundary correction (manifest-accuracy bullet, "full fresh snapshots are
not prerequisites for every operation"):** the unresolved items above
block the **cutover** preflight (§9) and the **Auth/notification** steps
specifically. They do **not** block release preparation's build/export
steps (§4/§5), which only need the EAS/GitHub environment reconciliation
in §3. Revision 1 implied a broader blocking scope than is accurate; this
revision separates the two explicitly.

## 7. Backup and restore evidence

Unchanged from revision 1 — still cited from
`docs/backend/staging-to-production-runbook-2026-09-22.md`, still no fresh
export taken this session, still explicitly not a blocker for release
preparation's build steps (see the boundary correction in §6). It remains
a blocking prerequisite specifically for the EAS credential-reconciliation
step in §3 (capturing recoverable previous values before overwriting them)
and for cutover (§9).

Migration-copy scripts and the hosted-restore-rehearsal plan remain
superseded for this in-place release; relevant only to Task D, not
executable against `zhrucqghrqkjyzmupdyy`.

## 8. Forward/reverse commands

**REVISED per review items 3 and 7** — bound to the actual operation, not
a standalone check; correct, help-verified CLI syntax; explicit candidate-
deployment handling.

### Release preparation — forward

```sh
# 1. Confirm PR state immediately before merging (re-run, don't trust this document's cached values):
gh pr view 9 --json mergeable,mergeStateStatus,statusCheckRollup,headRefOid
# Proceed only if mergeable=MERGEABLE, mergeStateStatus=CLEAN, statusCheckRollup all SUCCESS.
# Merge via GitHub UI or: gh pr merge 9 --merge --subject "<reviewed subject>"
# Record the resulting main HEAD SHA immediately: git fetch origin && git rev-parse origin/main

# 2. Capture recoverable previous EAS production values BEFORE any change (§3, §7) —
#    secure from the first byte, directory already created this revision (§3):
umask 077
eas env:list --environment production --include-sensitive --format long \
  > /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation/eas-production-before.txt
ls -la /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation
# Verify directory 0700, file 0600 — both from creation, not via a later chmod.

# 3. Reconcile EAS production (current, non-deprecated syntax; run once per variable):
eas env:set production --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://zhrucqghrqkjyzmupdyy.supabase.co --visibility plaintext --non-interactive
# ... repeat per §3's table. Do NOT touch LIVEKIT_URL or EXPO_FORCE_WEBCONTAINER_ENV (shared scope).
# Secret values (SUPABASE_SERVICE_ROLE, LIVEKIT_API_KEY/SECRET) must come from a secure,
# non-history-logged mechanism, not a literal in this command text.

# Unset the four stale Harrow-only allowlist entries (exact help-verified syntax, r2 item 5):
eas env:delete production --variable-name LIVE_BROADCAST_START_MODE --scope project --non-interactive
eas env:delete production --variable-name LIVE_BROADCAST_END_MODE --scope project --non-interactive
eas env:delete production --variable-name LIVE_BROADCAST_START_RPC_MOSQUE_IDS --scope project --non-interactive
eas env:delete production --variable-name LIVE_BROADCAST_END_RPC_MOSQUE_IDS --scope project --non-interactive
# Before running: reconfirm via `eas env:list --environment production --format long` that these
# four still hold exactly their §2 observed values (allowlist / 52fbe3bf-2d08-4009-9921-208afb5b3169).
# STOP if the current values or record membership have drifted from §2 — do not delete unexpected state.

# 4. Verify credential/project match using the §3 corrected, no-data-output probes (illustrative;
#    run inside a workflow step with the value as a masked env var, never echoed, body discarded):
curl -sf -o /dev/null -w '%{http_code}' \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  https://zhrucqghrqkjyzmupdyy.supabase.co/auth/v1/health
# Expect 200. Anything else — STOP, the key does not belong to this project.
curl -sf -o /dev/null -w '%{http_code}' \
  -H "apikey: $SUPABASE_SERVICE_ROLE" \
  https://zhrucqghrqkjyzmupdyy.supabase.co/rest/v1/
# Expect 200.

# 4b. Set the matching GitHub secrets from the SAME verified-good values (r2 item 4 — do not
#     trust GitHub's existing unreadable values; overwrite fresh from the authoritative source):
gh secret set PRODUCTION_EXPO_PUBLIC_SUPABASE_URL --body "https://zhrucqghrqkjyzmupdyy.supabase.co"
gh secret set PRODUCTION_EXPO_PUBLIC_SUPABASE_ANON_KEY < /path/to/secure/value  # never as a literal arg
gh secret set PRODUCTION_EXPO_PUBLIC_API_BASE_URL --body "https://adhan-connect.expo.app"
# Record the mutation time; there is no read-back path to confirm the value afterward except a build.

# 5. Production export, from the pinned post-merge SHA, local dotenv disabled:
EXPO_NO_DOTENV=1 eas env:exec production "npx expo export --platform web --clear"
# Confirmed this revision: `npx expo export` writes to `dist/` by default, and `eas deploy`'s
# `--export-dir` also defaults to `dist` (checked `eas deploy --help`) — no explicit flag needed,
# no override found in package.json/scripts.

# 6. Deploy WITHOUT --prod and WITHOUT --alias (never move the root/preview alias here). Write the
#    result outside the repository, not as an untracked file inside the git working directory (r2 item 5):
eas deploy --environment production --json \
  > /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation/deploy-result.json
# --id is a CUSTOM identifier if you choose to set one; omitted here, so EAS assigns one automatically.
# Read the assigned deployment ID and URL from that file — do not invent or pre-guess it.

# 7. Candidate-deployment restrictions (review item 3 — an unaliased deployment is reachable, not inert):
#    - Allowed: GET the candidate's own unique URL root, /callback, /new-password (route existence only).
#    - Allowed: unauthenticated protected-API checks expecting 401 (mirrors existing test:live:contracts pattern).
#    - NOT allowed: any authenticated action (sign-in, broadcast, admin, rota edit) — the candidate
#      shares retained-project credentials with the eventual real production alias and with the demo.
#    - Record the candidate's exact URL/ID in this manifest's §5 once it exists.
```

### Release preparation — reverse

- EAS production environment: restore each changed variable from the
  recovery file with
  `eas env:set production --name <NAME> --value <FROM-RECOVERY-FILE> --visibility <matching> --non-interactive`.
  Re-create the four deleted `LIVE_BROADCAST_*` allowlist entries from
  their §2 observed values the same way, if reversal is needed:
  `eas env:set production --name LIVE_BROADCAST_START_MODE --value allowlist --visibility plaintext --non-interactive`
  (and the matching `END_MODE`/`START_RPC_MOSQUE_IDS`/`END_RPC_MOSQUE_IDS`
  with `52fbe3bf-2d08-4009-9921-208afb5b3169`). Delete any variable
  created fresh this session and not previously present
  (`LIVEKIT_API_KEY`/`SECRET`, `RESEND_API_KEY`, `MOSQUE_REQUEST_*`) with
  `eas env:delete production --variable-name <NAME> --scope project --non-interactive`
  (exact form confirmed via `eas env:delete --help` this revision).
- GitHub `PRODUCTION_*` secrets: per §3's r2 correction, there is no
  read-back path, so "reverse" means `gh secret set` a newly verified
  intended value from the recovery file — not restoring unreadable old
  bytes, which never could be read to begin with.
- Candidate Hosting deployment: `eas deploy:delete <DEPLOYMENT_ID>`
  (confirmed command, `eas deploy:delete --help` checked this revision).
  Root/preview aliases were never touched, so no alias reversal is needed
  for this checkpoint specifically.
- PR merge: reverting a merge to `main` is a separate, higher-impact
  decision than this manifest's scope (it affects the default branch
  history) — not included as a routine reverse step; would need its own
  explicit approval if ever required.

### Cutover — forward and reverse

Still specified in the primary handover §6.C and §7, not restated here to
avoid drift (unchanged from revision 1). **Correction (review item, "the
primary handover gives constraints and sequence, not complete executable
commands"):** treat the primary handover as the authoritative *sequence
and constraints*, not as copy-pasteable final commands — the actual
guarded Auth/notification/automation operations and their reverses must be
written from the fresh deployed definitions in §6 once those are obtained,
not assumed executable as written today. This is an explicit later-phase
blocker for cutover specifically, separate from release preparation.

## 9. Acceptance matrix, test window, and rollback

Full matrix unchanged, specified in the primary handover §8.

**REVISED per review item 8** — asking now, not deferred:

The four bundled questions from revision 1, plus the Google Play tester
question from §4, are asked together in this session's reply to the
owner (not held back until artifacts exist) — see the chat message
accompanying this revision. An answer to any of them is information, not
approval to distribute or cut over.

**Pre-cutover testing boundary (review item 8):** even a bare app launch
performs network operations (session check, prayer-time fetch, etc.).
"Offline/no-side-effect" for pre-cutover artifact checks means: install
the build, launch it, confirm it reaches the sign-in screen without
crashing, and stop there — do not sign in, do not browse mosque data, do
not enable notifications. Only after the matched API/database pair exists
(post-cutover) does the full acceptance matrix in the primary handover §8
apply.

Rollback route unchanged from revision 1.

## 10. Outstanding blockers and next concrete action

**Blocking release preparation:**

1. PR #9 merge — needs the bounded release-preparation approval requested
   below. Confirmed `MERGEABLE`/`CLEAN` as of this revision.
2. The recovery directory for EAS production values is created (§3,
   0700, empty) but the actual `eas env:list --include-sensitive` capture
   into it has not been run — blocks §8 forward step 3 specifically.
3. Google Play owner-input fields (§4) — needed before app-record
   creation specifically, not before anything else in release preparation.

**Blocking cutover only (not release preparation, §6's boundary
correction):**

4. Fresh Auth safe-field audit of the retained project.
5. Fresh notification/automation/live-state re-check.
6. Fresh full-database snapshot "after write quiescence" (§7).

**Resolved across this session's two revisions:**

7. ~~App Store Connect key role~~ — **Admin**, confirmed by owner
   2026-09-23. Not "Apple's highest role" (that's `Account Holder`) —
   corrected in revision 3 per r2 review item 1.
8. ~~Whether the GitHub repository is connected to Xcode Cloud~~ — **yes**,
   `digimaxai/adhan-connect` already connected (Codex's r2 inspection).
   The actual gap is app `6792143739`'s missing product onboarding, not a
   GitHub authorization — corrected in revision 3.
9. ~~EAS account-scope precedence risk~~ — checked read-only by Codex, no
   account-wide production variables exist.

**Owner-input questions, not blockers on my independent work:**

10. The four acceptance-window questions (§9) plus Play tester group (§4)
    — bundled, asked in the r2-revision reply; awaiting answers.

**Next concrete action**: report items 3 and 10 (the still-open owner
questions) alongside this revision, and request the bounded
release-preparation approval covering exactly: merge PR #9, the EAS
production-values recovery capture (§8 step 2) followed by EAS/GitHub
production environment reconciliation per §3, the first real native
builds, and a candidate Hosting deployment restricted to the read-only
smoke tests in §8. This explicitly excludes Google Play app
creation/upload (needs its own confirmed fields first, item 3) and
excludes §9's service cutover entirely.
