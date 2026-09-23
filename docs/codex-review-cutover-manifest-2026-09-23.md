# Review of Claude's draft cutover manifest

23 September 2026. Reviewed the actual uncommitted
`docs/backend/production-cutover-manifest.md` against the committed handovers,
production validator, installed EAS CLI help and primary platform documentation.
This review did not re-query live credentials or change any service. Claude's
manifest remains unmodified. No approval for merge/build/cutover is implied.

**Disposition: useful draft, but revise before requesting release-preparation
approval.** Task A remains complete. Continue the independent read-only checks
and document corrections below; owner approval is not blocking that work.

## Corrections required before the release-preparation request

1. **Finish the per-consumer change list.** Section 3 omits EAS production
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` from its explicit change set. Update both
   client URL/key and server URL/key as matched pairs. Also give a concrete
   retain/change/unset decision for export `APP_VARIANT`, `LIVEKIT_URL`, start/end
   modes and old allowlists, social flags, redirects and mosque-request email
   integration. Verify against current preview; do not leave these decisions to
   be invented during the approved operation. Preserve existing working behavior.

2. **A passing build does not prove key/project matching.** Section 3 says GitHub
   values can be confirmed by a passing `validate-production-build.js`. That
   validator only checks the key is nonempty; it cannot establish that an opaque
   key belongs to the URL. A secret's name/date proves neither value nor validity.
   Specify the authoritative credential source and a non-mutating authenticated
   verification with safe output. During approved reconciliation, set unreadable
   GitHub values from that verified source if their provenance cannot otherwise
   be established. Do not retrieve or expose them through Actions logs.

3. **An unaliased candidate is reachable, not inert.** Remove section 8's claim
   that no reverse action is needed because the deployment is unaliased. Each
   Hosting deployment has its own URL. With retained-project server credentials,
   its authenticated endpoints can affect demo data. Specify allowed smoke tests,
   shared-data restrictions, candidate identification and cleanup if abandoned;
   keep root/preview aliases unchanged during preparation. See [Expo deployment
   behavior](https://docs.expo.dev/eas/hosting/deployments-and-aliases/).

4. **Inventory scope and environment membership before changing EAS variables.**
   Installed `eas env:list --help` has project/account scope selection and defaults
   to project scope. Establish both scopes/effective precedence before declaring
   a variable entirely absent. Record each relevant variable's scope, visibility
   and environment membership. A shared account variable or variable assigned to
   preview and production must not be changed in a way that also changes preview.
   Choose production-only entries/changes consistent with actual CLI semantics.
   Avoid blanket copying or rewriting environment groups.

5. **Specify recoverable previous configuration, not just a text listing.**
   `--include-sensitive` is not a guarantee that every secret can be recovered;
   GitHub also cannot read secret values back. Record which previous values are
   available from an authorised source, which were absent, and which are
   unrecoverable. Include visibility/scope/environment membership and precise
   restoration/deletion actions. Keep snapshots private with restrictive
   permissions from creation, not only a chmod after writing. Do not overwrite an
   unrecoverable credential until a concrete acceptable recovery route exists.
   Verify Hosting-compatible visibility for server credentials: Expo distinguishes
   secret visibility from sensitive visibility and documents that secret-visibility
   variables cannot be deployed with Hosting. Never make server values public.
   See [Expo environment usage](https://docs.expo.dev/eas/environment-variables/usage/).

6. **Correct the Xcode access claim.** Codex used GET-scoped tokens; that does NOT
   prove the underlying API key is read-only. Apple documents [workflow creation
   through the API](https://developer.apple.com/documentation/appstoreconnectapi/post-v1-ciworkflows).
   This does not prove the key has the required role, or that initial product and
   repository onboarding can be done through that endpoint. Inspect supported
   capabilities/roles/onboarding prerequisites before declaring the owner must do
   all setup manually. Do not probe write permissions by creating resources, expand
   key privileges or perform setup without the applicable authorisation. If an
   owner-only action is established, describe exactly that action and its reason.

7. **Make the release-preparation procedure executable and reversible.** Section
   8's standalone hostname check only checks the shell value, not the EAS account,
   project, environment or mutation it precedes. Bind guards to the operation;
   require the exact HTTPS URL and expected before-values, plus after-state checks.
   Pin the reviewed PR head when merging and verify the actual build run SHA.
   Validate command syntax against installed CLI help. `eas deploy --id` selects
   a custom new deployment ID; it is not an unknown returned ID to substitute
   beforehand. Choose a verified unused ID or capture an automatically assigned
   one. Use no root-alias promotion flag during candidate upload. Draft the real
   release-preparation reverse procedure for environment entries, workflow/start
   conditions, builds/distribution, candidate cleanup and merge disposition.
   Stop at failed checks; no implicit fall-through to later steps.

8. **Do not defer tester selection until after distribution.** Internal tester
   selection is an input to the preparation approval if it includes distribution.
   Ask the bundled account/mosque/device/tester questions while independent work
   continues. Select a tentative window now and reconfirm it later. Keep connected
   tests and tester installation/launch controlled until the root API and embedded
   database targets agree; even app startup can perform network operations. For
   pre-cutover launch checks, explicitly use an offline/no-side-effect procedure.
   Do not claim the demo/data will remain untouched by every test merely because
   an alias has not moved.

## Manifest accuracy and later cutover readiness

- The old EAS production target was already recorded in Codex's 23 September
  review (paragraph beginning “The validator cannot prove…”), and reconciliation
  was already required. Claude's fresh observation is useful confirmation. Its
  report of missing LiveKit credentials is additional detail; verify effective
  scope before presenting complete absence as established.
- EAS environment inventory and HTTP 200 do not prove which immutable deployment
  an alias currently serves or which configuration that artifact embeds. Mark
  alias IDs/configuration as last observed until actual mappings/provenance are
  refreshed. Do not label these facts independently verified by environment lists.
- “Working tree clean” describes the state before the manifest was created. The
  manifest is currently untracked/uncommitted; record that explicitly.
- Replace “SB_SECRET_KEY variant” / “APP_VARIANT-equivalent” with the precise
  distinction: preserve `SB_SECRET_KEY`; the dispatch selection is Edge secret
  `APP_VARIANT`, separately configured from EAS/native variant.
- The primary handover gives constraints and sequence, NOT complete executable
  forward/reverse commands. Section 8's instruction to execute directly from it
  overstates readiness. Write the actual guarded Auth/notification/automation and
  reverse operations from fresh deployed definitions before requesting CUTOVER
  approval. These may remain explicit later-phase blockers during preparation.
- Full fresh database/queue snapshots are not prerequisites for every read-only
  or source operation. Separate release-preparation prerequisites from the fresh
  snapshot and live-state checks required immediately before shared-service
  cutover. Do not say merge blocks all useful remaining preparation.
- Old migration-copy/rehearsal scripts are historical reference, not automatically
  applicable or approved for Task D. Future staging still requires a separately
  reviewed concrete reset/reuse procedure.

## Next instruction to Claude

Revise the draft manifest using this review. Finish available read-only checks,
the complete environment diff/recovery plan and the exact release-preparation
forward/reverse procedure. Record unavailable access as a specific tested blocker,
not an assumed owner task. Ask the small set of missing tester/device choices
while continuing independent work. Commit/push the reviewed documentation when
ready, preserving unrelated files. Then present ONE bounded release-preparation
approval request with exact scope and verified prerequisites. Do not merge, change
cloud values, start builds or deploy merely because this review exists.
