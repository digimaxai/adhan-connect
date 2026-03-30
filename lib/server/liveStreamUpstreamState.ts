import type { SupabaseClient } from '@supabase/supabase-js';
import type { MosqueLiveBroadcastConfig } from '../liveStreamProviders';

export type MosqueLiveStreamUpstreamStateRow = {
  mosque_id: string;
  provider_status?: string | null;
  encoder_connected?: boolean | null;
  playback_active?: boolean | null;
  provider_stream_id?: string | null;
  provider_message?: string | null;
  provider_payload?: unknown;
  last_seen_at?: string | null;
  updated_at?: string | null;
};

const UPSTREAM_STATE_FRESH_MS = 5 * 60 * 1000;

function isRecent(value?: string | null) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= UPSTREAM_STATE_FRESH_MS;
}

export async function fetchMosqueLiveStreamUpstreamState(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string
): Promise<MosqueLiveStreamUpstreamStateRow | null> {
  const { data, error } = await supabaseAdmin
    .from('mosque_live_stream_upstream_states')
    .select('mosque_id, provider_status, encoder_connected, playback_active, provider_stream_id, provider_message, provider_payload, last_seen_at, updated_at')
    .eq('mosque_id', mosqueId)
    .maybeSingle<MosqueLiveStreamUpstreamStateRow>();

  if (error) throw error;
  return data ?? null;
}

export function attachMosqueLiveUpstreamState(
  config: MosqueLiveBroadcastConfig,
  upstreamState: MosqueLiveStreamUpstreamStateRow | null
): MosqueLiveBroadcastConfig {
  if (!upstreamState) {
    return config;
  }

  const upstreamStatus = upstreamState.provider_status?.trim().toLowerCase() || null;
  const upstreamEncoderConnected = !!upstreamState.encoder_connected;
  const upstreamPlaybackActive = !!upstreamState.playback_active;
  const upstreamLastSeenAt = upstreamState.last_seen_at ?? null;
  const upstreamMessage = upstreamState.provider_message?.trim() || null;
  const recent = isRecent(upstreamLastSeenAt);

  let encoderPreflightStatus = config.encoder_preflight_status;
  let encoderPreflightSummary = config.encoder_preflight_summary;

  if (config.supports_external_encoder && recent) {
    if (upstreamStatus === 'error') {
      encoderPreflightStatus = 'attention';
      encoderPreflightSummary = upstreamMessage || 'Provider reported an upstream encoder error.';
    } else if (upstreamStatus === 'offline') {
      encoderPreflightStatus = 'attention';
      encoderPreflightSummary = 'Provider reports the mosque encoder is offline.';
    } else if (upstreamStatus === 'connecting') {
      encoderPreflightStatus = 'manual_check_required';
      encoderPreflightSummary = 'Provider reports the encoder is connecting. Confirm audio is flowing before going live.';
    } else if (upstreamEncoderConnected || upstreamStatus === 'connected' || upstreamStatus === 'live') {
      encoderPreflightStatus = 'ready';
      encoderPreflightSummary =
        upstreamStatus === 'live' || upstreamPlaybackActive
          ? 'Provider reports the upstream stream is live.'
          : 'Provider reports the encoder is connected.';
    }
  } else if (config.supports_external_encoder && config.requires_ingest_url && !recent) {
    encoderPreflightStatus = config.encoder_preflight_status === 'attention' ? 'attention' : 'manual_check_required';
    encoderPreflightSummary =
      'No recent provider callback has been received yet. Complete the provider or encoder-side check before going live.';
  }

  return {
    ...config,
    upstream_status: upstreamStatus,
    upstream_encoder_connected: upstreamEncoderConnected,
    upstream_playback_active: upstreamPlaybackActive,
    upstream_last_seen_at: upstreamLastSeenAt,
    upstream_stream_id: upstreamState.provider_stream_id?.trim() || null,
    upstream_message: upstreamMessage,
    encoder_preflight_status: encoderPreflightStatus,
    encoder_preflight_summary: encoderPreflightSummary,
  };
}
