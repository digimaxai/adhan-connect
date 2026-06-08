import React, { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMuezzinSchedule } from '../../lib/hooks/useMuezzinSchedule';
import { useRoleFlags } from '../../lib/roles';
import type { MuezzinSchedule, MuezzinSlot } from '../../lib/types/muezzin';
import { AppButton } from '../../components/ui/app-button';
import { AppCard } from '../../components/ui/app-card';
import { ScreenContainer } from '../../components/ui/screen-container';
import { AppText } from '../../components/ui/app-text';

const PAGE_PADDING = 14;
const WINDOW_START_MS = 3 * 60 * 1000;
const WINDOW_END_MS = 2 * 60 * 1000;

export default function MuezzinToolsScreen() {
  const router = useRouter();
  const { schedule, loading, refresh } = useMuezzinSchedule();
  const roles = useRoleFlags();
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

  return (
    <ScreenContainer
      style={styles.container}
      contentStyle={{ paddingHorizontal: PAGE_PADDING, paddingTop: PAGE_PADDING, paddingBottom: 12 }}
        refreshControl={<RefreshControl refreshing={!!loading} onRefresh={refresh} />}
      >
        <AppText variant="title" style={styles.title}>Muezzin Home</AppText>
        <AppText variant="caption" style={styles.subtitle}>Review your next adhan and start live when the time comes.</AppText>

        <NextAdhanCard
          slot={nextPrayerSlot}
          assignedSlot={safeNextAssignedSlot}
          scheduleSlots={resolvedSchedule.slots}
          mosqueName={resolvedSchedule.mosqueName}
          loading={isInitialScheduleLoad}
          onPressStatusStrip={handleOpenLiveBroadcast}
        />

        <TodaysPrayerTimesCard schedule={resolvedSchedule} loading={isInitialScheduleLoad} />

        <TodaysRotaCard schedule={resolvedSchedule} loading={isInitialScheduleLoad} />

        <AppButton title="Manage Live Broadcast" onPress={handleManageLivePress} style={styles.primaryButton} />
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
        <AppButton title="Start test live adhan" onPress={handleStartTest} style={styles.primaryButton} />
      ) : canManageLive ? (
        <AppButton title="Manage Live Broadcast" onPress={handleManage} style={styles.primaryButton} />
      ) : (
        <View style={styles.heroFooterNote}>
          <AppText variant="caption" style={styles.heroFooterText}>
            {resolvedSlot?.isAssignedToMe
              ? 'You can manage this slot when the broadcast window opens.'
              : 'You can monitor this slot and open test mode if needed.'}
          </AppText>
        </View>
      )}
    </AppCard>
  );
};

interface TodaysScheduleCardProps {
  schedule: MuezzinSchedule;
  loading?: boolean;
}

const TodaysPrayerTimesCard: React.FC<TodaysScheduleCardProps> = ({ schedule, loading = false }) => {
  const subtitleText = schedule.mosqueName ?? (loading ? 'Loading assigned mosque...' : null);
  if (!schedule.slots.length && !loading) {
    return (
      <AppCard style={styles.card}>
        <AppText variant="sectionTitle" style={styles.cardTitle}>Today&apos;s Prayer Times</AppText>
        {!!subtitleText && <AppText variant="caption" style={styles.cardSubtitle}>{subtitleText}</AppText>}
        <AppText variant="caption" style={styles.cardEmptyText}>Prayer times are unavailable right now. Pull to refresh.</AppText>
      </AppCard>
    );
  }

  return (
    <AppCard style={styles.card}>
      <AppText variant="sectionTitle" style={styles.cardTitle}>Today&apos;s Prayer Times</AppText>
      {!!subtitleText && <AppText variant="caption" style={styles.cardSubtitle}>{subtitleText}</AppText>}

      <View style={{ marginTop: 12 }}>
        {loading && !schedule.slots.length ? (
          <AppText variant="caption" style={styles.cardEmptyText}>Loading today&apos;s prayer times...</AppText>
        ) : schedule.slots.map((slot, index) => {
          const isLast = index === schedule.slots.length - 1;
          return (
            <View key={`${slot.id}-times`} style={[styles.adahnRow, !isLast && styles.adahnRowDivider]}>
              <View style={styles.adahnLeft}>
                <AppText style={styles.adahnName}>{slot.prayerName}</AppText>
              </View>
              <View style={styles.adahnRightOnly}>
                <AppText style={styles.adahnTime}>{formatTime(slot.adhanTime)}</AppText>
              </View>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
};

const TodaysRotaCard: React.FC<TodaysScheduleCardProps> = ({ schedule, loading = false }) => {
  const subtitleText = schedule.mosqueName ?? (loading ? 'Loading assigned mosque...' : null);
  if (!schedule.slots.length && !loading) {
    return (
      <AppCard style={styles.card}>
        <AppText variant="sectionTitle" style={styles.cardTitle}>Today&apos;s Rota</AppText>
        {!!subtitleText && <AppText variant="caption" style={styles.cardSubtitle}>{subtitleText}</AppText>}
        <AppText variant="caption" style={styles.cardEmptyText}>Rota assignments are unavailable right now. Pull to refresh.</AppText>
      </AppCard>
    );
  }

  return (
    <AppCard style={styles.card}>
      <AppText variant="sectionTitle" style={styles.cardTitle}>Today&apos;s Rota</AppText>
      {!!subtitleText && <AppText variant="caption" style={styles.cardSubtitle}>{subtitleText}</AppText>}

      <View style={{ marginTop: 12 }}>
        {loading && !schedule.slots.length ? (
          <AppText variant="caption" style={styles.cardEmptyText}>Loading today&apos;s rota...</AppText>
        ) : schedule.slots.map((slot, index) => {
          const isLast = index === schedule.slots.length - 1;
          return (
            <View key={slot.id} style={[styles.adahnRow, !isLast && styles.adahnRowDivider]}>
              <View style={styles.adahnLeft}>
                <AppText style={styles.adahnName}>{slot.prayerName}</AppText>
              </View>
              <View style={styles.adahnMiddle}>
                <AppText style={styles.adahnTime}>{formatTime(slot.adhanTime)}</AppText>
              </View>
              <View style={styles.adahnRight}>
                {slot.assignmentSource === 'default' ? (
                  <View style={styles.defaultPill}>
                    <AppText variant="caption" style={styles.defaultPillText}>
                      {slot.isAssignedToMe ? 'Default: you' : `Default: ${slot.assignedMuezzinName ?? 'muezzin'}`}
                    </AppText>
                  </View>
                ) : slot.isAssignedToMe ? (
                  <View style={styles.youPill}>
                    <Ionicons name="mic-outline" size={14} color="#0B7A30" style={{ marginRight: 4 }} />
                    <AppText variant="caption" style={styles.youPillText}>You</AppText>
                  </View>
                ) : slot.assignedMuezzinName ? (
                  <AppText variant="caption" style={styles.assignedOtherText}>{slot.assignedMuezzinName}</AppText>
                ) : (
                  <AppText variant="caption" style={styles.unassignedText}>Unassigned</AppText>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
};

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
    letterSpacing: 0.5,
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
  adahnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 44,
  },
  adahnRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E8EB',
  },
  adahnLeft: { flex: 1 },
  adahnMiddle: { width: 70, alignItems: 'flex-end' },
  adahnRight: { flexShrink: 0, marginLeft: 8 },
  adahnRightOnly: { minWidth: 72, alignItems: 'flex-end' },
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
    maxWidth: 132,
  },
  defaultPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  assignedOtherText: {
    fontSize: 13,
    color: '#111827',
  },
  unassignedText: {
    fontSize: 13,
    color: '#9CA3AF',
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
