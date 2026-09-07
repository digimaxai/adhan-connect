import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const NOTIFICATION_REQUEST_TIMEOUT_MS = 8_000;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let cachedAccessToken: string | null = null;
let cachedClient: SupabaseClient | null = null;

function timeoutError(label: string, timeoutMs: number) {
  const error = new Error(`${label} took too long. Check your connection and try again.`);
  error.name = 'NotificationRequestTimeoutError';
  return error;
}

const boundedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort();
  if (upstreamSignal?.aborted) controller.abort();
  upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });

  const error = timeoutError('The notification service', NOTIFICATION_REQUEST_TIMEOUT_MS);
  let rejectId: ReturnType<typeof setTimeout> | null = null;
  const timeoutId = setTimeout(() => controller.abort(), NOTIFICATION_REQUEST_TIMEOUT_MS);

  try {
    return await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      new Promise<Response>((_, reject) => {
        rejectId = setTimeout(() => reject(error), NOTIFICATION_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } catch (requestError) {
    if (controller.signal.aborted && !upstreamSignal?.aborted) throw error;
    throw requestError;
  } finally {
    clearTimeout(timeoutId);
    if (rejectId) clearTimeout(rejectId);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
};

/**
 * A session-scoped Supabase client for notification work.
 *
 * The normal application client resolves a token through auth.getSession()
 * before every Postgrest/RPC request. During native permission and token
 * registration that can queue behind auth-js' process lock. This client uses
 * the already-mounted AuthProvider token directly and applies one network
 * deadline to every notification request.
 */
export function notificationClient(accessToken: string) {
  if (!accessToken) throw new Error('Your session has expired. Sign in again to manage notifications.');
  if (cachedClient && cachedAccessToken === accessToken) return cachedClient;

  cachedAccessToken = accessToken;
  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => accessToken,
    global: { fetch: boundedFetch },
  });
  return cachedClient;
}

export async function withNotificationDeadline<T>(
  operation: Promise<T>,
  label: string,
  timeoutMs = NOTIFICATION_REQUEST_TIMEOUT_MS
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(timeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
