import { supabase } from '../../supabase';
import type { MuezzinCoverRequest } from '../../types/muezzin';

export type MosqueMuezzinMember = {
  userId: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
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
  const profileMap = await fetchProfileMap(safeRows.map((row) => row.user_id));

  return safeRows.map((row) => {
    const profile = profileMap[row.user_id];
    return {
      userId: row.user_id,
      displayName: displayNameForProfile(profile),
      email: profile?.email ?? null,
      isActive: row.is_active !== false,
      createdAt: row.created_at ?? null,
    };
  });
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
