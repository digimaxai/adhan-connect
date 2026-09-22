# Xcode Cloud production-beta workflow

For the current in-place promotion, production targets the retained Supabase
project `zhrucqghrqkjyzmupdyy`, not the old production project. Follow the exact
environment mapping and workflow-inspection gates in
[`../claude-production-promotion-handoff-2026-09-22.md`](../claude-production-promotion-handoff-2026-09-22.md).
The native configuration below remains applicable; do not copy stale EAS
production values before that environment mapping has been reconciled.

The release branch contains a clean production native baseline generated from
the reviewed Expo configuration:

- project: `ios/AdhanConnect.xcodeproj`;
- shared scheme and target: `AdhanConnect`;
- product name: `AdhanConnect`;
- bundle identifier: `com.maksumsdigitalagency.adhanconnect`;
- URL scheme: `adhanconnect`;
- App Store Connect app ID: `6792143739`.

The `staging` branch keeps its existing `AdhanConnectStaging` project, scheme,
`.staging` bundle identifier and `adhanconnect-staging` URL scheme. Do not copy
the production `ios/` directory back to `staging`.

## Create the workflow

Create a separate Xcode Cloud workflow for the production App Store Connect
app after PR #9 is approved and merged:

1. Select repository branch `main` and shared scheme `AdhanConnect`.
2. Use a manual start condition for the first beta build. Do not enable an
   automatic production/TestFlight release trigger during migration.
3. Add an Archive action for iOS and distribute only to an internal TestFlight
   group until the migration acceptance checks pass.
4. Use Xcode-managed signing for
   `com.maksumsdigitalagency.adhanconnect`; confirm the resulting archive is
   attached to App Store Connect app `6792143739`.
5. Keep the existing staging workflow on branch `staging`, scheme
   `AdhanConnectStaging`, and the staging App Store Connect app.

## Workflow environment

Set these values in the production Xcode Cloud workflow. Copy the public client
values from the EAS `production` environment without placing them in Git or
build logs:

```text
APP_VARIANT=production
EXPO_PUBLIC_SUPABASE_URL=<production Supabase URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
EXPO_PUBLIC_API_BASE_URL=<production HTTPS API URL>
EXPO_PUBLIC_APPLE_AUTH_ENABLED=false
EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=false
EXPO_PUBLIC_SOCIAL_LINKING_ENABLED=false
```

The workflow does not currently need redirect overrides on native iOS because
the app derives `adhanconnect://...` callbacks from its production scheme.
Confirm the generated callback and password-reset URLs in the production
Supabase Auth allowlist before distributing the build.

Do not add `SUPABASE_SERVICE_ROLE`, LiveKit API credentials, notification
dispatcher secrets, or other server values to Xcode Cloud. The client bundle
must receive only `EXPO_PUBLIC_*` values.

## Repository build behavior

Xcode Cloud runs `ios/ci_scripts/ci_post_clone.sh`. The script installs the
locked JavaScript dependencies, writes only `EXPO_PUBLIC_*` workflow values to
an ignored `.env.local`, runs non-clean Expo prebuild against the committed
production project, and installs CocoaPods. A clean production rehearsal and a
second non-clean rehearsal both resolved the project, scheme, product name,
bundle identifier and URL scheme shown above.

The local config plugin `plugins/with-ios-pod-build-settings.js` is applied on
every prebuild. It raises transitive CocoaPods targets to the app's iOS 15.1
minimum and compiles only the pinned `fmt` pod as C++17, avoiding two Xcode 27
compiler failures without changing application code. After CocoaPods install,
a signing-disabled Release build completed successfully on Xcode 27.0 with the
production EAS public variables. Warnings from React Native, Expo and LiveKit
dependencies remain non-fatal.

Before TestFlight acceptance, confirm the Xcode Cloud log reports
`APP_VARIANT=production`, the Archive uses the production bundle identifier,
and no `.staging` identifier appears in the signed archive.
