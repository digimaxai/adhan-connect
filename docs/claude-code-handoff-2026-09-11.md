# Claude Code Handoff — 2026-09-11

**Sessions**: Yesterday (2026-09-10, context-limited) + Today (2026-09-11)

## Summary

Resolved missing ELM prayer times on listener and muezzin surfaces via a Supabase DB cache architecture. The app was showing Aladhan fallback times instead of East London Mosque (ELM) times for the Guidance Centre mosque on EAS Hosting. Root cause: `LPT_API_KEY` (ELM API credential) could not be injected at runtime on EAS Hosting. Implemented a production-ready architectural fix with daily refresh. Also improved Muezzin My Rota screen UX.

---

## 1. ELM Prayer Times Fix (Option 2: Supabase DB Cache)

### Problem
- **What**: Guidance Centre mosque (ID: `2b434f46-fc2d-42aa-815b-bffa0a0aad26`) showed Aladhan times on listener app instead of ELM times
- **Why**: `LPT_API_KEY` not available at runtime on EAS Hosting server routes
- **Root cause**: Architectural limitation — EAS Hosting does not inject environment variables at runtime for server routes unless they were available during `expo export` via dotenv files. `LPT_API_KEY` was added to `.env.local` but not `.env.local.staging` (the file Expo reads for `APP_VARIANT=staging`). Unlike `SUPABASE_SERVICE_ROLE` (established from day 1), EAS env var injection via UI doesn't work for new variables.

### Option 1 (Rejected)
- **Attempted**: Add `LPT_API_KEY` to EAS environment as `secret` / `sensitive` / `plaintext` visibility
- **Result**: No effect. Exhausted all approaches.
- **Lesson**: EAS Hosting env var injection is tied to dotenv availability at export time, not visibility setting.

### Option 2 (Implemented) ✓
**New Architecture**:
1. **`elm_timetable` DB table** (public read, service-role write)
   - Migration: `20260911003000_elm_timetable.sql`
   - Caches ELM API response by date
   - RLS: public can read (for client-side fallback), only service role can write

2. **`fetch-elm-timetable` Edge Function**
   - File: `supabase/functions/fetch-elm-timetable/index.ts`
   - Fetches 60 days from ELM API daily
   - `LPT_API_KEY` stored as Supabase secret (not in app env)
   - Upserts rows to `elm_timetable` (no retry if cache hit)

3. **Server routes** (`app/api/prayer-times-daily+api.ts`, `app/api/admin/prayer-times-workspace+api.ts`)
   - New function: `fetchELMTimingsFromDB(supabaseAdmin, dateIso)` queries `elm_timetable` first
   - Falls back to direct `fetchELMTimes()` if cache miss
   - Zero changes to API response format

4. **Client-side** (`lib/api/prayerTimesUnified.ts`)
   - `fetchSourceTimingMaps()` queries `elm_timetable` via anon client (public read access)
   - Falls back to direct `fetchELMTimes()` (catches timeout → Aladhan)
   - No env var needed on client (DB read only)

5. **Daily Refresh Schedule**
   - Migration: `20260911004000_schedule_elm_fetch.sql`
   - `pg_cron` job at 01:00 UTC daily
   - Invokes Edge Function via `net.http_post` with service role auth

### Results
- ✓ Prayer times now resolve via `source: "auto_calculated_elm"`
- ✓ Example: Fajr 04:54 (correct ELM time), not 05:27 Aladhan
- ✓ Works on EAS Hosting without env var injection
- ✓ Client and server both query DB with fallback to ELM API
- ✓ No dependency on runtime env vars for the ELM key

### Commits
- `d90bb2f` feat: ELM timetable DB cache for server and client prayer times
- `5f529e0` chore: Schedule daily elm_timetable cache refresh via pg_cron

### Deployed
- EAS Hosting alias `preview` → deployment `ne4k8zraxs` (after seeding)

---

## 2. Muezzin My Rota Screen Improvements

### Problems Addressed
1. **Scroll burden**: Users had to scroll down to see cover request cards ("My active requests", "Open mosque cover")
2. **Unclear interaction**: Request cards looked passive; buttons weren't visually distinct
3. **Alarming messaging**: "Adhan time unavailable" made times feel broken, even when pending

### Changes

**A. Top "Current & Upcoming" Summary Banner**
- Sticky banner right below header (before rota grid)
- Shows next scheduled duty (prayer + date)
- Red badge showing action count (`myRequests.length + openRequests.length`)
- Eliminates need to scroll to see what needs attention

**B. Improved Request Card Buttons**
- **Cancel button**: Amber/yellow background + close icon (secondary action)
- **Volunteer button**: Blue background + add icon (primary action)
- Added loading spinner feedback during action
- Larger min-height (40px) for better tapability
- Improved visual contrast and clarity

**C. Better Time Messaging**
- Changed "Adhan time unavailable" → "Adhan time pending" (less alarming)
- Pending times render in amber color (vs. blue for confirmed times)
- Helps users distinguish tentative vs. confirmed adhan times

### Implementation Details
- Added `nextDuty` useMemo: finds next scheduled duty from entries
- Added `totalActionItems` useMemo: counts active + open requests
- New style tokens: `summaryBanner`, `summaryBannerLabel`, `actionBadge`, `timePending`, `rowButtonContent`
- Updated `ActionRow` component to render icons and handle busy state
- Enhanced `rowPrimaryButton` and `rowSecondaryButton` styling

### Commits
- `64f2db3` refactor: Improve Muezzin My Rota screen UX
- `7d764fd` fix: Move useMemo hooks after state declarations in my-rota

### Deployed
- EAS Hosting alias `preview` → deployment `xj850yhvmy`

---

## 3. Technical Insights & Lessons

### EAS Hosting Environment Variable Injection
- **How it works**: Metro preserves non-`EXPO_PUBLIC_` env vars as runtime lookups in server bundles
- **When it fails**: Variables only available at export time via dotenv files (`SUPABASE_SERVICE_ROLE` works because it's in `.env.local` from day 1)
- **When to use**: For established secrets that predate the build system; for new secrets, prefer Supabase secret storage + Edge Functions
- **EAS UI variables don't help**: Adding to EAS environment via UI doesn't inject at runtime for server routes on EAS Hosting (works for native builds via Expo EAS)

### Supabase DB as Cache for External APIs
- **Advantage**: Eliminate env var propagation issues, improve latency (DB read ~100ms vs. external API ~2s)
- **Pattern**: Store secrets in Supabase → Edge Function fetches → cache in table with public read access → server/client query DB, fall back to API
- **RLS**: Public read policy allows anon clients to query cache; only service role can write (via Edge Function)
- **Schedule**: `pg_cron` job at fixed time (01:00 UTC) before key time window (Fajr in London)

### Prayer Time Data Flow (Post-Fix)
1. Server route `/api/prayer-times-daily` queries `elm_timetable` first
2. If cache hit, uses cached times (fast path)
3. If cache miss, calls `fetchELMTimes()` directly (only on first deployment or stale cache)
4. Client-side `getDailyPrayerTimes()` queries `elm_timetable` via anon client (DB read)
5. If DB read fails/times out, falls back to `fetchELMTimes()` (mobile: no key → Aladhan)
6. Both server and client can work independently, no shared env var needed

---

## 4. Outstanding Items (For Codex or Next)

1. **Cache seeding on deploy**: Manual seeding via `supabase db query --linked` was required. Consider automating initial cache population in a post-deploy hook or Edge Function startup.

2. **Adhan time for staff rota**: Some entries still show "Adhan time pending" because `staff_rota.adhan_time` is null and `prayer_times` table has no rows for those dates. Long-term: ensure `prayer_times` table has coverage for all staffed dates, or auto-populate `staff_rota.adhan_time` from `prayer_times` on save.

3. **Request card modal**: Users can still tap a rota slot to open a modal and request/volunteer from there. The new summary banner is complementary; the modal flow remains unchanged.

4. **Live broadcast impact**: Confirmed zero impact on live streaming (separate RPC/control plane). Broadcast works independently.

---

## 5. Files Changed Summary

### New Files
- `supabase/migrations/20260911003000_elm_timetable.sql` — DB table + RLS
- `supabase/migrations/20260911004000_schedule_elm_fetch.sql` — pg_cron schedule
- `supabase/functions/fetch-elm-timetable/index.ts` — Edge Function

### Modified Files
- `app/api/prayer-times-daily+api.ts` — Added DB cache query (lines 99–105)
- `app/api/admin/prayer-times-workspace+api.ts` — Added DB cache query in fallback logic
- `lib/api/prayerTimesUnified.ts` — Client-side DB cache query in fallback
- `screens/muezzin/my-rota.tsx` — UX improvements (banner, button icons, messaging)

### Status
- ✓ TypeScript: `npx tsc --noEmit` passes
- ✓ Lint: `npm run lint` passes
- ✓ Deployed to EAS preview and tested live

---

## 6. Testing Checklist (For Codex)

- [ ] Listener home: Guidance Centre shows ELM times (Fajr ~04:54, not 05:27)
- [ ] Mosque detail page: Prayer times match listener home
- [ ] Muezzin My Rota: Top banner shows next duty + action count
- [ ] Muezzin request cards: Buttons have icons, amber/blue distinction
- [ ] Admin prayer times: Fallback flow works when cache is empty
- [ ] Client fallback: If DB is slow/unavailable, app still works (uses direct ELM API or Aladhan)
- [ ] Edge Function: Runs daily at 01:00 UTC (check Supabase dashboard logs)
- [ ] No regression: Main live broadcast, rota assignment, cover requests unchanged

---

## 7. Next Steps (Optional)

1. **Promote to production**: Once tested, merge `staging` → `main` and run production deploy
2. **Monitor**: Watch Supabase logs for Edge Function errors; check `elm_timetable` row count over time
3. **Extend**: Apply same pattern to other mosques using external prayer time APIs
4. **Document**: Update `lib/api/londonPrayerTimes.ts` comments to note DB cache architecture

---

**Handoff prepared by**: Claude Code  
**Date**: 2026-09-11  
**Branch**: `staging` (commits `d90bb2f`, `5f529e0`, `64f2db3`, `7d764fd`)
