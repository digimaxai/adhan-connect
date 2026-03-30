alter table public.mosques
  add column if not exists live_stream_mount_path text,
  add column if not exists live_stream_listener_secret text;

comment on column public.mosques.live_stream_mount_path is
  'Optional mountpoint path for Icecast-style listener playback, for example /live/harrow-mosque.aac.';

comment on column public.mosques.live_stream_listener_secret is
  'Per-mosque secret used to mint short-lived signed listener playback access URLs.';
