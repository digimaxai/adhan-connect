-- Adhan broadcast + reminder scaffolding for Supabase
-- Run this in your Supabase SQL editor.

-- Ensure mosques carry a timezone
alter table if exists mosques
  add column if not exists time_zone text not null default 'UTC';

-- Core table to track each prayer broadcast window
create table if not exists adhan_broadcasts (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references mosques(id) on delete cascade,
  prayer text not null check (prayer in ('fajr','dhuhr','asr','maghrib','isha')),
  scheduled_for timestamptz not null,
  status text not null check (status in ('scheduled','live','completed','missed','cancelled')) default 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  started_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (mosque_id, prayer, scheduled_for)
);

create index if not exists idx_adhan_broadcasts_mosque_scheduled
  on adhan_broadcasts (mosque_id, scheduled_for);
create index if not exists idx_adhan_broadcasts_status_scheduled
  on adhan_broadcasts (status, scheduled_for);

alter table adhan_broadcasts enable row level security;

-- Helper: convert local time to UTC based on mosque timezone
create or replace function tz_local_to_utc(p_date date, p_time time, p_tz text)
returns timestamptz
language sql immutable as $$
  select (p_date + p_time) at time zone p_tz at time zone 'UTC';
$$;

-- Generate broadcast rows from mosque_prayer_times for a date
create or replace function enqueue_adhans_for_day(p_mosque uuid, p_date date)
returns void
language plpgsql
as $$
declare
  pt record;
  tz text;
begin
  select time_zone into tz from mosques where id = p_mosque;
  select * into pt from mosque_prayer_times where mosque_id = p_mosque and prayer_date = p_date;
  if not found then return; end if;

  insert into adhan_broadcasts (mosque_id, prayer, scheduled_for)
  values
    (p_mosque, 'fajr', tz_local_to_utc(p_date, pt.fajr, tz)),
    (p_mosque, 'dhuhr', tz_local_to_utc(p_date, pt.dhuhr, tz)),
    (p_mosque, 'asr', tz_local_to_utc(p_date, pt.asr, tz)),
    (p_mosque, 'maghrib', tz_local_to_utc(p_date, pt.maghrib, tz)),
    (p_mosque, 'isha', tz_local_to_utc(p_date, pt.isha, tz))
  on conflict (mosque_id, prayer, scheduled_for) do nothing;
end;
$$;

-- Start broadcast: membership + status guard
create or replace function begin_broadcast(p_broadcast_id uuid)
returns adhan_broadcasts
language plpgsql
security definer
as $$
declare
  b adhan_broadcasts;
begin
  select * into b from adhan_broadcasts where id = p_broadcast_id for update;
  if not found then
    raise exception 'Broadcast not found';
  end if;

  if b.status <> 'scheduled' then
    raise exception 'Broadcast not in startable state';
  end if;

  if not exists (
    select 1 from muezzins m where m.user_id = auth.uid() and m.mosque_id = b.mosque_id and m.is_active = true
  ) then
    raise exception 'Not authorized to start' using errcode = '42501';
  end if;

  update adhan_broadcasts
    set status = 'live',
        started_by = auth.uid(),
        started_at = now(),
        updated_at = now()
  where id = b.id
  returning * into b;

  return b;
end;
$$;

-- Complete/miss broadcast
create or replace function complete_broadcast(p_broadcast_id uuid, mark_missed boolean default false)
returns adhan_broadcasts
language plpgsql
security definer
as $$
declare
  b adhan_broadcasts;
begin
  select * into b from adhan_broadcasts where id = p_broadcast_id for update;
  if not found then
    raise exception 'Broadcast not found';
  end if;

  if not exists (
    select 1 from muezzins m where m.user_id = auth.uid() and m.mosque_id = b.mosque_id and m.is_active = true
  ) then
    raise exception 'Not authorized to complete' using errcode = '42501';
  end if;

  update adhan_broadcasts
    set status = case when mark_missed then 'missed' else 'completed' end,
        ended_at = now(),
        updated_at = now()
  where id = b.id
  returning * into b;

  return b;
end;
$$;

-- Fetch upcoming broadcasts for the signed-in muezzin (with mosque meta)
create or replace function get_upcoming_broadcasts_for_user(limit_rows int default 5)
returns table (
  id uuid,
  mosque_id uuid,
  prayer text,
  scheduled_for timestamptz,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  started_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  mosque_name text,
  time_zone text
)
language sql
security definer
stable
as $$
  select b.id, b.mosque_id, b.prayer, b.scheduled_for, b.status,
         b.started_at, b.ended_at, b.started_by, b.created_at, b.updated_at,
         mos.name as mosque_name, mos.time_zone
  from adhan_broadcasts b
  join muezzins m on m.mosque_id = b.mosque_id and m.user_id = auth.uid() and m.is_active = true
  join mosques mos on mos.id = b.mosque_id
  where b.scheduled_for > now() - interval '15 minutes'
  order by b.scheduled_for asc
  limit greatest(1, limit_rows);
$$;

-- Fetch broadcast by id (for deep links) with mosque meta
create or replace function get_broadcast_by_id(broadcast_id uuid)
returns table (
  id uuid,
  mosque_id uuid,
  prayer text,
  scheduled_for timestamptz,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  started_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  mosque_name text,
  time_zone text
)
language sql
security definer
stable
as $$
  select b.id, b.mosque_id, b.prayer, b.scheduled_for, b.status,
         b.started_at, b.ended_at, b.started_by, b.created_at, b.updated_at,
         mos.name as mosque_name, mos.time_zone
  from adhan_broadcasts b
  join muezzins m on m.mosque_id = b.mosque_id and m.user_id = auth.uid() and m.is_active = true
  join mosques mos on mos.id = b.mosque_id
  where b.id = broadcast_id
  limit 1;
$$;

-- RLS policies (muezzins can read/update their mosque broadcasts)
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'adhan_broadcasts' and policyname = 'muezzin select own mosque') then
    create policy "muezzin select own mosque" on adhan_broadcasts
      for select using (
        exists (
          select 1 from muezzins m
          where m.user_id = auth.uid()
            and m.mosque_id = adhan_broadcasts.mosque_id
            and m.is_active = true
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'adhan_broadcasts' and policyname = 'muezzin update own mosque') then
    create policy "muezzin update own mosque" on adhan_broadcasts
      for update using (
        exists (
          select 1 from muezzins m
          where m.user_id = auth.uid()
            and m.mosque_id = adhan_broadcasts.mosque_id
            and m.is_active = true
        )
      );
  end if;
end$$;
