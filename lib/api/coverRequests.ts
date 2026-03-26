import { supabase } from '../supabase';
import { insertAppNotifications } from './appNotifications';
import type {
  CoverRequestStatus,
  MuezzinCoverRequest,
  RotaPrayerName,
  StaffRotaEntry,
} from '../types/muezzin';

type CreateCoverRequestInput = {
  mosqueId: string;
  date: string;
  prayerName: RotaPrayerName;
  reason?: string;
  urgency: 'standard' | 'urgent';
};

type ResolveCoverRequestInput = {
  requestId: string;
  action: 'approve' | 'dismiss';
  assignedByUserId: string;
};

function formatPrayerLabel(prayerName: RotaPrayerName) {
  return prayerName.charAt(0).toUpperCase() + prayerName.slice(1);
}

function formatDateLabel(dateIso: string) {
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function activeStatuses(): CoverRequestStatus[] {
  return ['open', 'volunteered', 'provisional_cover'];
}

async function fetchProfileNameMap(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, string>;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, email')
    .in('id', userIds);

  if (error && error.code !== 'PGRST116') {
    console.warn('[fetchProfileNameMap]', error);
    return {} as Record<string, string>;
  }

  const map: Record<string, string> = {};
  (data ?? []).forEach((row: any) => {
    map[row.id] = row.display_name ?? row.full_name ?? row.email ?? row.id;
  });
  return map;
}

async function enrichRequests(rows: MuezzinCoverRequest[]) {
  const userIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.requester_user_id, row.volunteer_user_id ?? null, row.resolved_by_user_id ?? null])
        .filter(Boolean) as string[]
    )
  );
  const nameMap = await fetchProfileNameMap(userIds);
  return rows.map((row) => ({
    ...row,
    requester_name: nameMap[row.requester_user_id] ?? null,
    volunteer_name: row.volunteer_user_id ? nameMap[row.volunteer_user_id] ?? null : null,
    resolved_by_name: row.resolved_by_user_id ? nameMap[row.resolved_by_user_id] ?? null : null,
  }));
}

async function fetchCoverRequestById(requestId: string) {
  const { data, error } = await supabase
    .from('muezzin_cover_requests')
    .select(
      'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
    )
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as MuezzinCoverRequest | null;
}

async function fetchLocalAdminIdsForMosque(mosqueId: string) {
  const { data, error } = await supabase
    .from('mosque_admins')
    .select('user_id')
    .eq('mosque_id', mosqueId);

  if (error && error.code !== 'PGRST116') throw error;
  return Array.from(new Set(((data ?? []) as { user_id: string }[]).map((row) => row.user_id)));
}

async function fetchStaffRotaRow(mosqueId: string, dateIso: string, prayerName: RotaPrayerName) {
  let data: any = null;
  let error: any = null;
  ({ data, error } = await supabase
    .from('staff_rota')
    .select('id, mosque_id, date, prayer_name, muezzin_user_id, staff_user_id, notes, adhan_time, iqama_time')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .eq('prayer_name', prayerName)
    .maybeSingle());

  if (error?.code === '42703') {
    const fallback = await supabase
      .from('staff_rota')
      .select('id, mosque_id, date, prayer_name, muezzin_user_id, staff_user_id, notes')
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso)
      .eq('prayer_name', prayerName)
      .maybeSingle();
    data = fallback.data ?? null;
    error = fallback.error ?? null;
  }

  if (error && error.code !== 'PGRST116') throw error;
  return (data ?? null) as StaffRotaEntry | null;
}

async function writeStaffRotaAssignee(
  baseRow: StaffRotaEntry,
  volunteerUserId: string,
  assignedByUserId: string
) {
  const payload = {
    mosque_id: baseRow.mosque_id,
    date: baseRow.date,
    prayer_name: baseRow.prayer_name,
    muezzin_user_id: volunteerUserId,
    staff_user_id: volunteerUserId,
    duty_date: baseRow.date,
    prayer: baseRow.prayer_name,
    notes: baseRow.notes ?? null,
    adhan_time: baseRow.adhan_time ?? null,
    iqama_time: baseRow.iqama_time ?? null,
    assigned_by: assignedByUserId,
  };

  const { error: deleteError } = await supabase
    .from('staff_rota')
    .delete()
    .eq('mosque_id', baseRow.mosque_id)
    .eq('date', baseRow.date)
    .eq('prayer_name', baseRow.prayer_name);

  if (deleteError && deleteError.code !== 'PGRST116') throw deleteError;

  let { error } = await supabase.from('staff_rota').insert(payload as any);
  const message = `${error?.message ?? ''}`.toLowerCase();
  if (
    error &&
    (error.code === '42703' ||
      error.code === '23503' ||
      message.includes('adhan_time') ||
      message.includes('iqama_time') ||
      message.includes('assigned_by'))
  ) {
    const legacyPayload = {
      mosque_id: baseRow.mosque_id,
      date: baseRow.date,
      prayer_name: baseRow.prayer_name,
      muezzin_user_id: volunteerUserId,
      staff_user_id: volunteerUserId,
      duty_date: baseRow.date,
      prayer: baseRow.prayer_name,
      notes: baseRow.notes ?? null,
      assigned_by: assignedByUserId,
    };
    const legacyResult = await supabase.from('staff_rota').insert(legacyPayload as any);
    error = legacyResult.error ?? null;
  }

  const legacyMessage = `${error?.message ?? ''}`.toLowerCase();
  if (
    error &&
    (error.code === '42703' ||
      legacyMessage.includes('staff_user_id') ||
      legacyMessage.includes('duty_date') ||
      legacyMessage.includes('prayer') ||
      legacyMessage.includes('assigned_by'))
  ) {
    const minimalPayload = {
      mosque_id: baseRow.mosque_id,
      date: baseRow.date,
      prayer_name: baseRow.prayer_name,
      muezzin_user_id: volunteerUserId,
      notes: baseRow.notes ?? null,
    };
    const minimalResult = await supabase.from('staff_rota').insert(minimalPayload as any);
    error = minimalResult.error ?? null;
  }

  if (error) throw error;
}

export async function getCoverRequestsForMosque(
  mosqueId: string,
  statuses?: CoverRequestStatus[]
): Promise<MuezzinCoverRequest[]> {
  let query = supabase
    .from('muezzin_cover_requests')
    .select(
      'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
    )
    .eq('mosque_id', mosqueId)
    .order('created_at', { ascending: false });

  if (statuses?.length) {
    query = query.in('status', statuses);
  }

  const { data, error } = await query;
  if (error && error.code !== 'PGRST116') throw error;
  return enrichRequests(((data ?? []) as MuezzinCoverRequest[]) ?? []);
}

export async function getMyCoverRequestState(mosqueId: string) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) {
    return { userId: null, myRequests: [], openRequests: [] as MuezzinCoverRequest[] };
  }

  const requests = await getCoverRequestsForMosque(mosqueId, activeStatuses());
  return {
    userId: user.id,
    myRequests: requests.filter((request) => request.requester_user_id === user.id),
    openRequests: requests.filter(
      (request) =>
        request.requester_user_id !== user.id &&
        !request.volunteer_user_id &&
        request.status === 'open'
    ),
  };
}

export async function createCoverRequest(input: CreateCoverRequestInput) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error('Please sign in again.');

  const existingRow = await fetchStaffRotaRow(input.mosqueId, input.date, input.prayerName);
  const originalUserId = existingRow?.muezzin_user_id ?? existingRow?.staff_user_id ?? null;
  if (!originalUserId || originalUserId !== user.id) {
    throw new Error('Only the assigned muezzin can request cover for this slot.');
  }

  const payload = {
    mosque_id: input.mosqueId,
    date: input.date,
    prayer_name: input.prayerName,
    requester_user_id: user.id,
    original_muezzin_user_id: originalUserId,
    request_kind: 'cover',
    urgency: input.urgency,
    status: 'open',
    reason: input.reason?.trim() || null,
    requested_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('muezzin_cover_requests')
    .insert(payload)
    .select(
      'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
    )
    .single();

  if (error) throw error;

  const adminIds = await fetchLocalAdminIdsForMosque(input.mosqueId);
  if (adminIds.length) {
    const title =
      input.urgency === 'urgent'
        ? `${formatPrayerLabel(input.prayerName)} needs urgent cover`
        : `${formatPrayerLabel(input.prayerName)} cover requested`;
    const body = `${formatDateLabel(input.date)} now needs local-admin attention.`;

    await insertAppNotifications(
      adminIds.map((userId) => ({
        user_id: userId,
        mosque_id: input.mosqueId,
        actor_user_id: user.id,
        type: input.urgency === 'urgent' ? 'cover_request_urgent' : 'cover_request_created',
        title,
        body,
        metadata: {
          requestId: data.id,
          date: input.date,
          prayerName: input.prayerName,
          urgency: input.urgency,
        },
      }))
    );
  }

  return data as MuezzinCoverRequest;
}

export async function volunteerForCoverRequest(requestId: string) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error('Please sign in again.');

  const request = await fetchCoverRequestById(requestId);
  if (!request) throw new Error('This cover request no longer exists.');
  if (request.requester_user_id === user.id) {
    throw new Error('You cannot volunteer for your own request.');
  }
  if (request.status !== 'open') {
    throw new Error('This cover request is no longer open.');
  }

  const nextStatus: CoverRequestStatus =
    request.urgency === 'urgent' ? 'provisional_cover' : 'volunteered';

  const { data, error } = await supabase
    .from('muezzin_cover_requests')
    .update({
      volunteer_user_id: user.id,
      status: nextStatus,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'open')
    .select(
      'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
    )
    .single();

  if (error) throw error;

  const recipients = [request.requester_user_id, ...(await fetchLocalAdminIdsForMosque(request.mosque_id))];
  const title =
    nextStatus === 'provisional_cover'
      ? `${formatPrayerLabel(request.prayer_name)} has provisional cover`
      : `${formatPrayerLabel(request.prayer_name)} has a volunteer`;
  const body =
    nextStatus === 'provisional_cover'
      ? `${formatDateLabel(request.date)} now has emergency backup pending confirmation.`
      : `${formatDateLabel(request.date)} is awaiting local-admin approval.`;

  await insertAppNotifications(
    Array.from(new Set(recipients)).map((recipientId) => ({
      user_id: recipientId,
      mosque_id: request.mosque_id,
      actor_user_id: user.id,
      type: nextStatus === 'provisional_cover' ? 'cover_request_provisional' : 'cover_request_volunteered',
      title,
      body,
      metadata: {
        requestId,
        date: request.date,
        prayerName: request.prayer_name,
      },
    }))
  );

  return data as MuezzinCoverRequest;
}

export async function cancelCoverRequest(requestId: string) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error('Please sign in again.');

  const request = await fetchCoverRequestById(requestId);
  if (!request) throw new Error('This cover request no longer exists.');

  const { data, error } = await supabase
    .from('muezzin_cover_requests')
    .update({
      status: 'cancelled',
      resolved_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
      resolved_by_user_id: user.id,
    })
    .eq('id', requestId)
    .eq('requester_user_id', user.id)
    .in('status', activeStatuses())
    .select(
      'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
    )
    .single();

  if (error) throw error;

  const recipients = [
    ...(await fetchLocalAdminIdsForMosque(request.mosque_id)),
    request.volunteer_user_id ?? null,
  ].filter(Boolean) as string[];

  if (recipients.length) {
    await insertAppNotifications(
      Array.from(new Set(recipients)).map((recipientId) => ({
        user_id: recipientId,
        mosque_id: request.mosque_id,
        actor_user_id: user.id,
        type: 'cover_request_cancelled',
        title: `${formatPrayerLabel(request.prayer_name)} cover request cancelled`,
        body: `${formatDateLabel(request.date)} no longer needs cover.`,
        metadata: {
          requestId,
          date: request.date,
          prayerName: request.prayer_name,
        },
      }))
    );
  }

  return data as MuezzinCoverRequest;
}

export async function resolveCoverRequest(input: ResolveCoverRequestInput) {
  const request = await fetchCoverRequestById(input.requestId);
  if (!request) throw new Error('This cover request no longer exists.');

  if (input.action === 'approve') {
    if (!request.volunteer_user_id) {
      throw new Error('A volunteer must accept cover before this request can be approved.');
    }
    const staffRow = await fetchStaffRotaRow(request.mosque_id, request.date, request.prayer_name);
    if (!staffRow) {
      throw new Error('The original rota row could not be found for this prayer.');
    }
    await writeStaffRotaAssignee(staffRow, request.volunteer_user_id, input.assignedByUserId);
  }

  const status: CoverRequestStatus = input.action === 'approve' ? 'approved' : 'dismissed';
  const { data, error } = await supabase
    .from('muezzin_cover_requests')
    .update({
      status,
      resolved_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
      resolved_by_user_id: input.assignedByUserId,
    })
    .eq('id', input.requestId)
    .in('status', activeStatuses())
    .select(
      'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
    )
    .single();

  if (error) throw error;

  const recipients = [request.requester_user_id, request.volunteer_user_id ?? null].filter(Boolean) as string[];
  const title =
    input.action === 'approve'
      ? `${formatPrayerLabel(request.prayer_name)} cover approved`
      : `${formatPrayerLabel(request.prayer_name)} cover request closed`;
  const body =
    input.action === 'approve'
      ? `${formatDateLabel(request.date)} now has a confirmed replacement.`
      : `${formatDateLabel(request.date)} still needs local follow-up in the rota.`;

  if (recipients.length) {
    await insertAppNotifications(
      Array.from(new Set(recipients)).map((recipientId) => ({
        user_id: recipientId,
        mosque_id: request.mosque_id,
        actor_user_id: input.assignedByUserId,
        type: input.action === 'approve' ? 'cover_request_approved' : 'cover_request_dismissed',
        title,
        body,
        metadata: {
          requestId: input.requestId,
          date: request.date,
          prayerName: request.prayer_name,
          volunteerUserId: request.volunteer_user_id ?? null,
        },
      }))
    );
  }

  return data as MuezzinCoverRequest;
}
