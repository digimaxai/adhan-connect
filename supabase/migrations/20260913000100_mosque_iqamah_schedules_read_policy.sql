-- Iqamah schedules are public-readable data (like elm_timetable and
-- prayer_times), needed by the client-side fallback resolution path in
-- lib/api/prayerTimesUnified.ts when the server API isn't reachable
-- (native/mobile). Writes remain gated entirely through the SECURITY
-- DEFINER RPCs added in 20260913000000_mosque_iqamah_schedules.sql.
create policy mosque_iqamah_schedules_public_read
  on public.mosque_iqamah_schedules
  for select
  to anon, authenticated
  using (true);
