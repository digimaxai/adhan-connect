# Prayer Times Unification (Listener & Muezzin)

## Purpose
- Expose a single read path for prayer times that prefers the new `prayer_times` table while retaining legacy fallback.
- Keep Listener/Muezzin UI behaviour stable during migration by returning a normalized shape regardless of source.
- Prepare for later cleanup when `mosque_prayer_times` can be deprecated safely.

## Migration Strategy
- Backfill `prayer_times` from existing `mosque_prayer_times` rows (one row per mosque/date) without touching schemas or RLS.
- Inserted rows use legacy adhan times combined with the stored `prayer_date`; iqama columns remain null.
- `source_type` is set to `legacy_import` when the constraint permits (falls back to `manual` otherwise), with `generated_method`/`created_by`/`updated_by` left null and `overrides_exist` false.
- Migration is idempotent: skips any `(mosque_id, date)` already present in `prayer_times`.

## Unified API (lib/api/prayerTimesUnified.ts)
- `getDailyPrayerTimes(mosqueId, date)`: read `prayer_times` for that day; if missing, fallback to `mosque_prayer_times`. Returns normalized object:
  - `{ fajr: { adhan: Date|null, iqama: Date|null }, ... }` for all five prayers.
- `normalizePrayerTimes(row)`: helper to map DB rows to the normalized structure.
- `convertLegacyTimesToDate(prayerDate, time)`: combine legacy `date + time without tz` into a JS `Date` for downstream use.

## Fallback Behaviour (active until cleanup)
- If no `prayer_times` row exists for the date, the API returns data from `mosque_prayer_times`.
- Listener/Muezzin hooks format the normalized adhan times back to the same display strings the UI expects, so visuals stay unchanged.
- No writes are redirected; legacy table remains untouched for compatibility.

## Admin Write Path
- Admin interfaces should continue writing to `prayer_times` (policies already guard by `mosque_admins`).
- Backfill ensures legacy data is visible through the unified API without requiring admins to re-enter times.

## Future Deprecation Plan
- Monitor usage until all consumers rely on `prayer_times` rows for current dates.
- Add consistency checks (e.g., alerts when `mosque_prayer_times` has newer data than `prayer_times`).
- Once confident, remove fallback reads, then archive or drop `mosque_prayer_times` in a dedicated cleanup stage.
