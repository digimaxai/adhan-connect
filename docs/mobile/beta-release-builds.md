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
EXPO_PUBLIC_SUPABASE_REDIRECT_URL
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
LIVE_BROADCAST_START_MODE
LIVE_BROADCAST_START_RPC_MOSQUE_IDS
LIVE_BROADCAST_END_MODE
LIVE_BROADCAST_END_RPC_MOSQUE_IDS
```

If the API routes are deployed with EAS Hosting, configure those server-only values in the hosting/server environment with **sensitive** visibility. EAS Hosting cannot deploy variables with **secret** visibility. Do not prefix server-only values with `EXPO_PUBLIC_`.

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
