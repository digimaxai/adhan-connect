# Claude Code execution handover: authorised release preparation

Prepared by Codex on 23 September 2026 for Claude Code. This is the primary
execution prompt for the next session. Read it completely before changing
anything, then read the referenced manifest. Do not ask the owner to paste this
file back piece by piece; it is committed on the release branch.

## 1. Authority and exact boundary

The owner explicitly approved this bounded checkpoint in chat:

- make any small pre-merge release-safety corrections identified below;
- merge PR #9 to `main` after all checks pass;
- capture recoverable EAS production state privately;
- reconcile production-only EAS variables and the three GitHub Android client
  secrets to the retained project;
- build an unaliased production-configured EAS Hosting candidate;
- produce the first signed Android production APK/AAB;
- guide the owner through first-time production Xcode Cloud onboarding and
  produce the first iOS production archive/TestFlight-processed build.

Do not request the same approval again. This authority does **not** include:

- moving `adhan-connect.expo.app` or any other Hosting alias;
- changing Supabase Auth, database rows/schema, Storage, Edge Function secrets,
  notification functions, cron jobs, dispatchers or assistant automation;
- uploading the AAB to Google Play, creating a Play track, inviting testers or
  making any build available through Play;
- adding TestFlight testers or enabling automatic TestFlight distribution;
- resetting/reusing either Supabase project;
- merging the recorded-Adhan branch or adding fallback automation;
- deleting old deployments, branches, databases, users, mosques or backups.

If an action crosses that boundary, stop only that action, record it as pending,
and continue independent work inside the authorised scope.

## 2. Starting state and fixed identities

Start in `/private/tmp/adhan-connect-production-promotion`.

| Item | Required identity/state at handover |
| --- | --- |
| Repository | `digimaxai/adhan-connect` |
| Release branch | `release/stable-staging-to-production-2026-09-21` |
| Reviewed source before this handover-only commit | `62f3621b451086119e6b4ef5b18273823e821107` |
| Pull request | #9, `Prepare stable app for in-place production promotion` |
| PR base | `main` |
| PR state at handover | open, draft, mergeable, clean |
| Last CI at handover | run `35890763237`, passed |
| Reviewed implementation ancestor | `c1b8f57223197bdea5fa7fd753797460d8d3cace` |
| Retained Supabase project, becoming production | `zhrucqghrqkjyzmupdyy` |
| Old production, preserved for later staging decision | `yecbsezhwvpdkuzmmziv` |
| EAS project UUID | `20092fdb-b6af-47f8-891a-42f343175678` |
| Production web/API root | `https://adhan-connect.expo.app` |
| Working demo alias | `https://adhan-connect--preview.expo.app` |
| Production bundle/package | `com.maksumsdigitalagency.adhanconnect` |
| Production iOS app | App Store Connect `6792143739` |
| Production iOS scheme | `AdhanConnect` |
| Existing staging iOS app | App Store Connect `6811365919`, preserve |
| Google Play app record | `Adhan Connect`, package `com.maksumsdigitalagency.adhanconnect` |
| Private recovery directory | `/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation` |

The original checkout `/Users/mzk/PROJECTS/adhan-connect` and feature worktree
`/private/tmp/adhan-connect-cloud-recorded-adhan` contain unrelated work. Do not
reset, clean, overwrite, merge or discard either.

Read, in order:

1. this file;
2. `docs/backend/production-cutover-manifest.md`;
3. `docs/claude-remaining-production-actions-2026-09-23.md`;
4. `docs/mobile/xcode-cloud-production-beta-2026-09-22.md`;
5. `docs/mobile/google-play-beta-plan-2026-09-23.md`;
6. `docs/claude-production-promotion-handoff-2026-09-22.md` for later-cutover
   context only. Do not execute its Task C or D steps.

Where an older document says approval, Play app creation or GitHub connection is
pending, this file and the current manifest supersede it.

## 3. Phase 0: refresh state and close two pre-merge safety gaps

Run these read-only checks first:

```sh
cd /private/tmp/adhan-connect-production-promotion
git status --short
git branch --show-current
git fetch origin
git rev-list --left-right --count HEAD...origin/release/stable-staging-to-production-2026-09-21
git merge-base --is-ancestor c1b8f57223197bdea5fa7fd753797460d8d3cace HEAD
gh pr view 9 --json state,isDraft,headRefOid,baseRefName,mergeable,mergeStateStatus,statusCheckRollup,title,url
```

Expected before edits: release branch, clean worktree, `0 0`, ancestor check exit
0, PR open/draft/base `main`, and every current check successful. Inspect and
reconcile any drift; never reset or discard unexpected changes.

Two safety corrections are required before merge.

### 3.1 Allocate a valid iOS build number

The repository currently has iOS build number `1` in `app.json` and both
`CURRENT_PROJECT_VERSION` entries in
`ios/AdhanConnect.xcodeproj/project.pbxproj`. The latest production App Store
Connect upload observed on 23 September was build `10`. An upload using `1`
would fail.

Use the existing App Store Connect Admin API key only for GET requests and
refresh the maximum uploaded build number for app `6792143739`. Do not print the
private key or JWT. Set the next build number to `max + 1`; use `11` only if the
fresh query still proves `10` is the maximum. Update all three source locations:

- `expo.ios.buildNumber` in `app.json`, as a string;
- both `CURRENT_PROJECT_VERSION` settings in
  `ios/AdhanConnect.xcodeproj/project.pbxproj`.

Confirm exactly two project settings match the JSON value. Do not change the
marketing version or Android version code. Record the fresh maximum and chosen
number in the cutover manifest without storing API credentials.

If the App Store query cannot be completed, do not start the iOS archive. Other
release-preparation work may continue, but mark iOS `BLOCKED — BUILD NUMBER NOT
FRESHLY VERIFIED` rather than guessing.

### 3.2 Make Android artifact verification part of the build run

In `.github/workflows/android-production-build.yml`, add this step immediately
after `Build signed release APK and AAB` and before either upload-artifact step:

```yaml
      - name: Verify signed release artifacts
        working-directory: android
        run: |
          set -euo pipefail
          APK=app/build/outputs/apk/release/app-release.apk
          AAB=app/build/outputs/bundle/release/app-release.aab
          APKSIGNER="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner | sort -V | tail -1)"
          AAPT="$(find "$ANDROID_HOME/build-tools" -type f -name aapt | sort -V | tail -1)"
          test -n "$APKSIGNER" && test -x "$APKSIGNER"
          test -n "$AAPT" && test -x "$AAPT"
          "$APKSIGNER" verify --verbose --print-certs "$APK"
          "$AAPT" dump badging "$APK" | sed -n '1p'
          jarsigner -verify "$AAB"
          sha256sum "$APK" "$AAB"
```

This publishes only certificate metadata, package/version metadata and hashes;
it must not print keystore bytes or passwords. Preserve the always-run keystore
cleanup and both signed artifact uploads.

Run the complete pre-merge validation after both edits:

```sh
npx tsc --noEmit
npm run lint
npm run test:services
npm run test:notifications:safety
npm run test:production-build-guards
APP_VARIANT=production \
EXPO_PUBLIC_SUPABASE_URL=https://zhrucqghrqkjyzmupdyy.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=validation-placeholder \
EXPO_PUBLIC_API_BASE_URL=https://adhan-connect.expo.app \
EXPO_NO_DOTENV=1 npm run validate:app-identity
git diff --check
```

Expected baseline: TypeScript clean; lint zero errors and six known warnings;
services pass; notification safety returns `ok:true` with 18 protected files;
24 production-guard tests pass; production identity passes; diff check clean.
Investigate deviations instead of updating baselines to hide them.

Update the manifest with these corrections, commit only intended files, push the
release branch, and wait for PR #9 CI to pass at the new head. Record the new
head and CI run URL.

## 4. Phase 1: make PR #9 ready and merge it

Immediately before merge, refresh:

```sh
gh pr view 9 --json state,isDraft,headRefOid,baseRefName,mergeable,mergeStateStatus,statusCheckRollup,title,url
```

Proceed only when base is `main`, mergeable is `MERGEABLE`, merge state is
`CLEAN`, and every current check is `SUCCESS`. Then:

```sh
gh pr ready 9
gh pr merge 9 --merge
git fetch origin
git rev-parse origin/main
```

Do not squash, rebase, force-push or delete the release branch. Record the merge
commit as `MERGE_SHA`. Confirm the production workflow is registered on `main`:

```sh
gh workflow list --all
```

Create an isolated post-merge checkout. If the target path already exists,
inspect it and use another new empty path; never delete an unknown worktree:

```sh
git worktree add --detach /private/tmp/adhan-connect-production-preparation-main origin/main
cd /private/tmp/adhan-connect-production-preparation-main
git rev-parse HEAD
git status --short
```

The detached HEAD must equal `MERGE_SHA` and the worktree must be clean. Run all
exports and artifact bookkeeping from this checkout.

## 5. Phase 2: private recovery capture and source-credential checks

Create/correct the private directory before writing secrets:

```sh
umask 077
mkdir -m 0700 -p /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation
eas env:list --environment production --include-sensitive --format long \
  > /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation/eas-production-before.txt
shasum -a 256 \
  /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation/eas-production-before.txt \
  > /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation/eas-production-before.sha256
stat -f '%Sp %N' \
  /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation \
  /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation/eas-production-before.txt
```

Require directory `drwx------` and file `-rw-------`. Never `cat`, log, commit or
paste the file. Stop reconciliation if the capture is empty or permissions are
wrong.

Use `eas env:exec preview` to validate the retained-project source values without
displaying them. The checks must establish:

- preview `EXPO_PUBLIC_SUPABASE_URL` and `SUPABASE_URL` equal
  `https://zhrucqghrqkjyzmupdyy.supabase.co`;
- `GET /auth/v1/health` with the publishable key in `apikey` returns 200;
- `GET /rest/v1/` with the server key in `apikey` returns 200;
- LiveKit `RoomServiceClient.listRooms()` succeeds using preview's URL/key/secret;
- only labels and HTTP status/success booleans are printed, never values or
  response bodies.

Use `createRequire(process.cwd() + '/package.json')` if a private helper outside
the repository needs `livekit-server-sdk`. A failure stops credential copying;
do not work around it by weakening validation.

## 6. Phase 3: reconcile EAS production without exposing credentials

First refresh both project and account scopes. There must still be no
account-scope production variable conflict. Confirm `LIVEKIT_URL` and
`EXPO_FORCE_WEBCONTAINER_ENV` remain shared records; never update them.

Set public/literal values:

```sh
eas env:set production --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://zhrucqghrqkjyzmupdyy.supabase.co \
  --visibility plaintext --scope project --non-interactive
eas env:set production --name SUPABASE_URL \
  --value https://zhrucqghrqkjyzmupdyy.supabase.co \
  --visibility plaintext --scope project --non-interactive
```

Copy these verified values from `preview` to production without printing them or
placing them in shell history/process arguments:

| Variable | Production visibility |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `plaintext` |
| `SUPABASE_SERVICE_ROLE` | `sensitive` |
| `LIVEKIT_API_KEY` | `sensitive` |
| `LIVEKIT_API_SECRET` | `sensitive` |

Use EAS's interactive `env:set` prompt, or an `expect` helper stored mode 0700 in
the private recovery directory and invoked inside `eas env:exec preview`. The
helper must read the chosen value from its injected environment, spawn exactly:

```text
eas env:set production --name VARIABLE --visibility VISIBILITY --type string --scope project
```

and send the value only after `Variable value:`. It must set `log_user 0`, print
only the variable name and success/failure, and propagate the child exit code.
Do not use `--value` for copied credentials and do not read them into the agent
transcript.

The owner has not yet confirmed whether the existing preview mosque-request
recipients should receive production requests. Ask once, as a policy question,
without requesting the address. Continue every other step while awaiting it:

- if **yes**, copy `RESEND_API_KEY`, `MOSQUE_REQUEST_NOTIFY_EMAIL` and
  `MOSQUE_REQUEST_NOTIFY_FROM` with the same secure method and set
  `MOSQUE_REQUEST_ADMIN_URL` to
  `https://adhan-connect.expo.app/admin/mosque-requests` as `sensitive`;
- if **no** or unanswered, leave all four absent and record the production
  mosque-request email integration as pending. Do not guess recipients.

Before deleting old allowlist variables, confirm their current non-sensitive
values still match the manifest. Then run exactly:

```sh
eas env:delete production --variable-name LIVE_BROADCAST_START_MODE --scope project --non-interactive
eas env:delete production --variable-name LIVE_BROADCAST_END_MODE --scope project --non-interactive
eas env:delete production --variable-name LIVE_BROADCAST_START_RPC_MOSQUE_IDS --scope project --non-interactive
eas env:delete production --variable-name LIVE_BROADCAST_END_RPC_MOSQUE_IDS --scope project --non-interactive
```

Do not set redirect overrides or social-login flags in EAS. Do not touch
`LIVEKIT_URL`, `LIVEKIT_ROOM_NAMESPACE`, `EXPO_FORCE_WEBCONTAINER_ENV` or the
preview/development environments.

Run the same no-body Supabase/LiveKit probe under `eas env:exec production`.
Require all checks to pass. Then list production without sensitive values and
record names, visibility, scope and environment membership. Never record values.

## 7. Phase 4: replace the GitHub Android client secrets

Use the same verified retained-project publishable value. Avoid command-line
secret arguments:

```sh
gh secret set PRODUCTION_EXPO_PUBLIC_SUPABASE_URL \
  --repo digimaxai/adhan-connect \
  --body 'https://zhrucqghrqkjyzmupdyy.supabase.co'
eas env:exec preview \
  'printf %s "$EXPO_PUBLIC_SUPABASE_ANON_KEY" | gh secret set PRODUCTION_EXPO_PUBLIC_SUPABASE_ANON_KEY --repo digimaxai/adhan-connect'
gh secret set PRODUCTION_EXPO_PUBLIC_API_BASE_URL \
  --repo digimaxai/adhan-connect \
  --body 'https://adhan-connect.expo.app'
gh secret list --repo digimaxai/adhan-connect
```

Confirm the three `PRODUCTION_*` names and four Android signing-secret names
exist. GitHub cannot reveal old or new values; record mutation times and rely on
the workflow's exact URL/identity guards. Leave both production redirect secrets
absent. Never overwrite the signing secrets.

## 8. Phase 5: create an unaliased Hosting candidate

In the clean detached `MERGE_SHA` worktree, first confirm there is no unexpected
`.env.local`. Run validation and export with the production variant explicit;
this is mandatory because `app.config.js`'s retained-project ref otherwise has a
historical staging inference:

```sh
EXPO_NO_DOTENV=1 eas env:exec production \
  'APP_VARIANT=production EXPO_NO_DOTENV=1 node scripts/validate-production-build.js'
EXPO_NO_DOTENV=1 eas env:exec production \
  'APP_VARIANT=production EXPO_NO_DOTENV=1 npx expo export --platform web --clear'
umask 077
eas deploy --environment production --export-dir dist --json \
  > /Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation/deploy-result.json
```

Do not pass `--prod`, `--alias` or move any alias. Extract and record the unique
candidate deployment ID/URL and verify the JSON file is mode 0600.

Allowed candidate checks only:

- unauthenticated GET/redirect checks for `/`, `/callback`, `/new-password`;
- the existing unauthenticated protected-route contract checks that must return
  401 before all protected work, plus the documented malformed requests that
  return 400;
- no sign-in, session reuse, admin action, rota edit, notification registration,
  broadcast, mosque request or other authenticated/data-changing action.

`LIVE_REGRESSION_BASE_URL` may point at the unique candidate URL for
`npm run test:live:contracts`; the script must report
`productionDataMutations: 0`. A failure stops promotion of this candidate. Do
not delete it and do not alias it; record it for later cutover review.

## 9. Phase 6: produce and verify Android artifacts

Dispatch only the production workflow from `main`:

```sh
gh workflow run android-production-build.yml --ref main --repo digimaxai/adhan-connect
gh run list --workflow android-production-build.yml --branch main \
  --event workflow_dispatch --limit 5 \
  --json databaseId,headSha,status,conclusion,url,createdAt
```

Select the newly created run and require its `headSha` to equal `MERGE_SHA`.
Watch it to completion. The run must pass production URL/identity guards,
release signing requirements, `apksigner`, package/version inspection,
`jarsigner`, checksums, keystore cleanup and both artifact uploads.

Download both artifacts into a new mode-0700 subdirectory under the private
recovery directory. Record:

- workflow run ID/URL and `MERGE_SHA`;
- APK and AAB filenames, sizes and locally recalculated SHA-256 hashes;
- APK package `com.maksumsdigitalagency.adhanconnect`;
- version name `1.0.0` and version code `2`;
- public signing-certificate SHA-256 digest from `apksigner`;
- successful AAB signature verification.

Do not upload the AAB to Google Play. The owner still needs to provide a public
support email and manage a private tester list/group, and Play upload/tester
rollout is outside this checkpoint.

If a physical Android device is available, installation may verify only that the
APK installs and reaches the sign-in screen without Metro. Do not sign in or
exercise network-backed features before the production API alias and retained
database are matched during the separately approved cutover.

## 10. Phase 7: production Xcode Cloud onboarding and iOS build

The GitHub provider and `digimaxai/adhan-connect` repository are already
connected to Xcode Cloud. Do not ask the owner to reconnect GitHub. The missing
piece is first-time product/workflow onboarding for App Store Connect app
`6792143739`; no public API creates the missing `ciProduct` directly.

Claude must do every available read-only/API check first, then guide the owner
through the minimum interactive Xcode action. Use the post-merge worktree and:

1. Open `ios/AdhanConnect.xcworkspace` in Xcode and select scheme
   `AdhanConnect`.
2. Choose **Product → Xcode Cloud → Create Workflow**.
3. Select the existing production app `Adhan Connect` / `6792143739`, repository
   `digimaxai/adhan-connect`, branch `main`, workspace
   `ios/AdhanConnect.xcworkspace`, scheme `AdhanConnect`.
4. Use a **manual** start condition only. Do not add a branch-push trigger.
5. Add an iOS Archive action using Xcode-managed signing for
   `com.maksumsdigitalagency.adhanconnect`.
6. Upload/process the archive in App Store Connect/TestFlight, but do not assign
   tester groups, invite testers or enable automatic distribution.
7. Preserve the existing staging product/workflow/app unchanged.

Set only these workflow environment values:

```text
APP_VARIANT=production
EXPO_PUBLIC_SUPABASE_URL=https://zhrucqghrqkjyzmupdyy.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=(same retained-project publishable key; enter privately)
EXPO_PUBLIC_API_BASE_URL=https://adhan-connect.expo.app
EXPO_PUBLIC_APPLE_AUTH_ENABLED=false
EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=false
EXPO_PUBLIC_SOCIAL_LINKING_ENABLED=false
```

Do not add server credentials, service-role keys, LiveKit API keys, Resend keys or
redirect overrides to Xcode Cloud. Do not paste the publishable key into chat or
Git. Although it is a publishable client key, copy it through the private UI/env
path used for build configuration.

After the workflow exists, verify via GET/API or App Store Connect UI:

- a production `ciProduct` now exists and points to the correct repo/app;
- workflow branch/scheme/workspace/start condition are exact;
- staging workflow remains unchanged;
- chosen source build number is above every prior production build;
- the archive uses the production bundle identifier and contains no `.staging`;
- the Xcode log passed `scripts/validate-production-build.js` with
  `APP_VARIANT=production`;
- record workflow ID, run/build ID, source SHA, build number and processing
  result.

If the build fails, fix only within the authorised scope, rerun relevant checks,
and preserve logs. Do not switch to EAS Build or modify signing identities as a
shortcut.

## 11. Evidence, rollback and required reporting

After every mutation, update `docs/backend/production-cutover-manifest.md` with
safe evidence: timestamps, commit/run/deployment IDs, variable names/scopes and
validation outcomes. Never commit values, tokens, private emails, tester lists,
recovery exports or build artifacts.

If EAS reconciliation fails partway:

- stop before builds/deploy;
- restore old production URL/key/service-role values from the private before
  file through interactive prompts;
- recreate the four old allowlist entries only if restoring the entire previous
  production environment, using the exact commands in manifest §8;
- delete only variables proven newly created by this run;
- rerun the production probes and record the partial failure.

GitHub secrets are write-only. Reversal means setting a newly verified intended
value; never claim the previous bytes were recovered. A failed unaliased Hosting
candidate does not affect root/preview aliases. Do not revert the merge or delete
the candidate without a separately reviewed reason; record it and stop its use.

Before ending the Claude session, commit and push documentation/evidence updates
to an appropriate branch/PR without force-pushing. Provide the owner with:

1. completed steps and exact resource IDs/URLs;
2. changed cloud values by **name only**;
3. checks/builds that passed or failed;
4. Android and iOS artifact identities and hashes/IDs;
5. confirmation that demo alias, root alias, databases, Auth, notifications,
   Play tracks and tester audiences were untouched;
6. remaining blockers and the next concrete action.

Do not call the app production-ready. The valid final status for this checkpoint
is at most: source merged; production configuration reconciled; candidate API
deployed unaliased; native artifacts produced; connected device acceptance and
service cutover still pending.

## 12. Owner inputs to request without blocking independent work

Ask these in one concise bundle, but continue all work that does not depend on
the answer:

1. Should the same existing staging mosque-request recipients also receive
   production mosque requests? Ask for yes/no, not addresses.
2. What public support email should be shown on Google Play?
3. Which existing test mosque/account should be used later for reversible rota
   and prayer checks? Never request a password in chat.
4. When will two physical devices be available for the later live-audio canary?
5. What private Google tester group/list will the owner manage? Ask for the group
   name only, not individual email addresses.

Only question 1 affects an EAS variable decision in this checkpoint. The other
answers prepare later distribution/cutover and must not be treated as approval
to upload, invite, distribute or switch services.

## Appendix A: exact private credential helpers

Use these helpers if Claude cannot safely operate EAS's interactive prompts
directly. Store them only in the private recovery directory, mode 0700. They
must never be added to Git because their execution environment contains
credentials, even though the helper source itself contains none.

Create `probe-production-credentials.cjs` with exactly this content:

```js
#!/usr/bin/env node
'use strict';

const { createRequire } = require('node:module');
const expectedOrigin = 'https://zhrucqghrqkjyzmupdyy.supabase.co';

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing:${name}`);
  return value;
}

async function requireStatus(label, url, key) {
  const response = await fetch(url, { headers: { apikey: key } });
  const status = response.status;
  await response.body?.cancel().catch(() => {});
  if (status !== 200) throw new Error(`${label}:http-${status}`);
  return status;
}

(async () => {
  const publicUrl = requireValue('EXPO_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const serverUrl = requireValue('SUPABASE_URL').replace(/\/+$/, '');
  if (publicUrl !== expectedOrigin || serverUrl !== expectedOrigin) {
    throw new Error('supabase-origin-mismatch');
  }

  const healthStatus = await requireStatus(
    'publishable-key',
    `${expectedOrigin}/auth/v1/health`,
    requireValue('EXPO_PUBLIC_SUPABASE_ANON_KEY')
  );
  const restStatus = await requireStatus(
    'server-key',
    `${expectedOrigin}/rest/v1/`,
    requireValue('SUPABASE_SERVICE_ROLE')
  );

  const projectRequire = createRequire(`${process.cwd()}/package.json`);
  const { RoomServiceClient } = projectRequire('livekit-server-sdk');
  const livekitUrl = new URL(requireValue('LIVEKIT_URL'));
  if (livekitUrl.protocol === 'wss:') livekitUrl.protocol = 'https:';
  if (livekitUrl.protocol === 'ws:') livekitUrl.protocol = 'http:';
  const rooms = new RoomServiceClient(
    livekitUrl.toString(),
    requireValue('LIVEKIT_API_KEY'),
    requireValue('LIVEKIT_API_SECRET')
  );
  await rooms.listRooms();

  console.log(JSON.stringify({
    ok: true,
    supabaseOriginMatched: true,
    publishableHealthStatus: healthStatus,
    serverRestStatus: restStatus,
    livekitListRooms: 'passed'
  }));
})().catch((error) => {
  console.error(`Credential probe failed: ${error.message}`);
  process.exitCode = 1;
});
```

Create `copy-preview-eas-variable.exp` with exactly this content:

```tcl
#!/usr/bin/expect -f
log_user 0
set timeout 180

if {$argc != 2} {
  puts stderr "Usage: copy-preview-eas-variable.exp VARIABLE VISIBILITY"
  exit 2
}

set variable [lindex $argv 0]
set visibility [lindex $argv 1]
if {![info exists env($variable)] || [string trim $env($variable)] eq ""} {
  puts stderr "Source variable is missing: $variable"
  exit 3
}

spawn -noecho eas env:set production --name $variable --visibility $visibility --type string --scope project
expect {
  -re {Variable value:} { send -- "$env($variable)\r" }
  timeout {
    puts stderr "Timed out waiting for value prompt: $variable"
    exit 4
  }
  eof {
    puts stderr "EAS exited before value prompt: $variable"
    exit 5
  }
}
expect eof
set result [wait]
set exitCode [lindex $result 3]
if {$exitCode != 0} {
  puts stderr "EAS failed while setting: $variable"
  exit $exitCode
}
log_user 1
puts "Updated production variable: $variable"
```

Prepare and run them from the clean post-merge worktree:

```sh
RECOVERY=/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-23-production-environment-reconciliation
chmod 700 "$RECOVERY/probe-production-credentials.cjs" "$RECOVERY/copy-preview-eas-variable.exp"
eas env:exec preview "node $RECOVERY/probe-production-credentials.cjs"
eas env:exec preview "$RECOVERY/copy-preview-eas-variable.exp EXPO_PUBLIC_SUPABASE_ANON_KEY plaintext"
eas env:exec preview "$RECOVERY/copy-preview-eas-variable.exp SUPABASE_SERVICE_ROLE sensitive"
eas env:exec preview "$RECOVERY/copy-preview-eas-variable.exp LIVEKIT_API_KEY sensitive"
eas env:exec preview "$RECOVERY/copy-preview-eas-variable.exp LIVEKIT_API_SECRET sensitive"
eas env:exec production "node $RECOVERY/probe-production-credentials.cjs"
```

If the owner confirms the same mosque-request recipients, additionally run:

```sh
eas env:exec preview "$RECOVERY/copy-preview-eas-variable.exp RESEND_API_KEY sensitive"
eas env:exec preview "$RECOVERY/copy-preview-eas-variable.exp MOSQUE_REQUEST_NOTIFY_EMAIL sensitive"
eas env:exec preview "$RECOVERY/copy-preview-eas-variable.exp MOSQUE_REQUEST_NOTIFY_FROM sensitive"
eas env:set production --name MOSQUE_REQUEST_ADMIN_URL \
  --value https://adhan-connect.expo.app/admin/mosque-requests \
  --visibility sensitive --scope project --non-interactive
```

The probe intentionally prints only statuses. The expect helper disables child
output before sending the value, so plaintext variables cannot echo into logs.
Delete neither helper during this checkpoint; retain them privately with the
recovery evidence for review and rollback.
