# Adhan Connect - Claude/Codex Handoff

Last audited by Codex: 2026-05-01

This file is a handoff summary for Claude.ai or any second coding agent working alongside Codex. It captures the current app shape, completed functionality, important source-of-truth files, known risks, and remaining work. Do not paste or expose values from `.env` or `.env.local`.

## Product Summary

Adhan Connect is an Expo Router + React Native + Supabase app for:

- Listeners: follow mosques, view daily prayer times, discover mosque pages, and listen to live adhans.
- Muezzins: view assigned rota slots, request or volunteer for cover, and start/end live adhan broadcasts.
- Local admins: manage mosque daily prayer times, staff rota, muezzins, and day-to-day mosque operations.
- Main admins: use a web-first command center for cross-mosque operations, user access, mosque setup, schedule imports, and live stream provider configuration.

The app is now much further along than `README-dev.md` suggests. Treat `docs/codex-worklog.md`, the current code, and this `CLAUDE.md` as fresher than the starter README files.

## Tech Stack

- Expo SDK 54, Expo Router 6, React 19, React Native 0.81.
- TypeScript strict mode with path alias `@/*`.
- Supabase Auth, PostgreSQL, RLS, server API routes via Expo Router server output.
- Audio playback via `expo-av` on native/mobile and browser `Audio` on web.
- External live audio providers are supported through playback/ingest config, especially Icecast/AzuraCast-style workflows.
- UI is mostly React Native components with shared tokens in `theme/tokens.ts`; main-admin web uses HTML/CSS-style components under `components/admin/web`.

## How To Run And Verify

Important package scripts:

- `npm run start` - Expo start.
- `npm run web` - Expo web.
- `npm run web:fast` - custom fast static web start.
- `npm run web:portal` - custom server web start for API routes.
- `npm run lint` - Expo lint.
- `npx tsc --noEmit` - TypeScript check.

Latest verification from this audit:

- `npx tsc --noEmit` passed.
- `npm run lint` failed with 3 errors and 4 warnings:
  - `app/(auth)/reset.tsx:35` has an unescaped apostrophe in JSX text.
  - `app/(muezzin)/_layout.tsx:9` missing display name for inline tabBarIcon component.
  - `app/(user)/_layout.tsx:9` missing display name for inline tabBarIcon component.
  - Warnings in `app/mosque/[id].tsx`: unused `StreamRow`, unused `fallbackTimes`, unused `resolvedId`, and missing effect deps `cityParam`/`countryParam`.

There are no test files except `scripts/create_test_users.js`; the project relies on lint/tsc and manual flow testing right now.

## Environment And Secrets

Expected env names seen in code:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_REDIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`
- `SUPABASE_ACCESS_TOKEN`
- `EXPO_PUBLIC_API_BASE_URL`

Never print actual env values. Server routes that use admin/service access require `SUPABASE_SERVICE_ROLE`. Native clients need `EXPO_PUBLIC_API_BASE_URL` or Expo dev URL resolution for API routes.

## Repo Shape

Important directories:

- `app/` - Expo Router routes, including role groups and server API routes.
- `screens/` - shared screen implementations used by route wrappers.
- `lib/` - Supabase client, auth, roles, APIs, live streaming helpers, import parsers, server access helpers.
- `components/` - shared mobile UI and admin web UI.
- `theme/tokens.ts` - design tokens.
- `docs/` - architecture docs, admin specs, worklog.
- `supabase/migrations/` and `migrations/` - SQL migrations. There is overlap between these folders.
- `archive/` - old route stack; excluded from TypeScript.

Current git note from audit: `.vscode/extensions.json` and `.vscode/settings.json` had pre-existing local modifications before this summary was added. Do not revert user/editor changes casually.

## Routing And Roles

Root routing is in `app/_layout.tsx`.

Implemented:

- Supabase Auth provider and session handling in `lib/auth.tsx`.
- Role resolution in `lib/roles.ts`, with server-first access lookup through `lib/sessionAccess.ts` and `/api/session-access`.
- Role target resolution in `lib/roleRouting.ts`.
- Dual local-admin + muezzin users are sent to `app/role-entry.tsx` to choose workspace.
- Main admins route to `/admin`.
- Local admins route to `/(admin)` / `/admin-home`.
- Muezzins route to `/(muezzin)` / `/muezzin-home`.
- Regular users route to `/listener-home`.

Auth screens are implemented:

- `app/(auth)/sign-in.tsx`
- `app/(auth)/sign-up.tsx`
- `app/(auth)/reset.tsx`
- `app/(auth)/new-password.tsx`
- `app/(auth)/callback.tsx`

## Listener/User Surface

Main routes:

- `app/(user)/listener-home.tsx` and `screens/user/index.tsx`
- `app/(user)/discover.tsx` and `screens/user/discover.tsx`
- `app/(user)/now.tsx` and `screens/user/now.tsx`
- `app/(user)/mosque/[id].tsx` and `screens/user/mosque/[id].tsx`
- `app/(user)/settings/*`

Completed functionality:

- Listener home shows a primary mosque, next prayer, today prayer times, followed mosques, and live broadcast state.
- Prayer times read through canonical helper `lib/api/prayerTimesUnified.ts`.
- Next prayer is computed across today and tomorrow via `lib/prayerTimesDisplay.ts`; avoid fake `+24h` fallbacks.
- Discovery uses Supabase RPC `search_mosques` when available, falling back to `mosques` query.
- Users can follow/unfollow mosques through `subscriptions`; UI enforces max 3 followed mosques.
- Mosque detail page shows identity, prayer times, live listen CTA, events, campaigns, announcements, recent adhan, follow state.
- Live player filters stale streams, selects followed/requested streams, auto-plays when appropriate, and stops playback if broadcast ends.
- Web playback uses browser `Audio`; native/mobile uses `expo-av`.
- Listener live playback is gated by signed `/api/live-stream-access` and `/api/live-stream-playback` URLs.

Important listener source-of-truth files:

- `screens/user/index.tsx`
- `screens/user/now.tsx`
- `screens/shared/hooks/useLiveStreamForMosque.ts`
- `lib/api/liveStreamAccess.ts`
- `lib/server/liveStreamListenerAccess.ts`
- `lib/liveStreamFreshness.ts`

## Muezzin Surface

Main routes:

- `app/(muezzin)/muezzin-home.tsx` and `screens/muezzin/user-home.tsx`
- `app/(muezzin)/my-rota.tsx` and `screens/muezzin/my-rota.tsx`
- `app/(muezzin)/live-broadcast.tsx` and `screens/muezzin/live-broadcast.tsx`
- Settings reuse user settings screens.

Completed functionality:

- Muezzin home shows assigned mosque, next adhan, live window status, today's prayer times, and today's rota.
- Schedule loading uses `lib/hooks/useMuezzinSchedule.ts` and `lib/api/muezzin/schedule.ts`.
- Assigned rota slots are highlighted; null-time placeholder slots are ignored.
- My Rota shows current week, upcoming weeks, assigned prayers, iqamah/adhan times, notes, active cover requests, open cover requests, swipe week navigation, and a modal for slot actions.
- Muezzins can create standard or urgent cover requests, cancel their own requests, and volunteer for open cover requests.
- Live broadcast screen shows readiness, provider config, playback/ingest credentials, upstream provider state, endpoint health, schedule timing, and start/end controls.
- Broadcast start/end control plane uses `lib/hooks/useLiveBroadcastEngine.ts`, `lib/api/muezzin/liveBroadcast.ts`, and `/api/muezzin/live-broadcast`.

Critical reality:

- The muezzin app currently controls live state only. It does not upload phone microphone audio.
- Real audio currently comes from AzuraCast Web DJ, Icecast, RTMP, or another external encoder.
- If muezzin marks live but listeners hear silence, first verify upstream audio in the provider player before editing listener playback.

## Local Admin Mobile Surface

Main routes:

- `app/(admin)/index.tsx`
- `app/(admin)/prayer-times/index.tsx`
- `app/(admin)/staff-rota/index.tsx`
- `app/(admin)/muezzins.tsx`
- `app/(admin)/events.tsx`
- `app/(admin)/settings.tsx`
- `app/(admin)/mosque-onboarding.tsx` for main-admin-accessible mobile setup.

Completed functionality:

- Admin dashboard chooses/uses an assigned mosque from `useAdminMosque`.
- Local admins get day-to-day tools for prayer times, staff rota, muezzins, events, and settings.
- Prayer times screen supports manual day overrides for adhan/iqamah times into `prayer_times`.
- On web as main admin, the same prayer-times route exposes bulk timetable import, preview, coverage intent, publish review, import history, and rollback.
- Staff rota screen loads prayer times, active muezzins, and existing rota for a date; admins assign muezzins per prayer and notes.
- Staff rota save creates `app_notifications` rows for assignment changes where supported.
- Muezzins screen lets local admins invite/reactivate muezzins by email, activate/deactivate/remove assignments, and resolve cover requests.

Important local admin files:

- `app/(admin)/index.tsx`
- `app/(admin)/prayer-times/index.tsx`
- `app/(admin)/staff-rota/index.tsx`
- `app/(admin)/muezzins.tsx`
- `lib/hooks/useAdminMosque.ts`
- `lib/api/admin/prayerTimes.ts`
- `lib/api/admin/prayerTimesWorkspace.ts`
- `lib/api/admin/staffRota.ts`
- `lib/api/admin/staffRotaWorkspace.ts`
- `lib/api/admin/muezzins.ts`
- `lib/api/admin/muezzinWorkspace.ts`

## Main Admin Web Portal

Main routes under `app/admin`:

- `/admin` - command center.
- `/admin/mosques` - mosque directory.
- `/admin/mosques/[id]` - mosque workspace.
- `/admin/mosques/[id]/prayer-times` - mosque-specific schedule workspace.
- `/admin/prayer-times` - prayer-times hub.
- `/admin/users` - user access management.

Completed functionality:

- Main admin portal is guarded by `components/admin/web/RequireMainAdmin.tsx`.
- Dashboard shows registered mosques, pending approvals, inactive mosques, platform users, priority queue, quick actions, search/command entry.
- Mosque directory supports search, status filter, sort, create mosque, pagination, and row actions.
- Mosque detail workspace handles mosque profile/status, staff assignments, local admin invites, muezzin invites, live stream provider settings, listener/ingest credentials, upstream provider state, and links to prayer times.
- Users page supports search, paging, global role changes (`user`/`main_admin`), local admin assignments, muezzin assignments, and removal.
- Prayer-times hub routes into one mosque workspace at a time for safer imports.

Important main-admin files:

- `app/admin/index.tsx`
- `app/admin/mosques/index.tsx`
- `app/admin/mosques/[id].tsx`
- `app/admin/users/index.tsx`
- `app/admin/prayer-times/index.tsx`
- `app/admin/mosques/[id]/prayer-times.tsx`
- `components/admin/web/*`
- `lib/admin-web/*`

## Backend And Database Model

Canonical tables used by current code:

- `users` - public profile and global role (`user`, `main_admin`; local admin/muezzin are mostly membership-derived).
- `mosques` - mosque profile, status, slug, location, timezone, live stream config.
- `mosque_admins` - local admin membership.
- `muezzins` - muezzin membership and active status.
- `prayer_times` - canonical daily adhan/iqamah rows.
- `mosque_prayer_times` - legacy/fallback prayer-time source.
- `staff_rota` - daily muezzin assignments.
- `streams` - current live state per mosque.
- `adhans` - schedule/history/live status.
- `muezzin_cover_requests` - cover workflow.
- `app_notifications` - in-app notifications for rota/cover/admin actions.
- `events`, `campaigns`, `announcements`, `subscriptions`.
- `prayer_schedule_imports` and `prayer_schedule_import_rows` - import audit/history/rollback.
- `mosque_live_stream_upstream_states` - provider callback state.

Important migrations are under both `migrations/` and `supabase/migrations/`. The `supabase/migrations/` folder includes later live-stream/provider additions. Reconcile duplicated migration folders before a clean production deployment.

Canonical backend rules:

- Listener/muezzin display should use `lib/api/prayerTimesUnified.ts`.
- `prayer_times` is canonical when present.
- `mosque_prayer_times` is fallback only.
- Staff rota can be a last-resort fallback for visible adhan times.
- Live listener state must filter stale streams/adhans through `lib/liveStreamFreshness.ts`.
- The app defensively treats live streams older than 20 minutes as stale on listener reads.

## Server API Routes

Important API route families:

- `/api/session-access` - resolves current role/access using service role.
- `/api/prayer-times-daily` - daily prayer-time payload.
- `/api/live-stream-access` - issues signed playback URL.
- `/api/live-stream-playback` - validates token and proxies/redirects to upstream.
- `/api/muezzin/live-broadcast` - muezzin live state/control plane.
- `/api/muezzin/rota-workspace` - muezzin rota payload.
- `/api/admin/prayer-times-workspace` and `/api/admin/prayer-times-save`.
- `/api/admin/staff-rota-workspace` and `/api/admin/staff-rota-save`.
- `/api/admin/muezzin-workspace`, `/api/admin/muezzin-invite`, `/api/admin/muezzin-assignment`.
- `/api/admin/local-admin-invite`, `/api/admin/local-admin-assignment`.
- `/api/admin/mosque-workspace`.
- `/api/admin/users-access`.
- `/api/integrations/live-stream-provider-status` - normalized provider callback.

Shared admin API guard:

- `lib/server/adminAccess.ts`

## Prayer-Time Import System

Implemented:

- Flexible CSV parser in `lib/prayerScheduleImport.ts`.
- Supported input shapes include Beginning + Jamat, Adhan + Iqamah, Adhan only, monthly sections with day numbers, and separate month/day columns.
- Import modes: smart auto-detect, strict explicit iqamah, adhan only, adhan plus fixed iqamah offset.
- Supports manual date context for files that only contain day numbers.
- Warns for unsupported/not-yet-published columns like sunrise, sunset, tahajjud, jummah, khutbah.
- Main-admin web publish flow includes preview, issue list, coverage intent (`single_month`, `date_range`, `full_year`), impact summary, publish confirmation, import history, and rollback.

Important docs:

- `docs/admin/prayer_schedule_import_spec.md`
- `docs/admin/role_surface_capability_matrix.md`
- `docs/system/prayer_times_unification.md`

## Prayer School Support (Sunni & Shia)

Implemented:

- **Sunni Jurisprudence**: 13 Aladhan calculation methods covering major Sunni schools globally (MWL, ISNA, Saudi, Egyptian, Pakistani, Turkish, etc.)
- **Shia Jurisprudence**: Method 7 (Tehran Institute of Geophysics) supports Twelver/Jafari calculations used in Iran and Shia communities.
- **Asr Calculation Schools**: Toggle between Shafi (1× shadow length, default) and Hanafi (2× shadow length) for Sunni mosques. Note: Hanafi is Sunni jurisprudence, common in South Asia / UK mosques.
- Admin UI now groups methods by tradition (Sunni vs Shia optgroups) for discoverability.
- Aladhan fallback calculation respects mosque's chosen method via `prayer_calculation_method` column.

Key Files:

- `lib/api/aladhan.ts` — ALADHAN_METHODS array with tradition labeling (`tradition: 'sunni' | 'shia'`)
- `lib/api/prayerTimesUnified.ts` — Prayer time resolution uses mosque's method (lines 277-279)
- `app/admin/mosques/[id].tsx` — Admin UI for method/school selection with grouped optgroups (lines 898-923)

Limitations:

- Aladhan API does not provide Shia-specific Asr jurisprudence (the `school` parameter is Sunni-only)
- **No support for combined prayer times** (Dhuhr+Asr, Maghrib+Isha) that some Shia mosques practice — workaround: admins must upload manual schedules with combined times
- No UI indication that certain methods are for Shia vs Sunni communities (labeling added, but users must read help text)

Not Implemented:

- Shia time-compression (combined prayers) UI or storage
- Complete `prayer_school_complete` enum for full jurisprudence tracking (only Asr variation tracked)
- Ismaili, Zaidi, or other Shia schools (only Twelver/Jafari via Method 7)

Recommendations for admins:

1. For Sunni mosques: choose the method matching your region/school (e.g., MWL for UK/Europe, ISNA for North America, Egyptian for North Africa)
2. For Shia (Twelver/Jafari) mosques: select "Institute of Geophysics, Tehran"
3. If prayer times don't match your mosque's actual schedule, upload a manual CSV schedule through the admin portal (takes precedence over auto-calculated times)

## Live Streaming System

Implemented:

- Provider config model in `lib/liveStreamProviders.ts` for `external`, `rtmp`, `icecast`, and `test`.
- Main admin can configure playback URL, ingest URL, mount path, username, stream key/source password, status secret, and listener secret.
- Muezzin live screen surfaces readiness, health, and copy/reveal actions.
- Listener playback uses signed short-lived URL access.
- Web delivery uses redirect for lower latency; native/mobile uses proxy for `expo-av` compatibility.
- Provider status callback exists at `/api/integrations/live-stream-provider-status`.

Not implemented:

- Phone microphone upload from the muezzin app.
- LiveKit or equivalent real-time media plane.
- Automatic source-of-truth cleanup for stale live rows; listener side filters them defensively.

## Notifications

Implemented:

- `lib/notify.ts` supports local notification permissions, Android channel creation, and local scheduled reminders.
- `lib/api/appNotifications.ts` supports in-app notification rows and read/unread state.
- Staff rota save and cover request workflows create `app_notifications` records.
- Settings notifications screen lists in-app notifications.

Still missing:

- No Expo push-token registration flow was found.
- No production push delivery pipeline was found.
- Reminder/broadcast push scheduling still needs product decisions and implementation.

## Existing Documentation

Read these before touching sensitive flows:

- `docs/codex-worklog.md` - most important current engineering log and "do not regress" rules.
- `docs/backend/live-adhan-architecture.md`
- `docs/backend/prayer_times_and_staff_rota_schema.md`
- `docs/admin/prayer_schedule_import_spec.md`
- `docs/admin/role_surface_capability_matrix.md`
- `docs/admin/db-reference-prayer-rotas.md`
- `docs/muezzin/muezzin_duties_and_assignment_logic.md`
- `docs/system/prayer_times_unification.md`
- `docs/live-stream-provider-callback.md`
- `UI_AUDIT.md`

The default `README.md` is still mostly Expo starter text and should be replaced.

## Known Duplicates And Legacy Areas

- `archive/` is legacy and excluded from TypeScript.
- Some route comments still mention `app/(tabs)` from older code.
- There are duplicate-looking route wrappers and screens between `app/`, `screens/`, and `archive/`; prefer current `app/(user)`, `app/(muezzin)`, `app/(admin)`, and `app/admin` paths.
- `app/(muezzin)/live.tsx` contains a TODO for old streaming logic and is hidden in the tab layout. Prefer `app/(muezzin)/live-broadcast.tsx`.
- `screens/admin/admin.tsx` appears legacy compared with the newer `app/(admin)/index.tsx`.
- `screens/lib/*` looks like older duplicate helpers; prefer root `lib/*`.
- `project-structure.txt` is huge and likely generated; do not rely on it as a current source of truth.

## Current Known Risks / Tech Debt

- Lint currently fails; fix before shipping.
- No automated unit/integration/E2E tests.
- Supabase generated `Database` types are not present; shared hand-written types exist under `lib/types`.
- Migration folders are duplicated (`migrations/` and `supabase/migrations/`); production migration history should be reconciled.
- Some compatibility fallback code supports old schema shapes (`staff_user_id`, `prayer`, missing `adhan_time`/`iqama_time`). Be careful before deleting.
- `lib/roles.ts` contains a hardcoded fallback user id/email for muezzin access. This should be removed or moved to proper DB-driven access before production.
- Some strings show mojibake/encoding artifacts in older files and docs. Prefer ASCII/clean UTF-8 when editing.
- `app/mosque/[id].tsx` and `screens/user/mosque/[id].tsx` have overlapping functionality; confirm which route is active before editing.
- Expo config references `assets/images/notification-icon.png`, but this file was not listed by `rg --files`; verify before building production notifications.
- The app has microphone permissions in native config, but current production flow does not actually capture/upload mic audio.

## Recommended Next Build Steps

1. Fix current lint errors and warnings.
2. Replace starter `README.md` and stale `README-dev.md` with accurate setup, env, and role-flow docs.
3. Decide live media strategy:
   - keep external encoder/AzuraCast/Icecast as production path, or
   - build app-based mic upload with LiveKit/WebRTC/RTMP bridge.
4. Add backend job or admin cleanup action to auto-end stale live rows at the source.
5. Add real test coverage:
   - pure parser tests for `lib/prayerScheduleImport.ts`;
   - unit tests for `lib/prayerTimesDisplay.ts` and `lib/api/prayerTimesUnified.ts`;
   - role-routing tests for `lib/roleRouting.ts`;
   - E2E smoke tests for sign-in, listener home, muezzin live, and admin prayer-times save.
6. Add Supabase generated types and replace broad `any`/manual table types where practical.
7. Reconcile migration folders and document the canonical Supabase deployment path.
8. Complete notifications:
   - push-token registration;
   - production push sender;
   - user preferences;
   - rota/cover/reminder delivery rules.
9. Clean legacy/duplicate routes after confirming active paths.
10. Harden main-admin and local-admin UX for production:
    - empty/error/loading states;
    - confirmation dialogs for risky writes;
    - audit surfaces for schedule imports, role changes, and live stream config changes.
11. Improve live playback instrumentation:
    - explicit errors for upstream silent/offline;
    - listener-side debug panel in dev;
    - provider health checks that distinguish playback URL, ingest URL, and upstream encoder state.
12. Build production onboarding:
    - mosque registration/approval path;
    - local admin invite acceptance;
    - muezzin invite acceptance;
    - first timetable import wizard.

## Agent Working Rules

- Before changing prayer-time, rota, live state, or playback logic, read `docs/codex-worklog.md`.
- Prefer current code paths listed in this file over legacy routes/screens.
- Do not change `.env`, `.env.local`, or print their values.
- Do not revert unrelated user changes.
- Keep listener and muezzin prayer-time display aligned through `getDailyPrayerTimes`.
- Keep muezzin live control plane separate from audio media plane unless intentionally implementing a new media architecture.
- When modifying prayer-time calculations or fallback logic: test with BOTH Sunni mosques (Methods 1-6, 8-15) and Shia mosques (Method 7) to ensure no regression. Shia support via Tehran method is available but undocumented in prior versions — do not break it.
- Run at minimum `npx tsc --noEmit` and `npm run lint` after code changes.
