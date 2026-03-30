alter table public.mosques
  add column if not exists live_stream_username text;

comment on column public.mosques.live_stream_username is
  'Optional provider username for mosque live streaming. Used by providers such as Icecast that require source username plus password.';
