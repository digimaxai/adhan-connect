import type { RequestHandler } from 'expo-router/server';
import { hasMosqueAdminAccess, json, requireAdminAccess } from '../../../lib/server/adminAccess';

type MosqueMuezzinMember = {
  userId: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string | null;
};

type MuezzinCoverRequest = {
  id: string;
  mosque_id: string;
  date: string;
  prayer_name: string;
  requester_user_id: string;
  original_muezzin_user_id: string;
  volunteer_user_id?: string | null;
  request_kind: string;
  urgency: string;
  status: string;
  reason?: string | null;
  requested_at?: string | null;
  responded_at?: string | null;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  requester_name?: string | null;
  volunteer_name?: string | null;
  resolved_by_name?: string | null;
};

type ProfileLookup = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

function displayNameForProfile(profile?: ProfileLookup | null) {
  return profile?.display_name ?? profile?.full_name ?? profile?.email ?? 'Muezzin';
}

async function fetchProfileMap(supabaseAdmin: any, userIds: string[]) {
  if (!userIds.length) return {} as Record<string, ProfileLookup>;
  const ids = Array.from(new Set(userIds));

  const [profilesRes, usersRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, display_name, email').in('id', ids),
    supabaseAdmin.from('users').select('id, email').in('id', ids),
  ]);

  const map: Record<string, ProfileLookup> = {};
  (profilesRes.data ?? []).forEach((row: any) => {
    map[row.id] = row as ProfileLookup;
  });
  (usersRes.data ?? []).forEach((row: any) => {
    map[row.id] = {
      ...(map[row.id] ?? {}),
      id: row.id,
      email: map[row.id]?.email ?? row.email ?? null,
    };
  });
  return map;
}

export const GET: RequestHandler = async (request) => {
  const auth = await requireAdminAccess(request);
  if ('response' in auth) {
    return auth.response;
  }

  const url = new URL(request.url);
  const mosqueId = (url.searchParams.get('mosqueId') ?? '').trim();

  if (!mosqueId) {
    return json({ error: 'A mosqueId query parameter is required.' }, 400);
  }

  if (!hasMosqueAdminAccess(auth.context, mosqueId)) {
    return json({ error: 'You do not have access to this mosque workspace.' }, 403);
  }

  const { supabaseAdmin } = auth.context;
  const [muezzinRes, requestRes, mosqueRes] = await Promise.all([
    supabaseAdmin
      .from('muezzins')
      .select('user_id, is_active, created_at')
      .eq('mosque_id', mosqueId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('muezzin_cover_requests')
      .select(
        'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
      )
      .eq('mosque_id', mosqueId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('mosques')
      .select('default_muezzin_user_id')
      .eq('id', mosqueId)
      .maybeSingle<{ default_muezzin_user_id?: string | null }>(),
  ]);

  if (muezzinRes.error && muezzinRes.error.code !== 'PGRST116') {
    return json({ error: muezzinRes.error.message || 'Unable to load muezzin assignments.' }, 500);
  }

  if (requestRes.error && requestRes.error.code !== 'PGRST116') {
    return json({ error: requestRes.error.message || 'Unable to load cover requests.' }, 500);
  }

  if (mosqueRes.error && !['PGRST116', '42703'].includes(mosqueRes.error.code)) {
    return json({ error: mosqueRes.error.message || 'Unable to load the mosque default muezzin.' }, 500);
  }

  const defaultMuezzinUserId = mosqueRes.error?.code === '42703'
    ? null
    : mosqueRes.data?.default_muezzin_user_id ?? null;
  const muezzinRows = (muezzinRes.data ?? []) as { user_id: string; is_active?: boolean | null; created_at?: string | null }[];
  const requestRows = (requestRes.data ?? []) as MuezzinCoverRequest[];
  const relatedIds = Array.from(
    new Set([
      ...muezzinRows.map((row) => row.user_id),
      ...requestRows.flatMap((row) => [
        row.requester_user_id,
        row.volunteer_user_id ?? null,
        row.resolved_by_user_id ?? null,
      ]),
    ].filter(Boolean))
  ) as string[];
  const profileMap = await fetchProfileMap(supabaseAdmin, relatedIds);

  const members: MosqueMuezzinMember[] = muezzinRows.map((row) => {
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

  const coverRequests = requestRows.map((row) => ({
    ...row,
    requester_name: displayNameForProfile(profileMap[row.requester_user_id]),
    volunteer_name: row.volunteer_user_id ? displayNameForProfile(profileMap[row.volunteer_user_id]) : null,
    resolved_by_name: row.resolved_by_user_id ? displayNameForProfile(profileMap[row.resolved_by_user_id]) : null,
  }));

  return json({
    members,
    coverRequests,
    defaultMuezzinUserId,
  });
};
