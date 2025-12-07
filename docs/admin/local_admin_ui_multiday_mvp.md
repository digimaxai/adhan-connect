# Local Admin UI (Multi-Day Prayer Times + Staff Rota) – MVP

## Feature Overview
- Admin Home now links to two flows: **Manage Prayer Times** and **Manage Staff Rota**.
- Both flows are date-aware (past/today/future) via a shared date selector with arrows and calendar picker.
- Prayer Times: view/edit adhan and iqama for Fajr/Dhuhr/Asr/Maghrib/Isha per day, then save (upsert) to `prayer_times`.
- Staff Rota: assign muezzins per prayer using the day’s prayer times; saves to `staff_rota`.
- All changes are admin-only, listener/muezzin UI untouched.

## Date Selector Behavior
- UI: `◀ 19 Feb 2025 ▶ [📅]`
- Left/right arrows shift the active date by one day.
- Calendar button opens a modal date picker to jump to any date.
- Reused across Prayer Times and Staff Rota screens.

## Data Flow (Prayer Times)
1) Admin landing → “Manage Prayer Times”.
2) Screen fetches admin’s mosque (from `mosque_admins`) and prayer_times for the selected date.
3) If none exist, a blank local form is shown.
4) Edits are local until “Save Changes”.
5) Save upserts `prayer_times` with updated_by and overrides_exist = true.

## Data Flow (Staff Rota)
1) Admin landing → “Manage Staff Rota”.
2) Screen fetches admin’s mosque, then:
   - Loads `prayer_times` for the date (required to proceed).
   - Loads active muezzins from `muezzins` for the mosque.
   - Loads existing `staff_rota` entries for that date.
3) If prayer_times missing: inputs disabled with guidance to create times first.
4) Assign muezzin per prayer (optional notes); adhan/iqama times are displayed from `prayer_times`.
5) Save upserts `staff_rota` rows for that date/prayer.

## Screenshots (placeholders)
- Admin Home: cards for Prayer Times / Staff Rota.
- Prayer Times: date selector + list of prayers with Adhan/Iqama time pickers + save CTA.
- Staff Rota: date selector + prayer rows with times, muezzin selector, notes + save CTA.

## Future Web Dashboard Expansion
- Add mosque selection dropdown (if multiple admin mosques).
- Bulk date ranges and CSV import/export per day.
- Notification hooks to alert muezzins when assigned/changed.
- Inline validation for overlapping times or missing iqama entries.

## Notes
- No schema changes beyond Stage A tables; all API calls use `prayer_times` and `staff_rota`.
- RLS respected via Supabase; admin reads/writes guarded by `mosque_admins`.
- Listener and muezzin surfaces remain unchanged.***
