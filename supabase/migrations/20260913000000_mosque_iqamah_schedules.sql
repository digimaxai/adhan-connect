-- Date-range iqamah (congregation) scheduling per mosque/prayer.
-- Lets a mosque set "Isha iqamah is 21:00 from Sept 1 to Sept 30" instead of
-- hand-editing every day, and resolves ahead of the ELM jamat fallback but
-- behind an explicit day-specific exception in prayer_times.
create table if not exists public.mosque_iqamah_schedules (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  prayer text not null check (prayer in ('fajr','dhuhr','asr','maghrib','isha')),
  iqama_time text not null check (iqama_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  start_date date not null,
  end_date date null,
  label text null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mosque_iqamah_schedules_date_order check (end_date is null or end_date >= start_date)
);

comment on table public.mosque_iqamah_schedules is
  'Local-admin defined date-range iqamah (congregation) time rules per mosque/prayer. Resolved ahead of ELM jamat auto-calc, behind an explicit day-specific prayer_times override.';
comment on column public.mosque_iqamah_schedules.iqama_time is
  'London local wall-clock "HH:MM". Converted to UTC at read time using the same Europe/London offset helper used for ELM/legacy prayer times.';
comment on column public.mosque_iqamah_schedules.end_date is
  'Null means open-ended / current rule, in effect until superseded by a new schedule or explicitly closed.';

create index if not exists mosque_iqamah_schedules_lookup_idx
  on public.mosque_iqamah_schedules (mosque_id, prayer, start_date desc);

alter table public.mosque_iqamah_schedules enable row level security;
-- No anon/authenticated SELECT policy: resolution happens server-side via
-- service-role API routes, and the admin CRUD screen reads through the RPCs
-- below (using SECURITY DEFINER), consistent with how prayer_times writes work.

create or replace function public.is_mosque_iqamah_schedule_overlapping(
  p_mosque_id uuid,
  p_prayer text,
  p_start_date date,
  p_end_date date,
  p_exclude_id uuid
) returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1 from public.mosque_iqamah_schedules s
    where s.mosque_id = p_mosque_id
      and s.prayer = p_prayer
      and (p_exclude_id is null or s.id <> p_exclude_id)
      and s.start_date <= coalesce(p_end_date, 'infinity'::date)
      and coalesce(s.end_date, 'infinity'::date) >= p_start_date
  );
$$;

create or replace function public.upsert_mosque_iqamah_schedule(
  p_id uuid,
  p_mosque_id uuid,
  p_prayer text,
  p_iqama_time text,
  p_start_date date,
  p_end_date date,
  p_label text
) returns public.mosque_iqamah_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mosque_iqamah_schedules;
begin
  if auth.uid() is null or not (
    public.is_main_admin() or public.is_local_admin_for_mosque(p_mosque_id)
  ) then
    raise exception 'Not authorised to manage iqamah schedules for this mosque' using errcode = '42501';
  end if;

  if p_prayer not in ('fajr','dhuhr','asr','maghrib','isha') then
    raise exception 'Invalid prayer';
  end if;
  if p_iqama_time !~ '^([01]\d|2[0-3]):[0-5]\d$' then
    raise exception 'Invalid iqamah time, expected HH:MM';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'End date cannot be before start date';
  end if;
  if public.is_mosque_iqamah_schedule_overlapping(p_mosque_id, p_prayer, p_start_date, p_end_date, p_id) then
    raise exception 'This date range overlaps an existing % schedule for this mosque', p_prayer using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.mosque_iqamah_schedules (
      mosque_id, prayer, iqama_time, start_date, end_date, label, created_by, updated_by
    ) values (
      p_mosque_id, p_prayer, p_iqama_time, p_start_date, p_end_date, nullif(p_label, ''), auth.uid(), auth.uid()
    ) returning * into v_row;
  else
    update public.mosque_iqamah_schedules set
      prayer = p_prayer,
      iqama_time = p_iqama_time,
      start_date = p_start_date,
      end_date = p_end_date,
      label = nullif(p_label, ''),
      updated_by = auth.uid(),
      updated_at = now()
    where id = p_id and mosque_id = p_mosque_id
    returning * into v_row;
    if not found then raise exception 'Iqamah schedule not found'; end if;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_mosque_iqamah_schedule(uuid,uuid,text,text,date,date,text) from public;
grant execute on function public.upsert_mosque_iqamah_schedule(uuid,uuid,text,text,date,date,text) to authenticated;

create or replace function public.delete_mosque_iqamah_schedule(p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mosque_id uuid;
begin
  select mosque_id into v_mosque_id from public.mosque_iqamah_schedules where id = p_id;
  if v_mosque_id is null then raise exception 'Iqamah schedule not found'; end if;
  if auth.uid() is null or not (
    public.is_main_admin() or public.is_local_admin_for_mosque(v_mosque_id)
  ) then
    raise exception 'Not authorised to manage iqamah schedules for this mosque' using errcode = '42501';
  end if;
  delete from public.mosque_iqamah_schedules where id = p_id;
end;
$$;

revoke all on function public.delete_mosque_iqamah_schedule(uuid) from public;
grant execute on function public.delete_mosque_iqamah_schedule(uuid) to authenticated;

create or replace function public.list_mosque_iqamah_schedules(p_mosque_id uuid)
returns setof public.mosque_iqamah_schedules
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (
    public.is_main_admin() or public.is_local_admin_for_mosque(p_mosque_id)
  ) then
    raise exception 'Not authorised to view iqamah schedules for this mosque' using errcode = '42501';
  end if;
  return query
    select * from public.mosque_iqamah_schedules
    where mosque_id = p_mosque_id
    order by prayer, start_date desc;
end;
$$;

revoke all on function public.list_mosque_iqamah_schedules(uuid) from public;
grant execute on function public.list_mosque_iqamah_schedules(uuid) to authenticated;
