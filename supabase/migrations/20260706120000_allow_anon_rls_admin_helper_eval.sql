-- Public listener reads can encounter permissive policies that reference these
-- auth-scoped helpers. Let anon evaluate them; auth.uid() is null for anon, so
-- they return false and do not grant admin/muezzin access.
--
-- Keep authenticated/service_role grants explicit so admin, muezzin, and
-- server-side live-broadcast flows continue to evaluate their existing RLS
-- policies normally.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.is_main_admin()',
    'public.is_main_admin(uuid)',
    'public.is_local_admin_for_mosque(uuid)',
    'public.is_active_muezzin_for_mosque(uuid)',
    'public.is_mosque_admin_for(uuid)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public', fn);
      execute format('grant execute on function %s to anon, authenticated, service_role', fn);
    end if;
  end loop;
end $$;
