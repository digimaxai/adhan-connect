# Sign-in simplification + GDPR compliance — handoff for Codex

Status: **historical input, reviewed and superseded by the implementation on
2026-07-24.** This document preserves Claude's original proposal; it is not the
current release plan. Codex intentionally rejected the unauthenticated
identifier lookup, non-blocking unverified-account access, assumed cascades,
and automatic email-based role merging. See
[`account-auth-release-gates.md`](./account-auth-release-gates.md) and the
current code for the implemented, fail-closed design.

## Original ask

The product owner asked for a review of the current sign-in/sign-up process, compared against TikTok, Instagram, and X, with an eye on EU GDPR compliance so the app doesn't end up exposed later. First pass was review-only; this doc is the follow-up scope produced after that review, with a few product decisions already made by the product owner (see "Decisions locked in" below). The instruction was to scope the work and wait for explicit go-ahead per phase — do not start implementing without that.

## Current state (as found in the repo)

- Auth is email/password only via Supabase Auth, spread across two separate screens: [app/(auth)/sign-in.tsx](../../app/(auth)/sign-in.tsx) and [app/(auth)/sign-up.tsx](../../app/(auth)/sign-up.tsx). No social login, no OTP/magic link, no biometrics.
- Sign-up forces email verification, then sends the user back to manually sign in again with the same credentials ([app/(auth)/sign-up.tsx:57-65](../../app/(auth)/sign-up.tsx#L57-L65)).
- [lib/supabase.ts:7-9](../../lib/supabase.ts#L7-L9) sets `persistSession: true` but **no storage adapter is installed** (`@react-native-async-storage/async-storage` / `expo-secure-store` are both absent from `package.json`). On native builds this likely means sessions do not survive an app restart — users may be forced to log in every time they open the app. Needs on-device confirmation, but if true it's probably the single biggest friction point versus TikTok/Instagram.
- [lib/auth.tsx:264](../../lib/auth.tsx#L264) returns raw Supabase error text on sign-up (e.g. "User already registered") — an account-enumeration leak.
- [lib/auth.tsx:222-247](../../lib/auth.tsx#L222-L247) logs project ref, email domain, and user id on every sign-in attempt, unconditionally (not gated to dev builds).
- No Privacy Policy or Terms page exists anywhere in either project (`adhan-connect` or `maksums-website`). Sign-up shows only dead placeholder text: [app/(auth)/sign-up.tsx:123-125](../../app/(auth)/sign-up.tsx#L123-L125).
- No account deletion or data export exists anywhere in the app. [screens/user/settings/account.tsx](../../screens/user/settings/account.tsx) is an 18-line stub.
- Most foreign keys to `auth.users(id)` already use `ON DELETE CASCADE` / `ON DELETE SET NULL` (see [migrations/20251207110000_prayer_times_staff_rota_bootstrap.sql](../../migrations/20251207110000_prayer_times_staff_rota_bootstrap.sql), [migrations/20260319133000_local_admin_muezzin_workflow.sql](../../migrations/20260319133000_local_admin_muezzin_workflow.sql)), which meaningfully de-risks account deletion — but `public.users` itself isn't defined in either tracked migrations folder (`migrations/` or `supabase/migrations/`), so its cascade behavior toward `auth.users` is unconfirmed and must be checked directly in the Supabase dashboard/SQL before deletion is wired up.
- Existing `+api.ts` server route pattern (bearer-token verification against a service-role Supabase client) is established in [lib/server/adminAccess.ts](../../lib/server/adminAccess.ts) and [app/api/admin/users-access+api.ts](../../app/api/admin/users-access+api.ts) — reuse this pattern for any new auth-adjacent API routes rather than inventing a new one.

## Why this matters (GDPR angle)

- No privacy notice at the point of data collection is a gap against Article 13, and blocks App Store/Play Store requirements for a working privacy policy URL.
- No self-serve deletion/export is a gap against Articles 15 (access), 17 (erasure), and 20 (portability) — and separately, in-app account deletion is required by Apple Guideline 5.1.1(v) for any app that supports account creation, so it's also an App Store blocker as-is.
- Unbundled consent: if marketing email/push is ever added, it needs a separate opt-in from Terms acceptance — not built now since no marketing sending exists yet, but flagged so it isn't retrofitted incorrectly later.
- Session tokens should live in encrypted storage (`expo-secure-store`), not just for UX (Phase 0 below) but as the "appropriate technical measure" Article 32 expects for credential-equivalent data.

## Decisions locked in with the product owner

- **Social login providers:** Apple + Google (not Apple-only, not deferred).
- **Email verification:** should not block first use. User gets in immediately after sign-up; verification happens in the background with a dismissible in-app banner.
- **Privacy Policy / Terms content:** draft a first pass based on the app's actual observed data practices — explicitly not a substitute for legal review, flagged to the product owner before anything is published.
- **Account deletion semantics:** immediate hard delete via the Supabase Admin API (not soft-delete/grace-period), leaning on the existing cascade rules noted above.

## Phased scope

### Phase 0 — Foundation fixes (small, do first)
1. Add `expo-secure-store` and wire it as the Supabase `auth.storage` adapter in [lib/supabase.ts](../../lib/supabase.ts) (web keeps default `localStorage`). Confirm on-device whether this actually fixes a re-login-every-launch problem.
2. Replace the raw Supabase error text on sign-up ([lib/auth.tsx:264](../../lib/auth.tsx#L264)) with a neutral message to close the enumeration leak.
3. Wrap the `console.log` calls in [lib/auth.tsx:222-247](../../lib/auth.tsx#L222-L247) in `if (__DEV__)`.

### Phase 1 — Identifier-first sign-in flow
- New route `app/api/auth/identifier-lookup+api.ts`: `POST { email } → { exists: boolean }` against `public.users`, modeled on the existing `+api.ts` pattern. **Trade-off to carry forward:** this deliberately reveals whether an email is registered, same as Instagram/X — needs basic per-IP/email throttling since it's a new unauthenticated endpoint, not a full anti-abuse system.
- Collapse [sign-in.tsx](../../app/(auth)/sign-in.tsx) and [sign-up.tsx](../../app/(auth)/sign-up.tsx) into a single entry screen: email → "Continue" → branches in place to password (existing account) or name+password (new account), reusing `signIn`/`signUp` from [lib/auth.tsx](../../lib/auth.tsx) unchanged.
- Remove the forced verify-then-go-back-and-sign-in-again step; sign-up should sign the user straight in, with a dismissible "verify your email" banner (reuse the deep-link handling already in [app/(auth)/callback.tsx](../../app/(auth)/callback.tsx)).
- Leave [reset.tsx](../../app/(auth)/reset.tsx) / [new-password.tsx](../../app/(auth)/new-password.tsx) as-is.

### Phase 2 — Social login (Apple + Google)
- `expo-apple-authentication` (iOS only) + `ios.usesAppleSignIn` in `app.json`; wire to `supabase.auth.signInWithIdToken({ provider: 'apple', ... })`.
- Google via `supabase.auth.signInWithOAuth({ provider: 'google' })`, using the already-installed `expo-web-browser`, completing through the existing [callback.tsx](../../app/(auth)/callback.tsx) deep link.
- Both buttons shown above the email field on the Phase 1 entry screen; Apple at equal-or-greater visual prominence (Apple HIG requirement).
- **External prerequisites the product owner needs to arrange (not code):** Apple Developer Sign-in-with-Apple capability + Services ID; Google Cloud OAuth client (iOS/Android/Web); enabling + configuring both providers in the Supabase dashboard; confirming Supabase's automatic-account-linking-by-email setting so a password account and a social account with the same email don't end up duplicated.

### Phase 3 — GDPR scaffolding
- Draft Privacy Policy + Terms pages from actual observed data practices (Supabase-hosted Postgres, mosque/staff/rota data, no analytics/ads SDKs today, Apple/Google become new processors once Phase 2 ships). Host as static pages on [maksums-website](../../../maksums-website) (already Vercel-deployed) at `/privacy` and `/terms`; link for real from sign-up and a new Settings entry, replacing [sign-up.tsx:123-125](../../app/(auth)/sign-up.tsx#L123-L125).
- Account deletion: new route `app/api/account/delete+api.ts`, same bearer-token pattern as [lib/server/adminAccess.ts](../../lib/server/adminAccess.ts) but self-service only (a user may delete only their own id), calling `supabaseAdmin.auth.admin.deleteUser(userId)`. **Before shipping:** confirm `public.users`' FK/cascade behavior directly against the DB (see note above — it's not in tracked migrations). Add a one-time warning if the requester is the sole `mosque_admins`/muezzin entry for a mosque (business-continuity edge case, not a GDPR blocker). Client UI replaces the stub in [screens/user/settings/account.tsx](../../screens/user/settings/account.tsx).
- Data export: new route `app/api/account/export+api.ts`, same self-service bearer-token pattern, bundling the requester's own rows (`users` profile, `subscriptions`, their `muezzin_cover_requests`, their `app_notifications`) as downloadable JSON. Mosque-owned config/content is out of scope. Needs `expo-sharing` added (`expo-file-system` is already installed).
- Confirm Supabase project region for EU data residency, fold into the privacy policy draft.
- Marketing-consent checkbox: documented as a future follow-up only; not built now since no marketing sending exists.

### Phase 4 — Later / polish
- Biometric app-unlock (`expo-local-authentication`) gating the already-persisted session.
- Revisit passkeys/WebAuthn once Supabase's React Native support matures.

## Recommended sequencing

Phase 0 → Phase 1 → Phase 3 → Phase 2 → Phase 4. Phase 2's external account provisioning (Apple/Google console work) can start in parallel any time since it doesn't depend on the other phases.

## Verification expectations

- `npx tsc --noEmit` and `npm run lint` after each phase, per the working rules in [CLAUDE.md](../../CLAUDE.md).
- Manual flow testing per phase (no automated test suite exists yet, per [CLAUDE.md](../../CLAUDE.md)): fresh sign-up → immediate access → banner dismiss → verify link still resolves; sign-in with an existing account; password reset unchanged; Apple/Google sign-in on a real device (Sign in with Apple doesn't work in the simulator); account deletion end-to-end against a disposable test user with a follow-up SQL check that dependent rows are actually gone; data export producing a valid JSON file.

## What's being asked of Codex

Review this scope for correctness and feasibility against the current codebase before any implementation starts. Flag anything here that conflicts with more recent changes, any reused pattern that's since moved, or any risk this scope underestimates — particularly around the `public.users` cascade-behavior unknown in Phase 3, and the enumeration trade-off in Phase 1.
