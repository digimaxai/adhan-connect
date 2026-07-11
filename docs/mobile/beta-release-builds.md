# Beta Release Builds

Use this runbook when creating installable Android and iOS builds for beta testers.

Adhan Connect uses native LiveKit/WebRTC modules, so Expo Go is not enough for beta testing. Use EAS Build for signed Android APK/AAB and iOS ad hoc/TestFlight builds.

## Current App IDs

- iOS bundle identifier: `com.digimaxai.adhanconnect`
- Android package name: `com.digimaxai.adhanconnect`
- App scheme: `adhanconnect`

Keep these identifiers stable once testers have installed beta builds.

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
```

If the API routes are deployed with EAS Hosting, configure those server-only values in the hosting/server environment. Do not prefix them with `EXPO_PUBLIC_`.

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

Use plaintext or sensitive visibility for client-side `EXPO_PUBLIC_` values because they are embedded in the app and are inherently public. Use secret visibility only for build-time/server-only values that are not embedded in the mobile binary.

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
