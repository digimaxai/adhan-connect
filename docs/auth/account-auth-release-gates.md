# Authentication and account-control release gates

Last updated: 2026-07-24.

This checklist separates completed code from external production configuration
and evidence that cannot safely be guessed.

## Live state verified read-only on 2026-07-24

- Email/password sign-up is enabled.
- Email auto-confirm is disabled, so a new email sign-up does not normally
  receive an authenticated session before verification.
- Apple authentication is not enabled in Supabase Auth.
- Google authentication is not enabled in Supabase Auth.
- The REST schema exposes `users`, `profiles`, `subscriptions`,
  `mosque_admins`, `muezzins`, `staff_rota`, `muezzin_cover_requests`,
  `app_notifications`, `jumuah_attendance_intents`, `adhan_broadcasts`,
  `streams`, schedule-import, onboarding and attributed content tables.

No Supabase Management API token or database password was available in the
workspace, so foreign-key delete actions, triggers, project region, backup
configuration, and migration history could not be inspected through
`pg_catalog`.

## Implemented locally, not deployed

- Email-first sign-in/create choice, neutral errors, pending-verification
  resend/correction, and read-only guest browsing.
- Device-only chunked SecureStore on native, browser storage locking on web,
  PKCE callbacks, and recovery links that require one-time recovery evidence.
- Neutral multi-role handoff and Account & data routes for listener, muezzin,
  local-admin and main-admin workspaces.
- One-time current-policy completion for new, legacy and invited accounts,
  durable receipt/withdrawal migration, client and server API consent gates,
  and self-service withdrawal to guest mode.
- Listener playback URLs use ten-minute signed grants that bind the mosque,
  stream, delivery mode, expiry, and a per-grant opaque account subject without
  exposing the raw Auth UUID. LiveKit publisher and subscriber connection
  tokens also expire after ten minutes and require a fresh server-side consent
  and access check before another token is issued.
- External playback is proxy-only and fail-closed behind
  `LIVE_STREAM_UPSTREAM_ALLOWED_HOSTS`. Every initial URL and redirect must
  match an exact or explicitly configured provider-controlled DNS suffix;
  private, loopback, link-local and obvious local destinations are rejected.
  The proxy accepts continuous audio such as Icecast AAC/MP3, but rejects HLS
  paths, media types and playlist bodies until a segment-aware signed proxy is
  designed. RTMP/RTMPS remains an encoder ingest option, not listener playback.
- Paginated/redacted self-service JSON export and fail-closed deletion impact
  scaffolding.
- Local Privacy, Terms and external deletion-request pages. They are drafts,
  are not deployed by this work, and must not be treated as published.

## Safe rollout order

The server routes deliberately fail closed when the consent tables/functions
are absent. Do not deploy this application build before the database foundation
is ready.

1. Freeze the reviewed policy wording and version identifiers. Keep the legal
   pages as drafts until qualified legal review is complete.
2. Run `scripts/account-data-audit.sql` against staging and production. Record
   the applied migration history, foreign-key/trigger/storage findings, the RLS
   policy report, and the aggregate metadata-versus-receipt counts.
3. Resolve every account that already has the exact `2026-07-24` metadata but
   no matching active receipt. Prefer a fresh in-app consent step. Backfill a
   receipt only where retained evidence proves the same wording and choice;
   otherwise clear/bump the current metadata version so the account is asked
   again. Never manufacture acceptance timestamps.
4. Apply `20260724090000_account_control_foundation.sql` and verify its tables,
   trigger, RPC permissions, withdrawal behaviour, and rate-limit purge job.
   The paid Supabase plan can support scheduled cleanup and stronger backup
   operations, but does not replace this verification.
5. From the audited production policy definitions, create and test a separate
   migration that adds `has_current_account_consent_v1(auth.uid())` (or an
   equivalently reviewed exact-version predicate) to every authenticated
   personalised-table `USING` and `WITH CHECK` path. Preserve intentional
   public/guest reads. API and client routing are not substitutes for RLS.
6. Re-run the audit and the consent/workspace tests, then deploy the server
   routes and client build with social-provider and hard-deletion flags still
   false.
7. Enable Apple/Google only after their configuration/device matrix passes.
   Enable hard deletion only after the separate schema, Storage, retention,
   revocation, retry, postcondition, and approval-row evidence is complete.

## Required before a release build

### Database and account controls

- Run `scripts/account-data-audit.sql` against the production project using the
  read-only SQL role.
- Review every `NO ACTION`/`RESTRICT` relation, indirect cascade, trigger,
  user-like UUID without an FK, Storage bucket, and RLS result.
- Convert approved delete/null/reassign/de-identify decisions into a canonical,
  versioned Supabase migration.
- Apply and verify the durable consent-receipt migration before deploying the
  new server routes.
- Verify the one-time consent gate, withdrawal, signed-out guest fallback and
  same-version re-consent for listener and every staff role. Confirm or replace
  explicit consent as the Article 9 condition with qualified legal advice, and
  translate the chosen state into server and direct-table RLS enforcement
  rather than relying only on client routing.
- Verify that playback URL tampering (including attempting the rejected
  redirect mode) is denied, that the upstream provider URL and raw user UUID
  never appear in browser-visible playback URLs, and that previously issued
  playback URLs and unused LiveKit connection tokens cannot establish a new
  connection more than ten minutes after issuance. Grant/JWT expiry does not
  itself terminate an already-open HTTP stream or eject an already-connected
  LiveKit participant; approve provider/participant termination on withdrawal
  if the product requires immediate interruption of an established connection.
- Configure `LIVE_STREAM_UPSTREAM_ALLOWED_HOSTS` with exact playback/HTTP
  ingest hosts wherever possible. A `*.provider.example` entry matches only
  subdomains and should be used only for a provider-controlled zone; add the
  apex separately if needed. Entries are hostnames only, without scheme, path,
  credentials, or port. Verify that missing/malformed configuration, unlisted
  hosts, local/private IP literals, and redirects to any such destination fail
  closed. The application validates every redirect manually, but production
  DNS/egress policy should also prevent allowlisted names resolving to private
  infrastructure.
- Keep external HLS listener playback disabled. Do not treat a working RTMP
  ingest as proof that its HLS output can be proxied: playlist segment and key
  URIs need their own scoped signing, host validation and expiry design. Use
  LiveKit or an allowlisted continuous Icecast/AAC/MP3 listener endpoint.
- On the deployed host, test a full-length concurrent continuous-audio canary,
  disconnect/cancellation propagation, first-byte timeout, bandwidth and
  connection limits, signed HEAD behaviour, providers that reject HEAD, and
  provider/runtime maximum request duration. GET is the readiness and playback
  path; do not make listener startup depend on optional upstream HEAD support.
  Do not release proxy playback on a serverless plan that buffers or
  terminates the expected live stream duration.
- Schedule `purge_account_control_rate_limits_v1(2592000)` and confirm the
  30-day pseudonymous security-counter period in the retention matrix.
- Configure the account deletion execution gate only after the audit and a
  disposable, fully populated user deletion test pass.
- Treat deletion as a cross-system orchestration, not a database transaction:
  approve a durable partial-failure/audit runbook, idempotent Apple revocation,
  safe retry rules, Auth/Storage/database postconditions and an operator path
  for a response lost after deletion. Keep
  `ACCOUNT_DELETION_ORCHESTRATION_AUDITED=false` until this evidence exists.
- Insert the exact `account-deletion/1.0` approval row only through a reviewed
  follow-up production-audit migration. The foundation migration intentionally
  inserts no approval.
- Verify deletion behaviour for sole main admin, sole mosque admin, default
  muezzin, upcoming/current rota, open cover, active broadcast, owned Storage
  objects, more than 1,000 exported rows, and a previously issued JWT.
- Configure durable account-endpoint rate limiting and alerting in the deployed
  environment.

### Apple

- Enable Sign in with Apple for the App ID and provisioning profile.
- Configure the native bundle identifier and, if web OAuth is offered, a
  Services ID, domains/return URLs, private key and rotating client secret.
- Enable Apple in Supabase Auth and add every exact native/web redirect.
- Do not set `EXPO_PUBLIC_APPLE_AUTH_ENABLED=true` until the above tests pass.
- Test first-authorisation name capture, private-relay email, cancellation,
  revoked permission, existing-password-account linking, multi-role UUID
  preservation, and token revocation on deletion.

### Google

- Create/configure the appropriate Google OAuth web client for Supabase’s OAuth
  callback and any native clients required by the chosen flow.
- Enable Google in Supabase Auth and add every exact redirect.
- Use PKCE with verified Universal Links/App Links where practical; document
  the same-device limitation of PKCE email recovery or implement a separately
  reviewed cross-device recovery design.
- Replace/approve the Google button treatment against current Google Identity
  branding before setting `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
- Test cancellation, cold/warm app return, existing-password-account linking,
  multi-role UUID preservation and an account whose Google email differs.
- On iOS, do not expose Google unless Sign in with Apple is also configured and
  offered with the required prominence.

### Email and redirects

- Verify production SMTP sender, templates, expiry and abuse controls.
- Allow-list the exact production web callback and `adhanconnect://` native
  callbacks in Supabase Auth.
- Configure `EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB` and
  `EXPO_PUBLIC_SUPABASE_REDIRECT_URL_NATIVE` separately. Do not rely on the
  legacy shared redirect variable in production.
- Test sign-up pending state, verification in the same/different device,
  duplicate generic responses, expired/reused links, invite/password setup and
  password recovery.

### Privacy/store configuration

- Confirm Supabase project region, DPA, subprocessors, backups and log periods.
- Complete LiveKit, EAS, Vercel, Web3Forms, Aladhan, SMTP, Apple and Google
  provider/transfer/retention review.
- Obtain legal review of the app Privacy Notice, Terms, special-category basis,
  age gate and mosque-operator/controller arrangement before deploying pages.
- Publish working privacy, terms and deletion URLs.
- Set App Store Connect Privacy Policy URL/privacy labels and Play Console
  privacy/Data Safety/deletion URL to match the verified build.
- Inspect the final IPA/AAB permissions and privacy manifests rather than
  relying only on `app.json`.

## Environment separation

Use separate redirect configuration for web and native production/dev targets.
Do not use a single environment URL that silently replaces every platform’s
callback. Never place service-role, Apple private-key, Google secret, or
management credentials in an `EXPO_PUBLIC_*` value.

Social UI is released only when its provider flag is true; identity linking
also requires `EXPO_PUBLIC_SOCIAL_LINKING_ENABLED=true`. All default to false.

Hard deletion requires all of the following server-only values plus the
database approval described above:

```text
ACCOUNT_DELETION_ENABLED=true
ACCOUNT_DELETION_SCHEMA_AUDITED=true
ACCOUNT_DELETION_STORAGE_AUDITED=true
ACCOUNT_DELETION_ORCHESTRATION_AUDITED=true
ACCOUNT_DELETION_STORAGE_BUCKETS=<audited buckets or none>
```

Apple-linked deletion additionally requires the reviewed revocation URL,
secret and `ACCOUNT_DELETION_APPLE_REVOCATION_READY=true`. Set
`ACCOUNT_TRUST_PROXY=true` only when the deployed host's forwarding headers are
known and trusted.
