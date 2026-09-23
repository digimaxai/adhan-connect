alter table public.mosques add column prayers_not_offered_reasons jsonb not null default '{}'::jsonb;
alter table public.mosques add constraint prayer_reasons_object check (jsonb_typeof(prayers_not_offered_reasons) = 'object');
grant select (prayers_not_offered_reasons) on public.mosques to anon, authenticated;

create function public.set_prayer_unavailability_reason(p_mosque_id uuid, p_prayer text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare exclusions text[];
begin
  if auth.uid() is null or not coalesce(public.is_main_admin() or public.is_local_admin_for_mosque(p_mosque_id), false) then
    raise exception 'Mosque admin access required';
  end if;
  if p_prayer is null or p_prayer not in ('fajr','dhuhr','asr','maghrib','isha') then raise exception 'Invalid prayer'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'Enter a reason between 1 and 500 characters'; end if;
  select prayers_not_offered into exclusions from public.mosques where id = p_mosque_id for update;
  if not found or not coalesce(p_prayer = any(exclusions), false) then raise exception 'This prayer is not marked as unavailable'; end if;
  update public.mosques set prayers_not_offered_reasons = jsonb_set(prayers_not_offered_reasons, array[p_prayer], to_jsonb(btrim(p_reason))) where id = p_mosque_id;
end $$;
revoke all on function public.set_prayer_unavailability_reason(uuid,text,text) from public;
grant execute on function public.set_prayer_unavailability_reason(uuid,text,text) to authenticated;
