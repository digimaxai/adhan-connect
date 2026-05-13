export type LiveStreamProvider = 'external' | 'rtmp' | 'icecast' | 'livekit' | 'test';

export type MosqueLiveStreamConfigRow = {
  id: string;
  name?: string | null;
  live_stream_enabled?: boolean | null;
  live_stream_provider?: string | null;
  live_stream_playback_url?: string | null;
  live_stream_ingest_url?: string | null;
  live_stream_mount_path?: string | null;
  live_stream_username?: string | null;
  live_stream_stream_key?: string | null;
  live_stream_status_secret?: string | null;
  live_stream_listener_secret?: string | null;
};

export type MosqueLiveBroadcastConfig = {
  streaming_enabled: boolean;
  provider: LiveStreamProvider;
  provider_label: string;
  provider_summary: string;
  playback_url_configured: boolean;
  playback_url: string | null;
  ingest_url_configured: boolean;
  mount_path_configured: boolean;
  mount_path: string | null;
  username_configured: boolean;
  username_label: string | null;
  username: string | null;
  stream_key_configured: boolean;
  credential_label: string;
  listener_access_requires_signed_url: boolean;
  listener_access_secret_configured: boolean;
  listener_access_ready: boolean;
  is_ready_for_broadcast: boolean;
  is_ready_for_external_encoder: boolean;
  supports_external_encoder: boolean;
  requires_ingest_url: boolean;
  requires_username: boolean;
  requires_stream_key: boolean;
  ingest_url: string | null;
  ingest_protocol_hint: string | null;
  stream_key: string | null;
  masked_stream_key: string | null;
  playback_health: EndpointHealthCheck | null;
  ingest_health: EndpointHealthCheck | null;
  encoder_preflight_status: EncoderPreflightStatus;
  encoder_preflight_summary: string;
  upstream_status: string | null;
  upstream_encoder_connected: boolean;
  upstream_playback_active: boolean;
  upstream_last_seen_at: string | null;
  upstream_stream_id: string | null;
  upstream_message: string | null;
  encoder_instructions: string | null;
  issues: string[];
};

export type EndpointHealthStatus =
  | 'reachable'
  | 'auth_required'
  | 'failing'
  | 'manual_check_required'
  | 'not_configured'
  | 'not_required'
  | 'unknown';

export type EncoderPreflightStatus = 'ready' | 'attention' | 'manual_check_required' | 'not_configured';

export type EndpointHealthCheck = {
  target: 'playback' | 'ingest';
  status: EndpointHealthStatus;
  message: string;
  url: string | null;
  checked_at: string | null;
  http_status: number | null;
};

type LiveStreamProviderProfile = {
  provider: LiveStreamProvider;
  label: string;
  summary: string;
  ingestProtocols: string[];
  ingestProtocolHint: string | null;
  supportsExternalEncoder: boolean;
  requiresIngestUrl: boolean;
  requiresUsername: boolean;
  requiresStreamKey: boolean;
  requiresPlaybackUrl: boolean;
  requiresListenerSecret: boolean;
  usernameLabel: string | null;
  credentialLabel: string;
  encoderInstructions: string;
};

const PROVIDER_PROFILES: Record<LiveStreamProvider, LiveStreamProviderProfile> = {
  external: {
    provider: 'external',
    label: 'External',
    summary: 'Playback is managed outside the app. Encoder details are optional when your vendor provides them.',
    ingestProtocols: ['http:', 'https:', 'rtmp:', 'rtmps:'],
    ingestProtocolHint: 'http(s) or rtmp(s)',
    supportsExternalEncoder: true,
    requiresIngestUrl: false,
    requiresUsername: false,
    requiresStreamKey: false,
    requiresPlaybackUrl: true,
    requiresListenerSecret: true,
    usernameLabel: null,
    credentialLabel: 'Stream key',
    encoderInstructions:
      'Use external mode when your provider manages ingest separately. Add ingest details only if your upstream vendor gave mosque-specific encoder credentials.',
  },
  rtmp: {
    provider: 'rtmp',
    label: 'RTMP / HLS',
    summary: 'Use RTMP or RTMPS ingest from the encoder and publish an HTTP playback URL for listeners.',
    ingestProtocols: ['rtmp:', 'rtmps:'],
    ingestProtocolHint: 'rtmp(s)',
    supportsExternalEncoder: true,
    requiresIngestUrl: true,
    requiresUsername: false,
    requiresStreamKey: true,
    requiresPlaybackUrl: true,
    requiresListenerSecret: true,
    usernameLabel: null,
    credentialLabel: 'Stream key',
    encoderInstructions:
      'Connect the mosque encoder to the RTMP ingest URL with the stream key. Your provider should expose the configured playback URL for follower listening.',
  },
  icecast: {
    provider: 'icecast',
    label: 'Icecast',
    summary: 'Use HTTP or HTTPS ingest with source credentials and provide a listener playback URL.',
    ingestProtocols: ['http:', 'https:'],
    ingestProtocolHint: 'http(s)',
    supportsExternalEncoder: true,
    requiresIngestUrl: true,
    requiresUsername: true,
    requiresStreamKey: true,
    requiresPlaybackUrl: true,
    requiresListenerSecret: true,
    usernameLabel: 'Source username',
    credentialLabel: 'Source password',
    encoderInstructions:
      'Configure your encoder with the Icecast source URL, source username, and source password. The playback URL should point followers to the public Icecast listener endpoint.',
  },
  livekit: {
    provider: 'livekit',
    label: 'LiveKit (In-App Mic)',
    summary: 'Mic audio is captured directly in the muezzin app and streamed via LiveKit. No external encoder required. Listeners connect automatically when the broadcast starts.',
    ingestProtocols: [],
    ingestProtocolHint: null,
    supportsExternalEncoder: false,
    requiresIngestUrl: false,
    requiresUsername: false,
    requiresStreamKey: false,
    requiresPlaybackUrl: false,
    requiresListenerSecret: false,
    usernameLabel: null,
    credentialLabel: 'Stream key',
    encoderInstructions:
      'Audio is captured from the muezzin\'s phone microphone and streamed via LiveKit. No external encoder or credentials are needed.',
  },
  test: {
    provider: 'test',
    label: 'Test',
    summary: 'Test mode only verifies follower playback from a fixed URL. No encoder credentials are required.',
    ingestProtocols: [],
    ingestProtocolHint: null,
    supportsExternalEncoder: false,
    requiresIngestUrl: false,
    requiresUsername: false,
    requiresStreamKey: false,
    requiresPlaybackUrl: true,
    requiresListenerSecret: true,
    usernameLabel: null,
    credentialLabel: 'Stream key',
    encoderInstructions: 'Test mode uses the configured playback URL only.',
  },
};

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function normalizeLiveStreamProvider(value?: string | null): LiveStreamProvider {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'rtmp' || normalized === 'icecast' || normalized === 'livekit' || normalized === 'test') return normalized;
  if (normalized === 'hls') return 'rtmp';
  return 'external';
}

export function getLiveStreamProviderProfile(provider?: string | null): LiveStreamProviderProfile {
  const normalized = normalizeLiveStreamProvider(provider);
  return PROVIDER_PROFILES[normalized];
}

export function normalizePlaybackUrl(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  const parsed = safeParseUrl(trimmed);
  if (!parsed) {
    throw new Error('Live stream playback URL is invalid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Live stream playback URL must use http or https.');
  }
  return parsed.toString();
}

export function normalizeIcecastMountPath(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;

  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = prefixed.replace(/\/{2,}/g, '/');

  if (normalized !== '/' && normalized.length < 2) {
    throw new Error('Icecast mount path is invalid.');
  }
  if (/[?#\s]/.test(normalized)) {
    throw new Error('Icecast mount path cannot contain spaces, query parameters, or fragments.');
  }

  return normalized;
}

export function deriveIcecastMountPathFromPlaybackUrl(value?: string | null) {
  const playbackUrl = normalizePlaybackUrl(value);
  if (!playbackUrl) return null;

  const parsed = safeParseUrl(playbackUrl);
  if (!parsed) return null;

  return normalizeIcecastMountPath(parsed.pathname || null);
}

export function normalizeIngestUrl(provider: LiveStreamProvider | string | null | undefined, value?: string | null) {
  const profile = getLiveStreamProviderProfile(provider);
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  const parsed = safeParseUrl(trimmed);
  if (!parsed) {
    throw new Error('Live stream ingest URL is invalid.');
  }
  if (profile.ingestProtocols.length && !profile.ingestProtocols.includes(parsed.protocol)) {
    const protocolHint = profile.ingestProtocolHint ?? 'supported protocols';
    throw new Error(`Live stream ingest URL must use ${protocolHint} for ${profile.label}.`);
  }
  if (!['http:', 'https:', 'rtmp:', 'rtmps:'].includes(parsed.protocol)) {
    throw new Error('Live stream ingest URL must use http, https, rtmp, or rtmps.');
  }
  return parsed.toString();
}

export function resolveLiveStreamMountPath(config: MosqueLiveStreamConfigRow) {
  try {
    const explicit = normalizeIcecastMountPath(config.live_stream_mount_path);
    if (explicit) return explicit;
  } catch {
    // Fall back to deriving from the playback URL below.
  }

  if (normalizeLiveStreamProvider(config.live_stream_provider) !== 'icecast') {
    return null;
  }

  try {
    return deriveIcecastMountPathFromPlaybackUrl(config.live_stream_playback_url);
  } catch {
    return null;
  }
}

export function resolveLiveStreamListenerSecret(config: MosqueLiveStreamConfigRow) {
  const listenerSecret = config.live_stream_listener_secret?.trim() || null;
  if (listenerSecret) return listenerSecret;
  return config.live_stream_status_secret?.trim() || null;
}

export function summarizeMosqueLiveBroadcastConfig(config: MosqueLiveStreamConfigRow): MosqueLiveBroadcastConfig {
  const profile = getLiveStreamProviderProfile(config.live_stream_provider);
  const issues: string[] = [];
  const streamingEnabled = !!config.live_stream_enabled;
  const mountPath = resolveLiveStreamMountPath(config);
  const playbackUrl = (() => {
    try {
      return normalizePlaybackUrl(config.live_stream_playback_url);
    } catch {
      return null;
    }
  })();
  const ingestUrl = (() => {
    try {
      return normalizeIngestUrl(profile.provider, config.live_stream_ingest_url);
    } catch {
      return null;
    }
  })();
  const username = config.live_stream_username?.trim() || null;
  const streamKey = config.live_stream_stream_key?.trim() || null;
  const listenerSecret = resolveLiveStreamListenerSecret(config);
  const streamKeyConfigured = !!streamKey;
  const usernameConfigured = !!username;
  const listenerAccessReady =
    !profile.requiresListenerSecret ||
    (!!listenerSecret && (profile.provider !== 'icecast' || !!mountPath));
  const maskedStreamKey = streamKey ? `${'*'.repeat(Math.max(0, streamKey.length - 4))}${streamKey.slice(-4)}` : null;
  const readyForExternalEncoder =
    (!profile.requiresIngestUrl || !!ingestUrl) &&
    (!profile.requiresUsername || usernameConfigured) &&
    (!profile.requiresStreamKey || streamKeyConfigured);
  const readyForBroadcast =
    streamingEnabled &&
    (!profile.requiresPlaybackUrl || !!playbackUrl) &&
    listenerAccessReady &&
    (!profile.supportsExternalEncoder || !profile.requiresIngestUrl && !profile.requiresUsername && !profile.requiresStreamKey || readyForExternalEncoder);

  if (!streamingEnabled) {
    issues.push('Live streaming is inactive for this mosque.');
  }
  if (profile.requiresPlaybackUrl && !playbackUrl) {
    issues.push('Follower playback URL is missing or invalid.');
  }
  if (profile.requiresIngestUrl && !ingestUrl) {
    issues.push(`${profile.label} ingest URL is missing or invalid.`);
  }
  if (profile.requiresUsername && !usernameConfigured) {
    issues.push(`${profile.usernameLabel ?? 'Username'} is not configured.`);
  }
  if (profile.requiresStreamKey && !streamKeyConfigured) {
    issues.push(`${profile.credentialLabel} is not configured.`);
  }
  if (profile.provider === 'icecast' && !mountPath) {
    issues.push('Icecast mount path is missing or invalid.');
  }
  if (profile.requiresListenerSecret && !listenerSecret) {
    issues.push('Listener access secret is not configured.');
  }

  return {
    streaming_enabled: streamingEnabled,
    provider: profile.provider,
    provider_label: profile.label,
    provider_summary: profile.summary,
    playback_url_configured: !!playbackUrl,
    playback_url: playbackUrl,
    ingest_url_configured: !!ingestUrl,
    mount_path_configured: !!mountPath,
    mount_path: mountPath,
    username_configured: usernameConfigured,
    username_label: profile.usernameLabel,
    username,
    stream_key_configured: streamKeyConfigured,
    credential_label: profile.credentialLabel,
    listener_access_requires_signed_url: true,
    listener_access_secret_configured: !!listenerSecret,
    listener_access_ready: listenerAccessReady,
    is_ready_for_broadcast: readyForBroadcast,
    is_ready_for_external_encoder: readyForExternalEncoder,
    supports_external_encoder: profile.supportsExternalEncoder,
    requires_ingest_url: profile.requiresIngestUrl,
    requires_username: profile.requiresUsername,
    requires_stream_key: profile.requiresStreamKey,
    ingest_url: ingestUrl,
    ingest_protocol_hint: profile.ingestProtocolHint,
    stream_key: streamKey,
    masked_stream_key: maskedStreamKey,
    playback_health: null,
    ingest_health: null,
    encoder_preflight_status: readyForBroadcast ? 'manual_check_required' : 'not_configured',
    encoder_preflight_summary: readyForBroadcast
      ? 'Configuration is complete. Run endpoint checks or verify the provider manually before going live.'
      : 'Finish the required live stream configuration before going live.',
    upstream_status: null,
    upstream_encoder_connected: false,
    upstream_playback_active: false,
    upstream_last_seen_at: null,
    upstream_stream_id: null,
    upstream_message: null,
    encoder_instructions: profile.encoderInstructions,
    issues,
  };
}
