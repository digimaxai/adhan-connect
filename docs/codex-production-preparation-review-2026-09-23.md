# Codex review of Claude's production preparation

Reviewed 23 September 2026, starting from `ab3ff12` and Claude's uncommitted
changes. Active strategy remains in-place retention of `zhrucqghrqkjyzmupdyy`.
No service cutover, native build start, merge or project reset occurred.

## Findings and corrections

Claude's explicit production EAS variant and positive identity matrix agree with
the plan. The Android workflow was unchanged, as reported. The original iOS
guard was incomplete: local executions demonstrated exit 0 for an HTTP Supabase
URL, an unwanted API base path, a wrong iOS bundle override, and entirely missing
configuration. It also allowed a staging variant in this production-native
checkout. Merely checking an origin/host does not verify resolved app identity.

The corrected implementation:

- `scripts/validate-production-build.js` is shared by production Android and
  the production-native Xcode hook. It requires explicit production variant,
  the retained HTTPS Supabase root, the exact production HTTPS API root, a
  nonempty client key, and the resolved production display name, native scheme,
  iOS bundle identifier, Android package and Expo app variant. Credentials,
  unexpected paths/ports, query strings and fragments are rejected. It does
  not print supplied URLs or client keys in validation failures.
- Android validates the environment before dependency installation and the
  resolved Expo identity after installation. Xcode checks before prebuild.
  The release hook intentionally refuses staging or missing variant: its
  committed native scheme is production. The staging branch/hook is untouched.
- The production Android workflow requires all four signing secrets, passes
  them via environment bindings (not shell-source interpolation), builds signed
  release APK and AAB, requires both artifacts to exist, and removes the decoded
  keystore in an always-run cleanup. The misleading debug APK acceptance path
  was removed. This workflow is still manual only, with read-only repository
  permission; it does not submit to Google Play.
- Claude's app-identity matrix now disables local dotenv and clears identifier
  overrides for deterministic fixtures. Real production validation uses actual
  environment overrides and rejects wrong values; fixture checks do not replace it.
- Added 24 focused guard tests and wired those plus the identity matrix into CI.
- `eas.json` keeps Claude's explicit production variant. `app.config.js` and
  the demo's existing database inference remain unchanged.

The validator cannot prove that an opaque client key belongs to its configured
project. Matching client/server credentials still requires the authenticated
environment verification in the cutover packet. No cloud credentials were
replaced in this review; the existing production values are still for the OLD
project, so a production build should fail the new checks until reconciled.

Claude's reported auto-mode denials are preserved in the incoming handover.
The authorised workflow preparation edit succeeded through normal tools in this
session. No agent permission settings were changed and no bypass was installed.

## Validation

- 24 production-guard tests passed, including absent settings, old database,
  HTTP, wrong ports/paths, preview API, URL credentials, and wrong app identities.
- Actual Expo CLI production configuration passed; actual iOS and Android
  identifier override cases failed as required.
- Explicit staging and production fixture identity matrices passed.
- Android YAML parsed; each embedded shell script passed syntax checking;
  the signing gate passed with all four dummy values and failed with each
  individual value missing. No secret expression remains inside shell source.
- TypeScript passed. Lint: zero errors, the same six existing warnings.
- Services passed. Notification safety passed with all 18 protected live files
  unchanged. No fingerprint baseline was updated.
- Xcode shell syntax and `git diff --check` passed.

This is build preparation evidence, not a signed Android/iOS build or a phone
acceptance result. No app runtime source was changed.

## Xcode Cloud read-only inspection

Contrary to the incoming assumption that App Store Connect could not be accessed,
the API key already referenced by `eas.json` exists and permits useful read-only
inspection. It was used only to sign short-lived, GET-scoped requests to Apple;
neither the private key nor bearer tokens were printed.

- Production app `6792143739`: bundle
  `com.maksumsdigitalagency.adhanconnect`. Its `ciProduct` relationship returned
  404. The product list also showed only the Adhan Connect staging product.
  No production Xcode Cloud product/workflow is presently visible.
- Latest uploaded production build is **10**, build resource
  `4b486d65-bba6-46a6-8c84-ca0eb4da3ac9`, 18 July 2026, VALID/unexpired.
  Builds 8 and 9 also exist. Choose a valid non-conflicting build number when
  configuring the first production workflow; do not assume committed number 1
  or a new workflow counter automatically exceeds prior submissions.
- Staging app `6811365919`: bundle
  `com.maksumsdigitalagency.adhanconnect.staging`. Latest uploaded build is
  **41**, `d78d0d30-1e42-4ada-a93e-9cb0927495c5`, 18 September 2026,
  VALID/unexpired. This does not establish which build is on the owner's phone.
- Staging CI product: `DD7F1666-B0D0-407B-A0F4-939E8BFF29EC`.
- Workflow `Default`: `D668FCEB-8D07-4128-8C71-B909607C2760`, enabled,
  exact branch condition `staging`, automatic cancellation enabled, no automatic
  PR/tag/scheduled condition. Archive action uses scheme `AdhanConnectStaging`
  and container `ios/AdhanConnectStaging.xcworkspace`.
- Workflow environment variable values, signing configuration and tester-group
  distribution were not verified by these metadata responses. Do not mark them
  checked. Nothing was changed in App Store Connect.

The per-app build relationships were enumerated without a next page and sorted
locally. A sorted relationship request returned 400 and a global filtered build
request returned 403; neither failure was treated as empty history. No key
permission or scope expansion was attempted to overcome the latter response.

API references used for this inspection:

- https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests
- https://developer.apple.com/documentation/appstoreconnectapi/products
- https://developer.apple.com/documentation/appstoreconnectapi/workflows

## GitHub and remaining work

Remote refs were fetched before committing. At inspection PR #9 was still draft
against `main` at `ab3ff12`; no external branch changes were found. Registered
GitHub workflows were CI and Android Staging Build. The production Android
workflow is not yet registered on the default branch; do not claim it can already
be dispatched or merge merely to get a build without checking the release gate.

Task A source preparation is complete with this review's commit. Xcode staging
start conditions and GitHub workflow registration have now been inspected.
Production Xcode Cloud setup, matching cloud environment values, native build
IDs/signing verification and physical acceptance remain open.

Next work: prepare Task B's exact cutover packet with explicit outstanding gates,
including production Xcode Cloud setup and the safe merge/manual-build sequence.
Use the primary handover; do not run a production build against old environment
values or falsely fill unknown build IDs. Tasks C and D have not started.
