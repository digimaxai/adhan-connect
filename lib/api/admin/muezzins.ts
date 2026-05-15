import { supabase } from '../../supabase';
import type { MuezzinCoverRequest } from '../../types/muezzin';
import { fetchServerApi, resolveApiUrls, supportsServerApi } from '../apiBaseUrl';

export type MosqueMuezzinMember = {
  userId: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: string | null;
};

type ProfileLookup = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

async function fetchProfileMap(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, ProfileLookup>;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, email')
    .in('id', userIds);

  if (error && error.code !== 'PGRST116') {
    console.warn('[fetchProfileMap]', error);
    return {} as Record<string, ProfileLookup>;
  }

  const map: Record<string, ProfileLookup> = {};
  (data ?? []).forEach((row: any) => {
    map[row.id] = row as ProfileLookup;
  });
  return map;
}

function displayNameForProfile(profile?: ProfileLookup | null) {
  return profile?.display_name ?? profile?.full_name ?? profile?.email ?? 'Muezzin';
}

async function getAccessToken() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh and sign in again.');
  }
  return sessionData.session.access_token;
}

async function getDefaultMuezzinUserId(mosqueId: string) {
  const { data, error } = await supabase
    .from('mosques')
    .select('default_muezzin_user_id')
    .eq('id', mosqueId)
    .maybeSingle<{ default_muezzin_user_id?: string | null }>();

  if (error && !['PGRST116', '42703'].includes(error.code)) {
    console.warn('[getDefaultMuezzinUserId]', error.message);
  }

  return error?.code === '42703' ? null : data?.default_muezzin_user_id ?? null;
}

export async function getMosqueMuezzinMembers(mosqueId: string): Promise<MosqueMuezzinMember[]> {
  let rows:
    | Array<{ user_id: string; is_active?: boolean | null; created_at?: string | null }>
    | null = null;
  let error: any = null;

  ({ data: rows, error } = await supabase
    .from('muezzins')
    .select('user_id, is_active, created_at')
    .eq('mosque_id', mosqueId)
    .order('created_at', { ascending: false }));

  if (error && error.code === '42703') {
    ({ data: rows, error } = await supabase
      .from('muezzins')
      .select('user_id, is_active')
      .eq('mosque_id', mosqueId));
  }

  if (error && error.code !== 'PGRST116') throw error;

  const safeRows = rows ?? [];
  const [profileMap, defaultMuezzinUserId] = await Promise.all([
    fetchProfileMap(safeRows.map((row) => row.user_id)),
    getDefaultMuezzinUserId(mosqueId),
  ]);

  return safeRows.map((row) => {
    const profile = profileMap[row.user_id];
    return {
      userId: row.user_id,
      displayName: displayNameForProfile(profile),
      email: profile?.email ?? null,
      isActive: row.is_active !== false,
      isDefault: row.user_id === defaultMuezzinUserId,
      createdAt: row.created_at ?? null,
    };
  });
}

export async function setMosqueDefaultMuezzin(mosqueId: string, userId: string | null) {
  if (supportsServerApi()) {
    const endpoints = resolveApiUrls('/api/admin/muezzin-default');
    const accessToken = await getAccessToken();
    let lastError: unknown = null;
    let serverRejection: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetchServerApi(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ mosqueId, userId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          serverRejection = new Error(payload?.error || 'Unable to update the default muezzin.');
          break;
        }
        return;
      } catch (error) {
        lastError = error;
      }
    }

    if (serverRejection) {
      throw serverRejection;
    }

    if (lastError) {
      console.warn('[setMosqueDefaultMuezzin] server fallback', lastError);
    }
  }

  const { error } = await supabase
    .from('mosques')
    .update({ default_muezzin_user_id: userId })
    .eq('id', mosqueId);

  if (error) throw error;
}

export async function setMosqueMuezzinActive(mosqueId: string, userId: string, isActive: boolean) {
  const { error } = await supabase
    .from('muezzins')
    .update({ is_active: isActive })
    .eq('mosque_id', mosqueId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function removeMosqueMuezzin(mosqueId: string, userId: string) {
  const { error } = await supabase
    .from('muezzins')
    .delete()
    .eq('mosque_id', mosqueId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getMosqueCoverRequests(mosqueId: string): Promise<MuezzinCoverRequest[]> {
  const { data, error } = await supabase
    .from('muezzin_cover_requests')
    .select(
      'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
    )
    .eq('mosque_id', mosqueId)
    .order('created_at', { ascending: false });

  if (error && error.code !== 'PGRST116') throw error;

  const rows = (data ?? []) as MuezzinCoverRequest[];
  const relatedIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.requester_user_id, row.volunteer_user_id ?? null, row.resolved_by_user_id ?? null])
        .filter(Boolean) as string[]
    )
  );
  const profileMap = await fetchProfileMap(relatedIds);

  return rows.map((row) => ({
    ...row,
    requester_name: displayNameForProfile(profileMap[row.requester_user_id]),
    volunteer_name: row.volunteer_user_id ? displayNameForProfile(profileMap[row.volunteer_user_id]) : null,
    resolved_by_name: row.resolved_by_user_id ? displayNameForProfile(profileMap[row.resolved_by_user_id]) : null,
  }));
}
