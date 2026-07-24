import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type AccountJwtAmrEntry = {
  method: string;
  timestamp: number;
};

export type AccountAccessContext = {
  accessToken: string;
  authUser: User;
  claims: Record<string, unknown>;
  requestId: string;
  supabaseAdmin: SupabaseClient<any, any, any>;
  userId: string;
};

type AccountAccessResult =
  | { context: AccountAccessContext }
  | { response: Response };

const PRIVATE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, private',
  'Content-Type': 'application/json; charset=utf-8',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
};

function createRequestId() {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `account-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return `account-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function privateJson(
  body: unknown,
  status = 200,
  options?: { headers?: Record<string, string>; requestId?: string }
) {
  const requestId = options?.requestId ?? createRequestId();
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...PRIVATE_HEADERS,
      'X-Request-Id': requestId,
      ...(options?.headers ?? {}),
    },
  });
}

function decodeJwtClaims(accessToken: string): Record<string, unknown> {
  try {
    const encoded = accessToken.split('.')[1];
    if (!encoded) return {};
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = globalThis.atob(padded);
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getJwtAmrEntries(claims: Record<string, unknown>): AccountJwtAmrEntry[] {
  const rawEntries = Array.isArray(claims.amr) ? claims.amr : [];
  return rawEntries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const method = typeof record.method === 'string' ? record.method.trim().toLowerCase() : '';
    const timestamp =
      typeof record.timestamp === 'number'
        ? record.timestamp
        : typeof record.timestamp === 'string'
          ? Number.parseInt(record.timestamp, 10)
          : Number.NaN;
    if (!method || !Number.isFinite(timestamp) || timestamp <= 0) return [];
    return [{ method, timestamp }];
  });
}

export function getRecentAuthentication(
  context: Pick<AccountAccessContext, 'claims'>,
  maximumAgeSeconds = 10 * 60
) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const interactiveEntries = getJwtAmrEntries(context.claims).filter(
    ({ method }) => !['anonymous', 'refresh_token', 'token_refresh'].includes(method)
  );
  const mostRecent = interactiveEntries.reduce<AccountJwtAmrEntry | null>(
    (latest, entry) => (!latest || entry.timestamp > latest.timestamp ? entry : latest),
    null
  );
  const ageSeconds = mostRecent ? Math.max(0, nowSeconds - mostRecent.timestamp) : null;

  return {
    ageSeconds,
    authenticatedAt: mostRecent ? new Date(mostRecent.timestamp * 1000).toISOString() : null,
    isRecent: ageSeconds !== null && ageSeconds <= maximumAgeSeconds,
    maximumAgeSeconds,
    method: mostRecent?.method ?? null,
  };
}

export function getAccountProviderNames(authUser: User) {
  const appMetadataProviders = Array.isArray(authUser.app_metadata?.providers)
    ? authUser.app_metadata.providers
    : [];
  const identityProviders = (authUser.identities ?? []).map((identity) => identity.provider);
  return Array.from(
    new Set(
      [...appMetadataProviders, ...identityProviders]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export async function requireAuthenticatedAccount(request: Request): Promise<AccountAccessResult> {
  const requestId = createRequestId();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      response: privateJson(
        { error: 'Account services are temporarily unavailable.', code: 'ACCOUNT_SERVICE_UNAVAILABLE' },
        503,
        { requestId }
      ),
    };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return {
      response: privateJson(
        { error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' },
        401,
        { requestId }
      ),
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    return {
      response: privateJson(
        { error: 'Your session is invalid or has expired.', code: 'SESSION_EXPIRED' },
        401,
        { requestId }
      ),
    };
  }

  return {
    context: {
      accessToken,
      authUser: data.user,
      claims: decodeJwtClaims(accessToken),
      requestId,
      supabaseAdmin,
      userId: data.user.id,
    },
  };
}
