alter table public.mosques
  add column if not exists live_stream_status_secret text;

comment on column public.mosques.live_stream_status_secret is
  'Shared secret used by upstream live-stream provider callbacks to report encoder connection state for this mosque.';

create table if not exists public.mosque_live_stream_upstream_states (
  mosque_id uuid primary key references public.mosques(id) on delete cascade,
  provider_status text not null default 'unknown',
  encoder_connected boolean not null default false,
  playback_active boolean not null default false,
  provider_stream_id text,
  provider_message text,
  provider_payload jsonb,
  last_seen_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.mosque_live_stream_upstream_states is
  'Latest upstream encoder/provider state per mosque, populated by provider callbacks or integration middleware.';

comment on column public.mosque_live_stream_upstream_states.provider_status is
  'Provider-reported stream state such as offline, connecting, connected, live, or error.';

comment on column public.mosque_live_stream_upstream_states.provider_payload is
  'Raw provider callback payload for debugging or future vendor-specific adapters.';

alter table public.mosque_live_stream_upstream_states enable row level security;
