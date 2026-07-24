import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  getAccountProviderNames,
  getRecentAuthentication,
  type AccountAccessContext,
} from './accountAccess';

const ACTIVE_COVER_STATUSES = ['open', 'volunteered', 'provisional_cover'];
const ACCOUNT_DELETION_APPROVAL_VERSION = 'account-deletion/1.0';
const IMPACT_PAGE_SIZE = 500;
const MAX_IMPACT_ROWS = 10_000;
const MAX_STORAGE_OBJECTS = 10_000;
const IMPACT_CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;
const APPLE_REVOCATION_TIMEOUT_MS = 10_000;

type ImpactIssue = {
  code: string;
  count?: number;
  message: string;
  mosqueIds?: string[];
};

type QueryState = {
  unresolved: string[];
};

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === 'string' && !!value))
  ).sort();
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function rowsOrUnresolved(
  state: QueryState,
  section: string,
  request: PromiseLike<{ data: any[] | null; error: { code?: string } | null }>
) {
  const { data, error } = await request;
  if (error) {
    state.unresolved.push(section);
    return [] as any[];
  }
  return data ?? [];
}

async function countOrUnresolved(
  state: QueryState,
  section: string,
  request: PromiseLike<{
    count: number | null;
    data: unknown;
    error: { code?: string } | null;
  }>
) {
  const { count, error } = await request;
  if (error) {
    state.unresolved.push(section);
    return 0;
  }
  return count ?? 0;
}

async function pagedRowsOrUnresolved(
  state: QueryState,
  section: string,
  queryPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: any[] | null; error: { code?: string } | null }>
) {
  const rows: any[] = [];
  for (let from = 0; from < MAX_IMPACT_ROWS; from += IMPACT_PAGE_SIZE) {
    const { data, error } = await queryPage(
      from,
      from + IMPACT_PAGE_SIZE - 1
    );
    if (error) {
      state.unresolved.push(section);
      return rows;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < IMPACT_PAGE_SIZE) return rows;
  }
  state.unresolved.push(`${section}:safety-limit`);
  return rows;
}

function configuredStorageBuckets() {
  const raw = process.env.ACCOUNT_DELETION_STORAGE_BUCKETS;
  if (raw === undefined) {
    return { configured: false, names: [] as string[] };
  }
  if (raw.trim().toLowerCase() === 'none') {
    return { configured: true, names: [] as string[] };
  }
  return {
    configured: true,
    names: uniqueStrings(raw.split(',').map((name: string) => name.trim())),
  };
}

async function listStorageFolder(
  supabaseAdmin: SupabaseClient<any, any, any>,
  bucket: string,
  path: string,
  output: string[]
): Promise<string | null> {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(path, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) return bucket;

    const entries = data ?? [];
    for (const entry of entries) {
      const childPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.id) {
        output.push(childPath);
        if (output.length > MAX_STORAGE_OBJECTS) return bucket;
      } else {
        const nestedError = await listStorageFolder(
          supabaseAdmin,
          bucket,
          childPath,
          output
        );
        if (nestedError) return nestedError;
      }
    }
    if (entries.length < 100) return null;
  }
}

export async function inspectOwnedStorage(
  supabaseAdmin: SupabaseClient<any, any, any>,
  userId: string
) {
  const buckets = configuredStorageBuckets();
  if (!buckets.configured) {
    return {
      configured: false,
      files: [] as { bucket: string; path: string }[],
      unresolvedBuckets: ['storage-bucket-configuration'],
    };
  }

  const files: { bucket: string; path: string }[] = [];
  const unresolvedBuckets: string[] = [];
  for (const bucket of buckets.names) {
    const paths: string[] = [];
    const errorBucket = await listStorageFolder(
      supabaseAdmin,
      bucket,
      userId,
      paths
    );
    if (errorBucket) {
      unresolvedBuckets.push(errorBucket);
      continue;
    }
    files.push(...paths.map((path) => ({ bucket, path })));
  }
  return {
    configured: true,
    files,
    unresolvedBuckets,
  };
}

export async function deleteOwnedStorageFiles(
  supabaseAdmin: SupabaseClient<any, any, any>,
  files: { bucket: string; path: string }[]
) {
  const byBucket = new Map<string, string[]>();
  for (const file of files) {
    const paths = byBucket.get(file.bucket) ?? [];
    paths.push(file.path);
    byBucket.set(file.bucket, paths);
  }

  for (const [bucket, paths] of byBucket.entries()) {
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .remove(paths.slice(index, index + 100));
      if (error) throw new Error('STORAGE_DELETE_FAILED');
    }
  }
}

async function deletionReadiness(
  authUser: User,
  supabaseAdmin: SupabaseClient<any, any, any>,
  state: QueryState
) {
  const providers = getAccountProviderNames(authUser);
  const usesApple = providers.includes('apple');
  const storageBuckets = configuredStorageBuckets();
  const appleRevocationConfigured =
    process.env.ACCOUNT_DELETION_APPLE_REVOCATION_READY === 'true' &&
    !!process.env.ACCOUNT_DELETION_APPLE_REVOCATION_URL?.trim() &&
    !!process.env.ACCOUNT_DELETION_APPLE_REVOCATION_SECRET?.trim();
  const { data: approval, error: approvalError } = await supabaseAdmin
    .from('account_deletion_release_approvals')
    .select(
      'approval_version, enabled, schema_audit_completed_at, storage_audit_completed_at, retention_matrix_version, approved_at'
    )
    .eq('approval_version', ACCOUNT_DELETION_APPROVAL_VERSION)
    .maybeSingle();
  if (approvalError) state.unresolved.push('deletion-release-approval');
  const databaseApprovalPresent =
    !approvalError &&
    approval?.enabled === true &&
    !!approval.schema_audit_completed_at &&
    !!approval.storage_audit_completed_at &&
    !!approval.retention_matrix_version &&
    !!approval.approved_at;

  return {
    approvalVersion: ACCOUNT_DELETION_APPROVAL_VERSION,
    appleTokenRevocationReady:
      !usesApple || appleRevocationConfigured,
    databaseApprovalPresent,
    deletionEnabled: process.env.ACCOUNT_DELETION_ENABLED === 'true',
    orchestrationAudited:
      process.env.ACCOUNT_DELETION_ORCHESTRATION_AUDITED === 'true',
    productionSchemaAudited:
      process.env.ACCOUNT_DELETION_SCHEMA_AUDITED === 'true',
    storageAuditComplete:
      process.env.ACCOUNT_DELETION_STORAGE_AUDITED === 'true' &&
      storageBuckets.configured,
    storageBucketsConfigured: storageBuckets.configured,
  };
}

export async function revokeAppleAuthorizationIfNeeded(authUser: User) {
  if (!getAccountProviderNames(authUser).includes('apple')) return;

  const endpoint = process.env.ACCOUNT_DELETION_APPLE_REVOCATION_URL?.trim();
  const secret = process.env.ACCOUNT_DELETION_APPLE_REVOCATION_SECRET?.trim();
  if (
    process.env.ACCOUNT_DELETION_APPLE_REVOCATION_READY !== 'true' ||
    !endpoint ||
    !secret
  ) {
    throw new Error('APPLE_REVOCATION_NOT_CONFIGURED');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    APPLE_REVOCATION_TIMEOUT_MS
  );
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `account-deletion:${ACCOUNT_DELETION_APPROVAL_VERSION}:${authUser.id}`,
      },
      body: JSON.stringify({
        approvalVersion: ACCOUNT_DELETION_APPROVAL_VERSION,
        userId: authUser.id,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('APPLE_REVOCATION_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildDeletionImpact(
  context: AccountAccessContext,
  options?: { durableRateLimitReady?: boolean }
) {
  const { authUser, supabaseAdmin, userId } = context;
  const state: QueryState = { unresolved: [] };
  const today = new Date().toISOString().slice(0, 10);

  const [profileRows, localAdminRows, muezzinRows] = await Promise.all([
    rowsOrUnresolved(
      state,
      'application-profile',
      supabaseAdmin.from('users').select('id, role').eq('id', userId).limit(1)
    ),
    pagedRowsOrUnresolved(
      state,
      'local-admin-memberships',
      (from, to) =>
        supabaseAdmin
          .from('mosque_admins')
          .select('id, mosque_id')
          .eq('user_id', userId)
          .order('mosque_id')
          .order('id')
          .range(from, to)
    ),
    pagedRowsOrUnresolved(
      state,
      'muezzin-memberships',
      (from, to) =>
        supabaseAdmin
          .from('muezzins')
          .select('id, mosque_id, is_active')
          .eq('user_id', userId)
          .order('mosque_id')
          .order('id')
          .range(from, to)
    ),
  ]);

  const localAdminMosqueIds = uniqueStrings(
    localAdminRows.map((row) => row.mosque_id)
  );
  const activeMuezzinMosqueIds = uniqueStrings(
    muezzinRows
      .filter((row) => row.is_active !== false)
      .map((row) => row.mosque_id)
  );

  const [
    upcomingRotaCount,
    openCoverCount,
    defaultMuezzinRows,
    broadcastHistoryCount,
    activeBroadcastCount,
    authoredImportCount,
    authoredOnboardingCount,
    authoredAnnouncementCount,
    authoredEventCount,
    authoredCampaignCount,
    authoredReflectionItemCount,
    authoredReflectionScheduleCount,
  ] = await Promise.all([
    countOrUnresolved(
      state,
      'upcoming-rota',
      supabaseAdmin
        .from('staff_rota')
        .select('id', { count: 'exact', head: true })
        .or(`muezzin_user_id.eq.${userId},staff_user_id.eq.${userId}`)
        .or(`date.gte.${today},duty_date.gte.${today}`)
    ),
    countOrUnresolved(
      state,
      'open-cover-requests',
      supabaseAdmin
        .from('muezzin_cover_requests')
        .select('id', { count: 'exact', head: true })
        .or(
          `requester_user_id.eq.${userId},original_muezzin_user_id.eq.${userId},volunteer_user_id.eq.${userId},resolved_by_user_id.eq.${userId}`
        )
        .in('status', ACTIVE_COVER_STATUSES)
    ),
    pagedRowsOrUnresolved(
      state,
      'default-muezzin',
      (from, to) =>
        supabaseAdmin
          .from('mosques')
          .select('id')
          .eq('default_muezzin_user_id', userId)
          .order('id')
          .range(from, to)
    ),
    countOrUnresolved(
      state,
      'broadcast-history',
      supabaseAdmin
        .from('adhan_broadcasts')
        .select('id', { count: 'exact', head: true })
        .eq('started_by', userId)
    ),
    countOrUnresolved(
      state,
      'active-broadcasts',
      supabaseAdmin
        .from('adhan_broadcasts')
        .select('id', { count: 'exact', head: true })
        .eq('started_by', userId)
        .eq('status', 'live')
    ),
    countOrUnresolved(
      state,
      'authored-prayer-imports',
      supabaseAdmin
        .from('prayer_schedule_imports')
        .select('id', { count: 'exact', head: true })
        .eq('initiated_by', userId)
    ),
    countOrUnresolved(
      state,
      'authored-onboarding-events',
      supabaseAdmin
        .from('mosque_broadcast_onboarding_events')
        .select('id', { count: 'exact', head: true })
        .eq('actor_user_id', userId)
    ),
    countOrUnresolved(
      state,
      'authored-announcements',
      supabaseAdmin
        .from('announcements')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', userId)
    ),
    countOrUnresolved(
      state,
      'authored-events',
      supabaseAdmin
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', userId)
    ),
    countOrUnresolved(
      state,
      'authored-campaigns',
      supabaseAdmin
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', userId)
    ),
    countOrUnresolved(
      state,
      'authored-reflection-items',
      supabaseAdmin
        .from('mosque_reflection_items')
        .select('id', { count: 'exact', head: true })
        .or(`created_by.eq.${userId},updated_by.eq.${userId}`)
    ),
    countOrUnresolved(
      state,
      'authored-reflection-schedules',
      supabaseAdmin
        .from('mosque_reflection_schedules')
        .select('id', { count: 'exact', head: true })
        .or(`created_by.eq.${userId},updated_by.eq.${userId}`)
    ),
  ]);

  const activeStreamCount = activeMuezzinMosqueIds.length
    ? await countOrUnresolved(
        state,
        'active-mosque-streams',
        supabaseAdmin
          .from('streams')
          .select('id', { count: 'exact', head: true })
          .in('mosque_id', activeMuezzinMosqueIds)
          .eq('is_live', true)
      )
    : 0;

  const soleLocalAdminMosqueIds: string[] = [];
  for (const mosqueId of localAdminMosqueIds) {
    const otherCount = await countOrUnresolved(
      state,
      `other-local-admins:${mosqueId}`,
      supabaseAdmin
        .from('mosque_admins')
        .select('id', { count: 'exact', head: true })
        .eq('mosque_id', mosqueId)
        .neq('user_id', userId)
    );
    if (otherCount === 0) soleLocalAdminMosqueIds.push(mosqueId);
  }

  const lastActiveMuezzinMosqueIds: string[] = [];
  for (const mosqueId of activeMuezzinMosqueIds) {
    const otherCount = await countOrUnresolved(
      state,
      `other-active-muezzins:${mosqueId}`,
      supabaseAdmin
        .from('muezzins')
        .select('id', { count: 'exact', head: true })
        .eq('mosque_id', mosqueId)
        .eq('is_active', true)
        .neq('user_id', userId)
    );
    if (otherCount === 0) lastActiveMuezzinMosqueIds.push(mosqueId);
  }

  const isMainAdmin =
    profileRows[0]?.role === 'main_admin' ||
    authUser.app_metadata?.role === 'main_admin';
  const otherMainAdminCount = isMainAdmin
    ? await countOrUnresolved(
        state,
        'other-main-admins',
        supabaseAdmin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'main_admin')
          .neq('id', userId)
      )
    : null;

  const storage = await inspectOwnedStorage(supabaseAdmin, userId);
  if (!storage.configured || storage.unresolvedBuckets.length) {
    state.unresolved.push('owned-storage');
  }

  const readiness = {
    ...(await deletionReadiness(authUser, supabaseAdmin, state)),
    durableRateLimitReady: options?.durableRateLimitReady === true,
  };
  const recentAuthentication = getRecentAuthentication(context);
  const providers = getAccountProviderNames(authUser);
  const blockers: ImpactIssue[] = [];
  const warnings: ImpactIssue[] = [];

  if (isMainAdmin && otherMainAdminCount === 0) {
    blockers.push({
      code: 'LAST_MAIN_ADMIN',
      count: 1,
      message:
        'Transfer main-admin access before deleting the platform’s last main-admin account.',
    });
  }
  if (soleLocalAdminMosqueIds.length) {
    blockers.push({
      code: 'SOLE_LOCAL_ADMIN',
      count: soleLocalAdminMosqueIds.length,
      mosqueIds: soleLocalAdminMosqueIds,
      message:
        'Assign another local admin to every affected mosque before deleting this account.',
    });
  }
  if (lastActiveMuezzinMosqueIds.length) {
    blockers.push({
      code: 'LAST_ACTIVE_MUEZZIN',
      count: lastActiveMuezzinMosqueIds.length,
      mosqueIds: lastActiveMuezzinMosqueIds,
      message:
        'Assign another active muezzin to every affected mosque before deleting this account.',
    });
  }
  const defaultMuezzinMosqueIds = uniqueStrings(
    defaultMuezzinRows.map((row) => row.id)
  );
  if (defaultMuezzinMosqueIds.length) {
    blockers.push({
      code: 'DEFAULT_MUEZZIN',
      count: defaultMuezzinMosqueIds.length,
      mosqueIds: defaultMuezzinMosqueIds,
      message:
        'Choose a different default muezzin for every affected mosque before deletion.',
    });
  }
  if (upcomingRotaCount) {
    blockers.push({
      code: 'UPCOMING_ROTA',
      count: upcomingRotaCount,
      message: 'Reassign or clear upcoming rota duties before deletion.',
    });
  }
  if (openCoverCount) {
    blockers.push({
      code: 'OPEN_COVER_REQUEST',
      count: openCoverCount,
      message: 'Resolve open cover requests involving this account before deletion.',
    });
  }
  if (activeBroadcastCount || activeStreamCount) {
    blockers.push({
      code: 'ACTIVE_BROADCAST',
      count: activeBroadcastCount + activeStreamCount,
      message: 'End active mosque broadcasts before deleting this account.',
    });
  }
  if (state.unresolved.length) {
    blockers.push({
      code: 'IMPACT_INCOMPLETE',
      count: uniqueStrings(state.unresolved).length,
      message:
        'Account impact could not be verified completely. Deletion remains unavailable.',
    });
  }
  if (!readiness.appleTokenRevocationReady) {
    blockers.push({
      code: 'APPLE_REVOCATION_NOT_READY',
      message:
        'Apple token revocation must be configured before this Apple-linked account can be deleted.',
    });
  }

  if (broadcastHistoryCount) {
    warnings.push({
      code: 'BROADCAST_HISTORY',
      count: broadcastHistoryCount,
      message:
        'Historical broadcast attribution must be anonymised according to the audited retention policy.',
    });
  }
  const authoredOperationalRecordCount =
    authoredImportCount +
    authoredOnboardingCount +
    authoredAnnouncementCount +
    authoredEventCount +
    authoredCampaignCount +
    authoredReflectionItemCount +
    authoredReflectionScheduleCount;
  if (authoredOperationalRecordCount) {
    warnings.push({
      code: 'OPERATIONAL_HISTORY',
      count: authoredOperationalRecordCount,
      message:
        'Mosque operational records will be retained only where the audited schema anonymises attribution.',
    });
  }
  if (storage.files.length) {
    warnings.push({
      code: 'OWNED_STORAGE',
      count: storage.files.length,
      message: 'Files owned under this account’s configured storage folders will be deleted.',
    });
  }
  if (localAdminRows.length || muezzinRows.length) {
    warnings.push({
      code: 'ROLE_MEMBERSHIPS',
      count: localAdminRows.length + muezzinRows.length,
      message: 'All listener and mosque staff access attached to this Auth UUID will end.',
    });
  }

  const releaseBlockers = [
    !readiness.deletionEnabled ? 'Account deletion is not enabled for this release.' : null,
    !readiness.productionSchemaAudited
      ? 'The production foreign-key, trigger, retention, and RLS audit is not signed off.'
      : null,
    !readiness.orchestrationAudited
      ? 'The partial-failure, retry, audit and postcondition runbook is not signed off.'
      : null,
    !readiness.storageAuditComplete
      ? 'User-owned Storage locations have not been explicitly audited and configured.'
      : null,
    !readiness.durableRateLimitReady
      ? 'The durable account-control rate limiter is not deployed.'
      : null,
    !readiness.databaseApprovalPresent
      ? `No enabled production deletion approval exists for ${readiness.approvalVersion}.`
      : null,
  ].filter((value): value is string => !!value);

  const confirmationWindow = Math.floor(
    Date.now() / IMPACT_CONFIRMATION_WINDOW_MS
  );
  const confirmationExpiresAt = new Date(
    (confirmationWindow + 1) * IMPACT_CONFIRMATION_WINDOW_MS
  ).toISOString();
  const fingerprintPayload = {
    confirmationWindow,
    blockers: blockers.map(({ code, count, mosqueIds }) => ({
      code,
      count: count ?? null,
      mosqueIds: mosqueIds ?? [],
    })),
    providers,
    readiness,
    impact: {
      activeBroadcastCount,
      activeStreamCount,
      authoredOperationalRecordCount,
      broadcastHistoryCount,
      defaultMuezzinMosqueIds,
      localAdminMosqueIds,
      muezzinMosqueIds: uniqueStrings(muezzinRows.map((row) => row.mosque_id)),
      openCoverCount,
      ownedStorageFileCount: storage.files.length,
      soleLocalAdminMosqueIds,
      upcomingRotaCount,
    },
    storageFiles: [...storage.files].sort((left, right) =>
      `${left.bucket}/${left.path}`.localeCompare(
        `${right.bucket}/${right.path}`
      )
    ),
    subject: userId,
    unresolved: uniqueStrings(state.unresolved),
  };

  return {
    schemaVersion: 'adhan-connect-account-deletion-impact/1.0',
    generatedAt: new Date().toISOString(),
    confirmationExpiresAt,
    subjectUserId: userId,
    providers,
    recentAuthentication,
    readiness,
    releaseBlockers,
    canDelete:
      releaseBlockers.length === 0 &&
      blockers.length === 0 &&
      recentAuthentication.isRecent,
    requiresRecentAuthentication: !recentAuthentication.isRecent,
    blockers,
    warnings,
    unresolvedChecks: uniqueStrings(state.unresolved),
    impact: fingerprintPayload.impact,
    impactFingerprint: await sha256(JSON.stringify(fingerprintPayload)),
    storageFiles: storage.files,
  };
}
