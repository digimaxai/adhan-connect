-- Track which of the five daily prayers are not held at this location.
-- Community centres that hold Jumu'ah but not, e.g., Fajr congregation
-- can mark those prayers so listeners see accurate info rather than blank times.

alter table public.mosques
  add column if not exists prayers_not_offered text[];

grant select(prayers_not_offered) on table public.mosques to anon;
grant select(prayers_not_offered) on table public.mosques to authenticated;
