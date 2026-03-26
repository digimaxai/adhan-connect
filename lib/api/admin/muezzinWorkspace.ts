import { resolveApiUrl, supportsServerApi } from '../apiBaseUrl';
import { supabase } from '../../supabase';
import { getMosqueCoverRequests, getMosqueMuezzinMembers, type MosqueMuezzinMember } from './muezzins';
import type { MuezzinCoverRequest } from '../../types/muezzin';

async function loadMosqueMuezzinWorkspaceFallback(mosqueId: string) {
  const [membersResult, coverRequestsResult] = await Promise.allSettled([
    getMosqueMuezzinMembers(mosqueId),
    getMosqueCoverRequests(mosqueId),
  ]);

  const members = membersResult.status === 'fulfilled' ? membersResult.value : [];
  const coverRequests = coverRequestsResult.status === 'fulfilled' ? coverRequestsResult.value : [];

  if (membersResult.status === 'rejected') {
    console.warn('[loadMosqueMuezzinWorkspaceFallback] members lookup failed', membersResult.reason);
  }

  if (coverRequestsResult.status === 'rejected') {
    console.warn('[loadMosqueMuezzinWorkspaceFallback] cover-request lookup failed', coverRequestsResult.reason);
  }

  if (membersResult.status === 'rejected' && coverRequestsResult.status === 'rejected') {
    throw membersResult.reason ?? coverRequestsResult.reason;
  }

  return {
    members,
    coverRequests,
  };
}

export async function loadMosqueMuezzinWorkspace(mosqueId: string): Promise<{
  members: MosqueMuezzinMember[];
  coverRequests: MuezzinCoverRequest[];
}> {
  if (!supportsServerApi()) {
    return loadMosqueMuezzinWorkspaceFallback(mosqueId);
  }

  const endpoint = resolveApiUrl('/api/admin/muezzin-workspace');
  if (!endpoint) {
    return loadMosqueMuezzinWorkspaceFallback(mosqueId);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh and sign in again.');
  }

  try {
    const url = new URL(endpoint);
    url.searchParams.set('mosqueId', mosqueId);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to load the mosque muezzin workspace.');
    }

    return {
      members: (payload.members ?? []) as MosqueMuezzinMember[],
      coverRequests: (payload.coverRequests ?? []) as MuezzinCoverRequest[],
    };
  } catch (error) {
    console.warn('[loadMosqueMuezzinWorkspace] server fallback', error);
    return loadMosqueMuezzinWorkspaceFallback(mosqueId);
  }
}
