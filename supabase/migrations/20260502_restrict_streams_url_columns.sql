-- Restrict raw stream playback URLs from public/authenticated reads.
-- The "streams listener select live" policy allowed any user to read all
-- columns on live streams, including url/stream_url. Listeners must obtain
-- a signed playback URL via /api/live-stream-access instead of reading the
-- raw URL directly. Server APIs use service_role and are unaffected.

revoke select on public.streams from anon, authenticated;

grant select (
  id,
  mosque_id,
  type,
  status,
  is_live,
  started_at,
  ended_at,
  current_prayer,
  last_health_check
) on public.streams to anon, authenticated;
