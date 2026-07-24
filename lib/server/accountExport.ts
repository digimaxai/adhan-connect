import type { User, SupabaseClient } from '@supabase/supabase-js';
import { getAccountProviderNames } from './accountAccess';

const EXPORT_SCHEMA_VERSION = 'adhan-connect-account-export/1.0';
const PAGE_SIZE = 500;
const MAX_ROWS_PER_SECTION = 10_000;

type QueryResult = {
  data: any[] | null;
  error: { code?: string; message?: string } | null;
};

type ExportSection = {
  count: number;
  records: unknown[];
  status: 'complete' | 'omitted' | 'truncated';
};

type ExportOmission = {
  reason: 'not_available' | 'query_failed' | 'safety_limit_reached';
  section: string;
};

type ExportCollection = {
  omissions: ExportOmission[];
  sections: Record<string, ExportSection>;
};

async function fetchPaged(
  section: string,
  queryPage: (from: number, to: number) => PromiseLike<QueryResult>,
  transform: (row: any) => unknown = (row) => row
): Promise<{ omission?: ExportOmission; section: ExportSection }> {
  const records: unknown[] = [];

  for (let from = 0; from < MAX_ROWS_PER_SECTION; from += PAGE_SIZE) {
    const result = await queryPage(from, from + PAGE_SIZE - 1);
    if (result.error) {
      return {
        omission: {
          reason:
            ['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205'].includes(
              result.error.code ?? ''
            )
              ? 'not_available'
              : 'query_failed',
          section,
        },
        section: {
          count: records.length,
          records,
          status: 'omitted',
        },
      };
    }

    const page = result.data ?? [];
    records.push(...page.map(transform));
    if (page.length < PAGE_SIZE) {
      return {
        section: {
          count: records.length,
          records,
          status: 'complete',
        },
      };
    }
  }

  return {
    omission: { reason: 'safety_limit_reached', section },
    section: {
      count: records.length,
      records,
      status: 'truncated',
    },
  };
}

function redactOtherUser(value: unknown, userId: string) {
  if (value === null || value === undefined) return null;
  return value === userId ? userId : '[another user]';
}

function safeAuthIdentity(user: User) {
  const metadata = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    createdAt: user.created_at,
    updatedAt: user.updated_at ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    phoneConfirmedAt: user.phone_confirmed_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    providers: getAccountProviderNames(user),
    profileMetadata: {
      displayName:
        typeof metadata.display_name === 'string' ? metadata.display_name : null,
      fullName: typeof metadata.full_name === 'string' ? metadata.full_name : null,
    },
    linkedIdentities: (user.identities ?? []).map((identity) => ({
      provider: identity.provider,
      createdAt: identity.created_at ?? null,
      lastSignInAt: identity.last_sign_in_at ?? null,
      updatedAt: identity.updated_at ?? null,
    })),
  };
}

async function addSection(
  collection: ExportCollection,
  name: string,
  queryPage: (from: number, to: number) => PromiseLike<QueryResult>,
  transform?: (row: any) => unknown
) {
  const result = await fetchPaged(name, queryPage, transform);
  collection.sections[name] = result.section;
  if (result.omission) collection.omissions.push(result.omission);
}

export async function buildAccountExport(
  supabaseAdmin: SupabaseClient<any, any, any>,
  authUser: User
) {
  const userId = authUser.id;
  const collection: ExportCollection = {
    omissions: [],
    sections: {},
  };

  await addSection(collection, 'applicationProfile', (from, to) =>
    supabaseAdmin
      .from('users')
      .select('id, email, display_name, phone, country_code, home_city, role, created_at, updated_at')
      .eq('id', userId)
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'legacyProfile', (from, to) =>
    supabaseAdmin
      .from('profiles')
      .select('id, email, display_name, full_name, created_at, updated_at')
      .eq('id', userId)
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'policyReceipts', (from, to) =>
    supabaseAdmin
      .from('account_consents')
      .select(
        'id, user_id, receipt_schema_version, terms_version, terms_accepted_at, privacy_version, privacy_acknowledged_at, special_category_consent_version, special_category_consented_at, special_category_withdrawn_at, age_gate_version, age_16_or_over_confirmed_at, source, client_context, recorded_at'
      )
      .eq('user_id', userId)
      .order('recorded_at', { ascending: true })
      .range(from, to)
  );

  await addSection(collection, 'mosqueSubscriptions', (from, to) =>
    supabaseAdmin
      .from('subscriptions')
      .select(
        'id, user_id, mosque_id, provider, status, price_cents, currency, start_date, end_date, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'localAdminMemberships', (from, to) =>
    supabaseAdmin
      .from('mosque_admins')
      .select('id, user_id, mosque_id, created_at')
      .eq('user_id', userId)
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'muezzinMemberships', (from, to) =>
    supabaseAdmin
      .from('muezzins')
      .select('id, user_id, mosque_id, is_active, created_at')
      .eq('user_id', userId)
      .order('id')
      .range(from, to)
  );

  await addSection(
    collection,
    'staffRota',
    (from, to) =>
      supabaseAdmin
        .from('staff_rota')
        .select(
          'id, mosque_id, muezzin_user_id, staff_user_id, prayer_name, prayer, role_on_duty, date, duty_date, adhan_time, iqama_time, assigned_by, created_at, updated_at'
        )
        .or(
          `muezzin_user_id.eq.${userId},staff_user_id.eq.${userId},assigned_by.eq.${userId}`
        )
        .order('date', { ascending: true })
        .order('id')
        .range(from, to),
    (row) => ({
      ...row,
      assigned_by: redactOtherUser(row.assigned_by, userId),
      muezzin_user_id: redactOtherUser(row.muezzin_user_id, userId),
      staff_user_id: redactOtherUser(row.staff_user_id, userId),
    })
  );

  await addSection(
    collection,
    'coverRequests',
    (from, to) =>
      supabaseAdmin
        .from('muezzin_cover_requests')
        .select(
          'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
        )
        .or(
          `requester_user_id.eq.${userId},original_muezzin_user_id.eq.${userId},volunteer_user_id.eq.${userId},resolved_by_user_id.eq.${userId}`
        )
        .order('created_at', { ascending: true })
        .order('id')
        .range(from, to),
    (row) => ({
      ...row,
      reason:
        row.requester_user_id === userId
          ? row.reason
          : '[not included because another user supplied it]',
      original_muezzin_user_id: redactOtherUser(
        row.original_muezzin_user_id,
        userId
      ),
      requester_user_id: redactOtherUser(row.requester_user_id, userId),
      resolved_by_user_id: redactOtherUser(row.resolved_by_user_id, userId),
      volunteer_user_id: redactOtherUser(row.volunteer_user_id, userId),
    })
  );

  await addSection(
    collection,
    'notifications',
    (from, to) =>
      supabaseAdmin
        .from('app_notifications')
        .select(
          'id, user_id, mosque_id, actor_user_id, type, title, body, read_at, created_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id')
        .range(from, to),
    (row) => ({
      ...row,
      actor_user_id: redactOtherUser(row.actor_user_id, userId),
    })
  );

  await addSection(
    collection,
    'notificationsAsActor',
    (from, to) =>
      supabaseAdmin
        .from('app_notifications')
        .select('id, mosque_id, actor_user_id, type, created_at')
        .eq('actor_user_id', userId)
        .neq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id')
        .range(from, to),
    (row) => ({
      ...row,
      recipient_user_id: '[another user]',
    })
  );

  await addSection(collection, 'jumuahAttendanceIntentions', (from, to) =>
    supabaseAdmin
      .from('jumuah_attendance_intents')
      .select(
        'id, user_id, mosque_id, slot_id, friday_date, party_size, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('friday_date', { ascending: true })
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'broadcastsStarted', (from, to) =>
    supabaseAdmin
      .from('adhan_broadcasts')
      .select(
        'id, mosque_id, prayer, scheduled_for, status, started_at, ended_at, started_by, created_at, updated_at'
      )
      .eq('started_by', userId)
      .order('scheduled_for', { ascending: true })
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'prayerScheduleImports', (from, to) =>
    supabaseAdmin
      .from('prayer_schedule_imports')
      .select(
        'id, mosque_id, source_type, source_label, import_mode, fixed_iqama_offset_minutes, status, coverage_start_date, coverage_end_date, total_rows, valid_rows, invalid_rows, warning_count, error_count, initiated_by, rolled_back_from_import_id, published_at, rolled_back_at, created_at, updated_at'
      )
      .eq('initiated_by', userId)
      .order('created_at', { ascending: true })
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'broadcastOnboardingUpdates', (from, to) =>
    supabaseAdmin
      .from('mosque_broadcast_onboarding')
      .select(
        'mosque_id, stage, ready_for_test_at, test_passed_at, launched_at, updated_by, created_at, updated_at'
      )
      .eq('updated_by', userId)
      .order('mosque_id')
      .range(from, to)
  );

  await addSection(collection, 'broadcastOnboardingEvents', (from, to) =>
    supabaseAdmin
      .from('mosque_broadcast_onboarding_events')
      .select(
        'id, mosque_id, actor_user_id, event_type, from_stage, to_stage, created_at'
      )
      .eq('actor_user_id', userId)
      .order('created_at', { ascending: true })
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'announcementsAuthored', (from, to) =>
    supabaseAdmin
      .from('announcements')
      .select(
        'id, mosque_id, created_by, status, is_urgent, is_pinned, created_at, updated_at'
      )
      .eq('created_by', userId)
      .order('created_at', { ascending: true })
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'eventsAuthored', (from, to) =>
    supabaseAdmin
      .from('events')
      .select(
        'id, mosque_id, start_at, status, is_public, created_by, created_at, updated_at'
      )
      .eq('created_by', userId)
      .order('created_at', { ascending: true })
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'campaignsAuthored', (from, to) =>
    supabaseAdmin
      .from('campaigns')
      .select(
        'id, mosque_id, end_at, status, created_by, created_at, updated_at'
      )
      .eq('created_by', userId)
      .order('created_at', { ascending: true })
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'reflectionItemsAuthored', (from, to) =>
    supabaseAdmin
      .from('mosque_reflection_items')
      .select(
        'id, mosque_id, content_type, status, created_by, updated_by, created_at, updated_at'
      )
      .or(`created_by.eq.${userId},updated_by.eq.${userId}`)
      .order('created_at', { ascending: true })
      .order('id')
      .range(from, to)
  );

  await addSection(collection, 'reflectionSchedulesAuthored', (from, to) =>
    supabaseAdmin
      .from('mosque_reflection_schedules')
      .select(
        'id, mosque_id, start_date, end_date, frequency, status, created_by, updated_by, published_at, created_at, updated_at'
      )
      .or(`created_by.eq.${userId},updated_by.eq.${userId}`)
      .order('created_at', { ascending: true })
      .order('id')
      .range(from, to)
  );

  const generatedAt = new Date().toISOString();
  const counts = Object.fromEntries(
    Object.entries(collection.sections).map(([name, section]) => [name, section.count])
  );

  return {
    manifest: {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      generatedAt,
      subjectUserId: userId,
      counts,
      omissions: collection.omissions,
      excludedCategories: [
        {
          category: 'privateMosqueContent',
          reason:
            'Authorship and edit attribution are included, but private draft text, rota/onboarding notes, and institution-owned content are excluded from the automated personal-data package.',
        },
        {
          category: 'rawAuthenticationMetadata',
          reason:
            'Only allowlisted account/profile fields and linked-provider timestamps are included. Provider identity payloads, tokens, security claims, and unrestricted Auth metadata are excluded.',
        },
        {
          category: 'streamConfiguration',
          reason:
            'Mosque-owned stream rows and secret playback or ingest configuration are not personal account data and may contain credentials.',
        },
        {
          category: 'subscriptionProcessorIdentifiers',
          reason:
            'Payment-provider customer and subscription identifiers are excluded from the self-service file; request them through the privacy contact if needed.',
        },
        {
          category: 'prayerScheduleImportRowSnapshots',
          reason:
            'Mosque operational timetable snapshots can contain records authored by other staff. The requester’s import headers are included instead.',
        },
        {
          category: 'supabaseStorageObjects',
          reason:
            'Supabase Storage objects are not enumerated by this automated export because ownership and third-party content must be reviewed per bucket. Request any owned personal files through the privacy contact.',
        },
        {
          category: 'providerLogsBackupsAndSupportRecords',
          reason:
            'Processor logs, backups, email delivery, and support records are not available through this automated export. Use the privacy request channel for a complete access request.',
        },
      ],
      thirdPartyRedaction:
        'User identifiers belonging to other people are replaced with [another user]. Notification metadata and stream secrets are not exported.',
    },
    account: {
      authentication: safeAuthIdentity(authUser),
      ...collection.sections,
    },
  };
}
