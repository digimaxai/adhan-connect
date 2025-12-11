import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMuezzinSchedule } from '../../lib/hooks/useMuezzinSchedule';
import type { MuezzinSchedule, MuezzinSlot } from '../../lib/types/muezzin';

const PAGE_PADDING = 14;
const WINDOW_START_MS = 3 * 60 * 1000;
const WINDOW_END_MS = 2 * 60 * 1000;

export default function MuezzinToolsScreen() {
  const router = useRouter();
  const { schedule, nextAssignedSlot, loading, refresh } = useMuezzinSchedule();

  const resolvedSchedule: MuezzinSchedule = schedule ?? {
    mosqueId: null,
    mosqueName: null,
    slots: [],
    nextAssignedSlot: null,
  };

  const primaryMosqueId = resolvedSchedule.mosqueId;

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
    if (nextAssignedSlot) {
      router.push({
        pathname: '/(muezzin)/live-broadcast',
        params: {
          mosqueId: primaryMosqueId ?? '',
          slotId: nextAssignedSlot.id,
          mosqueName: nextAssignedSlot.mosqueName ?? '',
          prayerName: nextAssignedSlot.prayerName,
          adhanTime: nextAssignedSlot.adhanTime ? nextAssignedSlot.adhanTime.toISOString() : '',
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
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: PAGE_PADDING, paddingTop: PAGE_PADDING, paddingBottom: 12 }}
        refreshControl={<RefreshControl refreshing={!!loading} onRefresh={refresh} />}
      >
        <Text style={styles.title}>Muezzin Home</Text>
        <Text style={styles.subtitle}>Review your next adhan and start live when the time comes.</Text>

        <NextAdhanCard slot={nextAssignedSlot} onPressStatusStrip={handleOpenLiveBroadcast} />

        <TodaysAdhansCard schedule={resolvedSchedule} />

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]} onPress={handleManageLivePress}>
          <Text style={styles.primaryButtonText}>Manage Live Broadcast</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

interface NextAdhanCardProps {
  slot: MuezzinSlot | null;
  onPressStatusStrip: (slot: MuezzinSlot | null) => void;
}

const NextAdhanCard: React.FC<NextAdhanCardProps> = ({ slot, onPressStatusStrip }) => {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const countdownText = useCountdown(slot?.adhanTime ?? null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const liveWindowStart = slot?.liveWindowStart ?? (slot?.adhanTime ? new Date(slot.adhanTime.getTime() - WINDOW_START_MS) : null);
  const liveWindowEnd = slot?.liveWindowEnd ?? (slot?.adhanTime ? new Date(slot.adhanTime.getTime() + WINDOW_END_MS) : null);
  const isLiveWindowOpen = !!liveWindowStart && !!liveWindowEnd && now >= liveWindowStart && now <= liveWindowEnd;
  const isAfterWindow = !!liveWindowEnd && now > liveWindowEnd;
  const liveOpensIn = liveWindowStart ? formatDuration(liveWindowStart, now) : null;

  const canManageLive = !!slot && (isLiveWindowOpen || slot.status === 'ready' || slot.status === 'live');

  const statusLabel =
    slot?.status === 'live'
      ? 'Live'
      : slot?.status === 'ready'
      ? 'Ready'
      : slot?.status === 'completed'
      ? 'Completed'
      : 'Scheduled';

  const statusPillStyle =
    slot?.status === 'live'
      ? styles.statusPillLive
      : slot?.status === 'ready'
      ? styles.statusPillReady
      : styles.statusPillNeutral;

  const handleStartTest = () => {
    router.push({ pathname: '/(muezzin)/live-broadcast', params: { mode: 'test' } });
  };

  const handleManage = () => {
    if (!slot) {
      handleStartTest();
      return;
    }
    onPressStatusStrip(slot);
  };

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeaderRow}>
        <Text style={styles.heroContextText}>Muezzin - {slot?.mosqueName ?? 'Mosque'}</Text>
        {slot ? (
          <View style={[styles.statusPill, statusPillStyle]}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.heroMain}>
        <Text style={styles.heroLabel}>Next adhan</Text>
        <Text style={styles.heroTime}>{slot ? `${slot.prayerName} - ${formatTime(slot.adhanTime)}` : 'No adhans remaining today.'}</Text>
        {!!countdownText && slot && <Text style={styles.heroCountdown}>{countdownText}</Text>}
      </View>

      {!slot ? (
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]} onPress={handleStartTest}>
          <Text style={styles.primaryButtonText}>Start test live adhan</Text>
        </Pressable>
      ) : canManageLive ? (
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]} onPress={handleManage}>
          <Text style={styles.primaryButtonText}>Manage Live Broadcast</Text>
        </Pressable>
      ) : isAfterWindow ? (
        <View style={[styles.heroStrip, styles.heroStripDisabled]}>
          <Text style={styles.heroStripText}>Adhan window ended</Text>
        </View>
      ) : (
        <View style={[styles.heroStrip, styles.heroStripDisabled]}>
          <Text style={styles.heroStripText}>
            {liveOpensIn ? `Live broadcast opens in ${liveOpensIn}` : 'Live broadcast opens soon'}
          </Text>
        </View>
      )}
    </View>
  );
};

interface TodaysAdhansCardProps {
  schedule: MuezzinSchedule;
}

const TodaysAdhansCard: React.FC<TodaysAdhansCardProps> = ({ schedule }) => {
  if (!schedule.slots.length) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Today&apos;s Adhans</Text>
      {!!schedule.mosqueName && <Text style={styles.cardSubtitle}>{schedule.mosqueName}</Text>}

      <View style={{ marginTop: 12 }}>
        {schedule.slots.map((slot, index) => {
          const isLast = index === schedule.slots.length - 1;
          return (
            <View key={slot.id} style={[styles.adahnRow, !isLast && styles.adahnRowDivider]}>
              <View style={styles.adahnLeft}>
                <Text style={styles.adahnName}>{slot.prayerName}</Text>
              </View>
              <View style={styles.adahnMiddle}>
                <Text style={styles.adahnTime}>{formatTime(slot.adhanTime)}</Text>
              </View>
              <View style={styles.adahnRight}>
                {slot.isAssignedToMe ? (
                  <View style={styles.youPill}>
                    <Ionicons name="mic-outline" size={14} color="#0B7A30" style={{ marginRight: 4 }} />
                    <Text style={styles.youPillText}>You</Text>
                  </View>
                ) : slot.assignedMuezzinName ? (
                  <Text style={styles.assignedOtherText}>{slot.assignedMuezzinName}</Text>
                ) : (
                  <Text style={styles.unassignedText}>Unassigned</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

function formatTime(date: Date | null): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(target: Date, now: Date): string {
  const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const mins = Math.floor(diff / 60)
    .toString()
    .padStart(2, '0');
  const secs = (diff % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function useCountdown(target: Date | null) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!target) {
      setText('');
      return;
    }
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target.getTime() - now) / 1000));
      const mins = Math.floor(diff / 60)
        .toString()
        .padStart(2, '0');
      const secs = (diff % 60).toString().padStart(2, '0');
      setText(`In ${mins}:${secs}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return text;
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
    padding: 10,
    marginBottom: 6,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroContextText: {
    fontSize: 12,
    color: '#52a6ff',
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
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  heroMain: {
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  heroTime: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroCountdown: {
    fontSize: 14,
    color: '#22C55E',
    marginTop: 4,
  },
  heroStrip: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  heroStripActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroStripDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroStripPressed: {
    opacity: 0.7,
  },
  heroStripText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#ffffff',
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
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
