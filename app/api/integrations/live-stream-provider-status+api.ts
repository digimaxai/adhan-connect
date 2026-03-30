import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';

type ProviderStatusPayload = {
  mosqueId?: string;
  secret?: string;
  providerStatus?: string | null;
  encoderConnected?: boolean | null;
  playbackActive?: boolean | null;
  providerStreamId?: string | null;
  message?: string | null;
  observedAt?: string | null;
  payload?: unknown;
};

type MosqueSecretRow = {
  id: string;
  name?: string | null;
  live_stream_status_secret?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeProviderStatus(value?: string | null) {
  const normalized = value?.trim().toLowerCase() || 'unknown';
  if (['offline', 'connecting', 'connected', 'live', 'error', 'unknown'].includes(normalized)) {
    return normalized;
  }
  return 'unknown';
}

function normalizeTimestamp(value?: string | null) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server live stream integration is missing Supabase configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const POST: RequestHandler = async (request) => {
  let body: ProviderStatusPayload;
  try {
    body = (await request.json()) as ProviderStatusPayload;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const mosqueId = body.mosqueId?.trim() ?? '';
  const secret =
    request.headers.get('x-live-stream-secret')?.trim() ??
    request.headers.get('x-mosque-stream-secret')?.trim() ??
    body.secret?.trim() ??
    '';

  if (!mosqueId) {
    return json({ error: 'A mosqueId is required.' }, 400);
  }
  if (!secret) {
    return json({ error: 'A live stream callback secret is required.' }, 401);
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: mosque, error: mosqueError } = await supabaseAdmin
      .from('mosques')
      .select('id, name, live_stream_status_secret')
      .eq('id', mosqueId)
      .maybeSingle<MosqueSecretRow>();

    if (mosqueError) {
      throw mosqueError;
    }
    if (!mosque) {
      return json({ error: 'Mosque not found.' }, 404);
    }
    if (!mosque.live_stream_status_secret || mosque.live_stream_status_secret !== secret) {
      return json({ error: 'Invalid callback secret.' }, 403);
    }

    const observedAt = normalizeTimestamp(body.observedAt);
    const providerStatus = normalizeProviderStatus(body.providerStatus);
    const encoderConnected =
      typeof body.encoderConnected === 'boolean'
        ? body.encoderConnected
        : providerStatus === 'connected' || providerStatus === 'live';
    const playbackActive =
      typeof body.playbackActive === 'boolean' ? body.playbackActive : providerStatus === 'live';

    const upsertPayload = {
      mosque_id: mosqueId,
      provider_status: providerStatus,
      encoder_connected: encoderConnected,
      playback_active: playbackActive,
      provider_stream_id: body.providerStreamId?.trim() || null,
      provider_message: body.message?.trim() || null,
      provider_payload:
        body.payload && typeof body.payload === 'object'
          ? (body.payload as Record<string, unknown>)
          : body.payload ?? null,
      last_seen_at: observedAt,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from('mosque_live_stream_upstream_states')
      .upsert(upsertPayload as any, { onConflict: 'mosque_id' });

    if (upsertError) {
      throw upsertError;
    }

    return json({
      ok: true,
      mosqueId,
      providerStatus,
      encoderConnected,
      playbackActive,
      observedAt,
      mosqueName: mosque.name ?? 'Mosque',
    });
  } catch (error: any) {
    return json({ error: error?.message ?? 'Unable to record live stream provider status.' }, 500);
  }
};
