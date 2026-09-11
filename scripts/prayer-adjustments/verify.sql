do $$
declare
  v_mosque_id uuid;
  v_before_source text;
  v_before_method integer;
  v_before_school integer;
  v_before_adjustments jsonb;
  v_after jsonb;
  v_admin_id uuid;
begin
  if exists (select 1 from public.mosques where not public.is_valid_prayer_time_adjustments(prayer_time_adjustments)) then
    raise exception 'Existing mosque adjustment data failed validation';
  end if;

  select id, prayer_source, prayer_calculation_method, prayer_school, prayer_time_adjustments
    into v_mosque_id, v_before_source, v_before_method, v_before_school, v_before_adjustments
  from public.mosques where status = 'active' order by created_at limit 1;
  if v_mosque_id is null then raise exception 'No active mosque is available for verification'; end if;

  begin
    update public.mosques set prayer_time_adjustments = '{"fajr":31,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}' where id = v_mosque_id;
    raise exception 'Out-of-range adjustment was accepted';
  exception when check_violation then null;
  end;

  select id into v_admin_id from public.users where role = 'main_admin' order by created_at limit 1;
  if v_admin_id is null then raise exception 'No main admin is available for RPC verification'; end if;
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform public.update_mosque_prayer_settings(
    v_mosque_id, 'aladhan', coalesce(v_before_method, 3), 1,
    '{"fajr":-2,"dhuhr":0,"asr":1,"maghrib":2,"isha":3}'::jsonb
  );
  select prayer_time_adjustments into v_after from public.mosques where id = v_mosque_id;
  if v_after <> '{"fajr":-2,"dhuhr":0,"asr":1,"maghrib":2,"isha":3}'::jsonb then
    raise exception 'Atomic prayer-settings RPC did not persist the expected values';
  end if;

  update public.mosques set prayer_source = v_before_source,
    prayer_calculation_method = v_before_method, prayer_school = v_before_school,
    prayer_time_adjustments = v_before_adjustments where id = v_mosque_id;
end $$;

select count(*) as canonical_schedule_rows
from public.prayer_times;
