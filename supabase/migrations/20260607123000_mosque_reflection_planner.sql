-- Reflection Planner Lite: mosque-owned reusable content, publishable schedules, and generated occurrences.
-- The listener MVP continues to read public.mosque_daily_quotes for the home Daily Reflection card.

create table if not exists public.mosque_reflection_items (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  content_type text not null default 'reflection'
    check (content_type in ('quran', 'dua', 'reflection', 'asma', 'hadith', 'custom')),
  title text not null check (char_length(trim(title)) >= 2),
  text_en text not null check (char_length(trim(text_en)) >= 5),
  text_ar text,
  transliteration text,
  source text,
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mosque_reflection_items_mosque_status_idx
  on public.mosque_reflection_items (mosque_id, status, content_type, created_at desc);
create table if not exists public.mosque_reflection_schedules (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  start_date date not null,
  end_date date not null,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'fridays')),
  target_prayers text[] not null default '{home}'
    check (target_prayers <@ array['home', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah']::text[]),
  item_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (coalesce(array_length(item_ids, 1), 0) > 0)
);
create index if not exists mosque_reflection_schedules_mosque_status_idx
  on public.mosque_reflection_schedules (mosque_id, status, start_date desc);
create table if not exists public.mosque_reflection_occurrences (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  schedule_id uuid not null references public.mosque_reflection_schedules(id) on delete cascade,
  reflection_item_id uuid not null references public.mosque_reflection_items(id) on delete restrict,
  occurrence_date date not null,
  target_prayer text not null default 'home'
    check (target_prayer in ('home', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah')),
  created_at timestamptz not null default now(),
  unique (schedule_id, occurrence_date, target_prayer)
);
create index if not exists mosque_reflection_occurrences_mosque_date_idx
  on public.mosque_reflection_occurrences (mosque_id, occurrence_date, target_prayer);
alter table public.mosque_reflection_items enable row level security;
alter table public.mosque_reflection_schedules enable row level security;
alter table public.mosque_reflection_occurrences enable row level security;
grant select, insert, update, delete on public.mosque_reflection_items to authenticated;
grant select, insert, update, delete on public.mosque_reflection_schedules to authenticated;
grant select, insert, update, delete on public.mosque_reflection_occurrences to authenticated;
drop policy if exists "Local admins read mosque reflection items" on public.mosque_reflection_items;
create policy "Local admins read mosque reflection items"
  on public.mosque_reflection_items
  for select
  to authenticated
  using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins insert mosque reflection items" on public.mosque_reflection_items;
create policy "Local admins insert mosque reflection items"
  on public.mosque_reflection_items
  for insert
  to authenticated
  with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins update mosque reflection items" on public.mosque_reflection_items;
create policy "Local admins update mosque reflection items"
  on public.mosque_reflection_items
  for update
  to authenticated
  using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
  with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins delete mosque reflection items" on public.mosque_reflection_items;
create policy "Local admins delete mosque reflection items"
  on public.mosque_reflection_items
  for delete
  to authenticated
  using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins read mosque reflection schedules" on public.mosque_reflection_schedules;
create policy "Local admins read mosque reflection schedules"
  on public.mosque_reflection_schedules
  for select
  to authenticated
  using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins insert mosque reflection schedules" on public.mosque_reflection_schedules;
create policy "Local admins insert mosque reflection schedules"
  on public.mosque_reflection_schedules
  for insert
  to authenticated
  with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins update mosque reflection schedules" on public.mosque_reflection_schedules;
create policy "Local admins update mosque reflection schedules"
  on public.mosque_reflection_schedules
  for update
  to authenticated
  using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))
  with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins delete mosque reflection schedules" on public.mosque_reflection_schedules;
create policy "Local admins delete mosque reflection schedules"
  on public.mosque_reflection_schedules
  for delete
  to authenticated
  using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins read mosque reflection occurrences" on public.mosque_reflection_occurrences;
create policy "Local admins read mosque reflection occurrences"
  on public.mosque_reflection_occurrences
  for select
  to authenticated
  using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins insert mosque reflection occurrences" on public.mosque_reflection_occurrences;
create policy "Local admins insert mosque reflection occurrences"
  on public.mosque_reflection_occurrences
  for insert
  to authenticated
  with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
drop policy if exists "Local admins delete mosque reflection occurrences" on public.mosque_reflection_occurrences;
create policy "Local admins delete mosque reflection occurrences"
  on public.mosque_reflection_occurrences
  for delete
  to authenticated
  using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id));
create or replace function public.update_reflection_planner_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists mosque_reflection_items_updated_at on public.mosque_reflection_items;
create trigger mosque_reflection_items_updated_at
  before update on public.mosque_reflection_items
  for each row execute function public.update_reflection_planner_updated_at();
drop trigger if exists mosque_reflection_schedules_updated_at on public.mosque_reflection_schedules;
create trigger mosque_reflection_schedules_updated_at
  before update on public.mosque_reflection_schedules
  for each row execute function public.update_reflection_planner_updated_at();
create or replace function public.publish_mosque_reflection_plan(
  p_mosque_id uuid,
  p_title text,
  p_start_date date,
  p_end_date date,
  p_frequency text,
  p_target_prayers text[],
  p_item_ids uuid[],
  p_occurrences jsonb,
  p_daily_quotes jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_id uuid;
  v_occurrences jsonb := coalesce(p_occurrences, '[]'::jsonb);
  v_daily_quotes jsonb := coalesce(p_daily_quotes, '[]'::jsonb);
begin
  if not (public.is_main_admin() or public.is_local_admin_for_mosque(p_mosque_id)) then
    raise exception 'Not authorised to publish reflection plans for this mosque'
      using errcode = 'P0001';
  end if;

  if p_frequency not in ('daily', 'weekly', 'fridays') then
    raise exception 'Invalid reflection frequency: %', p_frequency
      using errcode = 'P0001';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date must be on or after start date'
      using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_item_ids, 1), 0) = 0 then
    raise exception 'At least one reflection item is required'
      using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_target_prayers, 1), 0) = 0
     or not (p_target_prayers <@ array['home', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah']::text[]) then
    raise exception 'Invalid reflection targets'
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_occurrences) <> 'array' or jsonb_typeof(v_daily_quotes) <> 'array' then
    raise exception 'Reflection publish payload must use JSON arrays'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(p_item_ids) as requested(item_id)
    left join public.mosque_reflection_items item
      on item.id = requested.item_id
     and item.mosque_id = p_mosque_id
     and item.status = 'active'
    where item.id is null
  ) then
    raise exception 'One or more reflection items are not active for this mosque'
      using errcode = 'P0001';
  end if;

  insert into public.mosque_reflection_schedules (
    mosque_id,
    title,
    start_date,
    end_date,
    frequency,
    target_prayers,
    item_ids,
    status,
    published_at,
    created_by,
    updated_by
  ) values (
    p_mosque_id,
    trim(p_title),
    p_start_date,
    p_end_date,
    p_frequency,
    p_target_prayers,
    p_item_ids,
    'published',
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_schedule_id;

  insert into public.mosque_reflection_occurrences (
    mosque_id,
    schedule_id,
    reflection_item_id,
    occurrence_date,
    target_prayer
  )
  select
    p_mosque_id,
    v_schedule_id,
    occurrence.reflection_item_id,
    occurrence.occurrence_date,
    occurrence.target_prayer
  from jsonb_to_recordset(v_occurrences) as occurrence(
    reflection_item_id uuid,
    occurrence_date date,
    target_prayer text
  )
  where occurrence.reflection_item_id = any(p_item_ids)
    and occurrence.target_prayer = any(p_target_prayers);

  insert into public.mosque_daily_quotes (
    mosque_id,
    quote_date,
    text_en,
    text_ar,
    source
  )
  select
    p_mosque_id,
    daily.quote_date,
    daily.text_en,
    nullif(daily.text_ar, ''),
    nullif(daily.source, '')
  from jsonb_to_recordset(v_daily_quotes) as daily(
    quote_date date,
    text_en text,
    text_ar text,
    source text
  )
  where char_length(trim(daily.text_en)) >= 5
  on conflict (mosque_id, quote_date)
  do update set
    text_en = excluded.text_en,
    text_ar = excluded.text_ar,
    source = excluded.source,
    updated_at = now();

  return v_schedule_id;
end;
$$;
grant execute on function public.publish_mosque_reflection_plan(
  uuid,
  text,
  date,
  date,
  text,
  text[],
  uuid[],
  jsonb,
  jsonb
) to authenticated;
