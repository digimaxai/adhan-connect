-- Remove mosque_admins policy recursion for staff role lookups.
-- The previous select policy referenced is_local_admin_for_mosque(...)
-- from mosque_admins itself, which can recurse during RLS evaluation.

alter table public.mosque_admins enable row level security;

drop policy if exists "muezzin_select_same_mosque_admins" on public.mosque_admins;
create policy "muezzin_select_same_mosque_admins"
on public.mosque_admins
for select
to authenticated
using (
  public.is_main_admin()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.muezzins m
    where m.user_id = auth.uid()
      and m.mosque_id = mosque_admins.mosque_id
      and coalesce(m.is_active, true)
  )
);
