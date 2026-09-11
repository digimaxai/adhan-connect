-- ELM timetable cache: stores fetched East London Mosque prayer times
-- so server routes and clients can read from DB without needing LPT_API_KEY at runtime.
-- Populated by the fetch-elm-timetable Edge Function (runs daily).

create table if not exists elm_timetable (
  date          date        primary key,
  fajr          text,
  fajr_jamat    text,
  sunrise       text,
  dhuhr         text,
  dhuhr_jamat   text,
  asr           text,   -- Shafi (shadow 1x)
  asr_2         text,   -- Hanafi (shadow 2x)
  asr_jamat     text,
  magrib        text,
  magrib_jamat  text,
  isha          text,
  isha_jamat    text,
  fetched_at    timestamptz not null default now()
);

-- Public read: server routes use service role, clients use anon key
alter table elm_timetable enable row level security;

create policy "public read elm_timetable"
  on elm_timetable for select
  using (true);

-- Only service role (Edge Function) may write
create policy "service role write elm_timetable"
  on elm_timetable for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
