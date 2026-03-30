-- Remove muezzins policy recursion from client-side reads.
-- Several policies queried public.muezzins directly inside other table RLS
-- expressions. Combined with the local-admin muezzins policy, that can recurse
-- back through mosque_admins during prayer-time and rota lookups.

create or replace function public.is_active_muezzin_for_mosque(target_mosque_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.muezzins m
    where m.user_id = auth.uid()
      and m.mosque_id = target_mosque_id
      and coalesce(m.is_active, true)
  );
$$;

revoke all on function public.is_active_muezzin_for_mosque(uuid) from public;
grant execute on function public.is_active_muezzin_for_mosque(uuid) to authenticated, service_role;

alter table if exists public.mosque_admins enable row level security;
alter table if exists public.app_notifications enable row level security;
alter table if exists public.muezzin_cover_requests enable row level security;

drop policy if exists "muezzin_select_same_mosque_admins" on public.mosque_admins;
create policy "muezzin_select_same_mosque_admins"
on public.mosque_admins
for select
to authenticated
using (
  public.is_main_admin()
  or user_id = auth.uid()
  or public.is_active_muezzin_for_mosque(mosque_admins.mosque_id)
);

drop policy if exists "muezzin_insert_app_notifications" on public.app_notifications;
create policy "muezzin_insert_app_notifications"
on public.app_notifications
for insert
to authenticated
with check (
  user_id <> auth.uid()
  and mosque_id is not null
  and public.is_active_muezzin_for_mosque(app_notifications.mosque_id)
);

drop policy if exists "local_admin_select_cover_requests" on public.muezzin_cover_requests;
create policy "local_admin_select_cover_requests"
on public.muezzin_cover_requests
for select
to authenticated
using (
  public.is_main_admin()
  or public.is_local_admin_for_mosque(mosque_id)
  or requester_user_id = auth.uid()
  or volunteer_user_id = auth.uid()
  or public.is_active_muezzin_for_mosque(muezzin_cover_requests.mosque_id)
);

drop policy if exists "muezzin_insert_cover_requests" on public.muezzin_cover_requests;
create policy "muezzin_insert_cover_requests"
on public.muezzin_cover_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and original_muezzin_user_id = auth.uid()
  and public.is_active_muezzin_for_mosque(muezzin_cover_requests.mosque_id)
);

drop policy if exists "peer_volunteer_cover_requests" on public.muezzin_cover_requests;
create policy "peer_volunteer_cover_requests"
on public.muezzin_cover_requests
for update
to authenticated
using (
  status = 'open'
  and requester_user_id <> auth.uid()
  and public.is_active_muezzin_for_mosque(muezzin_cover_requests.mosque_id)
)
with check (
  volunteer_user_id = auth.uid()
  and status in ('volunteered', 'provisional_cover')
);
