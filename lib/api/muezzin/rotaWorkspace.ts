import { resolveApiUrls, supportsServerApi } from '../apiBaseUrl';
import { getMyCoverRequestState } from '../coverRequests';
import { supabase } from '../../supabase';
import { getMuezzinRotaForRange } from './schedule';
import type { MuezzinCoverRequest, StaffRotaEntry } from '../../types/muezzin';

type MyRotaWorkspacePayload = {
  entries: StaffRotaEntry[];
  profileNames: Record<string, string>;
  mosqueId: string | null;
  mosqueName: string | null;
  userId: string | null;
  myRequests: MuezzinCoverRequest[];
  openRequests: MuezzinCoverRequest[];
  error: string | null;
};

function isMyRotaWorkspacePayload(value: unknown): value is Partial<MyRotaWorkspacePayload> {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    'entries' in payload ||
    'profileNames' in payload ||
    'mosqueId' in payload ||
    'mosqueName' in payload ||
    'userId' in payload ||
    'myRequests' in payload ||
    'openRequests' in payload ||
    'error' in payload
  );
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadMyRotaWorkspaceFallback(startDate: Date, endDate: Date): Promise<MyRotaWorkspacePayload> {
  const rota = await getMuezzinRotaForRange(startDate, endDate);
  const requestState = rota.mosqueId ? await getMyCoverRequestState(rota.mosqueId) : { myRequests: [], openRequests: [] };

  return {
    entries: rota.entries ?? [],
    profileNames: rota.profileNames ?? {},
    mosqueId: rota.mosqueId ?? null,
    mosqueName: rota.mosqueName ?? null,
    userId: rota.userId ?? null,
    myRequests: requestState.myRequests ?? [],
    openRequests: requestState.openRequests ?? [],
    error: rota.error?.message ?? null,
  };
}

export async function loadMyRotaWorkspace(startDate: Date, endDate: Date): Promise<MyRotaWorkspacePayload> {
  if (!supportsServerApi()) {
    return loadMyRotaWorkspaceFallback(startDate, endDate);
  }

  const endpoints = resolveApiUrls('/api/muezzin/rota-workspace');
  if (!endpoints.length) {
    return loadMyRotaWorkspaceFallback(startDate, endDate);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh and sign in again.');
  }

  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('start', toIsoDate(startDate));
      url.searchParams.set('end', toIsoDate(endDate));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        lastError = new Error(
          payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
            ? (payload as any).error
            : 'Unable to load the muezzin rota workspace.'
        );
        console.warn('[loadMyRotaWorkspace] non-ok response', {
          endpoint: url.toString(),
          status: response.status,
          statusText: response.statusText,
          error:
            payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
              ? (payload as any).error
              : null,
        });
        continue;
      }

      if (!contentType.includes('application/json') || !isMyRotaWorkspacePayload(payload)) {
        lastError = new Error(`Unexpected muezzin rota workspace payload at ${url.toString()}.`);
        console.warn('[loadMyRotaWorkspace] unexpected payload', {
          endpoint: url.toString(),
          status: response.status,
          contentType,
        });
        continue;
      }

      return {
        entries: (payload.entries ?? []) as StaffRotaEntry[],
        profileNames: (payload.profileNames ?? {}) as Record<string, string>,
        mosqueId: payload.mosqueId ?? null,
        mosqueName: payload.mosqueName ?? null,
        userId: payload.userId ?? null,
        myRequests: (payload.myRequests ?? []) as MuezzinCoverRequest[],
        openRequests: (payload.openRequests ?? []) as MuezzinCoverRequest[],
        error: payload.error ?? null,
      };
    } catch (error) {
      lastError = error;
    }
  }

  console.warn('[loadMyRotaWorkspace] server fallback', lastError);
  return loadMyRotaWorkspaceFallback(startDate, endDate);
}
