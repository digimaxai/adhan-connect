-- Resolve Supabase linter findings for a security-definer view and exposed public tables.
-- Keep the fix forward-only and additive to avoid changing application behaviour unexpectedly.

create or replace view public.live_adhan_admins
with (security_invoker = true)
as
select u.id
from public.users u
where u.role in ('local_admin', 'main_admin');

alter view if exists public.live_adhan_admins
  set (security_invoker = true);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.can_read_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with viewer_mosques as (
    select ma.mosque_id
    from public.mosque_admins ma
    where ma.user_id = auth.uid()

    union

    select m.mosque_id
    from public.muezzins m
    where m.user_id = auth.uid()
      and coalesce(m.is_active, true)
  ),
  target_mosques as (
    select ma.mosque_id
    from public.mosque_admins ma
    where ma.user_id = target_user_id

    union

    select m.mosque_id
    from public.muezzins m
    where m.user_id = target_user_id
  )
  select
    auth.uid() is not null
    and (
      target_user_id = auth.uid()
      or public.is_main_admin()
      or exists (
        select 1
        from viewer_mosques vm
        join target_mosques tm on tm.mosque_id = vm.mosque_id
      )
    );
$$;

revoke all on function private.can_read_profile(uuid) from public;
grant execute on function private.can_read_profile(uuid) to authenticated, service_role;

alter table if exists public.profiles enable row level security;

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "profiles_select_shared_mosque" on public.profiles';
    execute '
      create policy "profiles_select_shared_mosque"
      on public.profiles
      for select
      to authenticated
      using (private.can_read_profile(id))
    ';
  end if;
end $$;

do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    begin
      execute 'alter table public.spatial_ref_sys enable row level security';
      execute 'drop policy if exists "spatial_ref_sys_public_read_only" on public.spatial_ref_sys';
      execute '
        create policy "spatial_ref_sys_public_read_only"
        on public.spatial_ref_sys
        for select
        to anon, authenticated
        using (true)
      ';
    exception
      when insufficient_privilege then
        raise notice
          'Could not enable RLS on public.spatial_ref_sys. On hosted Supabase projects, PostGIS installed in public is typically owned by supabase_admin. Move PostGIS to a non-exposed schema (recommended) or ask Supabase Support to perform the relocation.';
    end;
  end if;
end $$;
