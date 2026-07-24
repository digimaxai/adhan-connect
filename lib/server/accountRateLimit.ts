import type { SupabaseClient } from '@supabase/supabase-js';

type MemoryWindow = {
  count: number;
  expiresAt: number;
  windowStartedAt: number;
};

export type AccountRateLimitResult = {
  allowed: boolean;
  durable: boolean;
  retryAfterSeconds: number;
  unavailable?: boolean;
};

const memoryWindows = new Map<string, MemoryWindow>();
const MAX_MEMORY_WINDOWS = 10_000;

function trustedClientAddress(request: Request) {
  if (process.env.ACCOUNT_TRUST_PROXY !== 'true') return null;

  const candidates = [
    request.headers.get('cf-connecting-ip')?.trim(),
    request.headers.get('x-real-ip')?.trim(),
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  ];

  return (
    candidates.find(
      (value): value is string =>
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 128 &&
        /^[0-9a-f:.]+$/i.test(value)
    ) ?? null
  );
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function consumeMemoryWindow(
  key: string,
  limit: number,
  windowSeconds: number
): AccountRateLimitResult {
  const now = Date.now();
  const windowMilliseconds = windowSeconds * 1_000;
  if (memoryWindows.size >= MAX_MEMORY_WINDOWS) {
    for (const [storedKey, window] of memoryWindows) {
      if (window.expiresAt <= now) memoryWindows.delete(storedKey);
    }
    while (memoryWindows.size >= MAX_MEMORY_WINDOWS) {
      const oldestKey = memoryWindows.keys().next().value;
      if (typeof oldestKey !== 'string') break;
      memoryWindows.delete(oldestKey);
    }
  }
  const current = memoryWindows.get(key);
  const active =
    current && current.expiresAt > now
      ? current
      : {
          count: 0,
          expiresAt: now + windowMilliseconds,
          windowStartedAt: now,
        };
  active.count += 1;
  // Reinsert so the Map iteration order remains a useful LRU approximation.
  memoryWindows.delete(key);
  memoryWindows.set(key, active);

  const elapsedSeconds = Math.floor((now - active.windowStartedAt) / 1_000);
  return {
    allowed: active.count <= limit,
    durable: false,
    retryAfterSeconds: Math.max(1, windowSeconds - elapsedSeconds),
  };
}

async function consumeAccountRateLimitKey(options: {
  keyHash: string;
  limit: number;
  requireDurable?: boolean;
  supabaseAdmin: SupabaseClient<any, any, any>;
  windowSeconds: number;
}): Promise<AccountRateLimitResult> {
  try {
    const { data, error } = await options.supabaseAdmin.rpc(
      'consume_account_control_rate_limit_v1',
      {
        p_key_hash: options.keyHash,
        p_limit: options.limit,
        p_window_seconds: options.windowSeconds,
      }
    );

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (
      !row ||
      typeof row.allowed !== 'boolean' ||
      typeof row.retry_after_seconds !== 'number'
    ) {
      throw new Error('Unexpected rate-limit response.');
    }

    return {
      allowed: row.allowed,
      durable: true,
      retryAfterSeconds: Math.max(1, Math.ceil(row.retry_after_seconds)),
    };
  } catch {
    if (options.requireDurable) {
      return {
        allowed: false,
        durable: false,
        retryAfterSeconds: options.windowSeconds,
        unavailable: true,
      };
    }
    return consumeMemoryWindow(
      options.keyHash,
      options.limit,
      options.windowSeconds
    );
  }
}

export async function consumeAccountRateLimit(options: {
  action: 'consent' | 'delete' | 'export' | 'impact';
  limit: number;
  request: Request;
  requireDurable?: boolean;
  supabaseAdmin: SupabaseClient<any, any, any>;
  userId: string;
  windowSeconds: number;
}): Promise<AccountRateLimitResult> {
  // A user-only bucket cannot be bypassed by rotating or spoofing forwarding
  // headers. A broader trusted-IP bucket adds defence in depth only when the
  // deployed ingress is explicitly configured to overwrite those headers.
  const userKeyHash = await sha256(
    ['account-control-v2', options.action, 'user', options.userId].join(':')
  );
  const userResult = await consumeAccountRateLimitKey({
    keyHash: userKeyHash,
    limit: options.limit,
    requireDurable: options.requireDurable,
    supabaseAdmin: options.supabaseAdmin,
    windowSeconds: options.windowSeconds,
  });
  if (!userResult.allowed) return userResult;

  const clientAddress = trustedClientAddress(options.request);
  if (!clientAddress) return userResult;

  const ipKeyHash = await sha256(
    ['account-control-v2', options.action, 'ip', clientAddress].join(':')
  );
  const ipResult = await consumeAccountRateLimitKey({
    keyHash: ipKeyHash,
    limit: Math.max(20, options.limit * 10),
    requireDurable: options.requireDurable,
    supabaseAdmin: options.supabaseAdmin,
    windowSeconds: options.windowSeconds,
  });
  if (!ipResult.allowed) return ipResult;

  return {
    allowed: true,
    durable: userResult.durable && ipResult.durable,
    retryAfterSeconds: Math.max(
      userResult.retryAfterSeconds,
      ipResult.retryAfterSeconds
    ),
  };
}
