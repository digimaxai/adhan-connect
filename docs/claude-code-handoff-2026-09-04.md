# Claude Code Handoff — 2026-09-04

**From:** Codex

**For:** Claude Code / next engineering session

**Branch:** `staging`

**Base commit shown by Git:** `ac5bd44`

**Status:** Major staging work implemented; notification delivery still needs
the final physical-iPhone acceptance gate. Production was not changed.

This document supersedes the operational status in
`docs/claude-code-handoff-2026-08-31.md`. Read `CLAUDE.md` and
`docs/codex-worklog.md` as well. Never print or copy values from local
environment files, EAS secrets, Supabase secrets, Resend credentials, or
LiveKit credentials.

## Executive summary

Over the last several days, Codex restored staging authentication email,
repaired the new API routes, redesigned the listener Quran and Daily Reflection
experiences, simplified listener navigation and first-run mosque onboarding,
added travel-safe nearby context, and implemented an opt-in push notification
pipeline for listener and muezzin interests.

The latest iOS feedback exposed two separate notification issues. The client
screen was blocking unrelated controls and showing listener/travel settings in
the muezzin workspace. That UI is now role-aware and saves each setting
independently. The backend had a deeper assignment mismatch: the live app could
authorize an active mosque default muezzin without an explicit rota row, but the
reminder scheduler only read explicit rota rows. Staging now uses the same
precedence as the established app: approved/provisional cover, explicit rota,
then active default muezzin.

Staging iOS preview build 6 was installed on at least one physical iPhone and
verified device registration and preference persistence. Build 7 exposed a
multi-select save race and nested workspace transition problem. Fresh preview
build 8 contains both client repairs and is ready to install. The scheduler
function executes successfully after its enum-cast hotfix, and subsequent Isha
events produced successful 10- and 5-minute delivery receipts.

## Non-negotiable production safeguard

The current production end-to-end LIVE Adhan system is a protected release
surface. It includes role assignment, rota and cover behavior, publisher start,
LiveKit microphone broadcast, listener homepage/LIVE state, audible playback,
end cleanup, and restart/idempotency.

- Production Supabase was not migrated or reconfigured.
- Production EAS/LiveKit configuration was not changed.
- Notification work does not synchronously call Expo/APNs inside the broadcast
  transaction.
- LIVE writes enqueue a local durable event; the post-commit network wake-up
  catches all failures. Push failure therefore cannot fail or roll back the
  broadcast transaction.
- Notification safety tests hash-protect the established LIVE, assignment,
  rota, and listener surfaces and reject migrations that mutate protected
  operational tables.
- Do not merge or deploy the whole `staging` branch to production. Reconcile it
  with current `main`, review the protected-path delta, and run the complete
  physical publisher/listener canary first.

## Work completed

### 1. Staging authentication and email

- Confirmed the local portal had initially been compiled against production
  while staging SMTP was being inspected; added branch/environment guards so a
  staging launch refuses the known production Supabase ref by default.
- Found the exact staging email failure in Supabase Auth logs: the SMTP hostname
  had become `smtpsmtp.resend.com`.
- Rotated the exposed Resend credential and restored the complete custom SMTP
  block with `smtp.resend.com`, port 465, the Resend user, and the verified
  `mail.adhanconnect.com` sender domain.
- Kept email confirmation required.
- Added exact localhost confirmation/reset callbacks for ports 8081 and 8082
  alongside the native `adhanconnect://` callbacks.
- Fixed the native password-reset completion path that had received neither an
  auth code nor a PKCE verifier.
- Controlled staging email smoke returned HTTP 200 and removed its temporary
  user. Real verification and password-reset emails were then received and the
  user successfully signed in on iPhone.
- Supabase Support escalation is no longer required for this issue.

### 2. Expo Router API repair and network behavior

- Renamed the new API endpoints to Expo Router's required `+api.ts` convention;
  their previous filenames returned the web HTML shell/404 instead of JSON.
- Corrected `lat`/`lng`, current prayer-time columns, live-state fields,
  response normalization, validation, freshness filtering, and cache behavior.
- Added native API discovery that prefers the active Metro host for development
  but retains configured fallbacks. This fixed stale development clients
  repeatedly calling an obsolete EAS web URL.
- Added targeted smokes for Quran, devotional, nearby, email, notifications,
  and protected LIVE contracts.

Current API routes include:

- `/api/mosques/nearby`
- `/api/mosques/search`
- `/api/live-adhans/location`
- `/api/quran/chapters`
- `/api/quran/chapter`
- `/api/quran/reciters`
- `/api/quran/verse-audio`
- `/api/quran/surah-audio`
- `/api/duas/daily`
- `/api/tips/daily`

### 3. Quran experience

- Built a mobile-first catalogue of all 114 searchable surahs.
- Added Arabic ayahs and Saheeh International English translation with complete
  pagination.
- Added a clear surah selector, reciter selector, explicit per-ayah Listen
  actions, full-surah Play, compact persistent player, previous/next, progress,
  and selected-ayah state.
- Full-surah mode prefers one continuous Quran Foundation MP3 and uses ayah
  timestamps to seek between verses without the abrupt stop/start gaps caused
  by loading a separate file for every ayah.
- A per-ayah queue remains for a reciter that cannot be safely mapped to the
  separate chapter-audio catalogue.
- Bundled and loaded `AmiriQuran_400Regular` for Quranic Arabic only, with
  generous line height and a visually calmer size ratio against Latin text.
- Arabic source and Latin translation are placed on the same right side while
  Latin text retains left-to-right word order.
- Replaced the dark selected-surah treatment with the subtler sage reading
  palette used on verse cards.
- Quran metadata goes through the Expo API/cache. MP3 bytes travel directly
  from Quran Foundation's CDN to the phone; they do not pass through Supabase
  and do not add Supabase audio egress.

### 4. Daily Reflection experience

- Renamed the user-facing feature from Islamic Wisdom / Duas & Adhkar to
  **Daily Reflection**; the tab label is **Reflect** and the internal route
  remains `/duas` for compatibility.
- Added useful prayer-moment filters, real retry behavior, transliteration
  disclosure, and an “another reminder” action.
- Added eight reflection themes and removed non-working placeholder resources.
- Applied the shared Quran reading system: sage surfaces, borders, typography,
  actions, Amiri Quran Arabic, sensible Arabic/Latin ratio, and same-side right
  alignment.
- Devotional smoke covers all five prayer filters and eight themes.

### 5. Listener navigation and first-run UX

- Reduced the visible listener footer from seven cramped destinations to five:
  Home, Quran, Reflect, Mosques, and Settings.
- Hid invite/request utility routes from the tab bar and moved those actions to
  a clearly labelled Settings section.
- Added filled/outline icons, stronger selected/inactive contrast, safe-area
  spacing, accessibility labels, light selection haptics, and a restrained
  spring interaction.
- Reworked the signed-in listener/no-mosque home state into a focused first-run
  path with one primary Discover Mosques action, clear benefits, optional
  location context, and a missing-mosque route.
- Kept established listener and muezzin home branches separate from the
  first-run state.

### 6. Nearby and travel-safe context

- Added `NearYouNowCard` to listener home with PostGIS distance filtering,
  LIVE-first ordering, next prayer/time, timetable-versus-estimate labels,
  directions, mosque detail, and direct LIVE listening.
- Location refreshes while the app is in use and when it returns to foreground;
  there is no continuous/background journey tracking.
- Current-area LIVE alerts are optional, store only a rounded approximately
  1 km location for no more than 24 hours, and support 5/15/30 km radii.
- Travel state never follows a mosque, replaces the primary mosque, or changes
  existing subscriptions.
- Nearby schedule estimates are labelled and grouped/cached to avoid multiplying
  third-party prayer-time requests across adjacent mosques.

### 7. Push notification architecture

The deployed staging flow is:

| Stage | Responsibility | Failure behavior |
| --- | --- | --- |
| Device | Request permission only after an explicit user action; register an iOS Expo token scoped to the staging variant | App remains usable if permission/registration fails |
| Preferences | Store independent listener, muezzin, and travel interests | Each control saves separately |
| Producer | Insert an idempotent `notification_events` outbox row | Does not send network traffic inside LIVE transaction |
| Dispatcher | One-minute staging `pg_cron` plus a post-commit LIVE wake-up invokes `push-dispatch` | Authenticated; retries are bounded; LIVE wake-up fails open |
| Expo/APNs | Send the physical push | Tickets and receipts persist in `notification_deliveries`; invalid devices can be deactivated |

Implemented preferences:

- Listener upcoming alert, lead time, prayer selection, and primary/all-followed
  mosque scope.
- Listener followed-mosque LIVE alert.
- Muezzin assignment/rota updates.
- Muezzin upcoming duty alert with multiple lead times.
- Muezzin served-mosque LIVE status.
- Short-lived current-area LIVE alert in Listener mode.

Muezzin and listener interests remain independent. A person with a muezzin role
can switch to Listener mode to configure personal prayer/travel interests, but
the muezzin Notifications screen no longer mixes those controls with operational
duties.

### 8. Notification settings physical-QA fixes

The screen reported by the user has been repaired:

- Preferences render before secondary listener/activity queries complete.
- The global `busy` state was split into device, travel, activity, and per-key
  save state.
- Switches update optimistically and show only their own progress.
- Saves use `saveNotificationPreferencePatch` so toggling one choice does not
  rewrite or lock all other settings.
- A granted device is not redundantly registered for every preference switch.
- Muezzin workspace: My duties + Assignment updates only.
- Listener workspace: Adhan alerts + current-area travel alerts.
- Muezzin 5/10/30-minute choices now use a current-state ref and ordered
  per-field save queue, so rapid taps cannot overwrite newer selections.
- Selected leads show checkmarks, explicit multi-select guidance, selected
  count, and an individual saving message.
- Notification settings offers a direct workspace action. Shared Settings and
  Admin explicitly require a new workspace choice and replace their nested
  route with the chooser.
- Notification taps synchronize the saved workspace before replacing the old
  workspace route with the requested listener or muezzin destination.

### 9. Muezzin duty reminder assignment fix

Read-only staging evidence showed:

- the physical iOS device was active, staging-scoped, permission granted, and
  recently seen
- the muezzin preferences were saved, including duty reminders and lead times
  `[30, 10, 5]`
- the account had an active muezzin membership and was the mosque's active
  `default_muezzin_user_id`
- the future/past test timetable row existed, but no explicit `staff_rota` row
  did
- no notification event or delivery existed

The client and token were therefore healthy; no event had been created. The
scheduler is now aligned with the existing app's assignment resolution:

1. active approved/provisional cover
2. explicit rota assignee (`muezzin_user_id` or legacy `staff_user_id`)
3. active mosque default muezzin, but only when there is no explicit rota row

Migration details:

- `20260904123000_muezzin_duty_reminder_assignment_fallback.sql` replaces
  `enqueue_due_adhan_reminders_v1` and adds that precedence. It only inserts
  idempotent outbox events.
- Its first staging runtime invocation found that legacy `staff_rota.prayer`
  columns may be the `prayer_t` enum. PostgreSQL rejected uncast `trim()`.
  The failed transaction created no event or protected-table mutation.
- The canonical first migration now contains explicit `::text` casts for fresh
  databases.
- `20260904124500_fix_muezzin_duty_prayer_enum_cast.sql` safely corrects an
  already-installed uncast function definition in staging. Keep both files;
  the second is required for applied migration history compatibility.
- A runtime RPC call passed after the hotfix. It created zero events because
  the test Dhuhr had already passed, which was expected.
- The linked staging database reports no pending migrations.
- A later Isha test created default-assignment events at 10 and 5 minutes. Both
  delivery records reached `delivered` in one attempt with no error. The saved
  preference later ended at `[5]`, confirming the subsequent defect was the
  old client's multi-select state rather than backend assignment or delivery.

### 10. Staging iPhone builds

- Three iPhones are registered for internal distribution.
- Apple Push Notifications was enabled for the staging App ID and the ad hoc
  profile was regenerated with `aps-environment`.
- Two earlier attempts failed because the generated profile lacked that
  entitlement; this is resolved.
- Preview build 5 first introduced the native push stack and supported initial
  physical QA.
- Preview build 6 introduced the notification-settings repair and was used to
  verify device registration and preference persistence.
- Build 7 exposed the reminder multi-select and workspace-transition issues.
- Current preview build 8 is the corrected physical-acceptance binary:
  - EAS build ID: `de7300a8-36e7-45c9-9ece-f674b53e3573`
  - App build version: 8
  - Name: Adhan Connect Staging
  - Bundle ID: `com.maksumsdigitalagency.adhanconnect.staging`
  - Distribution: internal/ad hoc
  - Build page:
    `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/de7300a8-36e7-45c9-9ece-f674b53e3573`
  - EAS reported the active ad hoc profile expires 2027-07-17
- All three registered iPhones are included in the profile. Build 8 has not yet
  been physically installed at the time of this handoff update.

### 11. Staging email, portal, and mobile testing already observed

- Verification email now arrives.
- Password reset email and native reset flow complete successfully.
- Listener login works on the staging iPhone build.
- Muezzin login, notification permission, push device registration, and
  preference persistence work on build 6.
- The web portal served staging API endpoints correctly during targeted tests.
- Development-client performance was slower than production because it depends
  on Metro/debug tooling; preview build 8 is now the production-like staging
  path.

## Staging deployments and identifiers

- Supabase project ref: `zhrucqghrqkjyzmupdyy` (staging only)
- EAS project ID: `20092fdb-b6af-47f8-891a-42f343175678`
- Staging native scheme: `adhanconnect-staging`
- Staging iOS bundle: `com.maksumsdigitalagency.adhanconnect.staging`
- Applied notification migrations:
  - `20260903120000_push_notifications_travel_nearby.sql`
  - `20260903143000_notification_dispatch_schedule.sql`
  - `20260904123000_muezzin_duty_reminder_assignment_fallback.sql`
  - `20260904124500_fix_muezzin_duty_prayer_enum_cast.sql`
- Staging Edge Function: `push-dispatch`
- Staging recurring schedule: one minute
- The dispatcher credential is held in the database/EAS secret systems. Never
  print it or put it in documentation.

## Verification evidence

The latest change set passed:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:notifications:safety`
- clean iOS Expo export
- `npm run test:live:contracts` passed at the preceding checkpoint:
  - five protected pages served
  - nine protected endpoints rejected missing auth with 401
  - invalid/unsigned requests failed closed
  - zero data mutations
- the latest rerun was not counted because Expo CLI stalled during local port
  discovery before the portal started; protected LIVE hashes still pass and no
  protected LIVE file changed
- staging runtime execution of `enqueue_due_adhan_reminders_v1`
- linked staging `supabase db push --dry-run`: no pending migrations

Earlier in this multi-day pass, these also passed after their relevant work:

- `npm run test:quran:api`: all 114 surahs, long-surah pagination, reciter,
  verse audio, continuous chapter audio, range request, and queue fallback
- `npm run test:devotional:api`: all five prayer filters and eight themes
- clean iOS/Android/web exports for the feature set at those checkpoints
- controlled staging email smoke

These are contract/build/runtime checks, not a substitute for real authenticated
two-device audio and APNs acceptance.

## Immediate next test

Install and use build 8 on the muezzin phone:

1. Open Settings → Notifications → My duties and select 5, 10, and 30 minutes.
   Confirm all three show checkmarks and the screen says “3 reminders selected”.
2. Leave Notifications, return, and confirm all three selections persist. The
   current pre-build-8 database value is `[5]`, so 10 and 30 must be reselected.
3. Use the header workspace action to switch Muezzin → Admin → Listener →
   Muezzin, confirming each destination replaces the prior nested settings
   route.
4. In staging only, set the next prayer for the test mosque at least 32 minutes
   in the future. Leave no explicit rota row for the first test.
5. Background and lock the phone.
6. Expect one physical push at about 30, 10, and 5 minutes before the prayer.
7. Tap a push and confirm it opens the muezzin broadcast preparation screen.
8. Inspect staging `notification_events` and `notification_deliveries` only if
   the push is absent. Distinguish “event not created” from “Expo ticket” and
   “APNs receipt/device display”.

Build 8 is required because the latest fixes are in the native client bundle.

## Full remaining physical acceptance

After the default-muezzin test:

1. Add an explicit rota assignee and prove it takes precedence over the default.
2. Add an approved/provisional cover and prove the volunteer takes precedence
   over the rota assignee.
3. Test muezzin assignment-update and served-mosque LIVE preferences.
4. On a listener phone, follow the mosque and enable upcoming and LIVE alerts.
5. On another listener context, enable current-area LIVE within the selected
   radius without changing followed/default mosques.
6. Start a real LIVE Adhan on the muezzin phone.
7. Confirm publisher stability, homepage/live-page state, followed-mosque push,
   travel push only inside radius, opt-out, and uninterrupted audible audio on
   a second phone.
8. End the Adhan and confirm audio stops, UI clears, rows end, and the LiveKit
   room is absent.
9. Repeat start/end once for idempotency and duplicate suppression.
10. Sign out or change account on a registered device and confirm the previous
    account receives no private notification.

Use `docs/mobile/push-nearby-staging-test.md` and the existing LiveKit device
canary documentation as the acceptance checklist.

## Known risks and unfinished work

- Staging recorded successful Expo/APNs delivery receipts for default-muezzin
  10- and 5-minute events. Physical display and tap behavior on build 8 have not
  yet been confirmed; do not label the complete experience accepted until then.
- Full authenticated publisher/listener LIVE audio has not yet been rerun on
  build 8. The code paths are protected and contract tests pass, but the
  physical canary is mandatory.
- Build 8 reproduced an infinite Local Admin loading state after saving a
  muezzin notification preference. The client source now reuses the root
  session-access result, avoids the duplicate admin-mosque auth chain, removes
  the transient role redirect, and provides bounded fallback/recovery. This fix
  is included in staging build 9
  (`ce64a3bf-f83d-4c3d-bfdf-5fb05eed5fef`) and requires physical device QA.
- The working tree contains a large multi-day set of modified and untracked
  files. These changes were included in EAS source uploads but are not all
  represented by the displayed base Git commit. Do not reset, discard, or
  cherry-pick selectively without reviewing `git status` and the full diff.
- `.env.local.staging` is currently tracked. `.easignore` prevents it from
  entering EAS uploads, but it should be removed from Git tracking and affected
  credentials rotated before release.
- Staging build 8's ad hoc profile expires 2027-07-17.
- `staging` has broader historical divergence from `main`; never promote it
  wholesale.
- There is targeted operational coverage, not a comprehensive unit/integration
  E2E suite.
- Legal review, social providers, account-deletion rollout, stale LIVE source
  cleanup, generated Supabase types, legacy route cleanup, and complete release
  documentation remain broader project work.

## Key files

Notification client and UI:

- `screens/user/settings/notifications.tsx`
- `lib/notifications/api.ts`
- `lib/notifications/device.ts`
- `lib/notifications/types.ts`
- `components/NotificationRuntime.tsx`
- `lib/notify.ts`

Notification backend:

- `supabase/migrations/20260903120000_push_notifications_travel_nearby.sql`
- `supabase/migrations/20260903143000_notification_dispatch_schedule.sql`
- `supabase/migrations/20260904123000_muezzin_duty_reminder_assignment_fallback.sql`
- `supabase/migrations/20260904124500_fix_muezzin_duty_prayer_enum_cast.sql`
- `supabase/functions/push-dispatch/index.ts`
- `scripts/configure-push-dispatch.mjs`
- `scripts/test-notification-safety-contracts.js`

Nearby and listener UX:

- `components/NearYouNowCard.tsx`
- `screens/user/index.tsx`
- `screens/user/discover.tsx`
- `app/(user)/_layout.tsx`
- `screens/user/settings/index.tsx`
- `lib/mosquePreferences.ts`

Quran and Reflection:

- `app/(user)/quran.tsx`
- `app/(user)/duas.tsx`
- `components/QuranPlayer.tsx`
- `lib/api/quranClient.ts`
- `lib/api/quranContent.ts`
- `lib/api/quranAudio.ts`
- `theme/tokens.ts`

Environment/build/release safety:

- `app.config.js`
- `eas.json`
- `.easignore`
- `scripts/check-env.js`
- `scripts/start-web-fast.js`
- `scripts/test-live-regression-contracts.js`
- `docs/mobile/push-nearby-staging-test.md`

## Working rules for the next agent

- Read this file, `CLAUDE.md`, and the latest `docs/codex-worklog.md` entries
  before changing auth, prayer times, rota, assignments, LIVE, or notifications.
- Preserve the cover → explicit rota → active default assignment precedence.
- Preserve legacy `staff_user_id`, `prayer`, and enum compatibility until the
  production schema is formally migrated and generated types are introduced.
- Never put Expo/APNs network delivery inside the LIVE database transaction.
- Never let nearby/travel context mutate subscriptions or the primary mosque.
- Never proxy Quran MP3 bytes through Supabase.
- Never expose or commit credentials.
- Do not claim production readiness based solely on lint, TypeScript, an Expo
  ticket, an EAS build, or database runtime success. Require the documented
  physical-device evidence.

## 2026-09-05: Comprehensive notification reliability and role-model review

This section supersedes the earlier build-8/build-9 notification acceptance
notes. Build 9 reproduced a further Muezzin Notifications failure: the device
card could remain busy and the preference area could stay on “Loading your
preferences…” after prior notification work. A full client, database,
dispatcher, role-routing, and real-world UX review was completed rather than
adding another screen-level workaround.

### Product and workspace decision

- Listener is a universal, additive workspace for every authenticated person.
- Local Admin and Muezzin are operational permissions; they do not replace the
  person's Listener experience.
- A Local Admin + Muezzin therefore correctly has three workspace choices:
  Listener, Local Admin, and Muezzin.
- Listener mosque subscriptions, primary mosque, travel alerts, audio mixer,
  Quran, Reflection, and personal Adhan alerts live only in Listener.
- Muezzin Notifications now contains only assignment/rota changes, upcoming
  duty reminders, served-mosque LIVE status, and assignment activity.
- Admin no longer shows local-only “push toggles” that were never consumed by
  the backend. It explains where personal Listener and operational Muezzin
  notification controls belong.

### Confirmed causes and repairs

- Notification reads/writes and push-device RPCs now use a session-scoped
  Supabase client supplied with the already-mounted access token. This avoids
  reacquiring the shared Supabase Auth lock immediately after another request.
- Every notification Postgrest/RPC request has an absolute network deadline.
  Native module loading, SecureStore, Expo token registration, notification
  permission, location permission, GPS, and reverse-geocoding operations are
  bounded as well.
- Preference loading and device registration are independent. A slow or failed
  Expo/APNs registration can no longer hide otherwise usable preferences.
- The preference screen always settles to content or an explicit retry state;
  it has no unbounded full-page spinner.
- Expo device registration is single-flight and caches a recent success, so
  the root runtime and settings screen cannot start duplicate registration
  requests for the same mounted session.
- Optimistic preference saves are serialized per field and use synchronous
  refs. Rapid 5/10/30-minute taps cannot calculate from stale render state or
  arrive out of order. At least one Muezzin lead and Listener prayer remains
  selected.
- Save failures restore/reconcile the UI without discarding the visible cached
  preferences.
- Listener primary-mosque persistence now uses the same bounded session-scoped
  transport. Admin and Listener have separate local default-mosque keys, so
  selecting an Admin console mosque cannot overwrite the person's Listener
  primary mosque.
- Travel activation is an atomic RPC that updates the temporary region and
  preference together. It never mutates subscriptions or the primary mosque.
- The Listener home route no longer uses staff role flags, chooses a served
  staff mosque, suppresses nearby discovery, or renders Muezzin UI. Staff
  accounts receive the same independent Listener experience as everyone else.
- Workspace entry reuses the root session-access result. Admin fallback calls
  have deadlines, the transient dual-role redirect was removed, and recovery
  replaces an infinite Admin spinner.
- Local workspace/preference file mutations are serialized. Choosing a
  workspace and clearing the “selection required” marker can no longer race two
  writes to the same JSON store and resurrect stale navigation state.

### Backend hardening deployed to staging only

- Applied migration:
  `20260904231500_notification_preferences_reliability.sql`.
- It normalizes and constrains Muezzin leads to non-empty subsets of
  `[5,10,30]`, Listener prayers to a non-empty supported set, and travel radius
  to 5/15/30 km.
- It atomically upserts/clears travel preference state and expires stale pending
  events before materialisation. Stale LIVE work is useful for 20 minutes,
  upcoming/duty reminders for 5 minutes, and assignment updates for 6 hours.
- `push-dispatch` was redeployed to staging with a 10-second Expo send/receipt
  timeout. A receipt timeout keeps an accepted ticket observable for the next
  pass and does not duplicate the push.
- The service-only dispatcher smoke succeeded with no due work. The secret was
  not printed or documented.
- A post-deployment aggregate audit found one active granted iOS device, one
  valid preference row, zero invalid leads/prayers/radii, two recent Muezzin
  duty events, two delivered notifications, zero old pending deliveries, and
  no delivery errors. This demonstrates that scheduling, dispatcher, Expo/APNs
  receipt, and the staging backend are healthy; it does not replace physical
  display/tap acceptance.

The migration and function do not modify LIVE sessions, streams, Adhans,
prayer times, rota, assignments, muezzins, mosques, or subscriptions. Production
Supabase, production EAS, and production data were not targeted.

### Verification completed after the final changes

- `npx tsc --noEmit`: pass
- `npm run lint`: pass
- `git diff --check`: pass
- `npm run test:notifications:safety`: pass
  - 18 protected LIVE/broadcast/rota files unchanged
  - asynchronous notification outbox preserved
  - cover → explicit rota → active default assignment precedence preserved
  - universal/additive Listener workspace asserted
  - Listener/Admin mosque preference isolation asserted
  - session-scoped bounded transport and single-flight registration asserted
  - serialized local workspace persistence asserted
- fresh iOS production bundle export: pass
- `npm run test:live:contracts`: pass against the staging portal
  - listener home, LIVE listening, broadcast, muezzin, and rota pages: 200
  - nine protected mutation/access endpoints without auth: 401
  - invalid/unsigned playback and nearby requests fail closed: 400
  - production mutations: 0

### Build and physical acceptance status

Build 9 (`ce64a3bf-f83d-4c3d-bfdf-5fb05eed5fef`) predates this comprehensive
repair and must not be used to accept notification functionality.

The replacement internal iOS staging preview build completed successfully on
2026-09-05:

- build number: `10`
- EAS build ID: `b252f7a6-b1ef-4052-ab26-87b655a34c47`
- install/status page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/b252f7a6-b1ef-4052-ab26-87b655a34c47`
- bundle identifier: `com.maksumsdigitalagency.adhanconnect.staging`
- distribution/profile: internal / `preview`
- final EAS status: `FINISHED`
- signed for all three registered physical iPhones
- production was not built, submitted, configured, or changed

Build 10 contains the complete notification reliability/workspace repair, the
lightweight main-admin session-access fix, and the direct email-to-password
sign-in UX. It is the only current binary suitable for the physical matrix
below. Successful compilation is not physical acceptance.

### 2026-09-05 follow-up: 3-minute LIVE-window reminder and hosted API repair

The user physically confirmed that the 5-minute Muezzin reminder arrives. Its
old tap destination was premature because the established broadcast screen
does not allow LIVE to begin until the final three minutes.

Implemented on staging only:

- Muezzin lead choices are now `3`, `5`, `10`, and `30` minutes.
- 30/10/5-minute duty notifications are preparation prompts and route to My
  Rota.
- The 3-minute notification says the LIVE window is open and routes to the
  existing Muezzin broadcast screen. It does not bypass that screen's existing
  time, assignment, or authorization checks.
- Migration `20260905103000_muezzin_three_minute_live_window.sql` updates only
  notification preference validation and notification-event presentation/tap
  data. It does not read or mutate LIVE, stream, rota, assignment, mosque,
  timetable, or subscription state.
- The migration is applied to staging ref `zhrucqghrqkjyzmupdyy`; production
  was not migrated.

The Quran and Daily Reflection device failures were also traced to the EAS
Hosting API origin, not to Quran audio delivery or Supabase. The old `preview`
deployment returned HTML 404s for all new route modules. A current server export
was deployed as hosting deployment `9cuik64wko`, then the existing stable
`preview` alias was reassigned to it. The production alias was inspected before
and after and remains unchanged on deployment `b5blckazxb`.

Exact `https://adhan-connect--preview.expo.app` verification passes for 114
chapters, chapter verses, reciters, single-ayah audio metadata, full-surah audio
metadata, all prayer duas, and all reflection categories. The full Quran smoke
also proves Al-Fatihah and Al-Baqarah track counts, continuous/fallback modes,
and direct byte-range access to both allowlisted Quran audio CDNs. Daily
Reflection is internal curated server data; it does not call Quran.com.

Build 10 receives the hosted API repair immediately after force-close/reopen or
Retry because it already uses the stable `preview` alias, but it does not
contain the visible 3-minute selector. Replacement internal iOS build 11
finished successfully:

- build number: `11`
- EAS build ID: `034cc7a5-8a8a-43a9-9dd7-238d78dfc467`
- install/status page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/034cc7a5-8a8a-43a9-9dd7-238d78dfc467`
- bundle identifier: `com.maksumsdigitalagency.adhanconnect.staging`
- distribution/profile: internal / `preview`
- final EAS status: `FINISHED`
- signed for all three registered physical iPhones
- production was not built, submitted, configured, or changed

Build 11 supersedes build 10 for notification acceptance and includes the
visible 3-minute selector and tap-routing copy. Compilation is not physical
acceptance; complete the matrix below, especially the paired 5-minute and
3-minute tap destinations and the two-phone LIVE canary.

Required sequence on the replacement physical build:

1. Open Muezzin → Settings → Notifications. Preferences must render or show a
   retry within eight seconds even if device registration is slow.
2. Confirm “This device” settles to Ready, Disabled, or Setup needs attention;
   it must never remain a spinner. Retry must recover a registration error.
3. Rapidly select 3, 5, 10, and 30 minutes, leave the screen, return, and
   confirm all four persist.
4. Immediately after a save, switch Muezzin → Local Admin → Listener → Muezzin.
   Confirm no spinner, redirect bounce, or nested stale route.
5. Confirm Muezzin has only operational controls. In Listener, confirm personal
   Adhan/travel controls, Guidance (Qur’an and Reflection), mosque management,
   and nearby current-area discovery remain available for the same account.
6. Change the Admin console mosque and confirm the Listener primary mosque does
   not change.
7. Set a staging prayer at least 35 minutes ahead and prove 30/10/5-minute duty
   pushes open My Rota. Confirm the 3-minute push says the LIVE window is open,
   routes to the existing broadcast screen, and allows no early start. Then
   test explicit-rota and approved-cover precedence.
8. Test foreground, background, and killed app states; push tap routing; opt-out;
   sign-out/account isolation; Listener followed-mosque LIVE; travel LIVE; and
   duplicate suppression.
9. Perform the existing two-phone LIVE start/audio/end/restart canary before
   any release decision.

Do not call this production-ready until this physical matrix passes.

### 2026-09-05 follow-up: Listener information architecture

Implemented locally after build 11; a later mobile binary is required for
physical acceptance of these visual/navigation changes:

- Replaced the five Listener destinations with four: Home, Guidance, Mosques,
  and Settings.
- Added a nested Guidance hub with accessible square cards for Qur’an, Daily
  Reflection, and Knowledge Centre. Knowledge Centre is clearly labelled
  `Coming soon` and is not presented as a working action.
- Kept legacy `/quran` and `/duas` routes available for compatibility. Current
  hub navigation uses `/guidance/quran` and `/guidance/reflection`, with a clear
  return control and the Guidance tab remaining selected.
- Moved the established-listener full nearby directory out of the top of Home.
  Primary mosque, LIVE/next prayer, and today's prayer strip now appear first.
- Added a compact Home nearby summary that shows one LIVE-first/nearest result
  and routes to the existing Mosques tab for the full experience.
- Reworked Mosques into Nearby and Following views with search. Nearby contains
  the full next-Adhan/LIVE list, directions, and mosque-detail actions.
- First-run listeners without a followed mosque retain up to three nearby
  suggestions because mosque choice is the purpose of that state.
- Location permission, current-area LIVE notification preference, and primary
  mosque remain independent; none of these navigation changes mutates a
  subscription or default mosque.

Verification: TypeScript, Expo lint, diff validation, clean iOS and web exports,
and notification/LIVE safety contracts pass. All 18 protected LIVE, broadcast,
assignment and rota file hashes remain unchanged. The in-app browser surface
was unavailable for screenshot QA, so physical visual review is required on
the next staging build.

### 2026-09-05: Web main-admin access false failure

A confirmed staging main-admin account reached RootNavigator's fail-closed
“Account access unavailable” screen after a successful web sign-in. Read-only
staging inspection proved that the Auth user was confirmed, current Auth
consent metadata was complete, the immutable consent receipt was complete, and
the public profile role was `main_admin`. The account itself was not missing or
misconfigured.

Root cause:

- `/api/session-access` unnecessarily loaded and serialised the complete mosque
  directory for every main-admin role check (1,115 staging rows at diagnosis).
- The browser allowed only 1.5 seconds for route compilation, Auth token
  validation, consent verification, role queries, muezzin resolution, database
  pagination, payload transfer, and JSON parsing.
- A normal slow/cold request therefore surfaced as an authorization failure.

Repair:

- session access now returns only role authority and explicit local-admin
  membership context; the main-admin pages retain their existing independent,
  paginated mosque-directory queries
- the security check has a dedicated 10-second absolute deadline, preserving a
  bounded fail-closed outcome without rejecting normal portal startup
- main-admin authority remains represented by `isMainAdmin`; local-admin status
  is derived only from explicit membership rather than the global directory
- the notification safety contract now asserts this bounded role-only payload

TypeScript, lint, diff validation, notification safety, and the complete LIVE
regression contract pass after the repair. The staging portal was restarted on
port 8081 for authenticated retesting. No account row, consent row, role,
production data, or LIVE behavior was changed.

### 2026-09-05: Email sign-in choice-step removal

The email sign-in screen previously showed both “Sign in” and “Create account”
after an existing user entered their email and pressed Continue. This was
enumeration-resistant, but imposed a redundant and confusing second decision.

The flow is now:

1. Enter email and press Continue.
2. Go directly to password entry for every syntactically valid email.
3. Use “Forgot password?” or “Use a different email” from that screen.

“New to Adhan Connect? Create account” is now a quiet link on the initial email
screen only. The client performs no unauthenticated account-existence lookup,
and known/unknown emails still receive indistinguishable UI and neutral auth
errors. TypeScript, lint, diff validation, and a fresh iOS bundle export pass.

### 2026-09-05: Build 12 and Guidance polish follow-up

Internal iOS staging build 12
(`25a4cf65-5506-4253-9f4c-7723d73bdb22`) completed successfully with the
staging bundle identifier and all three registered iPhones provisioned. It
contains the four-tab listener navigation, Guidance hub, full Mosques nearby
destination, and compact nearby Home summary.

Physical review then identified avoidable height, narrow-card wrapping, and a
Knowledge Centre overlap on the Guidance landing screen. The local follow-up
removes the decorative intro card, uses two complete-card working actions with
shorter copy and explicit Open affordances, and moves Knowledge Centre to a
separate full-width non-interactive Coming Soon module. Cards automatically
stack below 360-point width or above 1.2 accessibility font scale. Haptic and
screen-reader semantics are included. TypeScript, Expo lint, diff validation,
clean iOS export, and the notification safety contract pass; protected LIVE,
broadcast, assignment and rota code remains unchanged. This final visual polish
is newer than build 12 and needs a later staging build for physical acceptance.

The follow-up is now available in internal iOS staging build 13
(`819b8e41-1e38-4f13-89e2-a4847abf102e`). Its active ad hoc profile covers all
three registered iPhones. Use build 13, not build 12, for Guidance visual
acceptance. Production was not built, submitted or changed.
