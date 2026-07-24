import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { fetchServerApi, resolveApiUrls, supportsServerApi } from './apiBaseUrl';
import { persistentStorage } from '../persistentStorage';
import { signOutCurrentDeviceFailClosed } from '../authSessionCleanup';
import { clearSessionAccessCache } from '../sessionAccess';
import { supabase } from '../supabase';

export const ACCOUNT_LEGAL_URLS = {
  deleteAccount: 'https://www.maksums.com/adhan-connect/delete-account/',
  privacy: 'https://www.maksums.com/adhan-connect/privacy/',
  terms: 'https://www.maksums.com/adhan-connect/terms/',
} as const;

export type AccountImpactIssue = {
  code: string;
  count?: number;
  message: string;
  mosqueIds?: string[];
};

export type AccountDeletionImpact = {
  schemaVersion: string;
  generatedAt: string;
  confirmationExpiresAt: string;
  subjectUserId: string;
  providers: string[];
  recentAuthentication: {
    ageSeconds: number | null;
    authenticatedAt: string | null;
    isRecent: boolean;
    maximumAgeSeconds: number;
    method: string | null;
  };
  readiness: {
    approvalVersion: string;
    appleTokenRevocationReady: boolean;
    databaseApprovalPresent: boolean;
    deletionEnabled: boolean;
    durableRateLimitReady: boolean;
    orchestrationAudited: boolean;
    productionSchemaAudited: boolean;
    storageAuditComplete: boolean;
    storageBucketsConfigured: boolean;
  };
  releaseBlockers: string[];
  canDelete: boolean;
  requiresRecentAuthentication: boolean;
  blockers: AccountImpactIssue[];
  warnings: AccountImpactIssue[];
  unresolvedChecks: string[];
  impact: {
    activeBroadcastCount: number;
    activeStreamCount: number;
    authoredOperationalRecordCount: number;
    broadcastHistoryCount: number;
    defaultMuezzinMosqueIds: string[];
    localAdminMosqueIds: string[];
    muezzinMosqueIds: string[];
    openCoverCount: number;
    ownedStorageFileCount: number;
    soleLocalAdminMosqueIds: string[];
    upcomingRotaCount: number;
  };
  impactFingerprint: string;
};

type AccountApiErrorPayload = {
  code?: string;
  error?: string;
  impact?: AccountDeletionImpact;
  requestId?: string;
};

export class AccountApiError extends Error {
  code: string | null;
  impact: AccountDeletionImpact | null;
  requestId: string | null;
  status: number;

  constructor(
    message: string,
    options: {
      code?: string | null;
      impact?: AccountDeletionImpact | null;
      requestId?: string | null;
      status: number;
    }
  ) {
    super(message);
    this.name = 'AccountApiError';
    this.code = options.code ?? null;
    this.impact = options.impact ?? null;
    this.requestId = options.requestId ?? null;
    this.status = options.status;
  }
}

async function requireSession(session?: Session | null) {
  if (session?.access_token) return session;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new AccountApiError('Your session has expired. Sign in again.', {
      code: 'SESSION_EXPIRED',
      status: 401,
    });
  }
  return data.session;
}

async function callAccountApi<T>(
  path: string,
  options?: {
    allowEndpointFailover?: boolean;
    body?: unknown;
    method?: 'GET' | 'POST';
    session?: Session | null;
    timeoutMs?: number;
  }
) {
  if (!supportsServerApi()) {
    throw new AccountApiError(
      'Account services are unavailable in this version of the app.',
      { code: 'ACCOUNT_SERVICE_UNAVAILABLE', status: 503 }
    );
  }

  const session = await requireSession(options?.session);
  const endpoints = resolveApiUrls(path);
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetchServerApi(
        endpoint,
        {
          method: options?.method ?? 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(options?.body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          ...(options?.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
        },
        options?.timeoutMs ?? 30_000
      );
      const payload = (await response.json().catch(() => null)) as
        | AccountApiErrorPayload
        | T
        | null;
      if (!response.ok) {
        const errorPayload = (payload ?? {}) as AccountApiErrorPayload;
        throw new AccountApiError(
          errorPayload.error || 'The account request failed.',
          {
            code: errorPayload.code,
            impact: errorPayload.impact,
            requestId:
              errorPayload.requestId ?? response.headers.get('x-request-id'),
            status: response.status,
          }
        );
      }
      if (!payload || typeof payload !== 'object') {
        throw new AccountApiError('The account service returned an invalid response.', {
          code: 'INVALID_RESPONSE',
          status: 502,
        });
      }
      return payload as T;
    } catch (error) {
      if (error instanceof AccountApiError && error.status < 500) throw error;
      lastError = error;
      if (options?.allowEndpointFailover === false) break;
    }
  }

  if (lastError instanceof AccountApiError) throw lastError;
  throw new AccountApiError('Could not reach the account service. Try again.', {
    code: 'NETWORK_ERROR',
    status: 503,
  });
}

export async function fetchAccountExport(session?: Session | null) {
  return callAccountApi<Record<string, unknown>>('/api/account/export', {
    session,
    timeoutMs: 90_000,
  });
}

function accountExportFilename() {
  return `adhan-connect-account-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function saveOrShareAccountExport(payload: Record<string, unknown>) {
  const filename = accountExportFilename();
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      throw new Error('Browser downloads are unavailable.');
    }
    const url = URL.createObjectURL(
      new Blob([json], { type: 'application/json;charset=utf-8' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { filename, shared: false };
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('A temporary export location is unavailable.');
  }
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('The share sheet is unavailable on this device.');
    }
    await Sharing.shareAsync(fileUri, {
      UTI: 'public.json',
      dialogTitle: 'Save or share your Adhan Connect data',
      mimeType: 'application/json',
    });
    return { filename, shared: true };
  } finally {
    await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
  }
}

export async function fetchAccountDeletionImpact(session?: Session | null) {
  return callAccountApi<AccountDeletionImpact>('/api/account/deletion-impact', {
    session,
    timeoutMs: 60_000,
  });
}

export async function withdrawCurrentAccountConsent(session?: Session | null) {
  return callAccountApi<{
    accountFeaturesRestricted: true;
    localSignOutRequired: true;
    refreshSessionsRevoked: boolean;
    withdrawn: true;
    withdrawnAt: string;
  }>('/api/account/consent/withdraw', {
    allowEndpointFailover: false,
    method: 'POST',
    session,
    timeoutMs: 30_000,
  });
}

export async function deleteCurrentAccount(
  input: {
    confirmation: 'DELETE';
    impactFingerprint: string;
  },
  session?: Session | null
) {
  return callAccountApi<{ deleted: true; localSignOutRequired: boolean }>(
    '/api/account/delete',
    {
      body: input,
      allowEndpointFailover: false,
      method: 'POST',
      session,
      timeoutMs: 90_000,
    }
  );
}

export async function clearDeletedAccountLocalData(userId: string) {
  const keys = [
    `session_access:${userId}`,
    `staff_entry_mode:${userId}`,
    `staff_entry_selection_required:${userId}`,
    `default_mosque_id:${userId}`,
    `admin_pref:notif_cover_requests:${userId}`,
    `admin_pref:notif_rota_changes:${userId}`,
    `admin_pref:time_format:${userId}`,
    `muezzin_schedule_cache:${userId}`,
  ];
  const removals = await Promise.allSettled(
    keys.map((key) => persistentStorage.removeItem(key))
  );
  let localPreferenceCleanupFailed = removals.some(
    (result) => result.status === 'rejected'
  );
  await clearSessionAccessCache(userId);
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(`admin:selected_mosque_id:${userId}`);
    } catch {
      localPreferenceCleanupFailed = true;
    }
  }
  await signOutCurrentDeviceFailClosed();
  if (localPreferenceCleanupFailed) {
    throw new Error('LOCAL_ACCOUNT_PREFERENCE_CLEAR_FAILED');
  }
}
