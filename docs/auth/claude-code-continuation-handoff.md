# Claude Code continuation handoff — authentication and account control

Last updated: 2026-07-24.

This is a live continuity note for Claude Code in case the current Codex
session ends unexpectedly. Do not treat it as release approval. The working
tree is intentionally uncommitted, no Supabase migration has been applied, no
website page has been deployed, and no provider or deletion feature flag has
been enabled.

**Update, same day:** Claude Code picked this up after Codex hit its usage
limit and completed the build/export verification and an independent security
review (see "Claude Code continuation — 2026-07-24" below). Build is clean,
exports are clean, no secrets leaked into any client bundle, and the
independent security pass found zero high-confidence issues. The working tree
is still uncommitted; nothing was migrated, deployed, or flag-enabled by this
pass either.

## Product goal and Codex verdict

The goal is a low-friction sign-in experience comparable with established
consumer apps while preserving listener, muezzin, local-admin and main-admin
capabilities and adding credible account/privacy controls.

Claude's original scope is retained in
`docs/auth/sign-in-simplification-gdpr-scope.md`. Codex implemented the useful
parts but deliberately changed four unsafe assumptions:

1. There is no unauthenticated email-existence lookup; sign-in and create
   actions remain explicit and errors are neutral.
2. Email verification remains required before authenticated account features
   open because the current Supabase project does not auto-confirm email.
   Pending users can browse in guest mode, resend verification, or correct the
   email.
3. Social identities are linked manually to the existing UUID. Matching email
   addresses never merge roles automatically.
4. Hard deletion remains fail-closed until the production schema, Storage,
   revocation and cross-system orchestration are audited.

## Implemented locally

- Chunked `expo-secure-store` Supabase session persistence on native, locked
  browser storage on web, PKCE callback/recovery handling, and fail-closed
  local sign-out cleanup.
- Simplified email sign-in/create screens, neutral enumeration-resistant
  errors, verification resend/correction and guest browsing of public routes.
- Feature-flagged Apple and Google sign-in/linking with UUID-preservation
  checks. Both flags remain off by default; Google on iOS also requires Apple.
- One-time versioned account consent, a durable receipt/withdrawal migration,
  consent-gated server APIs and fail-closed root navigation. Account export,
  deletion review and sign-out remain available without granting personalised
  feature consent.
- Listener/Admin/Muezzin workspace selection for multi-role accounts,
  authoritative role resolution, protected route groups and collision-free
  canonical public routes.
- Paginated/redacted JSON export with recent-authentication enforcement and
  conspicuous omissions.
- Impact-aware deletion scaffolding protected by server flags and an empty
  database approval gate. Actual deletion is intentionally unavailable.
- Ten-minute, proxy-only signed live-playback grants and ten-minute LiveKit
  tokens. Playback URLs bind mosque, stream, expiry, delivery and an opaque
  account-derived subject without exposing the Auth UUID or upstream URL.
  External HTTP(S) playback/probes fail closed behind
  `LIVE_STREAM_UPSTREAM_ALLOWED_HOSTS`; every redirect is revalidated and
  private/local literals are blocked. Continuous Icecast/AAC/MP3/OGG is
  supported, while HLS listener playback is deliberately rejected until a
  segment-aware signed proxy exists. RTMP/RTMPS may still be used for ingest.
- Draft Privacy, Terms and account-deletion pages in `maksums-website`, plus
  the data map, release gates, test matrix and SQL production audit.

## Safety-critical state

- Do not deploy the new client/server routes before applying and verifying
  `supabase/migrations/20260724090000_account_control_foundation.sql`.
- Do not set any social-login flag until Supabase, Apple/Google console,
  redirects, branding and real-device tests pass.
- Do not enable account deletion. Keep
  `ACCOUNT_DELETION_ENABLED`,
  `ACCOUNT_DELETION_SCHEMA_AUDITED`,
  `ACCOUNT_DELETION_STORAGE_AUDITED`,
  `ACCOUNT_DELETION_ORCHESTRATION_AUDITED` and Apple revocation readiness
  false until every release gate is evidenced.
- Production RLS still needs a separate migration based on the real policy
  audit. Client routing and hosted API checks do not protect direct PostgREST
  access.
- Playback/JWT expiry blocks new connections after ten minutes but does not
  guarantee that an already-open HTTP or LiveKit connection is immediately
  disconnected.
- External playback additionally requires a production upstream-host allowlist
  and a deployed-host canary proving long-lived streaming, cancellation,
  concurrency, bandwidth and request-duration behavior. HLS playback must stay
  gated.

## Current validation state

At the point Codex hit its usage limit on 2026-07-24:

- `npx tsc --noEmit --pretty false` passed after the final upstream-stream
  hardening.
- `npm run lint` passed after the final upstream-stream hardening.
- `git diff --check` passed after the final upstream-stream hardening.
- A network-backed `npx expo install --check` passed against the current Expo
  package metadata.
- The Expo Router parser resolves canonical listener/public paths exclusively
  to `(user)` routes. The only remaining `/` index aliases are handled by the
  root role target and protected guards. This was rechecked after upgrading
  Expo Router from 6.0.23 to 6.0.24.
- Static legal HTML passed HTML5 parsing, local-link/asset checks,
  `target="_blank"` rel checks and CSS brace validation.
- The direct upstream-policy matrices passed exact/suffix allowlisting,
  malformed configuration, private/local/reserved literals, IPv4-mapped IPv6,
  redirect revalidation, encoded HLS paths, HLS media/body detection including
  split BOM/markers, byte-preserving continuous-audio replay and partial
  response rejection.
- `npm audit --omit=dev --audit-level=moderate` reports 17 moderate paths, all
  through the Expo SDK 54 build-time chain `expo -> xcode@3.0.1 -> uuid@7.0.3`.
  npm proposes `--force` with a breaking downgrade to Expo 46. Do not apply
  that forced change; track an upstream Expo/xcode fix or a tested SDK upgrade.

### Exact stopping point

The first clean server-output web export exposed one reproducibility issue:

```text
Cannot find module 'babel-preset-expo'
```

`babel.config.js` directly names `babel-preset-expo`, but `package.json` does
not declare it. It currently exists only below Expo in `node_modules`, which
Babel cannot reliably resolve from the root config. Codex attempted the
SDK-aware install below, but the Codex usage limit rejected the tool action
before any package or lockfile change:

```bash
npx expo install babel-preset-expo --dev
```

Claude Code should run that command first, verify it adds the Expo 54-compatible
preset (currently expected around `~54.0.12`), and then rerun TypeScript, lint,
the dependency check and all three clean exports. Do not hand-edit
`package-lock.json` and do not use `npm audit fix --force`.

Temporary directories created for the interrupted export attempt may remain:

```text
/private/tmp/adhan-web.DewThG
/private/tmp/adhan-ios.3g8qSt
/private/tmp/adhan-android.CUOQP2
```

They are disposable build output only. The web directory contains at most the
failed partial export; iOS and Android exports were not started. No production
artifact was changed.

The required in-app Browser control skill was read, but its required
`node_repl`/browser-control tool was not available in this Codex session.
Therefore no visual browser smoke test was performed; do this manually or with
Claude Code's supported browser tooling.

## Source-of-truth map

Authentication, consent and navigation:

- `lib/supabase.ts`
- `lib/supabaseAuthStorage.ts` and `lib/supabaseAuthStorage.web.ts`
- `lib/auth.tsx`, `lib/authCallback.ts`, `lib/authSessionCleanup.ts`
- `lib/authFlowState.ts` (process-local email handoff; email is not placed in
  route URLs)
- `lib/socialAuth.ts`
- `lib/accountConsent.ts`, `lib/policies.ts`
- `lib/roles.ts`, `lib/roleRouting.ts`, `lib/roleEntryPreferences.ts`
- `lib/navigation/RootLayout.tsx`
- `app/(auth)/*`, `app/complete-account.tsx`, `app/auth-complete.tsx`
- `app/role-entry.tsx`

Account control:

- `screens/user/settings/account.tsx`
- `app/account.tsx`, `app/admin/account.tsx`,
  `app/(admin)/admin-account.tsx`
- `app/api/account/*`
- `lib/api/account.ts`
- `lib/server/accountAccess.ts`, `accountConsentAccess.ts`,
  `accountDeletion.ts`, `accountExport.ts`, `accountRateLimit.ts`
- `supabase/migrations/20260724090000_account_control_foundation.sql`
- `scripts/account-data-audit.sql`

Live access hardening:

- `app/api/live-stream-access+api.ts`
- `app/api/live-stream-playback+api.ts`
- `app/api/listener/livekit-token+api.ts`
- `app/api/muezzin/livekit-token+api.ts`
- `lib/api/liveStreamAccess.ts`
- `lib/server/liveStreamListenerAccess.ts`
- `lib/server/liveStreamUpstreamPolicy.ts`
- `lib/server/liveStreamHealth.ts`
- `lib/server/livekitRoom.ts`
- `lib/liveStreamProviders.ts`

Review/release documentation:

- `docs/auth/sign-in-simplification-gdpr-scope.md`
- `docs/auth/account-auth-release-gates.md`
- `docs/auth/account-auth-test-matrix.md`
- `docs/legal/account-data-map.md`
- `CLAUDE.md`
- Website drafts in sibling directory
  `/Users/mzk/PROJECTS/maksums-website/adhan-connect/`.

## Important implementation decisions and audit fixes

- `RootLayout` does not mount protected route groups until the current session,
  authoritative roles and token-bound workspace preference are resolved.
  Role-lookup errors fail closed with retry/account/sign-out actions.
- Account/data routes remain available without current personalised-feature
  consent so a user can export, review deletion, manage sign-in or sign out.
  Completing consent exits the completion route instead of looping.
- OAuth callback/password-recovery routes can mount before role bootstrap.
  This preserves the original session while a pending Google/Apple link is
  exchanged and UUID-preservation is checked.
- Auth email transfer between sign-in/create/reset screens is process-local;
  email addresses no longer appear in navigation query strings.
- Detailed admin URL/user/email/fingerprint diagnostics and user-action UUID
  logs are development-only.
- Precise listener location is sent in authenticated POST bodies. The old GET
  endpoint remains only as a compatibility path and needs a retirement date.
- Canonical public `/event`, `/campaign`, `/mosque`, `/jumuah`, `/discover`,
  `/now`, `/settings/account` and `/manage-mosques` routes resolve only through
  `(user)`. Admin editors and muezzin aliases were renamed so they do not
  collide. Only the three `/` group indexes remain, handled before protected
  Stack mount.
- Export requires recent interactive authentication, paginates/redacts known
  database data and conspicuously states that Supabase Storage objects are not
  yet included. Manual privacy handling remains required for omitted systems.
- Playback is proxy-only. Do not reintroduce a redirect response: it exposes
  the upstream URL and bypasses the intended access boundary.

## Claude Code continuation — 2026-07-24 (picked up after Codex's usage limit)

Steps 1-6 below (Codex's original "Next actions") were run to completion.
Nothing was committed, migrated, deployed, or had a feature flag flipped —
still waiting on explicit product-owner authorisation for that, per step 7.

1. Ran `npx expo install babel-preset-expo --dev`. Installed at `~54.0.10`
   (Expo 54-compatible). Fixed the `Cannot find module 'babel-preset-expo'`
   export failure.
2. Reran the full verification set: `npx tsc --noEmit --pretty false` (clean),
   `npm run lint` (clean), `git diff --check` (clean), `npx expo install
   --check` (up to date), `npm audit --omit=dev --audit-level=moderate` (17
   moderate findings, exact same inherited Expo/xcode/uuid chain documented
   below — no `--force` used).
3. Ran clean server-output web, iOS, and Android exports into fresh `mktemp -d`
   directories. All three exports completed successfully (the babel fix was
   sufficient). Scanned every output tree for the literal values of
   `SUPABASE_SERVICE_ROLE`, `SUPABASE_ACCESS_TOKEN`, `LIVEKIT_API_KEY`, and
   `LIVEKIT_API_SECRET` without printing them — zero matches in any of the
   three bundles. `SUPABASE_URL` appears once in the web bundle, but its value
   is identical to the already-public `EXPO_PUBLIC_SUPABASE_URL`, so this is
   not a leak. Temp export directories were deleted after the scan.
4. Ran an independent read-only security review of every modified/new file in
   this changeset, split across two parallel reviewer passes (auth/session/
   consent/roles/navigation, and account-export-deletion/admin-APIs/live-stream
   access) using the standard security-review methodology (input validation,
   authn/authz, crypto/secrets, injection, data exposure; IDOR, SSRF, and
   privilege-escalation given special attention given the domain). **Zero
   findings at or above the 8/10 confidence bar.** Both reviewers explicitly
   verified, by reading the code (not just trusting the docs' claims):
   server-side role derivation only (no client-supplied role/claim ever
   trusted for authz), fail-closed `RootLayout` gating, enumeration-resistant
   auth errors, manual (non-email-matching) identity linking, a real
   server-side consent receipt requirement (not just client metadata), no
   client-suppliable user-id parameter anywhere in the account export/delete/
   deletion-impact/consent-withdraw APIs, the empty-by-design deletion-approval
   table with no other deletion code path, hardcoded proxy-only playback
   delivery bound into the signed token, and redirect-hop re-validation in the
   live-stream upstream allowlist policy (not just the initial URL).
5. Manually smoke-tested what's feasible without real devices, App
   Store/Google accounts, or production release-gate approval, by launching
   `npm run web:portal` and driving it with a real (Playwright-controlled)
   Chromium browser against the actual dev Supabase project:
   - **Guest browsing (G1):** Passed. Tapping "Browse as guest" from the
     sign-in screen lands on `/listener-home`; a subsequent deep-link to
     `/discover` stays on `/discover` (does not bounce to sign-in) and renders
     the mosque list with "Sign in to follow" CTAs, as designed. Cold-opening
     `/discover` directly, with no prior guest opt-in, does correctly redirect
     to the sign-in screen (which itself offers "Browse as guest") — this
     looks like an intentional gate on the guest session flag, not a bug, but
     is worth a product confirmation.
   - **Sign-in with wrong password (E3):** Passed. Real Supabase
     `POST /auth/v1/token?grant_type=password` returned 400, and the UI shows
     a neutral "We could not sign you in with those details. Check them or
     reset your password." — does not confirm or deny account existence.
   - **Sign-in with a never-used email (E2/E3 enumeration check):** Passed.
     Produces the exact same explicit "Sign in / Create account / Use a
     different email" choice screen as a known, existing email. No
     distinguishing signal between the two cases was observed.
   - **Sign-up (E1):** Inconclusive, not a code defect. The real Supabase
     project's outbound-email rate limit (`over_email_send_rate_limit`)
     tripped after a couple of automated attempts in quick succession, since
     sign-up triggers a confirmation-email send. Confirmed via
     `supabase.auth.admin.listUsers()` that **no test auth users were actually
     created** by any of the attempts (all failed pre-creation), so nothing
     needed cleaning up. Re-testing sign-up end-to-end needs either real
     pacing (well under whatever the project's hourly send cap is) or a
     temporary SMTP/rate-limit override in a non-shared environment.
   - **Consent checkbox:** Visually confirmed present, checkable, and
     contextually worded on the sign-up form itself (in addition to the
     post-auth one-time consent step for legacy/social/invited accounts).
   - **New non-security finding:** `screens/user/discover.tsx` — this
     changeset wraps the pre-existing per-mosque "Sign in to follow" /
     "Follow" `Pressable` (around line 388) inside a newly added outer
     card-level `Pressable` (added ~line 361, for the new tap-to-open-mosque
     behaviour). On web this renders as a `<button>` nested inside another
     `<button>`, which is invalid HTML and produces a React DOM hydration
     warning. `onFollowPress` does call `event.stopPropagation()`
     (`discover.tsx:279`), so the outer "open mosque" handler is not
     double-triggered in practice — this is a semantic-HTML/accessibility
     cleanup item (e.g. give the inner control a non-nested layout, or drop
     `accessibilityRole="button"`/native button semantics from the outer
     wrapper), not a functional break or a release blocker.
   - Two `404`s observed on the guest Discover page are pre-existing,
     documented behaviour (`POST .../rpc/search_mosques` — the RPC isn't
     deployed in this dev project; `screens/user/discover.tsx` already falls
     back to a plain `mosques` query per `CLAUDE.md`), not a regression from
     this diff.
   - Not exercised in this pass (needs real devices / disposable production
     accounts / gates still off by design): Apple/Google sign-in (S1-S3),
     password recovery cross-device (E6/E7), consent withdrawal (C4-C6), every
     staff-role workspace combination (W2/W3), account export/deletion (A1-A5),
     and the LiveKit/external-playback canaries (G4-G6). These remain exactly
     as described in `docs/auth/account-auth-test-matrix.md`.

## Next actions (remaining)

1. Optional, low-risk cleanup: fix the nested-`Pressable` pattern in
   `screens/user/discover.tsx` (see above) — cosmetic/accessibility, not
   blocking.
2. Re-verify sign-up end-to-end once clear of the project's email rate limit.
3. Complete the remainder of `docs/auth/account-auth-test-matrix.md` that
   requires real devices, disposable production-like accounts, or flipping a
   release gate — none of that was done here.
4. Everything under "Production work that remains deliberately blocked" below
   is still exactly as blocked as Codex left it. In particular: no Supabase
   migration was applied, no legal review has happened, no social provider is
   configured, and hard deletion is still fail-closed.
5. Stop before migration, commit, push or deployment unless the product owner
   explicitly authorises those actions.

## Production work that remains deliberately blocked

- Apply and verify
  `supabase/migrations/20260724090000_account_control_foundation.sql` in a
  controlled Supabase environment. Neither Supabase CLI, Docker nor `psql` was
  available in this Codex environment, so SQL received static review only.
- Run `scripts/account-data-audit.sql` against the real production schema and
  reconcile every table, foreign key, Storage bucket/object, Auth identity,
  webhook/integration and receipt mismatch.
- Author and prove a production RLS migration from the real policy audit.
  Hosted APIs and client route guards do not secure direct PostgREST access.
- Configure `LIVE_STREAM_UPSTREAM_ALLOWED_HOSTS` with exact or `*.suffix`
  provider hosts, then run the deployed-host duration/concurrency/cancellation,
  bandwidth, HEAD and request-limit canaries. Keep HLS listener playback off.
- Complete Supabase plus Apple/Google console setup, exact redirect/branding
  review, real-device tests, link/unlink tests and provider revocation. Keep
  every social flag off until then.
- Obtain legal review, replace draft contact/retention assumptions where
  needed, and publish the Privacy, Terms and deletion pages. The sibling
  website has no connected deployment configuration and was not deployed.
- Keep all hard-deletion flags false and the database approval table empty
  until Storage, Apple revocation, Auth/Postgres ordering, idempotent retries,
  audit records and postcondition checks are production-evidenced.

The paid Supabase plan is useful for scheduled cleanup, backups and operational
capacity, but it does not remove any migration, RLS, legal, provider or
deletion-orchestration gate.
