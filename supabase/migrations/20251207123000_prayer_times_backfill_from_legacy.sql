-- Backfill prayer_times from mosque_prayer_times (legacy) without altering existing tables or policies.
-- Idempotent and additive: inserts only when a (mosque_id, date) row is missing in prayer_times.

with desired_source as (
  select
    exists (
      select 1
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      where t.relname = 'prayer_times'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%legacy_import%'
    ) as allow_legacy
)
insert into prayer_times (
  mosque_id,
  date,
  fajr_adhan_time,
  dhuhr_adhan_time,
  asr_adhan_time,
  maghrib_adhan_time,
  isha_adhan_time,
  fajr_iqama_time,
  dhuhr_iqama_time,
  asr_iqama_time,
  maghrib_iqama_time,
  isha_iqama_time,
  source_type,
  generated_method,
  overrides_exist,
  created_by,
  updated_by
)
select
  mpt.mosque_id,
  mpt.prayer_date as date,
  (mpt.prayer_date || ' ' || mpt.fajr::text)::timestamptz,
  (mpt.prayer_date || ' ' || mpt.dhuhr::text)::timestamptz,
  (mpt.prayer_date || ' ' || mpt.asr::text)::timestamptz,
  (mpt.prayer_date || ' ' || mpt.maghrib::text)::timestamptz,
  (mpt.prayer_date || ' ' || mpt.isha::text)::timestamptz,
  null::timestamptz,
  null::timestamptz,
  null::timestamptz,
  null::timestamptz,
  null::timestamptz,
  case when ds.allow_legacy then 'legacy_import' else 'manual' end,
  null,
  false,
  null,
  null
from mosque_prayer_times mpt
cross join desired_source ds
where not exists (
  select 1
  from prayer_times pt
  where pt.mosque_id = mpt.mosque_id
    and pt.date = mpt.prayer_date
);
