# Google Play availability: update to production-promotion plan

23 September 2026. The owner reports that Google has approved their developer
account/application. The precise approval type and available tracks have not yet
been inspected. This supersedes historical statements that developer-account
approval is still pending. It does not authorise a Play upload or public release.

## Revised Android path

Continue building the reviewed production AAB and signed standalone APK through
GitHub Actions. Google Play is the proposed additional distribution route; it
does not replace GitHub builds or change the retained-database promotion.

Prepare **Google Play internal testing** as the first store track for the
production package `com.maksumsdigitalagency.adhanconnect`. Keep the signed APK
available for controlled device checks and as a fallback if Console setup delays
testing. Do not make Play setup an unnecessary blocker for existing APK-based
acceptance. Never upload the `.staging` package to the production app record.

Account verification, app production access and approval of an individual release
are different milestones. Record the actual status instead of treating the owner's
account approval as proof that the application can be publicly released.

For personal developer accounts created after 13 November 2023, Google currently
requires a closed test with at least 12 testers continuously opted in for 14 days
before applying for production access. Internal testing is available separately;
it does not satisfy that closed-test requirement. Apply this only if it pertains
to the verified account and app status. See [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB).

## Minimum information requested from the owner now

1. Account type: organisation or personal. If personal, confirm creation date if
   it matters to the production-access requirement.
2. Exact non-sensitive wording of Google's approval and any remaining Console
   Dashboard verification/setup tasks. Do not request identity documents.
3. Whether an Adhan Connect app record already exists; if yes, its Console URL
   and package name, and whether any AAB/APK has previously been uploaded. The
   URL identifies the account/app to inspect without needing login credentials.

Before the first internal release, additionally identify:

- Intended trusted tester Google accounts, or an existing tester Google Group/
  Console list, and who should receive the opt-in link. Keep private email lists
  outside public documents/Git. Select recipients before distribution.
- Existing Play App Signing setup, upload certificate and app-signing certificate
  SHA-256 fingerprints, and highest uploaded version code, if an app/upload already
  exists. Obtain these through authorised inspection where possible; ask the owner
  for the App integrity status/public certificate fingerprints only if needed.
- Any actual internal-track submission blockers shown by Console. Gather relevant
  app-access instructions, privacy-policy URL and declarations only as required
  for the chosen track; review broader listing/data-safety/account-deletion and
  policy readiness before later wider distribution. Do not guess answers to
  declarations from the app's marketing description.

Do not request the owner's Google password, two-factor code, recovery codes,
keystore passwords or service-account private key in chat. No publishing API
credential is required merely to plan the release or for an owner-operated first
Console upload. Do not invent an assistant email address for a Console invitation.

## Signing and artifact checks before any upload

1. Verify that the Console app is the intended production package and account.
   If absent, prepare its creation details for the approved setup step; do not
   silently choose another package or create a duplicate app.
2. Inspect Play App Signing state. For an established app, compare the existing
   GitHub signing certificate against its registered upload certificate before
   using the AAB. Existing secret names do not prove a signing match. For first
   enrolment, present the app-signing/upload-key choice explicitly; do not replace
   an existing key or initiate a signing-key reset as a routine fix.
3. Inspect uploaded version-code history and set a valid unused increasing code
   in the actual GitHub/native build inputs. The EAS Build profile's
   `autoIncrement` setting does not prove that a GitHub Gradle build increments it.
4. Produce artifacts from the approved pinned commit and record workflow run,
   resolved database/API/variant, package, version name/code, AAB/APK checksums,
   upload signer and eventual Play signing certificate.
5. Verify device-update behavior explicitly. With Play App Signing, Play's
   distributed app may use a different certificate from the locally signed APK.
   Do not promise an in-place APK-to-Play update unless certificates are compatible.
   If reinstalling is needed, obtain tester agreement first: uninstalling can
   remove local data/session state. Keep the demo app available.

Google describes the distinction between the upload key and app signing key in
[Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en).

## Incorporate into the manifest and approval sequence

Claude should revise `docs/backend/production-cutover-manifest.md` alongside the
existing Codex review; preserve its DRAFT status until its gaps are resolved.

Add account/app status, selected internal track, signing verification, version
code, tester group, upload method and any Console blockers to the Android section.
Distinguish proposed setup from completed uploads and tester rollout. Leave
unknown values explicitly unresolved. The internal-track upload/distribution must
be stated in the bounded preparation approval if included; it is not authorised
by this account-status update alone. Public Play production rollout remains a
later separately reviewed action, beyond the present beta promotion.

Do not automatically invite testers or roll out a build while its retained
database target and root production API still disagree. Publishing a test build
may expose it to testers and platform testing; confirm the actual upload/review/
test behavior before assuming an uploaded draft is inert. Default to making the
internal build available only once the matched API is ready in the coordinated
window. Existing offline artifact checks may precede that point.

Record the internal release's version code, track/status, opt-in URL and audience
in the manifest after the approved action. Add a Play-installed physical-device
check for sign-in, live audio/background behavior, push receipt/tap and other
existing acceptance requirements. An APK test alone does not verify the Play
delivery/signing path. Keep iOS Xcode Cloud and database cutover order unchanged.

Start with the simplest available authorised upload route. Do not add automated
publishing to GitHub merely because the account is now approved. If automated
upload is later selected, inspect existing Google Cloud/API access first, use
app-scoped minimum testing permissions and secure credential storage; do not
grant account-wide admin/financial permissions for beta uploads. Google documents
[API access setup](https://developers.google.com/android-publisher/getting_started).

No merge, build, upload, track rollout, signing change or cloud mutation occurred
as part of writing this update.
