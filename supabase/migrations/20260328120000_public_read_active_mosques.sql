-- Allow listener surfaces to read active mosques directly and make the public
-- prayer-times policy independent of mosques table RLS.

create or replace function public.is_active_mosque(target_mosque_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mosques m
    where m.id = target_mosque_id
      and coalesce(m.status, 'pending') = 'active'
  );
$$;

revoke all on function public.is_active_mosque(uuid) from public;
grant execute on function public.is_active_mosque(uuid) to anon, authenticated, service_role;

alter table if exists public.mosques enable row level security;
alter table if exists public.prayer_times enable row level security;

drop policy if exists "public_read_active_mosques" on public.mosques;
create policy "public_read_active_mosques"
on public.mosques
for select
to anon, authenticated
using (coalesce(status, 'pending') = 'active');

drop policy if exists "public_read_active_mosque_prayer_times" on public.prayer_times;
create policy "public_read_active_mosque_prayer_times"
on public.prayer_times
for select
to anon, authenticated
using (public.is_active_mosque(prayer_times.mosque_id));
