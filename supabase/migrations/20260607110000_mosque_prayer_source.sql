-- Add prayer_source to mosques so London mosques can follow the East London Mosque
-- official timetable instead of Aladhan auto-calculation.
-- 'aladhan' (default) = use Aladhan API with the mosque's prayer_calculation_method.
-- 'elm'               = use London Prayer Times API (East London Mosque timetable, London only).
alter table public.mosques
  add column if not exists prayer_source text not null default 'aladhan';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mosques_prayer_source_check'
      and conrelid = 'public.mosques'::regclass
  ) then
    alter table public.mosques
      add constraint mosques_prayer_source_check
      check (prayer_source in ('aladhan', 'elm'));
  end if;
end;
$$;

comment on column public.mosques.prayer_source is
  'Source for auto-calculated prayer times when no manual schedule is uploaded. ''aladhan'' (default) uses the Aladhan API. ''elm'' uses the East London Mosque official timetable (London mosques only).';

-- Security-definer RPC so local admins can update their mosque''s prayer configuration
-- (prayer_source and prayer_school) without needing a broad mosques UPDATE policy.
create or replace function public.update_mosque_prayer_config(
  p_mosque_id uuid,
  p_prayer_source text,
  p_prayer_school integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_prayer_source not in ('aladhan', 'elm') then
    raise exception 'Invalid prayer_source value: %', p_prayer_source
      using errcode = 'P0001';
  end if;

  if p_prayer_school not in (0, 1) then
    raise exception 'Invalid prayer_school value: %', p_prayer_school
      using errcode = 'P0001';
  end if;

  if p_prayer_source = 'elm' and not exists (
    select 1 from public.mosques
    where id = p_mosque_id
      and lower(coalesce(city, '')) like '%london%'
  ) then
    raise exception 'East London Mosque timetable can only be selected for London mosques'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.mosque_admins
    where mosque_id = p_mosque_id
      and user_id = auth.uid()
  ) then
    raise exception 'Not authorised to update prayer configuration for this mosque'
      using errcode = 'P0001';
  end if;

  update public.mosques
  set prayer_source = p_prayer_source,
      prayer_school = p_prayer_school
  where id = p_mosque_id;
end;
$$;

grant execute on function public.update_mosque_prayer_config(uuid, text, integer) to authenticated;
grant select (prayer_source) on public.mosques to anon, authenticated;
