# Beta Release Builds

Use this runbook when creating installable Android and iOS builds for beta testers.

Adhan Connect uses native LiveKit/WebRTC modules, so Expo Go is not enough for beta testing. Use EAS Build for signed Android APK/AAB and iOS ad hoc/TestFlight builds.

## Current App IDs

- iOS bundle identifier: `com.maksumsdigitalagency.adhanconnect`
- Android package name: `com.maksumsdigitalagency.adhanconnect`
- App scheme: `adhanconnect`

Keep these identifiers stable once testers have installed beta builds.

## Apple Developer Enrollment

- Enrollment type: Organization
- Legal entity name: Maksums Limited
- Trading name: Maksums Digital Agency
- Website: https://www.maksums.com

Apple's public "Seller" name on the App Store defaults to the legal entity name (Maksums Limited) unless a separate request is made after enrollment to display the trading name instead.

## Required Backend URL

Native beta builds cannot call Expo Router API routes on `localhost`, `127.0.0.1`, `10.0.2.2`, or a Mac LAN IP. Before sharing a build outside local development, deploy the API routes to a stable HTTPS host and set:

```text
EXPO_PUBLIC_API_BASE_URL=https://<your-api-host>
```

This URL is required for LiveKit token endpoints, listener playback endpoints, and admin/muezzin server API actions.

## Environment Variables

Local `.env` files are ignored by git and are not available to EAS cloud builds. Configure EAS environment variables for each build environment instead.

Client-side values, safe to embed in the app binary:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB
EXPO_PUBLIC_SUPABASE_REDIRECT_URL_NATIVE
EXPO_PUBLIC_APPLE_AUTH_ENABLED=false
EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=false
EXPO_PUBLIC_SOCIAL_LINKING_ENABLED=false
EXPO_PUBLIC_API_BASE_URL
EXPO_FORCE_WEBCONTAINER_ENV=0
```

Server-only values must stay on the hosted API server, not in the mobile app build:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVE_STREAM_UPSTREAM_ALLOWED_HOSTS
LIVE_BROADCAST_START_MODE
LIVE_BROADCAST_START_RPC_MOSQUE_IDS
LIVE_BROADCAST_END_MODE
LIVE_BROADCAST_END_RPC_MOSQUE_IDS
ACCOUNT_TRUST_PROXY
ACCOUNT_DELETION_ENABLED
ACCOUNT_DELETION_SCHEMA_AUDITED
ACCOUNT_DELETION_STORAGE_AUDITED
ACCOUNT_DELETION_ORCHESTRATION_AUDITED
ACCOUNT_DELETION_STORAGE_BUCKETS
ACCOUNT_DELETION_APPLE_REVOCATION_READY
ACCOUNT_DELETION_APPLE_REVOCATION_URL
ACCOUNT_DELETION_APPLE_REVOCATION_SECRET
```

If the API routes are deployed with EAS Hosting, configure those server-only values in the hosting/server environment with **sensitive** visibility. EAS Hosting cannot deploy variables with **secret** visibility. Do not prefix server-only values with `EXPO_PUBLIC_`.

Use exact callback paths (normally `/callback` and `/new-password`) and
allow-list both web HTTPS and `adhanconnect://` native variants in Supabase.
The legacy `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` remains a compatibility fallback
only; do not use one value to overwrite both platforms.

Keep all three social flags false until Apple and Google are enabled and tested
in Supabase, Apple is present on every iOS build that offers another social
provider, provider-linking preserves the original Auth UUID for every staff
role, and current provider branding has been reviewed.

Account deletion must remain disabled unless every audit flag is true, the
durable account-control migration and cleanup schedule are deployed, and an
enabled `account-deletion/1.0` row has been deliberately inserted into
`public.account_deletion_release_approvals`. See
`docs/auth/account-auth-release-gates.md`; environment flags alone cannot
enable deletion.

`LIVE_BROADCAST_START_MODE` controls the transactional broadcast-start rollout:

- `legacy` (or missing): keep the existing start path.
- `allowlist`: use the transactional RPC only for UUIDs listed in the comma-separated `LIVE_BROADCAST_START_RPC_MOSQUE_IDS` value.
- `rpc`: use the transactional RPC for every mosque.

Deploy the database migration before selecting `allowlist` or `rpc`. Never fall back to the legacy start path after an RPC timeout because the transaction may already have committed.

`LIVE_BROADCAST_END_MODE` independently controls the transactional broadcast-end rollout with the same values:

- `legacy` (or missing): keep the existing end path.
- `allowlist`: use the transactional RPC only for UUIDs listed in the comma-separated `LIVE_BROADCAST_END_RPC_MOSQUE_IDS` value.
- `rpc`: use the transactional RPC for every mosque.

Deploy the end migration before selecting `allowlist` or `rpc`. The transactional end clears all live stream and adhan rows for the mosque in one commit, then performs non-fatal LiveKit room cleanup. Do not fall back to the legacy end path after an RPC timeout; retrying the RPC is idempotent and retains the room name for cleanup.

## Adding A Mosque To The Transactional Canary

Do not add a mosque to the START or END list merely because its live-stream
toggle is active. Complete the main-admin **Broadcast Readiness** workflow first:

1. Configure the prayer source/timetable, local admin, active muezzin, and
   default muezzin or future rota.
2. Configure and enable the intended provider.
3. Resolve every required readiness check and provision one dormant stream.
4. Confirm `Ready for test` in the portal.
5. Add the same mosque UUID to both START and END lists, then export and deploy
   the hosted API with the production EAS environment.
6. Confirm the portal reports both transactional paths enabled.
7. Run the publisher/listener start, audio, end, and restart test.
8. Verify hosted telemetry, zero residual live database rows, and LiveKit room
   cleanup before recording `Test passed` and launching the mosque.

The portal does not expose or edit either allowlist. A partial rollout, where
only START or END is transactional, must not be tested. See
`docs/admin/live-broadcast-onboarding.md` for the complete operational flow.

## One-Time EAS Setup

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

The project profiles in `eas.json` use the EAS environments `development`, `preview`, and `production`.

Create or update EAS environment variables through the Expo dashboard or CLI. Example:

```bash
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL --value https://<preview-api-host> --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_BASE_URL --value https://<production-api-host> --visibility plaintext
```

Use plaintext or sensitive visibility for client-side `EXPO_PUBLIC_` values because they are embedded in the app and are inherently public. Use sensitive visibility for server-only values required by EAS Hosting. Reserve secret visibility for values used only inside EAS Build or Workflows, because secret variables cannot be included in a Hosting deployment.

When the local `.env` contains credentials that do not belong in Hosting (for example `SUPABASE_ACCESS_TOKEN`), disable local dotenv loading and export with the selected EAS environment before deploying:

```bash
EXPO_NO_DOTENV=1 npx eas-cli@latest env:exec production \
  'npx expo export --platform web --clear'
EXPO_NO_DOTENV=1 npx eas-cli@latest deploy \
  --environment production \
  --non-interactive
```

This keeps the Hosting manifest limited to the variables configured in the EAS production environment.

## Pre-Build Checks

Run these before starting a cloud build:

```bash
npm ci
npx tsc --noEmit
npm run lint
npx expo config --type public
npx eas-cli@latest whoami
```

Confirm the resolved Expo config shows the expected iOS bundle identifier and Android package name.

## Android Beta APK

Use the preview profile for installable APKs that can be shared with testers:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Use the production profile when preparing the Google Play internal testing track:

```bash
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production
```

The production Android profile creates an AAB for Google Play.

## iOS Beta

For quick internal device testing, register tester devices and build the preview profile:

```bash
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

For TestFlight, use a production iOS build and submit it to App Store Connect:

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

iOS TestFlight requires Apple Developer Program access and App Store Connect credentials.

## Local Development Builds

Use these only for local device testing while Metro is running:

```bash
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform ios --profile development
```

For Android emulator-only API routing, use:

```bash
npx eas-cli@latest build --platform android --profile development:android-emulator
```

Do not use emulator or LAN API URLs for beta testers.

## Environments And Branch Promotion (added 2026-07-24)

There are now two persistent environments, each with its own Supabase project and EAS environment:

- **`staging`** git branch -> EAS `preview`/`development` environments -> the
  `adhan-connect-staging` Supabase project (same org/region as production,
  schema-cloned from it). This is where beta/TestFlight-ad-hoc builds get cut
  from, and where UAT happens.
- **`main`** git branch -> EAS `production` environment -> the real production
  Supabase project. `main` is protected: changes land via a pull request with
  a required `checks` CI status (`npx tsc --noEmit` + `npm run lint`), no
  force-push, no branch deletion. The repo owner can still bypass this in a
  genuine emergency (`enforce_admins` is deliberately `false`) -- GitHub will
  show a "Bypassed rule violations" warning when that happens, which is the
  intended signal that an emergency path was used, not a bug.
- `staging` itself is intentionally **not** protected -- push directly to it.
  CI still runs on every push there (informational), but gating only earns
  its keep on `main`, where it's tied to the live database and App Store
  identity.

Promotion flow for a change (including a new Supabase migration):

1. Branch off `staging` (e.g. `feature/xyz`), commit, push, open a PR into
   `staging`. Let CI run.
2. Merge into `staging`. If the change includes a new file under
   `supabase/migrations/`, apply it to staging now:
   ```bash
   npx supabase@latest db push --project-ref <staging-project-ref>
   ```
3. Cut an EAS `preview`-profile build from `staging` for real device/UAT
   testing against the staging Supabase project's synthetic data.
4. Only once UAT passes and the product owner explicitly signs off: open a
   PR from `staging` into `main`. Once merged, apply the same migration to
   production -- always `--dry-run` first:
   ```bash
   npx supabase@latest db push --project-ref yecbsezhwvpdkuzmmziv --dry-run
   npx supabase@latest db push --project-ref yecbsezhwvpdkuzmmziv
   ```
   Then cut the EAS `production`-profile build/submit.

The local `supabase` CLI's persistent link (`supabase/config.toml`, gitignored)
defaults to the staging project specifically, so a command run without an
explicit `--project-ref` hits the safe target. Touching production is always
a conscious extra flag, and any production push should be `--dry-run` first.

Before touching EAS environment variables: `SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE` were originally each a *single* variable record
shared across all three EAS environments (not obvious from the CLI). They
were split into independent per-environment records on 2026-07-24. Run
`eas env:list --environment <env> --format long` and check the
`Environments:` field before assuming a variable is already
environment-specific -- if it lists more than one environment, updating it
for "one" environment silently updates all of them.
