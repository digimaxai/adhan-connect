-- Fix update_mosque_prayer_settings: jsonb_object_length() does not exist in PostgreSQL.
-- Replace with a subquery count over jsonb_each().

create or replace function public.update_mosque_prayer_settings(
  p_mosque_id uuid,
  p_prayer_source text,
  p_prayer_calculation_method integer,
  p_prayer_school integer,
  p_prayer_time_adjustments jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if auth.uid() is null or not (
    public.is_main_admin() or public.is_local_admin_for_mosque(p_mosque_id)
  ) then
    raise exception 'Not authorised to update prayer settings for this mosque' using errcode = '42501';
  end if;
  if p_prayer_source not in ('aladhan', 'elm') then
    raise exception 'Invalid prayer source';
  end if;
  if p_prayer_calculation_method not between 0 and 99 then
    raise exception 'Invalid prayer calculation method';
  end if;
  if p_prayer_school not in (0, 1) then
    raise exception 'Invalid prayer school';
  end if;
  if jsonb_typeof(p_prayer_time_adjustments) <> 'object' then
    raise exception 'Prayer adjustments must be an object';
  end if;
  if (select count(*) from jsonb_each(p_prayer_time_adjustments)) > 5 then
    raise exception 'Prayer adjustments contain unsupported prayer names';
  end if;
  for v_key, v_value in select entry.key, entry.value from jsonb_each(p_prayer_time_adjustments) as entry
  loop
    if v_key not in ('fajr','dhuhr','asr','maghrib','isha')
      or jsonb_typeof(v_value) <> 'number'
      or (v_value::text)::numeric <> trunc((v_value::text)::numeric)
      or (v_value::text)::integer not between -30 and 30 then
      raise exception 'Invalid adjustment for %', v_key;
    end if;
  end loop;

  update public.mosques set
    prayer_source = p_prayer_source,
    prayer_calculation_method = p_prayer_calculation_method,
    prayer_school = p_prayer_school,
    prayer_time_adjustments = jsonb_build_object(
      'fajr', coalesce((p_prayer_time_adjustments->>'fajr')::integer, 0),
      'dhuhr', coalesce((p_prayer_time_adjustments->>'dhuhr')::integer, 0),
      'asr', coalesce((p_prayer_time_adjustments->>'asr')::integer, 0),
      'maghrib', coalesce((p_prayer_time_adjustments->>'maghrib')::integer, 0),
      'isha', coalesce((p_prayer_time_adjustments->>'isha')::integer, 0)
    )
  where id = p_mosque_id;
  if not found then raise exception 'Mosque not found'; end if;
end;
$$;

revoke all on function public.update_mosque_prayer_settings(uuid,text,integer,integer,jsonb) from public;
grant execute on function public.update_mosque_prayer_settings(uuid,text,integer,integer,jsonb) to authenticated;
