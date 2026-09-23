# Listener access without sign-up: architecture and privacy review

Date: 8 September 2026. Scope: repository review and existing local regression checks. This is a proposal, not an implemented migration or a production/audio certification.

## Recommendation

Remove mandatory listener registration. Retain named, authenticated accounts for main admins, local admins and muezzins. For the first implementation, retain a persistent, automatically created Supabase anonymous session for listeners when they need personalised server features or live access. Public browsing should work without waiting for session creation.

This meets the user-facing objective without rewriting every user-owned relationship. It is a provisional engineering recommendation based on the current architecture, subject to a staging proof of the anonymous-user lifecycle and the privacy decisions below. Supabase calls these anonymous users, but they still have an Auth UUID and authenticated session: describe them as “no sign-up required,” not “we collect no personal data.”

Do not simply enable the old guest switch, remove endpoint authentication, invent a shared listener account, grant broad public database access, or silently mark consent as accepted.

## Findings in the current implementation

Paths below are relative to the repository root.

| Area | Evidence | Consequence |
| --- | --- | --- |
| Root navigation | `lib/navigation/RootLayout.tsx` forces guest state to false in both guest-loading callbacks, with a testing comment. No-session users are redirected to sign-in. | Login is currently mandatory by explicit routing logic. |
| Existing guest mode | `lib/guestAccess.ts` only permits listener home, discover and mosque/event/campaign/Jumu'ah detail paths. Its comment explicitly excludes follows, preferences and live access. | Re-enabling it alone still blocks live-player/now, settings and guidance routes. |
| LiveKit listener client | `lib/hooks/useLiveKitSubscribe.ts` obtains and refreshes a Supabase session before requesting a subscriber token. | A truly sessionless listener fails before joining audio. Expiry errors currently instruct the user to sign in. |
| LiveKit listener API | `app/api/listener/livekit-token+api.ts` validates bearer token, account consent, mosque eligibility and a fresh live room. | Hiding sign-in alone produces 401 or consent-related 403 responses. |
| Other streaming providers | `lib/api/liveStreamAccess.ts`, `app/api/live-stream-access+api.ts`, `lib/server/liveStreamListenerAccess.ts` authenticate, check consent/eligibility and issue signed, expiring proxy URLs. Cache keys include user and location. | Both playback systems need coordinated changes; LiveKit-only changes leave other providers broken. Preserve upstream URL protection and grant isolation. |
| Mosque eligibility | `ensureUserCanAccessMosquePlayback` checks main-admin role, follow, mosque admin/muezzin membership, or supplied location within 30 km. | Local-only follows do not satisfy existing server eligibility. Anonymous sessions can retain server follows. Supplied coordinates are not proof of physical presence. |
| Live state | `screens/shared/hooks/useLiveStreamForMosque.ts` reads streams/adhans, subscribes to Realtime and polls every 15 seconds. Home and now also manage live subscriptions. | Verify row and column permissions plus Realtime delivery for the chosen principal. Seeing a LIVE badge does not prove audio access works. |
| Follows and mosque selection | `screens/user/discover.tsx`, `screens/user/mosque/[id].tsx`, `screens/shared/manage-mosques.tsx` use `subscriptions.user_id`. `lib/mosquePreferences.ts` already supports a local anonymous default mosque, but server notification preferences require a user/token. | Removing identity entirely requires a new persistence and synchronisation model. A local default mosque alone is insufficient. |
| Push and notification taps | `components/NotificationRuntime.tsx` exits without user ID/token, including response subscriptions. The September 3 push migration ties devices, preferences and deliveries to Auth users and derives listener delivery from subscriptions. | Sessionless listeners would lose the existing registration/delivery path; cold-start notification navigation also needs verification. |
| Other listener writes | Jumu'ah intentions, event engagement, mosque invitations/requests and notification settings have account dependencies. | Every listener action needs a defined guest behaviour; don't leave sign-in prompts or dead buttons behind. Attendance counts represent installations rather than verified people if anonymous identities are allowed. |
| Consent | Root routing and `lib/server/accountConsentAccess.ts` expect current metadata and durable account receipts. `20260724090000_account_control_foundation.sql` includes receipt triggers and a consent predicate. | Automatic anonymous sign-in alone is not sufficient. A new identity without the current metadata is diverted to account completion; fabricated metadata is not valid consent. |
| Staff publishing | `app/api/muezzin/livekit-token+api.ts` validates account, consent and mosque membership before minting publisher access. Broadcast control has separate transactional start/end migrations. | Preserve these authority checks and transactions. A listener session must never imply staff access. |
| Privacy rights | `app/api/account/delete+api.ts` requires recent authentication and impact checks. | Anonymous users cannot necessarily complete the existing interactive reauthentication path. They need a deliberately designed device/session-based deletion and export flow. |

The existing `docs/supabase-security-2026-09-08.md` reports staging/production migration differences and unresolved public PostGIS write privileges. Those findings were not independently rechecked here. Confirm deployed policies, grants, triggers and schema rather than assuming migration files exactly describe production. The reported permissions issue matters for either public or anonymous-auth access.

## Options

| Approach | Experience | Engineering tradeoff | Privacy tradeoff |
| --- | --- | --- | --- |
| Restore limited guest browsing | Browse without login; listening/follows still gated | Small change but does not satisfy the requested listener experience | Less data only for browsing |
| Automatic anonymous Supabase session — recommended first | No email, password, verification or social sign-in for listeners | Reuses UUID-based follows, notifications and playback checks; requires explicit guest lifecycle, consent and permission work | Removes named listener registration; retains pseudonymous server records |
| Sessionless browsing/playback plus optional device registration | No listener Auth user; local preferences; server device principal only for alerts | Larger redesign of token issuance, eligibility, push, writes and deletion; more independent failure paths | Can reduce server associations further, but push endpoints and infrastructure logs can still be personal data |

If “no listener records in Supabase Auth” is itself a requirement, use the third option. It is feasible, but it is not the lowest-disruption route for this codebase. A device principal must be authenticated with a protected credential; a submitted installation ID is not proof of ownership.

## Proposed listener experience and lifecycle

1. Launch into listener home. Offer mosque search/manual selection; request location only for a feature that needs it. Public prayer times and content should remain available if Auth is unavailable.
2. Save local choices immediately. Establish at most one protected anonymous session per installation when server functionality is needed. Deduplicate simultaneous creation requests and preserve the session across launches. Check Auth triggers/profile creation for missing email/name, including database constraints absent from local migrations.
3. Apply the approved privacy and age approach at the relevant feature boundary. Never automatically grant special-category consent. Existing all-account consent gates need deliberate replacement for guest features while staff requirements remain enforced.
4. Following a mosque can create a subscription owned by that anonymous UUID. Keep local defaults and notification primary-mosque preferences consistent; handle offline writes and partial failure visibly.
5. “Listen live” gets a short-lived server-issued grant. Keep current followed/nearby eligibility initially, so removing sign-up does not silently change mosque access policy. Ensure manually selecting/following a mosque works when GPS is denied.
6. Ask separately for optional adhan alerts. Permission denial or registration failure must not block manual listening. Explain that notifications are best-effort; do not promise unattended audio playback from a push notification.
7. Settings offers mosque preferences, notifications, privacy/data controls and a separate “Mosque staff sign in” entry. Staff login must not destroy the guest identity or overwrite staff/listener settings accidentally. Define credential storage and switching explicitly before coding it.
8. Refresh expired sessions quietly. On irrecoverable session loss, explain that a fresh installation identity may lose server preferences; do not silently claim that it restores the previous identity. Use retry/backoff and avoid creating endless replacement users during an outage.

Reinstallation, clearing browser storage and moving to another device do not provide account recovery or automatic cross-device sync. State that limitation. If optional recovery is introduced later, make it a separate opt-in. Never auto-delete existing named listener accounts; offer a migration preserving follows and preferences, deduplicate device registrations, and keep their existing export/deletion access. Multi-role users must retain every staff membership.

## Live broadcast invariants

- Publishers still require a named staff identity and current server-verified mosque authority. Explicitly deny anonymous principals from staff APIs and staff-grant paths; test both routes and direct database access. Do not rely solely on UI guards or editable metadata.
- Subscriber grants remain room-specific, short-lived and subscribe-only (`canPublish: false`, `canPublishData: false`). Never share one LiveKit identity among listeners. Consider per-connection identity scope for multiple simultaneous devices/tabs; test reconnect identity reuse to avoid duplicate-identity disconnects.
- The server resolves the active room from the mosque and fresh broadcast state; a client cannot select arbitrary rooms or obtain publishing privileges. Token response caching must not leak grants between callers.
- Preserve signed proxy expiry, stream matching, server-held secrets and upstream URL restrictions for non-LiveKit playback.
- Preserve transactional broadcast start/end, room shutdown, freshness checks, audio engine recovery and muezzin rota/assignment logic. Listener onboarding or notification errors must not end a broadcast.
- New identity creation and token issuance need abuse controls, rate limits and monitoring appropriate to many listeners behind one mosque's shared IP. Do not introduce a CAPTCHA challenge during an ongoing adhan unless abuse makes it necessary; evaluate supported platform protections during onboarding.
- A JWT's expiry is not a guaranteed active-connection cutoff. Verify provider behaviour and explicit room closure; don't claim expiry alone immediately stops existing listeners.

Supabase anonymous Auth users assume the `authenticated` database role, unlike requests using only the public anon key. Review every relevant policy, RPC and Storage permission with that distinction in mind. An `authenticated` check alone is not a staff check.

## GDPR implications

Removing email/name/password registration is worthwhile data minimisation and reduces recovery/identity-provider administration. It does not create a general GDPR exemption. Persistent Auth/device identifiers, push tokens, IP logs and linked preferences may still identify or single out someone. Pseudonymisation remains within GDPR; genuinely anonymous information has a different legal status.

Mosque follows, attendance intentions and linked activity may reveal religion. This is a context-dependent legal assessment, not a claim that every visitor has a particular belief. Where the processing is special-category data, identify both an Article 6 lawful basis and Article 9 condition. Obtain targeted legal review of the actual guest data flows before replacing today's consent model. OS notification/location permission and acknowledging a privacy notice are not substitutes for this analysis.

For the UK operator identified in the existing data map, UK GDPR remains relevant. EU GDPR may additionally apply when its territorial conditions are met, including relevant EEA establishment, offering services to people in the EEA or monitoring their behaviour there. Removing login does not change those tests.

Practical minimisation requirements:

- Collect no listener email, name, phone or social identity by default; keep local preferences local where server storage is unnecessary.
- Avoid persistent listening histories and religion-based profiling. Minimise and expire location data, including travel regions; permit manual mosque selection.
- Retain server follows/device endpoints only for the features requested. Define inactivity cleanup, failed-push-token expiry, backup handling and log retention. Supabase anonymous users need a planned cleanup process.
- Provide “Delete this device's data” and access/export mechanisms appropriate to the guest credential. Remove server associations and delivery registrations as well as local storage; do not weaken staff deletion safeguards. Document limitations if the credential has been lost.
- Update the data map, privacy notice, processor/transfer review and app-store privacy declarations, including Expo push and platform push services. Retain staff privacy duties.
- Reassess the existing 16+ account assumption and children's/DPIA screening when opening listener access. The existing data map explicitly treats this as unresolved; do not silently remove the age policy alongside login.

Sources checked on 8 September 2026:

- [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous): session behaviour, authenticated role, recovery limitations, abuse prevention and cleanup.
- [LiveKit access tokens and grants](https://docs.livekit.io/frontends/reference/tokens-grants/): room and publishing/subscribing permissions, token expiry semantics.
- [GDPR text, including Recital 26 and Article 3](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng): identifiable/pseudonymous data and territorial scope.
- [ICO: special-category data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/): religious belief and context of inference.
- [ICO: rules on special-category data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/?q=dpa): Article 6 and Article 9 requirements.
- [ICO: who UK GDPR applies to](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/who-does-the-uk-gdpr-apply-to/).

## Delivery and release gates

1. Inventory deployed Auth configuration, profile triggers, constraints, grants, RLS, RPCs and Storage policies in staging and production. Prove anonymous creation/refresh and ownership isolation in staging first. Resolve the previously reported exposed database permissions.
2. Implement behind a rollout flag with additive server/schema changes that keep existing authenticated clients working. Define guest consent, deletion, persistence and staff transition semantics before enabling guest writes.
3. Exercise both live playback paths plus follows/default mosque and push as one complete vertical slice. Introduce listener onboarding only after the guest backend contract works.
4. Test real Android and iOS devices, plus web where supported, with a staging muezzin and multiple distinct listeners. Prove audible audio and actual broadcast termination, not merely HTTP success or a LIVE badge.
5. Pilot with the local mosque. Monitor join success/time to first audio, reconnect failures, start/end correctness, notification delay/duplicates and anonymous-user growth using minimal diagnostics. Compare against the existing signed-in baseline before expansion.
6. Keep a kill switch for new guest enrolment while allowing already-issued guest sessions and old clients to function. Do not roll back by deleting guest identities or dropping new tables while listeners depend on them. Avoid flipping access rules during a broadcast.

Required test cases:

| Scenario | Required result |
| --- | --- |
| Fresh install; no email, location denied, notifications denied | Select/follow mosque and hear live audio without sign-in; other public content remains usable |
| Two listeners, multiple devices/tabs | Concurrent audio without identity collisions or shared private preferences |
| Live start, join late, stop, next adhan | Correct room, prompt end, no stale audio or stale live state |
| Network switch, interruption, screen lock/background, app resume | Supported audio/reconnect behaviour remains at least as reliable as signed-in baseline |
| Session expiry, token expiry, Auth outage, storage loss | Bounded recovery; no forced registration, duplicate-user loop or privilege fallback |
| Notification while foreground/background/cold-start; token rotation | Correct mosque opens after session hydration; no duplicate or expired delivery; no staff route for guests |
| Proxy provider playback | Valid grant works; unsigned/expired/wrong-stream grant fails; upstream secrets remain hidden |
| Guest A vs guest B, ordinary listener vs each staff role | Own-data isolation; no staff access, publishing, role changes or secret reads through API/RPC/database |
| Existing named listener and multi-role staff migration | Follows/preferences preserved; staff assignments, consent, export and deletion continue working |
| Withdraw/delete/reset/reinstall | Documented local/server cleanup and preference loss; old push registrations no longer receive alerts |
| Shared mosque Wi-Fi load and abusive token requests | Legitimate listeners can join; abuse controls bound resource use |
| Staging/production policy differences | Public reads and all intended guest ownership checks verified against actual deployed schema |

## Verification performed for this review

- `npm run test:notifications:safety`: passed; source contracts include 18 protected live files and asynchronous notification delivery isolation. These are structural checks, not end-to-end delivery tests.
- `npm run test:live:contracts`: passed against `http://127.0.0.1:8081` after retrying with permitted local network access. Five page routes returned 200; nine protected API checks returned 401; unsigned playback and invalid nearby input returned 400. The script reported zero production data mutations.
- The live contracts confirm today's authenticated boundary, including rejection of sessionless listeners. They do not prove the proposed guest design works or that real audio was heard.
- No application code, Auth configuration or database migrations were changed. No real-device audio, background playback, production RLS or push delivery was exercised during this review.

Decision: proceed with designing a no-sign-up listener experience using automatic anonymous sessions as the lowest-disruption first route. Release only after the guest lifecycle, privacy model and real-device broadcast gates above pass. A zero-regression guarantee is not supported by this review alone.
