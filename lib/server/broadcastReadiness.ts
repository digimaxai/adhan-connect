import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeMosqueLiveBroadcastConfig } from '../liveStreamProviders';
import type {
  BroadcastOnboardingStage,
  BroadcastReadinessAuditEvent,
  BroadcastReadinessCheck,
  BroadcastReadinessPayload,
  BroadcastRolloutState,
} from '../types/broadcastReadiness';

type MosqueReadinessRow = {
  id: string;
  name?: string | null;
  status?: string | null;
  city?: string | null;
  time_zone?: string | null;
  lat?: number | null;
  lng?: number | null;
  prayer_source?: string | null;
  default_muezzin_user_id?: string | null;
  live_stream_enabled?: boolean | null;
  live_stream_provider?: string | null;
  live_stream_playback_url?: string | null;
  live_stream_ingest_url?: string | null;
  live_stream_mount_path?: string | null;
  live_stream_username?: string | null;
  live_stream_stream_key?: string | null;
  live_stream_status_secret?: string | null;
  live_stream_listener_secret?: string | null;
};

type StreamReadinessRow = {
  id: string;
  is_live?: boolean | null;
  status?: string | null;
};

type MuezzinReadinessRow = {
  user_id: string;
  is_active?: boolean | null;
};

type RotaReadinessRow = {
  muezzin_user_id?: string | null;
  staff_user_id?: string | null;
};

type OnboardingRow = {
  stage?: string | null;
};

type OnboardingEventRow = {
  id: string;
  event_type: string;
  from_stage?: string | null;
  to_stage?: string | null;
  notes?: string | null;
  created_at: string;
};

const STAGE_LABELS: Record<BroadcastOnboardingStage, string> = {
  setup_pending: 'Setup pending',
  ready_for_test: 'Ready for test',
  test_passed: 'Test passed',
  live: 'Live',
};

function normalizeStage(value?: string | null): BroadcastOnboardingStage {
  if (value === 'ready_for_test' || value === 'test_passed' || value === 'live') return value;
  return 'setup_pending';
}

function resolveLocalDate(timeZone?: string | null) {
  const normalizedTimeZone = timeZone?.trim() || '';
  if (!normalizedTimeZone) {
    return { date: new Date().toISOString().slice(0, 10), validTimeZone: false };
  }
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: normalizedTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (values.year && values.month && values.day) {
      return { date: `${values.year}-${values.month}-${values.day}`, validTimeZone: true };
    }
  } catch {
    // Invalid legacy timezone values fall back to UTC below.
  }
  return { date: new Date().toISOString().slice(0, 10), validTimeZone: false };
}

function isTransactionalForMosque(modeValue: string | undefined, idsValue: string | undefined, mosqueId: string) {
  const mode = (modeValue ?? 'legacy').trim().toLowerCase();
  if (mode === 'rpc') return true;
  if (mode !== 'allowlist') return false;
  return (idsValue ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(mosqueId.toLowerCase());
}

function resolveRollout(mosqueId: string) {
  const startTransactional = isTransactionalForMosque(
    process.env.LIVE_BROADCAST_START_MODE,
    process.env.LIVE_BROADCAST_START_RPC_MOSQUE_IDS,
    mosqueId
  );
  const endTransactional = isTransactionalForMosque(
    process.env.LIVE_BROADCAST_END_MODE,
    process.env.LIVE_BROADCAST_END_RPC_MOSQUE_IDS,
    mosqueId
  );
  const state: BroadcastRolloutState =
    startTransactional && endTransactional
      ? 'enabled'
      : startTransactional || endTransactional
        ? 'partial'
        : 'off';
  return { startTransactional, endTransactional, state, managedExternally: true as const };
}

function assertQuery(result: { error?: { message?: string | null } | null }, fallback: string) {
  if (result.error) throw new Error(result.error.message || fallback);
}

export async function loadBroadcastReadiness(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string
): Promise<BroadcastReadinessPayload | null> {
  const mosqueRes = await supabaseAdmin
    .from('mosques')
    .select(
      'id, name, status, city, time_zone, lat, lng, prayer_source, default_muezzin_user_id, live_stream_enabled, live_stream_provider, live_stream_playback_url, live_stream_ingest_url, live_stream_mount_path, live_stream_username, live_stream_stream_key, live_stream_status_secret, live_stream_listener_secret'
    )
    .eq('id', mosqueId)
    .maybeSingle<MosqueReadinessRow>();

  assertQuery(mosqueRes, 'Unable to load the mosque broadcast configuration.');
  if (!mosqueRes.data) return null;

  const mosque = mosqueRes.data;
  const localDate = resolveLocalDate(mosque.time_zone);
  const today = localDate.date;
  const [streamsRes, adminsRes, muezzinsRes, rotaRes, prayerTimesRes, liveAdhansRes, onboardingRes, eventsRes] =
    await Promise.all([
      supabaseAdmin
        .from('streams')
        .select('id, is_live, status')
        .eq('mosque_id', mosqueId),
      supabaseAdmin
        .from('mosque_admins')
        .select('user_id')
        .eq('mosque_id', mosqueId),
      supabaseAdmin
        .from('muezzins')
        .select('user_id, is_active')
        .eq('mosque_id', mosqueId),
      supabaseAdmin
        .from('staff_rota')
        .select('muezzin_user_id, staff_user_id')
        .eq('mosque_id', mosqueId)
        .gte('date', today),
      supabaseAdmin
        .from('prayer_times')
        .select('id, date')
        .eq('mosque_id', mosqueId)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1),
      supabaseAdmin
        .from('adhans')
        .select('id')
        .eq('mosque_id', mosqueId)
        .eq('status', 'live'),
      supabaseAdmin
        .from('mosque_broadcast_onboarding')
        .select('stage')
        .eq('mosque_id', mosqueId)
        .maybeSingle<OnboardingRow>(),
      supabaseAdmin
        .from('mosque_broadcast_onboarding_events')
        .select('id, event_type, from_stage, to_stage, notes, created_at')
        .eq('mosque_id', mosqueId)
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

  assertQuery(streamsRes, 'Unable to inspect configured streams.');
  assertQuery(adminsRes, 'Unable to inspect local-admin assignments.');
  assertQuery(muezzinsRes, 'Unable to inspect muezzin assignments.');
  assertQuery(rotaRes, 'Unable to inspect staff rota coverage.');
  assertQuery(prayerTimesRes, 'Unable to inspect prayer-time coverage.');
  assertQuery(liveAdhansRes, 'Unable to inspect current adhan state.');
  assertQuery(onboardingRes, 'Unable to load broadcast onboarding state.');
  assertQuery(eventsRes, 'Unable to load the broadcast onboarding audit trail.');

  const streams = (streamsRes.data ?? []) as StreamReadinessRow[];
  const activeMuezzins = ((muezzinsRes.data ?? []) as MuezzinReadinessRow[]).filter(
    (row) => row.user_id && row.is_active !== false
  );
  const activeMuezzinIds = new Set(activeMuezzins.map((row) => row.user_id));
  const defaultMuezzinReady = !!mosque.default_muezzin_user_id && activeMuezzinIds.has(mosque.default_muezzin_user_id);
  const rotaReady = ((rotaRes.data ?? []) as RotaReadinessRow[]).some((row) => {
    const effectiveMuezzinId = row.muezzin_user_id ?? row.staff_user_id;
    return !!effectiveMuezzinId && activeMuezzinIds.has(effectiveMuezzinId);
  });
  const staffCoverageReady = defaultMuezzinReady || rotaReady;
  const config = summarizeMosqueLiveBroadcastConfig(mosque);
  const profileReady = localDate.validTimeZone;
  const liveKitServerReady =
    config.provider !== 'livekit' ||
    !!(
      process.env.LIVEKIT_URL?.trim() &&
      process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim()
    );
  const prayerSource = (mosque.prayer_source ?? 'aladhan').trim().toLowerCase();
  const automaticPrayerSourceReady =
    prayerSource === 'elm' || (prayerSource === 'aladhan' && mosque.lat != null && mosque.lng != null);
  const prayerScheduleReady = automaticPrayerSourceReady || (prayerTimesRes.data ?? []).length > 0;
  const localAdminReady = (adminsRes.data ?? []).length > 0;
  const activeMuezzinReady = activeMuezzins.length > 0;
  const streamCount = streams.length;
  const anyStreamLive = streams.some((stream) => stream.is_live === true);
  const singleDormantStreamReady =
    streamCount === 1 && !anyStreamLive && (streams[0]?.status ?? 'active') === 'active';
  const noLiveState = !anyStreamLive && (liveAdhansRes.data ?? []).length === 0;
  const mosqueActive = mosque.status === 'active';
  const rollout = resolveRollout(mosqueId);
  const stage = normalizeStage(onboardingRes.data?.stage);

  const checks: BroadcastReadinessCheck[] = [
    {
      key: 'mosque_profile',
      label: 'Mosque timezone',
      status: profileReady ? 'pass' : 'blocker',
      detail: profileReady
        ? `Prayer dates use ${mosque.time_zone}.`
        : 'Set a valid IANA mosque timezone before testing scheduled broadcasts.',
      requiredFor: 'test',
      action: 'profile',
    },
    {
      key: 'stream_configuration',
      label: 'Streaming configuration',
      status: config.is_ready_for_broadcast ? 'pass' : 'blocker',
      detail: config.is_ready_for_broadcast
        ? `${config.provider_label} is enabled and configured.`
        : config.issues[0] || 'Finish the live-stream configuration.',
      requiredFor: 'test',
      action: 'live_stream',
    },
    {
      key: 'provider_server',
      label: 'Provider server',
      status: liveKitServerReady ? 'pass' : 'blocker',
      detail: liveKitServerReady
        ? config.provider === 'livekit'
          ? 'The hosted LiveKit server credentials are available.'
          : 'No shared LiveKit credentials are required for this provider.'
        : 'The hosted API is missing one or more LiveKit server credentials.',
      requiredFor: 'test',
      action: liveKitServerReady ? null : 'operator',
    },
    {
      key: 'local_admin',
      label: 'Local admin',
      status: localAdminReady ? 'pass' : 'blocker',
      detail: localAdminReady ? 'At least one local admin is assigned.' : 'Assign a local admin for this mosque.',
      requiredFor: 'test',
      action: 'admins',
    },
    {
      key: 'active_muezzin',
      label: 'Active muezzin',
      status: activeMuezzinReady ? 'pass' : 'blocker',
      detail: activeMuezzinReady ? 'At least one active muezzin is assigned.' : 'Assign or reactivate a muezzin.',
      requiredFor: 'test',
      action: 'muezzins',
    },
    {
      key: 'staff_coverage',
      label: 'Default or rota coverage',
      status: staffCoverageReady ? 'pass' : 'blocker',
      detail: defaultMuezzinReady
        ? 'The active default muezzin can cover unassigned prayer slots.'
        : rotaReady
          ? 'A future rota assignment is available to an active muezzin.'
          : 'Select an active default muezzin or publish a future rota.',
      requiredFor: 'test',
      action: 'muezzins',
    },
    {
      key: 'prayer_schedule',
      label: 'Prayer schedule',
      status: prayerScheduleReady ? 'pass' : 'blocker',
      detail: automaticPrayerSourceReady
        ? `The ${prayerSource} prayer source is configured.`
        : prayerScheduleReady
          ? 'Current or future canonical prayer times are available.'
          : 'Configure a prayer source or publish current prayer times.',
      requiredFor: 'test',
      action: 'prayer_times',
    },
    {
      key: 'stream_record',
      label: 'Dormant stream record',
      status: singleDormantStreamReady ? 'pass' : 'blocker',
      detail: singleDormantStreamReady
        ? 'Exactly one inactive stream is provisioned.'
        : streamCount === 0
          ? 'No stream is provisioned yet.'
          : streamCount > 1
            ? `${streamCount} stream rows exist; duplicates require manual review.`
            : anyStreamLive
              ? 'The configured stream is currently live.'
              : 'The configured stream is not active and requires manual review.',
      requiredFor: 'test',
      action: streamCount === 0 ? 'operator' : null,
    },
    {
      key: 'clean_live_state',
      label: 'Clean live state',
      status: noLiveState ? 'pass' : 'blocker',
      detail: noLiveState
        ? 'No stream or adhan is currently marked live.'
        : 'End and verify the existing live stream or adhan before onboarding continues.',
      requiredFor: 'test',
      action: noLiveState ? null : 'operator',
    },
    {
      key: 'public_status',
      label: 'Public mosque status',
      status: mosqueActive ? 'pass' : 'warning',
      detail: mosqueActive
        ? 'The mosque is active for public launch.'
        : 'The mosque may remain pending during setup and private testing; approve it before launch.',
      requiredFor: 'launch',
      action: 'profile',
    },
    {
      key: 'transactional_rollout',
      label: 'Transactional START and END',
      status: rollout.state === 'enabled' ? 'pass' : rollout.state === 'partial' ? 'blocker' : 'warning',
      detail:
        rollout.state === 'enabled'
          ? 'Both transactional paths are enabled for this mosque.'
          : rollout.state === 'partial'
            ? 'Only START or END is enabled. Do not test until both use the same rollout.'
            : 'An operator must add this mosque to both rollout lists and deploy before the physical test.',
      requiredFor: 'advisory',
      action: 'operator',
    },
  ];

  const requiredChecks = checks.filter((check) => check.requiredFor === 'test');
  const requiredComplete = requiredChecks.filter((check) => check.status === 'pass').length;
  const testReady = requiredChecks.every((check) => check.status === 'pass');
  const launchReady = testReady && mosqueActive && rollout.state === 'enabled' && (stage === 'test_passed' || stage === 'live');
  const canProvision =
    streamCount === 0 &&
    noLiveState &&
    config.is_ready_for_broadcast &&
    profileReady &&
    liveKitServerReady &&
    localAdminReady &&
    activeMuezzinReady &&
    staffCoverageReady &&
    prayerScheduleReady;

  const auditEvents: BroadcastReadinessAuditEvent[] = ((eventsRes.data ?? []) as OnboardingEventRow[]).map(
    (event) => ({
      id: event.id,
      eventType: event.event_type,
      fromStage: event.from_stage ? normalizeStage(event.from_stage) : null,
      toStage: event.to_stage ? normalizeStage(event.to_stage) : null,
      notes: event.notes ?? null,
      createdAt: event.created_at,
    })
  );

  return {
    mosqueId,
    stage,
    stageLabel: STAGE_LABELS[stage],
    checks,
    requiredComplete,
    requiredTotal: requiredChecks.length,
    testReady,
    launchReady,
    stream: {
      count: streamCount,
      id: streamCount === 1 ? streams[0]?.id ?? null : null,
      isLive: anyStreamLive,
    },
    rollout,
    actions: {
      canProvision,
      canConfirmReadiness: testReady && stage === 'setup_pending',
      canRecordTestPassed: testReady && rollout.state === 'enabled' && stage === 'ready_for_test',
      canMarkLive: launchReady && stage === 'test_passed',
      canReset: stage !== 'setup_pending',
    },
    auditEvents,
  };
}
