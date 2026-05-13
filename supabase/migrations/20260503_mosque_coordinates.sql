-- Ensure lat/lng coordinates exist on mosques.
-- These are required for the Aladhan prayer-time auto-calculation fallback.
-- Without coordinates, getDailyPrayerTimes cannot call the Aladhan API and
-- newly onboarded mosques will show no prayer times until a schedule is uploaded.
alter table public.mosques
  add column if not exists lat  double precision;

alter table public.mosques
  add column if not exists lng  double precision;

comment on column public.mosques.lat is
  'Mosque latitude (WGS-84). Required for Aladhan calculated prayer-time fallback.';
comment on column public.mosques.lng is
  'Mosque longitude (WGS-84). Required for Aladhan calculated prayer-time fallback.';
