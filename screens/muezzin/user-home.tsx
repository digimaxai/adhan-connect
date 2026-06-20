import React, { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMuezzinSchedule } from '../../lib/hooks/useMuezzinSchedule';
import { useRoleFlags } from '../../lib/roles';
import type { MuezzinSchedule, MuezzinSlot } from '../../lib/types/muezzin';
import {
  fetchMuezzinLiveBroadcastState,
  type MosqueLiveBroadcastConfig,
} from '../../lib/api/muezzin/liveBroadcast';
import { AppButton } from '../../components/ui/app-button';
import { AppCard } from '../../components/ui/app-card';
import { ScreenContainer } from '../../components/ui/screen-container';
import { AppText } from '../../components/ui/app-text';

const PAGE_PADDING = 14;
const WINDOW_START_MS = 3 * 60 * 1000;
const WINDOW_END_MS = 2 * 60 * 1000;

type BroadcastTestStatus = 'idle' | 'checking' | 'passed' | 'attention' | 'failed';

type BroadcastTestResult = {
  status: BroadcastTestStatus;
  title: string;
  message: string | null;
};

const initialBroadcastTestResult: BroadcastTestResult = {
  status: 'idle',
  title: 'Not checked',
  message: null,
};

export default function MuezzinToolsScreen() {
  const router = useRouter();
  const { schedule, loading, refresh } = useMuezzinSchedule();
  const roles = useRoleFlags();
  const [broadcastTest, setBroadcastTest] = useState<BroadcastTestResult>(initialBroadcastTestResult);
  const primaryMuezzinMosque = roles.muezzinMosques[0] ?? null;
  const hasSchedulePayload = !!schedule?.mosqueId || !!schedule?.mosqueName || !!schedule?.slots.length;

  const resolvedSchedule: MuezzinSchedule = schedule ?? {
    mosqueId: primaryMuezzinMosque?.mosqueId ?? null,
    mosqueName: primaryMuezzinMosque?.name ?? null,
    slots: [],
    nextAssignedSlot: null,
    nextMosqueSlot: null,
  };

  const primaryMosqueId = resolvedSchedule.mosqueId;
  const isInitialScheduleLoad = !!loading && !hasSchedulePayload;
  const safeNextAssignedSlot = hasConcreteSlotTime(resolvedSchedule.nextAssignedSlot ?? null)
    ? resolvedSchedule.nextAssignedSlot ?? null
    : null;
  const safeNextMosqueSlot = hasConcreteSlotTime(resolvedSchedule.nextMosqueSlot ?? null)
    ? resolvedSchedule.nextMosqueSlot ?? null
    : null;
  const nextPrayerSlot = useMemo(
    () => safeNextAssignedSlot ?? safeNextMosqueSlot ?? null,
    [safeNextAssignedSlot, safeNextMosqueSlot]
  );

  const handleOpenLiveBroadcast = (slot: MuezzinSlot | null) => {
    if (!slot) return;

    router.push({
      pathname: '/(muezzin)/live-broadcast',
      params: {
        mosqueId: primaryMosqueId ?? '',
        slotId: slot.id,
        mosqueName: slot.mosqueName ?? '',
        prayerName: slot.prayerName,
        adhanTime: slot.adhanTime ? slot.adhanTime.toISOString() : '',
      },
    });
  };

  const handleManageLivePress = () => {
    if (safeNextAssignedSlot) {
      router.push({
        pathname: '/(muezzin)/live-broadcast',
        params: {
          mosqueId: primaryMosqueId ?? '',
          slotId: safeNextAssignedSlot.id,
          mosqueName: safeNextAssignedSlot.mosqueName ?? '',
          prayerName: safeNextAssignedSlot.prayerName,
          adhanTime: safeNextAssignedSlot.adhanTime ? safeNextAssignedSlot.adhanTime.toISOString() : '',
        },
      });
      return;
    }

    router.push({
      pathname: '/(muezzin)/live-broadcast',
      params: { mode: 'test' },
    });
  };

  const handleStartTest = () => {
    if (broadcastTest.status === 'checking') return;

    if (!primaryMosqueId) {
      setBroadcastTest({
        status: 'failed',
        title: 'No mosque selected',
        message: 'Assign a mosque before running broadcast connectivity checks.',
      });
      return;
    }

    setBroadcastTest({
      status: 'checking',
      title: 'Checking connection',
      message: 'Testing broadcast configuration and endpoint reachability...',
    });

    void (async () => {
      try {
        const payload = await fetchMuezzinLiveBroadcastState(primaryMosqueId, 5000);
        setBroadcastTest(buildBroadcastTestResult(payload.config ?? null));
      } catch (error) {
        const raw = error instanceof Error ? error.message : '';
        const isTimeout = raw.toLowerCase().includes('timed out') || raw.toLowerCase().includes('abort');
        setBroadcastTest({
          status: 'failed',
          title: 'Connection check failed',
          message: isTimeout
            ? 'Could not reach the broadcast server. Make sure you are connected to the internet and try again.'
            : raw || 'Unable to run the broadcast connectivity check.',
        });
      }
    })();
  };

  const assignedSlotsToday = useMemo(
    () => resolvedSchedule.slots.filter((slot) => slot.isAssignedToMe).length,
    [resolvedSchedule.slots]
  );

  return (
    <ScreenContainer
      style={styles.container}
      contentStyle={{ paddingHorizontal: PAGE_PADDING, paddingTop: PAGE_PADDING, paddingBottom: 12 }}
        refreshControl={<RefreshControl refreshing={!!loading} onRefresh={refresh} />}
      >
        <AppText variant="title" style={styles.title}>Muezzin Home</AppText>
        <AppText variant="caption" style={styles.subtitle}>Your next slot, broadcast readiness, and today&apos;s rota in one place.</AppText>

        <NextAdhanCard
          slot={nextPrayerSlot}
          assignedSlot={safeNextAssignedSlot}
          scheduleSlots={resolvedSchedule.slots}
          mosqueName={resolvedSchedule.mosqueName}
          loading={isInitialScheduleLoad}
          onPressStatusStrip={handleOpenLiveBroadcast}
        />

        <BroadcastReadinessCard
          mosqueName={resolvedSchedule.mosqueName}
          mosqueId={primaryMosqueId}
          assignedSlot={safeNextAssignedSlot}
          assignedSlotsToday={assignedSlotsToday}
          loading={isInitialScheduleLoad}
          onOpenControls={handleManageLivePress}
          onRunTest={handleStartTest}
          testResult={broadcastTest}
        />

        <TodaysScheduleCard schedule={resolvedSchedule} loading={isInitialScheduleLoad} />

        <AppButton title="Open Broadcast Controls" onPress={handleManageLivePress} style={styles.primaryButton} />
    </ScreenContainer>
  );
}

interface NextAdhanCardProps {
  slot: MuezzinSlot | null;
  assignedSlot: MuezzinSlot | null;
  scheduleSlots: MuezzinSlot[];
  mosqueName: string | null;
  loading: boolean;
  onPressStatusStrip: (slot: MuezzinSlot | null) => void;
}

const NextAdhanCard: React.FC<NextAdhanCardProps> = ({
  slot,
  assignedSlot,
  scheduleSlots,
  mosqueName,
  loading,
  onPressStatusStrip,
}) => {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const safeAssignedSlot = hasConcreteSlotTime(assignedSlot) ? assignedSlot : null;
  const safeSlot = hasConcreteSlotTime(slot) ? slot : null;
  const nextAssignedFromSlots = useMemo(() => pickUpcomingSlot(scheduleSlots, now, true), [scheduleSlots, now]);
  const nextMosqueFromSlots = useMemo(() => pickUpcomingSlot(scheduleSlots, now, false), [scheduleSlots, now]);
  const resolvedAssignedSlot = nextAssignedFromSlots ?? safeAssignedSlot ?? (safeSlot?.isAssignedToMe ? safeSlot : null);
  const resolvedSlot = resolvedAssignedSlot ?? nextMosqueFromSlots ?? safeSlot ?? null;

  const liveWindowStart =
    resolvedSlot?.liveWindowStart ?? (resolvedSlot?.adhanTime ? new Date(resolvedSlot.adhanTime.getTime() - WINDOW_START_MS) : null);
  const liveWindowEnd =
    resolvedSlot?.liveWindowEnd ?? (resolvedSlot?.adhanTime ? new Date(resolvedSlot.adhanTime.getTime() + WINDOW_END_MS) : null);
  const isAfterWindow = !!liveWindowEnd && now > liveWindowEnd;
  const liveOpensIn = liveWindowStart ? formatDuration(liveWindowStart, now) : null;
  const countdownText = getNextAdhanCountdown(resolvedSlot, now, liveWindowEnd);
  const slotDayLabel = getFutureSlotLabel(resolvedSlot?.adhanTime ?? null, now);
  const activeAssignedSlot = resolvedAssignedSlot ?? (resolvedSlot?.isAssignedToMe ? resolvedSlot : null);
  const assignedLiveWindowStart =
    activeAssignedSlot?.liveWindowStart ??
    (activeAssignedSlot?.adhanTime ? new Date(activeAssignedSlot.adhanTime.getTime() - WINDOW_START_MS) : null);
  const assignedLiveWindowEnd =
    activeAssignedSlot?.liveWindowEnd ??
    (activeAssignedSlot?.adhanTime ? new Date(activeAssignedSlot.adhanTime.getTime() + WINDOW_END_MS) : null);
  const canManageLive =
    !!activeAssignedSlot &&
    !!assignedLiveWindowStart &&
    !!assignedLiveWindowEnd &&
    (now >= assignedLiveWindowStart || activeAssignedSlot.status === 'ready' || activeAssignedSlot.status === 'live') &&
    now <= assignedLiveWindowEnd;
  const assignedSlotDiffers = !!resolvedSlot && !!activeAssignedSlot && resolvedSlot.id !== activeAssignedSlot.id;

  const statusLabel =
    resolvedSlot?.status === 'live'
      ? 'Live'
      : resolvedSlot?.status === 'ready'
      ? 'Ready'
      : resolvedSlot?.status === 'completed'
      ? 'Completed'
      : 'Scheduled';

  const statusPillStyle =
    resolvedSlot?.status === 'live'
      ? styles.statusPillLive
      : resolvedSlot?.status === 'ready'
      ? styles.statusPillReady
      : styles.statusPillNeutral;
  const assignmentSummary = resolvedSlot
    ? resolvedSlot.assignmentSource === 'default'
      ? resolvedSlot.isAssignedToMe
        ? 'Default coverage: you'
        : resolvedSlot.assignedMuezzinName
        ? `Default coverage: ${resolvedSlot.assignedMuezzinName}`
        : 'Covered by mosque default'
      : resolvedSlot.assignmentSource === 'cover'
      ? resolvedSlot.isAssignedToMe
        ? 'Approved cover: you'
        : resolvedSlot.assignedMuezzinName
        ? `Approved cover: ${resolvedSlot.assignedMuezzinName}`
        : 'Covered by approved cover'
      : resolvedSlot.isAssignedToMe
      ? 'Assigned to you'
      : resolvedSlot.assignedMuezzinName
      ? `Assigned to ${resolvedSlot.assignedMuezzinName}`
      : 'No muezzin assigned yet'
    : null;
  const liveWindowSummary = !resolvedSlot
    ? 'No upcoming adhans are published in the timetable yet. Use test mode to verify the live broadcast flow.'
    : canManageLive
    ? 'Broadcast window is open now.'
    : isAfterWindow
    ? 'Adhan window ended for this slot.'
    : !activeAssignedSlot
    ? 'No assigned live slot right now.'
    : assignedSlotDiffers
    ? `Your next live slot is ${activeAssignedSlot.prayerName} at ${formatTime(activeAssignedSlot.adhanTime)}.`
    : liveOpensIn
    ? `Live broadcast opens in ${liveOpensIn}.`
    : 'Live broadcast opens soon.';

  const handleStartTest = () => {
    router.push({ pathname: '/(muezzin)/live-broadcast', params: { mode: 'test' } });
  };

  const handleManage = () => {
    if (!activeAssignedSlot) {
      handleStartTest();
      return;
    }
    onPressStatusStrip(activeAssignedSlot);
  };

  const resolvedMosqueName =
    resolvedSlot?.mosqueName ??
    mosqueName ??
    (loading ? 'Loading assigned mosque...' : 'No mosque assigned');
  const showLoadingState = loading && !resolvedSlot && !scheduleSlots.length;

  return (
    <AppCard padded={false} style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View style={styles.heroContextBlock}>
          <AppText variant="caption" style={styles.heroEyebrow}>Assigned mosque</AppText>
          <AppText variant="body" style={styles.heroContextText} numberOfLines={2}>
            {resolvedMosqueName}
          </AppText>
        </View>
        <View style={styles.heroBadgeWrap}>
          {slotDayLabel ? (
            <View style={[styles.statusPill, styles.statusPillTomorrow]}>
              <AppText variant="caption" style={styles.statusPillTomorrowText}>{slotDayLabel}</AppText>
            </View>
          ) : null}
          {resolvedSlot ? (
            <View style={[styles.statusPill, statusPillStyle]}>
              <AppText variant="caption" style={styles.statusPillText}>{statusLabel}</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.heroMain}>
        <AppText variant="caption" style={styles.heroLabel}>Next adhan</AppText>
        {showLoadingState ? (
          <>
            <AppText variant="hero" style={styles.heroTime}>Loading today&apos;s schedule...</AppText>
            <View style={styles.heroDetailsCard}>
              <View style={styles.heroDetailRow}>
                <Ionicons name="time-outline" size={16} color="#8CCBFF" />
                <AppText variant="caption" style={styles.heroDetailText}>
                  Pull to refresh if this takes more than a few seconds.
                </AppText>
              </View>
            </View>
          </>
        ) : resolvedSlot ? (
          <>
            <View style={styles.heroPrimaryRow}>
              <View style={styles.heroPrayerPill}>
                <AppText variant="body" style={styles.heroPrayerName}>{resolvedSlot.prayerName}</AppText>
              </View>
              <AppText variant="hero" style={styles.heroTime}>{formatTime(resolvedSlot.adhanTime)}</AppText>
            </View>
            {!!countdownText && <AppText variant="body" style={styles.heroCountdown}>{countdownText}</AppText>}
            <View style={styles.heroDetailsCard}>
              {assignmentSummary ? (
                <View style={styles.heroDetailRow}>
                  <Ionicons
                    name={resolvedSlot.isAssignedToMe ? 'mic-outline' : resolvedSlot.assignedMuezzinName ? 'person-outline' : 'alert-circle-outline'}
                    size={16}
                    color="#8CCBFF"
                  />
                  <AppText variant="caption" style={styles.heroDetailText}>{assignmentSummary}</AppText>
                </View>
              ) : null}
              <View style={styles.heroDetailRow}>
                <Ionicons name="radio-outline" size={16} color="#8CCBFF" />
                <AppText variant="caption" style={styles.heroDetailText}>{liveWindowSummary}</AppText>
              </View>
            </View>
          </>
        ) : (
          <>
            <AppText variant="hero" style={styles.heroTime}>No adhans remaining today.</AppText>
            <View style={styles.heroDetailsCard}>
              <View style={styles.heroDetailRow}>
                <Ionicons name="flask-outline" size={16} color="#8CCBFF" />
                <AppText variant="caption" style={styles.heroDetailText}>{liveWindowSummary}</AppText>
              </View>
            </View>
          </>
        )}
      </View>

      {showLoadingState ? (
        <View style={styles.heroFooterNote}>
          <AppText variant="caption" style={styles.heroFooterText}>Checking your rota and prayer times now.</AppText>
        </View>
      ) : !resolvedSlot ? (
        <AppButton title="Run Test Broadcast" onPress={handleStartTest} style={styles.primaryButton} />
      ) : canManageLive ? (
        <AppButton title="Open Broadcast Controls" onPress={handleManage} style={styles.primaryButton} />
      ) : (
        <View style={styles.heroFooterNote}>
          <AppText variant="caption" style={styles.heroFooterText}>
            {resolvedSlot?.isAssignedToMe
              ? 'Broadcast controls open when this slot reaches its live window.'
              : 'You can monitor this slot and open test mode if needed.'}
          </AppText>
        </View>
      )}
    </AppCard>
  );
};

interface BroadcastReadinessCardProps {
  mosqueName: string | null;
  mosqueId: string | null;
  assignedSlot: MuezzinSlot | null;
  assignedSlotsToday: number;
  loading: boolean;
  onOpenControls: () => void;
  onRunTest: () => void;
  testResult: BroadcastTestResult;
}

const BroadcastReadinessCard: React.FC<BroadcastReadinessCardProps> = ({
  mosqueName,
  mosqueId,
  assignedSlot,
  assignedSlotsToday,
  loading,
  onOpenControls,
  onRunTest,
  testResult,
}) => {
  const slotLabel = assignedSlot
    ? `${assignedSlot.prayerName} at ${formatTime(assignedSlot.adhanTime)}`
    : loading
    ? 'Checking rota'
    : 'No assigned slot';
  const mosqueLabel = mosqueName ?? (loading ? 'Checking assigned mosque' : 'No assigned mosque');
  const coverageLabel = loading
    ? 'Loading today'
    : assignedSlotsToday > 0
    ? `${assignedSlotsToday} slot${assignedSlotsToday === 1 ? '' : 's'} assigned to you today`
    : 'No assigned cover today';
  const statusChip = getReadinessStatusChip(mosqueId, loading, testResult.status);
  const testFeedback = getBroadcastTestFeedback(testResult);

  return (
    <AppCard style={styles.readinessCard}>
      <View style={styles.readinessHeader}>
        <View>
          <AppText variant="sectionTitle" style={styles.readinessTitle}>Broadcast readiness</AppText>
          <AppText variant="caption" style={styles.readinessSubtitle}>Check the essentials before opening the mic.</AppText>
        </View>
        <View style={[styles.readinessStatusChip, statusChip.style]}>
          <AppText variant="caption" style={styles.readinessStatusText}>{statusChip.label}</AppText>
        </View>
      </View>

      <View style={styles.readinessRows}>
        <ReadinessRow icon="business-outline" label="Mosque" value={mosqueLabel} />
        <ReadinessRow icon="radio-outline" label="Next live slot" value={slotLabel} />
        <ReadinessRow icon="calendar-outline" label="Coverage" value={coverageLabel} />
      </View>

      <View style={styles.readinessActionRow}>
        <AppButton title="Open Controls" onPress={onOpenControls} style={styles.readinessAction} />
        <AppButton
          title={testResult.status === 'checking' ? 'Testing...' : 'Run Test'}
          variant="secondary"
          onPress={onRunTest}
          disabled={testResult.status === 'checking' || !mosqueId}
          style={styles.readinessAction}
        />
      </View>

      {testFeedback ? (
        <View style={[styles.testFeedback, testFeedback.style]}>
          <Ionicons name={testFeedback.icon} size={18} color={testFeedback.iconColor} />
          <View style={styles.testFeedbackText}>
            <AppText variant="body" style={styles.testFeedbackTitle}>{testResult.title}</AppText>
            {!!testResult.message && (
              <AppText variant="caption" style={styles.testFeedbackMessage} numberOfLines={3}>
                {testResult.message}
              </AppText>
            )}
          </View>
        </View>
      ) : null}
    </AppCard>
  );
};

function buildBroadcastTestResult(config: MosqueLiveBroadcastConfig | null): BroadcastTestResult {
  if (!config) {
    return {
      status: 'failed',
      title: 'No broadcast configuration',
      message: 'The backend responded, but no broadcast readiness details were returned.',
    };
  }

  const summary = config.encoder_preflight_summary?.trim();
  const firstIssue = config.issues.find((issue) => issue.trim().length > 0);
  const providerLabel = config.provider_label ?? 'Broadcast';
  const isLiveKitProvider = config.provider === 'livekit';

  if (!config.streaming_enabled || !config.is_ready_for_broadcast) {
    return {
      status: 'failed',
      title: 'Setup incomplete',
      message: firstIssue ?? summary ?? 'Finish the mosque live stream configuration before going live.',
    };
  }

  switch (config.encoder_preflight_status) {
    case 'ready':
      return {
        status: 'passed',
        title: isLiveKitProvider ? 'LiveKit readiness passed' : 'Backend check passed',
        message: summary ?? `${providerLabel} connectivity checks passed.`,
      };
    case 'manual_check_required':
      return {
        status: 'attention',
        title: 'Manual check needed',
        message: summary ?? `${providerLabel} is configured, but this provider still needs manual verification.`,
      };
    case 'attention':
      return {
        status: 'attention',
        title: isLiveKitProvider ? 'LiveKit needs attention' : 'Connection needs attention',
        message: summary ?? firstIssue ?? 'One or more broadcast endpoint checks needs attention.',
      };
    case 'not_configured':
    default:
      return {
        status: 'failed',
        title: 'Setup incomplete',
        message: summary ?? firstIssue ?? 'Required broadcast settings are missing.',
      };
  }
}

function getReadinessStatusChip(mosqueId: string | null, loading: boolean, status: BroadcastTestStatus) {
  if (loading || status === 'checking') {
    return { label: 'Checking', style: styles.readinessStatusChecking };
  }
  if (!mosqueId) {
    return { label: 'Needs setup', style: styles.readinessStatusWarn };
  }
  if (status === 'passed') {
    return { label: 'Passed', style: styles.readinessStatusReady };
  }
  if (status === 'attention') {
    return { label: 'Review', style: styles.readinessStatusWarn };
  }
  if (status === 'failed') {
    return { label: 'Failed', style: styles.readinessStatusDanger };
  }
  return { label: 'Not checked', style: styles.readinessStatusIdle };
}

function getBroadcastTestFeedback(result: BroadcastTestResult) {
  switch (result.status) {
    case 'checking':
      return {
        icon: 'sync-outline' as const,
        iconColor: '#0369A1',
        style: styles.testFeedbackChecking,
      };
    case 'passed':
      return {
        icon: 'checkmark-circle-outline' as const,
        iconColor: '#047857',
        style: styles.testFeedbackPassed,
      };
    case 'attention':
      return {
        icon: 'alert-circle-outline' as const,
        iconColor: '#B45309',
        style: styles.testFeedbackAttention,
      };
    case 'failed':
      return {
        icon: 'close-circle-outline' as const,
        iconColor: '#DC2626',
        style: styles.testFeedbackFailed,
      };
    default:
      return null;
  }
}

function ReadinessRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.readinessRow}>
      <View style={styles.readinessIcon}>
        <Ionicons name={icon} size={16} color="#0369A1" />
      </View>
      <View style={styles.readinessText}>
        <AppText variant="caption" style={styles.readinessLabel}>{label}</AppText>
        <AppText variant="body" style={styles.readinessValue} numberOfLines={2}>{value}</AppText>
      </View>
    </View>
  );
}

interface TodaysScheduleCardProps {
  schedule: MuezzinSchedule;
  loading?: boolean;
}

const TodaysScheduleCard: React.FC<TodaysScheduleCardProps> = ({ schedule, loading = false }) => {
  const subtitleText = schedule.mosqueName ?? (loading ? 'Loading assigned mosque...' : null);
  if (!schedule.slots.length && !loading) {
    return (
      <AppCard style={styles.card}>
        <AppText variant="sectionTitle" style={styles.cardTitle}>Today&apos;s Schedule</AppText>
        {!!subtitleText && <AppText variant="caption" style={styles.cardSubtitle}>{subtitleText}</AppText>}
        <AppText variant="caption" style={styles.cardEmptyText}>Prayer times and rota assignments are unavailable right now. Pull to refresh.</AppText>
      </AppCard>
    );
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.scheduleHeader}>
        <View style={styles.scheduleHeaderCopy}>
          <AppText variant="sectionTitle" style={styles.cardTitle}>Today&apos;s Schedule</AppText>
          {!!subtitleText && <AppText variant="caption" style={styles.cardSubtitle}>{subtitleText}</AppText>}
        </View>
        <View style={styles.scheduleHeaderPill}>
          <AppText variant="caption" style={styles.scheduleHeaderPillText}>Adhan + rota</AppText>
        </View>
      </View>

      <View style={styles.scheduleColumns}>
        <View style={styles.schedulePrayerColumn}>
          <AppText variant="caption" style={styles.scheduleColumnLabel}>Prayer</AppText>
        </View>
        <View style={styles.scheduleTimeColumn}>
          <AppText variant="caption" style={styles.scheduleColumnLabel}>Adhan</AppText>
        </View>
        <View style={styles.scheduleCoverageColumn}>
          <AppText variant="caption" style={styles.scheduleColumnLabel}>Rota</AppText>
        </View>
      </View>

      <View style={styles.scheduleRows}>
        {loading && !schedule.slots.length ? (
          <AppText variant="caption" style={styles.cardEmptyText}>Loading today&apos;s schedule...</AppText>
        ) : schedule.slots.map((slot, index) => {
          const isLast = index === schedule.slots.length - 1;
          return (
            <View key={slot.id} style={[styles.scheduleRow, !isLast && styles.adahnRowDivider]}>
              <View style={styles.schedulePrayerColumn}>
                <AppText style={styles.adahnName}>{slot.prayerName}</AppText>
              </View>
              <View style={styles.scheduleTimeColumn}>
                <AppText style={styles.adahnTime}>{formatTime(slot.adhanTime)}</AppText>
              </View>
              <View style={styles.scheduleCoverageColumn}>
                <AssignmentBadge slot={slot} />
              </View>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
};

function AssignmentBadge({ slot }: { slot: MuezzinSlot }) {
  if (slot.assignmentSource === 'default') {
    return (
      <View style={styles.defaultPill}>
        <AppText variant="caption" style={styles.defaultPillText} numberOfLines={1}>
          {slot.isAssignedToMe ? 'Default: you' : `Default: ${slot.assignedMuezzinName ?? 'muezzin'}`}
        </AppText>
      </View>
    );
  }

  if (slot.isAssignedToMe) {
    return (
      <View style={styles.youPill}>
        <Ionicons name="mic-outline" size={14} color="#0B7A30" style={{ marginRight: 4 }} />
        <AppText variant="caption" style={styles.youPillText}>You</AppText>
      </View>
    );
  }

  if (slot.assignedMuezzinName) {
    return <AppText variant="caption" style={styles.assignedOtherText} numberOfLines={1}>{slot.assignedMuezzinName}</AppText>;
  }

  return <AppText variant="caption" style={styles.unassignedText}>Unassigned</AppText>;
}

function formatTime(date: Date | null): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(target: Date, now: Date): string {
  const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(diff / 3600)
    .toString()
    .padStart(2, '0');
  const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
  const secs = (diff % 60).toString().padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
}

function getNextAdhanCountdown(slot: MuezzinSlot | null, now: Date, liveWindowEnd: Date | null) {
  if (!slot?.adhanTime) return '';
  const adhanDiffMs = slot.adhanTime.getTime() - now.getTime();
  if (adhanDiffMs > 0) {
    return `In ${formatDuration(slot.adhanTime, now)}`;
  }
  if (liveWindowEnd && liveWindowEnd.getTime() > now.getTime()) {
    return `Window closes in ${formatDuration(liveWindowEnd, now)}`;
  }
  return '';
}

function getFutureSlotLabel(date: Date | null, now: Date) {
  if (!date) return null;
  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  ) {
    return 'Tomorrow';
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() <= today.getTime()) {
    return null;
  }

  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function pickUpcomingSlot(slots: MuezzinSlot[], now: Date, assignedOnly: boolean) {
  const nowMs = now.getTime();
  const prayerOrder: MuezzinSlot['prayerName'][] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  return [...slots]
    .filter((slot) => hasConcreteSlotTime(slot))
    .filter((slot) => !assignedOnly || slot.isAssignedToMe)
    .filter((slot) => {
      const cutoff = slot.liveWindowEnd?.getTime() ?? slot.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return cutoff >= nowMs;
    })
    .sort((left, right) => {
      const leftOpen =
        !!left.liveWindowStart &&
        !!left.liveWindowEnd &&
        nowMs >= left.liveWindowStart.getTime() &&
        nowMs <= left.liveWindowEnd.getTime();
      const rightOpen =
        !!right.liveWindowStart &&
        !!right.liveWindowEnd &&
        nowMs >= right.liveWindowStart.getTime() &&
        nowMs <= right.liveWindowEnd.getTime();

      if (leftOpen !== rightOpen) return leftOpen ? -1 : 1;

      const leftTime = left.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftTime !== rightTime) return leftTime - rightTime;

      return prayerOrder.indexOf(left.prayerName) - prayerOrder.indexOf(right.prayerName);
    })[0] ?? null;
}

function hasConcreteSlotTime(slot: MuezzinSlot | null | undefined) {
  return !!slot?.adhanTime || !!slot?.liveWindowStart || !!slot?.liveWindowEnd;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 2,
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#8a8f9b',
    marginBottom: 10,
  },
  mosquePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e4f2ff',
    marginBottom: 14,
  },
  mosquePillTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  mosquePillSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  heroCard: {
    backgroundColor: '#071427',
    borderRadius: 24,
    padding: 16,
    marginBottom: 6,
  },
  heroTop: {
    gap: 10,
    marginBottom: 14,
  },
  heroContextBlock: {
    gap: 4,
  },
  heroBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'uppercase',
    color: '#6FB9FF',
  },
  heroContextText: {
    color: '#E2E8F0',
    fontWeight: '700',
    lineHeight: 20,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillNeutral: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statusPillReady: {
    backgroundColor: '#dcfce7',
  },
  statusPillLive: {
    backgroundColor: '#fee2e2',
  },
  statusPillTomorrow: {
    backgroundColor: '#E0F2FE',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  statusPillTomorrowText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  heroMain: {
    gap: 10,
  },
  heroLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  heroPrimaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  heroPrayerPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(111,185,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(111,185,255,0.2)',
  },
  heroPrayerName: {
    color: '#D8EEFF',
    fontWeight: '800',
    fontSize: 16,
  },
  heroTime: {
    flexShrink: 1,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroCountdown: {
    fontSize: 15,
    color: '#22C55E',
    fontWeight: '700',
  },
  heroDetailsCard: {
    gap: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  heroDetailText: {
    flex: 1,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 18,
  },
  heroFooterNote: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  heroFooterText: {
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 18,
  },
  readinessCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#DDE7F2',
  },
  readinessHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  readinessTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  readinessSubtitle: {
    marginTop: 3,
    color: '#64748B',
    lineHeight: 18,
  },
  readinessStatusChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  readinessStatusIdle: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  readinessStatusChecking: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  readinessStatusReady: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  readinessStatusWarn: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  readinessStatusDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  readinessStatusText: {
    color: '#0F172A',
    fontWeight: '800',
  },
  readinessRows: {
    marginTop: 12,
    gap: 8,
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readinessIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  readinessText: {
    flex: 1,
  },
  readinessLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  readinessValue: {
    color: '#0F172A',
    fontWeight: '800',
    lineHeight: 20,
  },
  readinessActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  readinessAction: {
    flex: 1,
    minHeight: 44,
  },
  testFeedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  testFeedbackChecking: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  testFeedbackPassed: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  testFeedbackAttention: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  testFeedbackFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  testFeedbackText: {
    flex: 1,
    minWidth: 0,
  },
  testFeedbackTitle: {
    fontWeight: '800',
    color: '#0F172A',
  },
  testFeedbackMessage: {
    marginTop: 2,
    color: '#475569',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E6E8EB',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  cardEmptyText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  scheduleHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  scheduleHeaderPill: {
    flexShrink: 0,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  scheduleHeaderPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  scheduleColumns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E8EB',
  },
  scheduleColumnLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  scheduleRows: {
    marginTop: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 8,
  },
  adahnRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E8EB',
  },
  schedulePrayerColumn: {
    flex: 1,
    minWidth: 0,
  },
  scheduleTimeColumn: {
    width: 80,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  scheduleCoverageColumn: {
    width: 112,
    flexShrink: 0,
    alignItems: 'flex-end',
    minWidth: 0,
  },
  adahnName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  adahnTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  youPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
  },
  youPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  defaultPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    maxWidth: '100%',
  },
  defaultPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  assignedOtherText: {
    fontSize: 13,
    color: '#111827',
    maxWidth: '100%',
    textAlign: 'right',
  },
  unassignedText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  primaryButton: {
    width: '100%',
    marginTop: 8,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
