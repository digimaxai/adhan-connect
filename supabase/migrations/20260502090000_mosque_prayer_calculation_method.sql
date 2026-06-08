-- Add Aladhan calculation method configuration to mosques.
-- Used as the last-resort fallback in getDailyPrayerTimes when no stored
-- prayer times exist for a mosque+date. Default 3 = Muslim World League (MWL).
-- See https://aladhan.com/calculation-methods for the full method list.
alter table public.mosques
  add column if not exists prayer_calculation_method integer not null default 3;

comment on column public.mosques.prayer_calculation_method is
  'Aladhan calculation method ID used as fallback when no manual prayer times are stored. Default 3 = Muslim World League. See https://aladhan.com/calculation-methods';

grant select (prayer_calculation_method) on public.mosques to anon, authenticated;
