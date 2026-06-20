import {
  type EndpointHealthCheck,
  type EncoderPreflightStatus,
  getLiveStreamProviderProfile,
  type MosqueLiveBroadcastConfig,
} from '../liveStreamProviders';
import { isLiveKitConfigured } from './livekitRoom';

const PROBE_TIMEOUT_MS = 3000;

function withTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

async function probeHttpUrl(
  url: string,
  target: 'playback' | 'ingest'
): Promise<{ status: number | null; ok: boolean; authRequired: boolean; message: string }> {
  const methods: RequestInit['method'][] = ['HEAD', 'GET'];
  let lastStatus: number | null = null;
  let lastMessage = 'Endpoint did not respond.';

  for (const method of methods) {
    const { signal, cleanup } = withTimeoutSignal(PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal,
        headers:
          method === 'GET'
            ? {
                Accept: target === 'playback' ? 'audio/*,application/vnd.apple.mpegurl,*/*' : '*/*',
                Range: 'bytes=0-0',
              }
            : undefined,
      });
      cleanup();
      lastStatus = response.status;

      if (response.status >= 200 && response.status < 400) {
        return {
          status: response.status,
          ok: true,
          authRequired: false,
          message: method === 'HEAD' ? 'Endpoint responded successfully.' : 'Endpoint responded to a playback probe.',
        };
      }

      if (target === 'ingest' && (response.status === 401 || response.status === 403)) {
        return {
          status: response.status,
          ok: false,
          authRequired: true,
          message: 'Endpoint is reachable and requires encoder credentials.',
        };
      }

      if ([400, 405].includes(response.status) && method === 'HEAD') {
        lastMessage = 'HEAD probe not supported; retrying with GET.';
        continue;
      }

      lastMessage = `Endpoint returned HTTP ${response.status}.`;
    } catch (error) {
      cleanup();
      lastMessage =
        error instanceof Error && error.name === 'AbortError'
          ? 'Endpoint probe timed out.'
          : error instanceof Error
          ? error.message
          : 'Endpoint probe failed.';
    }
  }

  return {
    status: lastStatus,
    ok: false,
    authRequired: false,
    message: lastMessage,
  };
}

function buildHealthCheck(
  target: 'playback' | 'ingest',
  status: EndpointHealthCheck['status'],
  message: string,
  url: string | null,
  httpStatus: number | null = null
): EndpointHealthCheck {
  return {
    target,
    status,
    message,
    url,
    checked_at: new Date().toISOString(),
    http_status: httpStatus,
  };
}

async function probePlaybackHealth(config: MosqueLiveBroadcastConfig): Promise<EndpointHealthCheck> {
  const profile = getLiveStreamProviderProfile(config.provider);

  if (!profile.requiresPlaybackUrl) {
    return buildHealthCheck(
      'playback',
      'not_required',
      config.provider === 'livekit'
        ? 'LiveKit listeners join through room tokens; no static playback URL is required.'
        : `${profile.label} does not require a playback URL.`,
      null
    );
  }

  if (!config.playback_url) {
    return buildHealthCheck(
      'playback',
      'not_configured',
      'Follower playback URL is not configured.',
      null
    );
  }

  const result = await probeHttpUrl(config.playback_url, 'playback');
  if (result.ok) {
    return buildHealthCheck('playback', 'reachable', result.message, config.playback_url, result.status);
  }

  return buildHealthCheck('playback', 'failing', result.message, config.playback_url, result.status);
}

async function probeIngestHealth(config: MosqueLiveBroadcastConfig): Promise<EndpointHealthCheck> {
  const profile = getLiveStreamProviderProfile(config.provider);

  if (!profile.supportsExternalEncoder) {
    return buildHealthCheck('ingest', 'not_required', 'This provider does not require an external encoder.', null);
  }

  if (!config.ingest_url) {
    return buildHealthCheck(
      'ingest',
      profile.requiresIngestUrl ? 'not_configured' : 'not_required',
      profile.requiresIngestUrl ? `${profile.label} ingest URL is not configured.` : 'Ingest URL is optional for this provider.',
      null
    );
  }

  if (config.ingest_url.startsWith('rtmp://') || config.ingest_url.startsWith('rtmps://')) {
    return buildHealthCheck(
      'ingest',
      'manual_check_required',
      'RTMP ingest cannot be preflighted from this API. Confirm the encoder can connect to the provider.',
      config.ingest_url
    );
  }

  const result = await probeHttpUrl(config.ingest_url, 'ingest');
  if (result.ok) {
    return buildHealthCheck('ingest', 'reachable', result.message, config.ingest_url, result.status);
  }
  if (result.authRequired) {
    return buildHealthCheck('ingest', 'auth_required', result.message, config.ingest_url, result.status);
  }

  return buildHealthCheck('ingest', 'failing', result.message, config.ingest_url, result.status);
}

function summarizePreflight(
  config: MosqueLiveBroadcastConfig,
  playbackHealth: EndpointHealthCheck,
  ingestHealth: EndpointHealthCheck
): { status: EncoderPreflightStatus; summary: string } {
  const profile = getLiveStreamProviderProfile(config.provider);

  if (!config.is_ready_for_broadcast) {
    return {
      status: 'not_configured',
      summary: config.issues[0] ?? 'Required live stream configuration is incomplete.',
    };
  }

  if (config.provider === 'livekit' && !isLiveKitConfigured()) {
    return {
      status: 'attention',
      summary: 'LiveKit is not configured on the server. Contact support before going live.',
    };
  }

  if (config.provider === 'livekit') {
    return {
      status: 'ready',
      summary: 'LiveKit is configured. In-app microphone publishing and listener room tokens are ready.',
    };
  }

  if (profile.requiresPlaybackUrl && (playbackHealth.status === 'failing' || playbackHealth.status === 'not_configured')) {
    return {
      status: 'attention',
      summary: 'Follower playback endpoint did not pass the preflight check.',
    };
  }

  if (config.requires_ingest_url) {
    if (ingestHealth.status === 'failing' || ingestHealth.status === 'not_configured') {
      return {
        status: 'attention',
        summary: 'Encoder ingest endpoint did not pass the preflight check.',
      };
    }
    if (ingestHealth.status === 'manual_check_required') {
      return {
        status: 'manual_check_required',
        summary: 'Playback looks reachable. RTMP ingest still requires manual verification from the encoder.',
      };
    }
  }

  if (!config.requires_ingest_url && ingestHealth.status === 'failing') {
    return {
      status: 'ready',
      summary: 'Follower playback looks reachable. Optional ingest check failed, but it is not required for this provider.',
    };
  }

  return {
    status: 'ready',
    summary: 'Configured endpoints look reachable for this mosque.',
  };
}

export async function attachMosqueLiveHealthChecks(
  config: MosqueLiveBroadcastConfig
): Promise<MosqueLiveBroadcastConfig> {
  const [playbackHealth, ingestHealth] = await Promise.all([
    probePlaybackHealth(config),
    probeIngestHealth(config),
  ]);

  const preflight = summarizePreflight(config, playbackHealth, ingestHealth);

  return {
    ...config,
    playback_health: playbackHealth,
    ingest_health: ingestHealth,
    encoder_preflight_status: preflight.status,
    encoder_preflight_summary: preflight.summary,
  };
}
