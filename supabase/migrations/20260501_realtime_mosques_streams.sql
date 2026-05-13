-- Enable Supabase Realtime CDC for mosque metrics and live stream state.
-- Applied 2026-05-01 via Management API.
alter publication supabase_realtime add table public.mosques, public.streams;
