import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMuezzinSchedule } from '../../lib/hooks/useMuezzinSchedule';
import type { MuezzinSlot } from '../../lib/types/muezzin';

export default function LiveBroadcastScreen() {
  const params = useLocalSearchParams<{ slotId?: string; mosqueName?: string; prayerName?: string; adhanTime?: string }>();
  const router = useRouter();
  const { schedule, nextAssignedSlot } = useMuezzinSchedule();

  const slot: MuezzinSlot | null = useMemo(() => {
    const slots = schedule?.slots ?? [];
    if (params.slotId) {
      const found = slots.find((s) => s.id === params.slotId);
      if (found) return found;
    }
    return nextAssignedSlot ?? null;
  }, [schedule?.slots, nextAssignedSlot, params.slotId]);

  return (
    <>
      <Stack.Screen options={{ title: 'Live broadcast' }} />
      {!slot ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No adhan slot found</Text>
          <Text style={styles.emptyText}>There is no active adhan scheduled for you at the moment.</Text>
          {params.prayerName || params.adhanTime ? (
            <Text style={[styles.emptyText, { marginTop: 6 }]}>
              {params.prayerName ? `${params.prayerName} ` : ''}{params.adhanTime ? `(${params.adhanTime})` : ''}
            </Text>
          ) : null}
        </View>
      ) : (
        <LiveBroadcastContent slot={slot} onGoBack={() => router.back()} />
      )}
    </>
  );
}

interface LiveBroadcastContentProps {
  slot: MuezzinSlot;
  onGoBack: () => void;
}

const LiveBroadcastContent: React.FC<LiveBroadcastContentProps> = ({ slot, onGoBack }) => {
  // TODO: plug into your actual streaming start/stop logic.
  const scheduledTime = formatTime(slot.adhanTime);
  const liveWindow =
    slot.liveWindowStart && slot.liveWindowEnd
      ? `${formatTime(slot.liveWindowStart)} – ${formatTime(slot.liveWindowEnd)}`
      : 'Not set';

  const statusLabel =
    slot.status === 'live' ? 'Live' : slot.status === 'ready' ? 'Ready' : slot.status === 'completed' ? 'Finished' : 'Scheduled';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.mosqueName}>{slot.mosqueName}</Text>
        <Text style={styles.prayerTitle}>
          {slot.prayerName} · {scheduledTime}
        </Text>
      </View>

      <View style={styles.micWrapper}>
        <View style={styles.micOuter}>
          <View style={styles.micInner}>
            <Text style={styles.micLabelTop}>{statusLabel}</Text>
            <Text style={styles.micLabelBottom}>
              {slot.status === 'ready' ? 'Tap to start' : slot.status === 'live' ? 'Broadcasting…' : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.timingCard}>
        <Text style={styles.cardLabel}>Timing</Text>
        <View style={styles.timingRow}>
          <Text style={styles.timingKey}>Scheduled</Text>
          <Text style={styles.timingValue}>{scheduledTime}</Text>
        </View>
        <View style={styles.timingRow}>
          <Text style={styles.timingKey}>Live window</Text>
          <Text style={styles.timingValue}>{liveWindow}</Text>
        </View>
      </View>

      <View style={styles.connectionBar}>
        <Text style={styles.connectionText}>Ready to connect</Text>
        <Text style={styles.connectionText}>Listeners: --</Text>
      </View>

      <Pressable onPress={onGoBack} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Text style={styles.backBtnText}>Back</Text>
      </Pressable>
    </View>
  );
};

function formatTime(date: Date | null): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#F8FAFC',
  },
  header: {
    marginBottom: 24,
  },
  mosqueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  prayerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
    color: '#0F172A',
  },
  micWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  micOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLabelTop: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  micLabelBottom: {
    marginTop: 4,
    fontSize: 14,
    color: '#e5e7eb',
  },
  timingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6E8EB',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0F172A',
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timingKey: {
    fontSize: 14,
    color: '#6b7280',
  },
  timingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  connectionBar: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#ecfeff',
    marginBottom: 16,
  },
  connectionText: {
    fontSize: 14,
    color: '#0f172a',
  },
  backBtn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtnText: {
    color: '#0EA5E9',
    fontWeight: '800',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0F172A',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
