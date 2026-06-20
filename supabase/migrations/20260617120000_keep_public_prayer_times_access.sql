-- Keep anonymous prayer-time reads working after SECURITY DEFINER hardening.
-- The public prayer_times policy calls public.is_active_mosque(uuid). It only
-- needs caller-visible active mosque rows, so SECURITY INVOKER is sufficient.

do $$
begin
  if to_regprocedure('public.is_active_mosque(uuid)') is not null then
    execute 'alter function public.is_active_mosque(uuid) security invoker';
    execute 'alter function public.is_active_mosque(uuid) set search_path = public';
    execute 'revoke all on function public.is_active_mosque(uuid) from public';
    execute 'grant execute on function public.is_active_mosque(uuid) to anon, authenticated, service_role';
  end if;
end $$;
