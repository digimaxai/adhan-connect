-- Membership-derived mosque-scoped roles:
-- keep public.users.role for global access only, and let local_admin/muezzin
-- resolve from mosque membership tables.

alter table public.muezzins enable row level security;
alter table public.mosque_admins enable row level security;

drop policy if exists "user_select_own_muezzin_assignments" on public.muezzins;
create policy "user_select_own_muezzin_assignments"
on public.muezzins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_select_own_mosque_admin_assignments" on public.mosque_admins;
create policy "user_select_own_mosque_admin_assignments"
on public.mosque_admins
for select
to authenticated
using (user_id = auth.uid());

update public.users
set role = 'user'
where role::text in ('local_admin', 'muezzin');
