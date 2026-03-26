-- Replace legacy staff_rota/prayer_times local-admin policies that query mosque_admins
-- directly. Use the security-definer helper instead so local-admin writes do not recurse
-- through mosque_admins RLS during client-side operations.

alter table if exists public.prayer_times enable row level security;
alter table if exists public.staff_rota enable row level security;

drop policy if exists "local_admin_manage_prayer_times" on public.prayer_times;
create policy "local_admin_manage_prayer_times"
on public.prayer_times
for all
to authenticated
using (
  public.is_main_admin()
  or public.is_local_admin_for_mosque(mosque_id)
)
with check (
  public.is_main_admin()
  or public.is_local_admin_for_mosque(mosque_id)
);

drop policy if exists "local_admin_manage_staff_rota" on public.staff_rota;
create policy "local_admin_manage_staff_rota"
on public.staff_rota
for all
to authenticated
using (
  public.is_main_admin()
  or public.is_local_admin_for_mosque(mosque_id)
)
with check (
  public.is_main_admin()
  or public.is_local_admin_for_mosque(mosque_id)
);
