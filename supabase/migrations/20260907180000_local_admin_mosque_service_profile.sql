-- Local admins know their own mosque's prayer availability and services
-- offered better than main admins, but the mosques table UPDATE policy is
-- main-admin-only (main_admin_update_mosques). Rather than widen that row-
-- level policy — which would let a local admin touch unrelated fields like
-- slug, status, or live-stream credentials via a direct table call — this
-- RPC exposes just the three columns already involved in the main-admin
-- "About & Contact" editor: services, prayers_not_offered, and
-- prayers_not_offered_reasons.
create function public.set_mosque_service_profile(
  p_mosque_id uuid,
  p_services text[],
  p_prayers_not_offered text[],
  p_prayers_not_offered_reasons jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare v_prayer text; v_service text; v_reason text;
begin
  if auth.uid() is null or not coalesce(public.is_main_admin() or public.is_local_admin_for_mosque(p_mosque_id), false) then
    raise exception 'Mosque admin access required';
  end if;

  if p_prayers_not_offered is not null then
    foreach v_prayer in array p_prayers_not_offered loop
      if v_prayer not in ('fajr','dhuhr','asr','maghrib','isha') then
        raise exception 'Invalid prayer: %', v_prayer;
      end if;
      v_reason := p_prayers_not_offered_reasons ->> v_prayer;
      if v_reason is null or length(btrim(v_reason)) not between 1 and 500 then
        raise exception 'Enter a reason between 1 and 500 characters for %', v_prayer;
      end if;
    end loop;
  end if;

  if p_services is not null then
    if array_length(p_services, 1) > 40 then raise exception 'Too many services selected'; end if;
    foreach v_service in array p_services loop
      if length(btrim(v_service)) = 0 or length(v_service) > 100 then
        raise exception 'Each service must be between 1 and 100 characters';
      end if;
    end loop;
  end if;

  update public.mosques set
    services = nullif(p_services, array[]::text[]),
    prayers_not_offered = nullif(p_prayers_not_offered, array[]::text[]),
    prayers_not_offered_reasons = (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      from jsonb_each(coalesce(p_prayers_not_offered_reasons, '{}'::jsonb))
      where key = any(coalesce(p_prayers_not_offered, array[]::text[]))
    ),
    updated_at = now()
  where id = p_mosque_id;
end $$;

revoke all on function public.set_mosque_service_profile(uuid, text[], text[], jsonb) from public;
grant execute on function public.set_mosque_service_profile(uuid, text[], text[], jsonb) to authenticated;
