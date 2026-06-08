-- Add LiveKit room tracking to the streams table.
-- livekit_room_name: deterministic room name (adhan-{mosqueId}-{prayer}-{date})
-- set when a broadcast starts with the livekit provider; null for Icecast/RTMP streams.
ALTER TABLE streams
  ADD COLUMN IF NOT EXISTS livekit_room_name text;

-- Grant read access so listeners can discover which room to join.
GRANT SELECT (livekit_room_name) ON streams TO authenticated, anon;
