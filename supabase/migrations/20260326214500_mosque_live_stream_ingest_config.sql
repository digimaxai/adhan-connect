-- Optional encoder-side live stream configuration per mosque.
-- Playback remains follower-facing; ingest values are for mosque/operator setup.

alter table public.mosques
  add column if not exists live_stream_ingest_url text,
  add column if not exists live_stream_stream_key text;

comment on column public.mosques.live_stream_ingest_url is
  'Optional ingest endpoint for the mosque live stream provider, such as RTMP or Icecast.';

comment on column public.mosques.live_stream_stream_key is
  'Optional stream key or credential used by the mosque live stream provider.';
