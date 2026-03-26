-- Allow listeners and unauthenticated visitors to read canonical prayer times
-- for active mosques. This keeps follower surfaces aligned with uploaded
-- timetables instead of falling back to placeholder times.

alter table if exists public.prayer_times enable row level security;

drop policy if exists "public_read_active_mosque_prayer_times" on public.prayer_times;
create policy "public_read_active_mosque_prayer_times"
on public.prayer_times
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.mosques m
    where m.id = prayer_times.mosque_id
      and coalesce(m.status, 'pending') = 'active'
  )
);
