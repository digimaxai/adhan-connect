-- Multi-tenant live stream configuration per mosque.
-- This lets each mosque provide its own playback source instead of reusing
-- whatever URL happened to exist on an old stream row.

alter table public.mosques
  add column if not exists live_stream_enabled boolean not null default false,
  add column if not exists live_stream_provider text,
  add column if not exists live_stream_playback_url text;

comment on column public.mosques.live_stream_enabled is
  'When true, this mosque is configured to publish a live audio stream to followers.';

comment on column public.mosques.live_stream_provider is
  'Provider label for the mosque live stream setup, for example external, icecast, hls, or test.';

comment on column public.mosques.live_stream_playback_url is
  'Playback URL followers should consume while this mosque is live.';
