# Prayer Schedule Import Spec

## Goal
- Accept real mosque timetable shapes without forcing every mosque to reformat into an internal-only model.
- Normalize all accepted uploads into the canonical `prayer_times` table.
- Keep the importer flexible enough for future API/provider integrations.

## Real-World Timetable Shapes Observed
- `Beginning + Jamat`
  - Common in UK mosque monthly PDFs.
  - Example pattern: separate start/beginning times and congregational/jamaat times.
- `Adhan + Iqamah`
  - Explicit columns for both prayer start and congregation.
- `Adhan only + fixed iqamah rule`
  - Example pattern: site states prayer times are adhan times and iqamah is a fixed offset after adhan.
- `Regular + Ramadan variants`
  - Many mosques publish separate Ramadan timetables.

## Canonical Import Outcome
- Every valid row must publish to `prayer_times`.
- Current canonical published fields:
  - `date`
  - `fajr_adhan_time`, `fajr_iqama_time`
  - `dhuhr_adhan_time`, `dhuhr_iqama_time`
  - `asr_adhan_time`, `asr_iqama_time`
  - `maghrib_adhan_time`, `maghrib_iqama_time`
  - `isha_adhan_time`, `isha_iqama_time`

## Current Importer Scope
- Supported now:
  - Daily prayer timetable rows by date
  - Adhan/start/beginning times for the five daily prayers
  - Optional explicit iqama/jamaat columns for the five daily prayers
- Recognized but not yet published:
  - `sunrise`
  - `sunset`
  - `tahajjud`
  - `jummah` / `khutbah`
- When these columns are present, the importer should warn clearly instead of silently pretending they were imported.

## Required CSV Contract

### Minimum accepted shape
- `date`
- `fajr`
- `dhuhr` or `zuhr`
- `asr`
- `maghrib`
- `isha`

### Preferred full shape
- `date`
- `fajr`, `fajr_iqama`
- `dhuhr`, `dhuhr_iqama`
- `asr`, `asr_iqama`
- `maghrib`, `maghrib_iqama`
- `isha`, `isha_iqama`

## Accepted Column Aliases

### Date
- `date`
- `prayer_date`
- `day`
- `schedule_date`

### Fajr
- Adhan/start:
  - `fajr`
  - `fajr_adhan`
  - `fajr_azan`
  - `fajr_start`
- Iqama/jamaat:
  - `fajr_iqama`
  - `fajr_jamaat`
  - `fajr_jamaah`
  - `fajr_jamat`

### Dhuhr / Zuhr
- Adhan/start:
  - `dhuhr`
  - `zuhr`
  - `dhuhr_adhan`
  - `zuhr_adhan`
  - `dhuhr_azan`
  - `zuhr_azan`
- Iqama/jamaat:
  - `dhuhr_iqama`
  - `zuhr_iqama`
  - `dhuhr_jamaat`
  - `zuhr_jamaat`
  - `dhuhr_jamaah`
  - `zuhr_jamaah`

### Asr
- Adhan/start:
  - `asr`
  - `asr_adhan`
  - `asr_azan`
- Iqama/jamaat:
  - `asr_iqama`
  - `asr_jamaat`
  - `asr_jamaah`
  - `asr_jamat`

### Maghrib
- Adhan/start:
  - `maghrib`
  - `maghrib_adhan`
  - `maghrib_azan`
- Iqama/jamaat:
  - `maghrib_iqama`
  - `maghrib_jamaat`
  - `maghrib_jamaah`
  - `maghrib_jamat`

### Isha
- Adhan/start:
  - `isha`
  - `isha_adhan`
  - `isha_azan`
  - `isha_a`
- Iqama/jamaat:
  - `isha_iqama`
  - `isha_jamaat`
  - `isha_jamaah`
  - `isha_jamat`

## Supported Date Formats
- `YYYY-MM-DD`
- `DD/MM/YYYY`
- `DD-MM-YYYY`
- `DD.MM.YYYY`
- Any date string JavaScript can parse consistently

Recommendation:
- Prefer `YYYY-MM-DD` for all uploads.

## Supported Time Formats
- `05:12`
- `5:12`
- `5.12`
- `5:12 am`
- `5:12 pm`
- `17:12`

Recommendation:
- Prefer 24-hour `HH:MM` format.

## Validation Rules
- Each row must have a valid `date`.
- Each row must have valid daily prayer adhan/start times for:
  - Fajr
  - Dhuhr/Zuhr
  - Asr
  - Maghrib
  - Isha
- Missing or invalid iqama columns do not block import.
- If an iqama is earlier than its matching adhan, importer should warn.
- If prayer order appears non-sequential across the day, importer should warn.

## Recommended Mosque Admin Workflow

### Best case
- Upload the full explicit timetable:
  - adhan/start times
  - iqama/jamaat times

### Acceptable fallback
- Upload adhan/start times only.
- Then either:
  - manually add same-day iqama overrides where needed
  - or later apply mosque-level iqama offset rules once supported

## Columns That Should Be Allowed Later
- `sunrise`
- `sunset`
- `tahajjud`
- `jummah_1`
- `jummah_2`
- `jummah_khutbah`
- `hijri_day`
- `hijri_month`
- `schedule_type`
- `notes`

These should not block current import, but they should remain outside the current canonical publish path until the backend model supports them directly.

## Future API / Provider Mapping Rule
- CSV upload and API/provider sync must normalize into the same internal shape before publish.
- Provider adapters should output:
  - `date`
  - five daily adhan/start times
  - optional five daily iqama/jamaat times
  - optional metadata such as source/provider/schedule type

## Templates
- Full explicit timetable template:
  - [prayer_schedule_template_full.csv](c:/Users/hmakh/Documents/Project/adhan-connect/docs/admin/prayer_schedule_template_full.csv)
- Minimal adhan-only timetable template:
  - [prayer_schedule_template_minimal.csv](c:/Users/hmakh/Documents/Project/adhan-connect/docs/admin/prayer_schedule_template_minimal.csv)

## Current Implementation Notes
- Canonical import parser:
  - [prayerScheduleImport.ts](c:/Users/hmakh/Documents/Project/adhan-connect/lib/prayerScheduleImport.ts)
- Canonical prayer-time write path:
  - [prayerTimes.ts](c:/Users/hmakh/Documents/Project/adhan-connect/lib/api/admin/prayerTimes.ts)
- Local-admin prayer schedule workspace:
  - [index.tsx](c:/Users/hmakh/Documents/Project/adhan-connect/app/(admin)/prayer-times/index.tsx)
