# Codex review of production cutover manifest revision 2

Reviewed 23 September 2026. This review covers Claude's uncommitted revision 2
of `docs/backend/production-cutover-manifest.md` and the changed checkpoint banner
in `docs/claude-remaining-production-actions-2026-09-23.md`. No service, workflow,
alias, secret, build, app record or database state was changed.

**Disposition: materially improved, but not ready for the bounded
release-preparation approval yet.** Preserve revision 2 and correct the remaining
items below. Do not merge or begin configuration/builds from the current draft.

## Confirmed improvements

- The production change list now includes matching client and server URL/key
  pairs and concrete retain/change/remove decisions.
- `LIVEKIT_URL` and `EXPO_FORCE_WEBCONTAINER_ENV` are correctly identified as
  records assigned to development, preview and production. Do not edit them as
  part of a production-only reconciliation.
- Sensitive preview server credentials use `SENSITIVE`, not `SECRET`, visibility.
  Expo documents that client values used for Hosting export must be plaintext or
  sensitive and that secret-visibility values are unavailable to Hosting. New
  production Hosting credentials should retain server confidentiality while
  using Hosting-compatible visibility.
- Installed CLI help confirms `eas env:set` is the current create/update command
  and `eas deploy:delete [DEPLOYMENT_ID]` is available for candidate cleanup.
- Candidate deployments are now correctly treated as reachable shared-data
  endpoints even without aliases.
- Google Play organisation/no-app/no-upload state and internal-test planning are
  integrated without treating account verification as app-release approval.

Codex additionally queried the EAS **account** scope for the production
environment, read-only, without sensitive values. It contains no account-wide
production variables. Combined with Claude's project-scope inventory, no current
account-level precedence conflict was found. Record this dated evidence and
recheck both scopes immediately before mutation; absence now is not a permanent
invariant.

## Corrections still required

### 1. Correct the Xcode Cloud conclusion

`Admin` is a broad App Store Connect API-key role, but it is not Apple's “highest
role.” `Account Holder` is a separate role with exclusive agreement, renewal and
some certificate responsibilities. Say only that the key is assigned `Admin` and
has broad API permissions; do not infer endpoint success without performing the
authorised operation. See [Apple roles](https://developer.apple.com/help/account/access/roles).

The production app's missing `ciProduct` means that app has not been onboarded as
an Xcode Cloud product. It does **not** mean the GitHub provider/repository is
unconnected. Codex performed a fresh GET-only App Store Connect inspection:

- one connected provider, type `GITHUB_CLOUD`;
- repository `digimaxai/adhan-connect` is already visible to Xcode Cloud;
- repository ID `b14af416-8f9c-469f-ac5f-1e13247baa46`;
- last accessed 18 September 2026;
- no additional provider/repository page was present.

This is consistent with the existing staging Xcode Cloud product using the same
repository. Apple documents web/provider authorisation during initial source
onboarding, but that authorisation already exists for this repository. Apple
documents API creation of workflows but exposes `ciProducts` as products detected
when Xcode Cloud is first used; no public create-product endpoint was found.
Therefore the remaining uncertainty is **production product onboarding**, likely
through Xcode's “Create Workflow” flow, not GitHub authorisation. Prepare the exact
Xcode/app/project selection steps for the approved checkpoint. Do not attempt to
POST a workflow before a production `ciProduct` exists and do not ask the owner to
reauthorise GitHub unless the onboarding UI actually reports missing access.

Primary source: [Apple's Xcode Cloud onboarding walkthrough](https://developer.apple.com/videos/play/wwdc2021/10267/).

### 2. Replace the Supabase credential probes

The proposed client-key probe is incorrect for the current `sb_publishable_*`
format. Supabase explicitly says to send publishable and secret keys in `apikey`,
not as `Authorization: Bearer`; the new keys are not JWTs. Also, the PostgREST
OpenAPI root can reject public keys even when they belong to the project, so a
non-401 root response is not a reliable publishable-key test.

Use two no-data-output checks during the approved reconciliation:

- Publishable client key: `GET /auth/v1/health` on the retained project with only
  the `apikey` header; require HTTP 200 and discard the body. Supabase documents
  that endpoint for a publishable key.
- Server key: `GET /rest/v1/` with only the server key in `apikey`; require HTTP
  200 and discard the OpenAPI response. This checks the elevated key without
  reading an application table or user record.

Never print headers, response bodies or keys. Remove the proposed RLS-table
positive/negative test: it is unnecessary, table-specific and could disclose
data. If the existing server credential is a legacy JWT rather than `sb_secret_*`,
record its type without decoding or logging claims and use the documented
compatible `apikey` request.

Sources: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Auth health check](https://supabase.com/docs/guides/troubleshooting/how-do-i-check-gotrueapi-version-of-a-supabase-project-lQAnOR).

### 3. Create sensitive recovery files securely from the first byte

Revision 2 redirects sensitive EAS output to a file and only then runs
`chmod 600`. That does not satisfy the prior review: the file can initially be
created using a permissive process umask. The approved procedure must:

1. resolve a concrete new dated directory under the private recovery root;
2. create it with mode `0700` before any secret retrieval;
3. set `umask 077` in the same shell before redirection;
4. write the inventory directly into that directory;
5. verify directory/file modes and exclude the path from Git/log output;
6. state which sensitive values the command can and cannot recover.

Replace `<FRESH-DATED-DIR>` before approval; no executable command in the final
packet may retain a placeholder. Do not put raw secret values in command text,
shell history, process arguments, chat or workflow logs. Verify a secure
interactive or injected-value mechanism for each `eas env:set` secret operation.

### 4. Simplify GitHub secret reconciliation

Do not build a workflow merely to test unreadable existing GitHub values. Their
names and timestamps prove neither their values nor provenance. During the
approved reconciliation, verify the authoritative retained-project values first,
then set the production GitHub secrets from that same verified source. Record the
mutation time and validate the resulting build without logging keys. This removes
the circular “verify by consequence” language while retaining the fail-closed
build guard.

There is no rollback value for unreadable GitHub secrets unless an independent
authoritative record exists. State this explicitly. The recovery action after a
failed reconciliation is to replace them with a newly verified intended value or
disable the production build path, not pretend the old bytes can be restored.

### 5. Finish exact EAS mutation and reversal commands

The draft still says the four `LIVE_BROADCAST_*` deletion commands will be
help-verified later. Installed help already gives the form:
`eas env:delete production --variable-name NAME --scope project --non-interactive`.
Before approval, list every variable and its exact scope/visibility/action, bind
each to the expected current state, and write the corresponding reverse action.
Confirm the working preview behavior and code default before deleting the four
old allowlist variables. Stop if current values or record membership drift.

Similarly, write the Hosting candidate output outside the repository or add an
explicit cleanup step; do not leave `deploy-result.json` as an untracked release
artifact. Verify whether the chosen `eas deploy` invocation consumes the already
exported `dist` directory as intended, and use the exact installed-CLI syntax.

### 6. Record the first Android version code now

No Play upload exists, so there is no historical Console version-code conflict.
The current committed production config is `versionCode: 2`; GitHub's Expo
prebuild will use that value. EAS `autoIncrement` does not increment GitHub
builds. Add version code 2 to the first artifact plan, verify it from the built
APK/AAB, and define how later GitHub builds will increment it before producing a
second Play artifact. Do not postpone this until an upload rejection.

### 7. Repair internal status contradictions

- Remove the duplicate `## 6. Fresh read-only service state` heading.
- The worktree is not clean after revision 2: the manifest and checklist are
  modified. Record the actual current state rather than the moment before edits.
- Update the checklist banner: the Apple key role is no longer unknown.
- Update section 6's table, which still labels the key role unknown.
- Remove “item 7” from the pending owner-question list because it is resolved.
- Replace “Admin is Apple's highest role” everywhere.
- Keep revision 2 uncommitted until these corrections are incorporated and the
  final diff passes link/whitespace checks.

## Next step

Claude should revise the existing manifest/checklist in place, run documentation
link and whitespace checks, and report the exact remaining owner decisions. It
may commit and push the corrected documentation to the release branch after this
review; that does not authorise merge, cloud configuration, builds, app creation,
upload, distribution or cutover. The preparation approval request should follow
only after the corrected manifest contains no placeholders or unresolved command
syntax for the actions it asks to execute.
