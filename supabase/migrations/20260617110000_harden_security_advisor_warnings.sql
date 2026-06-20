-- Harden Supabase advisor warnings without removing RPCs used by the app.
-- Live broadcast RPCs remain callable by authenticated users only.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.begin_broadcast(uuid)',
    'public.begin_broadcast_client(uuid)',
    'public.complete_broadcast(uuid, boolean)',
    'public.complete_broadcast_client(uuid, boolean)',
    'public.complete_broadcast_v2(uuid, boolean)',
    'public.enforce_follow_cap()',
    'public.enforce_sub_cap()',
    'public.get_broadcast_by_id(uuid)',
    'public.get_upcoming_broadcasts_for_user(integer)',
    'public.handle_new_auth_user()',
    'public.handle_new_auth_user_create_profile()',
    'public.is_active_mosque(uuid)',
    'public.is_active_muezzin_for_mosque(uuid)',
    'public.is_local_admin_for_mosque(uuid)',
    'public.is_main_admin()',
    'public.is_main_admin(uuid)',
    'public.is_mosque_admin_for(uuid)',
    'public.publish_mosque_reflection_plan(uuid, text, date, date, text, text[], uuid[], jsonb, jsonb)',
    'public.search_mosques(text, double precision, double precision, double precision, integer)',
    'public.set_follow_user_id_from_auth()',
    'public.set_sub_user_id_from_auth()',
    'public.st_estimatedextent(text, text)',
    'public.st_estimatedextent(text, text, text)',
    'public.st_estimatedextent(text, text, text, boolean)',
    'public.update_mosque_prayer_config(uuid, text, integer)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public', fn);
      execute format('revoke all on function %s from anon', fn);
      execute format('revoke all on function %s from authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;

do $$
declare
  fn text;
begin
  -- RPCs called by the app or legacy live-broadcast screens remain available
  -- to signed-in users. Every listed function performs its own auth/mosque check.
  foreach fn in array array[
    'public.begin_broadcast(uuid)',
    'public.begin_broadcast_client(uuid)',
    'public.complete_broadcast(uuid, boolean)',
    'public.complete_broadcast_client(uuid, boolean)',
    'public.complete_broadcast_v2(uuid, boolean)',
    'public.get_broadcast_by_id(uuid)',
    'public.get_upcoming_broadcasts_for_user(integer)',
    'public.publish_mosque_reflection_plan(uuid, text, date, date, text, text[], uuid[], jsonb, jsonb)',
    'public.search_mosques(text, double precision, double precision, double precision, integer)',
    'public.update_mosque_prayer_config(uuid, text, integer)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('grant execute on function %s to authenticated', fn);
    end if;
  end loop;

  -- Helper predicates are referenced by RLS policies. Keeping authenticated
  -- execute avoids breaking table access while anon RPC execution stays revoked.
  foreach fn in array array[
    'public.is_active_mosque(uuid)',
    'public.is_active_muezzin_for_mosque(uuid)',
    'public.is_local_admin_for_mosque(uuid)',
    'public.is_main_admin()',
    'public.is_main_admin(uuid)',
    'public.is_mosque_admin_for(uuid)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('grant execute on function %s to authenticated', fn);
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    foreach fn in array array[
      'public.handle_new_auth_user()',
      'public.handle_new_auth_user_create_profile()'
    ] loop
      if to_regprocedure(fn) is not null then
        execute format('grant execute on function %s to supabase_auth_admin', fn);
      end if;
    end loop;
  end if;
end $$;

-- Fix mutable search_path warnings. These are intentionally ALTERs so function
-- bodies and trigger bindings remain unchanged.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.update_reflection_planner_updated_at()',
    'public.enforce_mosque_admin_scope_policy()',
    'public.enforce_mosque_local_admin_policy_updates()',
    'public.complete_broadcast_v2(uuid, boolean)',
    'public.set_profiles_updated_at()',
    'public.ensure_profile_exists()',
    'public.update_mosque_daily_quotes_updated_at()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('alter function %s set search_path = public', fn);
    end if;
  end loop;
end $$;

-- Replace policies flagged for WITH CHECK (true) with equivalent scoped checks.
do $$
begin
  if to_regclass('public.adhans') is not null then
    execute 'drop policy if exists "admin_manage_adhans" on public.adhans';
    execute 'create policy "admin_manage_adhans" on public.adhans for all to authenticated using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id)) with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))';

    execute 'drop policy if exists "muezzin_update_own_mosque_adhans" on public.adhans';
    execute 'create policy "muezzin_update_own_mosque_adhans" on public.adhans for update to authenticated using (public.is_active_muezzin_for_mosque(mosque_id)) with check (public.is_active_muezzin_for_mosque(mosque_id))';
  end if;

  if to_regclass('public.muezzins') is not null then
    execute 'drop policy if exists "main_admins_full_access_muezzins" on public.muezzins';
    execute 'create policy "main_admins_full_access_muezzins" on public.muezzins for all to authenticated using (public.is_main_admin()) with check (public.is_main_admin())';
  end if;
end $$;

do $$
begin
  if to_regclass('public.recorded_adhans') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'recorded_adhans'
         and column_name = 'mosque_id'
     ) then
    execute 'drop policy if exists "admin_manage_recorded_adhans" on public.recorded_adhans';
    execute 'create policy "admin_manage_recorded_adhans" on public.recorded_adhans for all to authenticated using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id)) with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))';
  end if;
end $$;

-- Public buckets can still serve public object URLs without allowing clients
-- to list every object name in the bucket.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "recordings_public_read" on storage.objects';
  end if;
end $$;
