-- Ensure main_admins can manage mosques, assignments, and read users
create or replace function public.is_main_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = 'main_admin'
  );
$$;

alter table public.mosques enable row level security;

drop policy if exists "main_admin_select_mosques" on public.mosques;
create policy "main_admin_select_mosques"
on public.mosques
for select
to authenticated
using (public.is_main_admin());

drop policy if exists "main_admin_insert_mosques" on public.mosques;
create policy "main_admin_insert_mosques"
on public.mosques
for insert
to authenticated
with check (public.is_main_admin());

drop policy if exists "main_admin_update_mosques" on public.mosques;
create policy "main_admin_update_mosques"
on public.mosques
for update
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());

drop policy if exists "main_admin_delete_mosques" on public.mosques;
create policy "main_admin_delete_mosques"
on public.mosques
for delete
to authenticated
using (public.is_main_admin());

alter table public.users enable row level security;

drop policy if exists "main_admin_select_users" on public.users;
create policy "main_admin_select_users"
on public.users
for select
to authenticated
using (public.is_main_admin());

alter table public.mosque_admins enable row level security;

drop policy if exists "main_admin_select_mosque_admins" on public.mosque_admins;
create policy "main_admin_select_mosque_admins"
on public.mosque_admins
for select
to authenticated
using (public.is_main_admin());

drop policy if exists "main_admin_insert_mosque_admins" on public.mosque_admins;
create policy "main_admin_insert_mosque_admins"
on public.mosque_admins
for insert
to authenticated
with check (public.is_main_admin());

drop policy if exists "main_admin_delete_mosque_admins" on public.mosque_admins;
create policy "main_admin_delete_mosque_admins"
on public.mosque_admins
for delete
to authenticated
using (public.is_main_admin());

alter table public.muezzins enable row level security;

drop policy if exists "main_admin_select_muezzins" on public.muezzins;
create policy "main_admin_select_muezzins"
on public.muezzins
for select
to authenticated
using (public.is_main_admin());

drop policy if exists "main_admin_insert_muezzins" on public.muezzins;
create policy "main_admin_insert_muezzins"
on public.muezzins
for insert
to authenticated
with check (public.is_main_admin());

drop policy if exists "main_admin_update_muezzins" on public.muezzins;
create policy "main_admin_update_muezzins"
on public.muezzins
for update
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());

drop policy if exists "main_admin_delete_muezzins" on public.muezzins;
create policy "main_admin_delete_muezzins"
on public.muezzins
for delete
to authenticated
using (public.is_main_admin());
