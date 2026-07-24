import type { Session } from '@supabase/supabase-js';
import { fetchServerApi, resolveApiUrls, supportsServerApi } from './api/apiBaseUrl';
import { persistentStorage } from './persistentStorage';
import { supabase } from './supabase';

export type SessionAccessPayload = {
  globalRole?: 'user' | 'main_admin' | null;
  effectiveRole?: 'user' | 'local_admin' | 'main_admin' | 'muezzin' | null;
  isMainAdmin?: boolean;
  isLocalAdmin?: boolean;
  isMuezzin?: boolean;
  adminMosques?: {
    mosqueId: string;
    name: string;
    city?: string | null;
    country?: string | null;
  }[];
  muezzinMosques?: {
    mosqueId: string;
    name: string;
    city?: string | null;
    country?: string | null;
  }[];
};

type SessionAccessCacheEntry = {
  cachedAt: number;
  payload: SessionAccessPayload;
};

const sessionAccessMemory = new Map<string, SessionAccessCacheEntry>();
const sessionAccessInflight = new Map<string, Promise<SessionAccessPayload>>();

function storageKey(userId: string) {
  return `session_access:${userId}`;
}

function inflightKey(userId: string, allowCachedFallback: boolean) {
  return `${userId}:${allowCachedFallback ? 'cache-fallback' : 'fresh-only'}`;
}

function normalizeCacheEntry(value: unknown): SessionAccessCacheEntry | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  if ('payload' in record && record.payload && typeof record.payload === 'object') {
    return {
      cachedAt: typeof record.cachedAt === 'number' ? record.cachedAt : 0,
      payload: record.payload as SessionAccessPayload,
    };
  }

  return {
    cachedAt: 0,
    payload: record as SessionAccessPayload,
  };
}

async function readCachedSessionAccess(userId: string): Promise<SessionAccessCacheEntry | null> {
  const memory = sessionAccessMemory.get(userId);
  if (memory) return memory;

  try {
    const raw = await persistentStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = normalizeCacheEntry(JSON.parse(raw));
    if (!parsed) return null;
    sessionAccessMemory.set(userId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function cacheSessionAccess(userId: string, payload: SessionAccessPayload) {
  const entry: SessionAccessCacheEntry = {
    cachedAt: Date.now(),
    payload,
  };
  sessionAccessMemory.set(userId, entry);
  try {
    await persistentStorage.setItem(storageKey(userId), JSON.stringify(entry));
  } catch {
    // Non-fatal: keep the in-memory copy.
  }
}

export async function clearSessionAccessCache(userId: string | null) {
  if (!userId) return;
  sessionAccessMemory.delete(userId);
  sessionAccessInflight.delete(inflightKey(userId, true));
  sessionAccessInflight.delete(inflightKey(userId, false));
  try {
    await persistentStorage.removeItem(storageKey(userId));
  } catch {
    // Non-fatal.
  }
}

function isSessionAccessPayload(value: unknown): value is SessionAccessPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    'globalRole' in payload ||
    'effectiveRole' in payload ||
    'isMainAdmin' in payload ||
    'isLocalAdmin' in payload ||
    'isMuezzin' in payload ||
    'adminMosques' in payload ||
    'muezzinMosques' in payload
  );
}

export async function fetchSessionAccess(options?: {
  preferCache?: boolean;
  /** Keep false for route guards and other authorization decisions. */
  allowCachedFallback?: boolean;
  maxAgeMs?: number;
  session?: Session | null;
}): Promise<SessionAccessPayload> {
  if (!supportsServerApi()) {
    throw new Error('Server access API is unavailable in this runtime.');
  }

  const endpoints = resolveApiUrls('/api/session-access');
  if (!endpoints.length) {
    throw new Error('Could not resolve the session access endpoint.');
  }

  let session = options?.session ?? null;
  if (!session?.access_token) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      throw new Error('Your session has expired. Refresh the app and sign in again.');
    }
    session = sessionData.session;
  }

  const userId = session.user.id;
  const maxAgeMs = options?.maxAgeMs ?? 60_000;
  const allowCachedFallbackOption = options?.allowCachedFallback ?? true;
  const cached = await readCachedSessionAccess(userId);
  if (
    options?.preferCache &&
    allowCachedFallbackOption &&
    cached &&
    Date.now() - cached.cachedAt <= maxAgeMs
  ) {
    return cached.payload;
  }

  const requestKey = inflightKey(userId, allowCachedFallbackOption);
  const existingInflight = sessionAccessInflight.get(requestKey);
  if (existingInflight) {
    return existingInflight;
  }

  const fetchPromise = (async () => {
    let lastError: string | null = null;
    let allowCachedFallback = allowCachedFallbackOption;
    for (const endpoint of endpoints) {
      try {
        const response = await fetchServerApi(endpoint, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const responseCode =
            payload &&
            typeof payload === 'object' &&
            'code' in payload &&
            typeof (payload as any).code === 'string'
              ? (payload as any).code
              : null;
          if (
            response.status === 401 ||
            response.status === 403 ||
            responseCode === 'ACCOUNT_CONSENT_REQUIRED' ||
            responseCode === 'ACCOUNT_CONSENT_CONTROL_UNAVAILABLE'
          ) {
            // Never revive cached roles after an authentication/consent
            // denial. The cache is a performance aid, not authorization.
            allowCachedFallback = false;
            await clearSessionAccessCache(userId);
          }
          lastError =
            (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
              ? (payload as any).error
              : null) || `Unable to resolve the current session access at ${endpoint}.`;
          console.warn('[fetchSessionAccess] non-ok response', {
            endpoint,
            status: response.status,
            statusText: response.statusText,
            error:
              payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
                ? (payload as any).error
                : null,
          });
          continue;
        }

        if (!contentType.includes('application/json') || !isSessionAccessPayload(payload)) {
          lastError = `Unexpected session access payload at ${endpoint}.`;
          console.warn('[fetchSessionAccess] unexpected payload', {
            endpoint,
            status: response.status,
            contentType,
          });
          continue;
        }

        await cacheSessionAccess(userId, payload);
        return payload;
      } catch (error: any) {
        lastError = error?.message ?? 'Unable to resolve the current session access.';
      }
    }

    if (allowCachedFallback) {
      const fallbackCached = await readCachedSessionAccess(userId);
      if (fallbackCached) {
        return fallbackCached.payload;
      }
    }

    throw new Error(lastError || 'Unable to resolve the current session access.');
  })();

  sessionAccessInflight.set(requestKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    sessionAccessInflight.delete(requestKey);
  }
}
