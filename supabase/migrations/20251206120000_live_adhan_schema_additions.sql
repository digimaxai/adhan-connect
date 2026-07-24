-- Live Adhan MVP - Schema additions (additive, non-destructive)
-- This migration only adds missing columns and indexes needed for live broadcasting.
-- It does not drop, rename, or alter existing columns or constraints.

-- STREAMS: ensure live-ready fields exist (one row per mosque in practice; uniqueness not enforced here).
alter table if exists streams
  add column if not exists mosque_id uuid references mosques(id);

alter table if exists streams
  add column if not exists is_live boolean default false;

alter table if exists streams
  add column if not exists current_prayer text;

alter table if exists streams
  add column if not exists started_at timestamptz;

alter table if exists streams
  add column if not exists ended_at timestamptz;

alter table if exists streams
  add column if not exists stream_url text;

-- Helpful indexes (non-unique to avoid conflicts with existing data).
create index if not exists idx_streams_mosque_id on streams(mosque_id);
create index if not exists idx_streams_is_live on streams(is_live);

-- ADHANS: align schedule/history fields while keeping existing columns intact.
alter table if exists adhans
  add column if not exists status text default 'scheduled';

alter table if exists adhans
  add column if not exists started_at timestamptz;

alter table if exists adhans
  add column if not exists ended_at timestamptz;

alter table if exists adhans
  add column if not exists stream_id uuid references streams(id);

-- Helpful indexes for schedule/status lookups.
create index if not exists idx_adhans_mosque_id on adhans(mosque_id);
create index if not exists idx_adhans_scheduled_at on adhans(scheduled_at);
create index if not exists idx_adhans_status on adhans(status);
