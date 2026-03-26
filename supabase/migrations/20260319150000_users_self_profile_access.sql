-- Allow every authenticated user to read their own public.users row safely.
-- Keep privileged role assignment server-controlled: self-bootstrap only allows role = 'user'.

alter table public.users enable row level security;

drop policy if exists "users_select_own_profile" on public.users;
create policy "users_select_own_profile"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users_insert_own_profile_as_user" on public.users;
create policy "users_insert_own_profile_as_user"
on public.users
for insert
to authenticated
with check (
  id = auth.uid()
  and role = 'user'
);
