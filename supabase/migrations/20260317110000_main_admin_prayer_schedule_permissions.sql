-- Move timetable publishing to main_admin while preserving local-admin manual edits.
-- Idempotent and additive: replaces broad prayer-time/import policies with role-specific ones.

create or replace function public.is_main_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'main_admin'
  );
$$;

create or replace function public.is_mosque_admin_for(target_mosque uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mosque_admins ma
    where ma.user_id = auth.uid()
      and ma.mosque_id = target_mosque
  );
$$;

alter table if exists public.prayer_times enable row level security;
alter table if exists public.prayer_schedule_imports enable row level security;
alter table if exists public.prayer_schedule_import_rows enable row level security;

drop policy if exists "local_admin_manage_prayer_times" on public.prayer_times;
drop policy if exists "local_admin_read_prayer_times" on public.prayer_times;
drop policy if exists "local_admin_insert_manual_prayer_times" on public.prayer_times;
drop policy if exists "local_admin_update_manual_prayer_times" on public.prayer_times;
drop policy if exists "local_admin_delete_prayer_times" on public.prayer_times;
drop policy if exists "main_admin_manage_prayer_times" on public.prayer_times;

create policy "local_admin_read_prayer_times"
on public.prayer_times
for select
to authenticated
using (public.is_mosque_admin_for(mosque_id));

create policy "local_admin_insert_manual_prayer_times"
on public.prayer_times
for insert
to authenticated
with check (
  public.is_mosque_admin_for(mosque_id)
  and coalesce(source_type, 'manual') = 'manual'
  and import_id is null
);

create policy "local_admin_update_manual_prayer_times"
on public.prayer_times
for update
to authenticated
using (public.is_mosque_admin_for(mosque_id))
with check (
  public.is_mosque_admin_for(mosque_id)
  and coalesce(source_type, 'manual') = 'manual'
  and import_id is null
);

create policy "local_admin_delete_prayer_times"
on public.prayer_times
for delete
to authenticated
using (public.is_mosque_admin_for(mosque_id));

create policy "main_admin_manage_prayer_times"
on public.prayer_times
for all
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());

drop policy if exists "mosque_and_main_admin_manage_prayer_schedule_imports" on public.prayer_schedule_imports;
drop policy if exists "local_admin_read_prayer_schedule_imports" on public.prayer_schedule_imports;
drop policy if exists "main_admin_manage_prayer_schedule_imports" on public.prayer_schedule_imports;

create policy "local_admin_read_prayer_schedule_imports"
on public.prayer_schedule_imports
for select
to authenticated
using (public.is_mosque_admin_for(mosque_id));

create policy "main_admin_manage_prayer_schedule_imports"
on public.prayer_schedule_imports
for all
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());

drop policy if exists "mosque_and_main_admin_manage_prayer_schedule_import_rows" on public.prayer_schedule_import_rows;
drop policy if exists "local_admin_read_prayer_schedule_import_rows" on public.prayer_schedule_import_rows;
drop policy if exists "main_admin_manage_prayer_schedule_import_rows" on public.prayer_schedule_import_rows;

create policy "local_admin_read_prayer_schedule_import_rows"
on public.prayer_schedule_import_rows
for select
to authenticated
using (public.is_mosque_admin_for(mosque_id));

create policy "main_admin_manage_prayer_schedule_import_rows"
on public.prayer_schedule_import_rows
for all
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());
