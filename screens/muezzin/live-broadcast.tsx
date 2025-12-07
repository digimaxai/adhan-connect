import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrayerName, labelForPrayer } from '../../lib/adhans';
import { useLiveBroadcastEngine } from '../../lib/hooks/useLiveBroadcastEngine';
import { useMuezzinSchedule } from '../../lib/hooks/useMuezzinSchedule';
import { useMosquePrayerTimes } from '../shared/hooks/useMosquePrayerTimes';

type Params = {
  mosqueId?: string;
  mosqueName?: string;
  prayerName?: string;
  scheduledTime?: string;
  mode?: string;
  adhanId?: string;
};

const WINDOW_START_MS = 3 * 60 * 1000; // 3 minutes before
const WINDOW_END_MS = 2 * 60 * 1000; // 2 minutes after

const formatCountdown = (seconds: number) => {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const secs = Math.max(0, Math.floor(seconds % 60));
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function MuezzinLiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const schedule = useMuezzinSchedule();
  const paramsMosqueId = params.mosqueId ?? null;
  const resolvedMosqueId = paramsMosqueId ?? schedule.mosqueId ?? '';
  const mosqueName = params.mosqueName ?? schedule.mosqueName ?? 'Mosque';
  const prayerName = params.prayerName ?? (schedule.nextAdhan?.prayer as string) ?? 'Adhan';
  const prayerKey = (prayerName ?? '').toString().toLowerCase() as PrayerName;
  const mode = params.mode === 'test' ? 'test' : 'normal';

  const prayerTimes = useMosquePrayerTimes(resolvedMosqueId);
  const [banner, setBanner] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const adhanFromParams = useMemo(() => {
    if (!params.scheduledTime) return null;
    return {
      id: params.adhanId ?? 'pending',
      mosque_id: resolvedMosqueId,
      prayer: prayerName,
      scheduled_at: params.scheduledTime,
      status: 'scheduled',
    };
  }, [params.adhanId, params.scheduledTime, prayerName, resolvedMosqueId]);

  const activeAdhan = useMemo(() => {
    if (adhanFromParams) return adhanFromParams;
    if (schedule.nextAdhan) return schedule.nextAdhan;
    // fallback to nearest prayer time if available
    const fromTimes = prayerTimes.times?.[prayerKey];
    if (fromTimes) {
      const [h, m] = fromTimes.split(':').map((v) => parseInt(v, 10));
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return {
        id: 'fallback',
        mosque_id: resolvedMosqueId,
        prayer: prayerName,
        scheduled_at: d.toISOString(),
        status: 'scheduled',
      };
    }
    return null;
  }, [adhanFromParams, schedule.nextAdhan, prayerTimes.times, prayerKey, prayerName, resolvedMosqueId]);

  const scheduledDate = useMemo(() => {
    if (activeAdhan?.scheduled_at) return new Date(activeAdhan.scheduled_at);
    if (mode === 'test') {
      const d = new Date();
      d.setSeconds(d.getSeconds() + 120);
      return d;
    }
    return null;
  }, [activeAdhan?.scheduled_at, mode]);

  const engine = useLiveBroadcastEngine(resolvedMosqueId, activeAdhan);

  useEffect(() => {
    if (engine.status === 'READY' || engine.status === 'LIVE') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.05, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [engine.status, pulse]);

  const timeUntil = engine.timeUntilSeconds;
  const windowStartLabel = scheduledDate ? new Date(scheduledDate.getTime() - WINDOW_START_MS) : null;
  const windowEndLabel = scheduledDate ? new Date(scheduledDate.getTime() + WINDOW_END_MS) : null;

  const statusPill = (() => {
    if (engine.isLive) return { label: 'LIVE', bg: '#FEE2E2', color: '#B91C1C' };
    if (engine.isEarly) return { label: 'Not yet', bg: '#E2E8F0', color: '#475569' };
    if (engine.canStart) return { label: 'Ready', bg: '#DCFCE7', color: '#166534' };
    if (engine.isLate) return { label: 'Completed', bg: '#E2E8F0', color: '#475569' };
    return { label: 'Scheduled', bg: '#E2E8F0', color: '#475569' };
  })();

  const helperText = (() => {
    if (engine.isLive) return 'Broadcast is live.';
    if (engine.isEarly) return 'You can start within 3 minutes before the adhan time.';
    if (engine.canStart) return 'Ready to start broadcast.';
    if (engine.isLate) return 'Adhan window has passed.';
    return 'Awaiting schedule.';
  })();

  const isAssigned = schedule.assignedPrayers[prayerKey] ?? false;

  const connectionStatus = engine.isLive ? 'Stream connected' : engine.loading ? 'Connecting…' : 'Ready to connect';

  const handlePrimaryPress = async () => {
    setBanner(null);
    if (engine.isLive) {
      await engine.endBroadcast();
      if (!engine.errorMessage) setBanner('Broadcast ended');
    } else {
      await engine.startBroadcast();
      if (!engine.errorMessage) setBanner('Broadcast started');
    }
  };

  const circleStyle = (() => {
    if (engine.isLive)
      return {
        bg: '#DC2626',
        main: 'Live',
        sub: engine.stream?.started_at ? `Since ${new Date(engine.stream.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Tap to end',
      };
    if (engine.canStart)
      return {
        bg: '#0EA5E9',
        main: 'Ready',
        sub: timeUntil !== null ? `Starts in ${formatCountdown(timeUntil)}` : 'Tap to start',
      };
    if (engine.isEarly)
      return {
        bg: '#E2E8F0',
        main: 'Too early',
        sub: 'You can start within 3 minutes before time',
      };
    if (engine.isLate)
      return { bg: '#0F172A', main: 'Completed', sub: 'Adhan window ended' };
    return { bg: '#E2E8F0', main: 'Scheduled', sub: timeUntil !== null ? `In ${formatCountdown(timeUntil)}` : '' };
  })();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Live Broadcast</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{labelForPrayer(prayerName as any)} for {mosqueName}</Text>
        <View style={[styles.statusPill, { backgroundColor: statusPill.bg }]}>
          <Text style={[styles.statusPillText, { color: statusPill.color }]}>{statusPill.label}</Text>
        </View>
        {isAssigned ? <Text style={styles.assignmentNote}>You are assigned to this adhan today.</Text> : null}

        {(banner || engine.errorMessage) ? (
          <View style={[styles.banner, engine.errorMessage ? styles.bannerError : null]}>
            <Text style={[styles.bannerText, engine.errorMessage ? styles.bannerErrorText : null]}>
              {engine.errorMessage ?? banner}
            </Text>
          </View>
        ) : null}

        <View style={styles.circleWrap}>
          <Animated.View style={[styles.circleOuter, (engine.canStart || engine.isLive) && timeUntil !== null ? styles.circleOuterReady : null, { transform: [{ scale: pulse }] }]}>
            <Pressable
              disabled={engine.loading || (!engine.canStart && !engine.isLive)}
              onPress={handlePrimaryPress}
              style={({ pressed }) => [
                styles.circle,
                {
                  backgroundColor: circleStyle.bg,
                  opacity: pressed && !engine.isEarly ? 0.9 : engine.isEarly ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons
                name="mic"
                size={36}
                color={engine.isEarly ? '#475569' : '#FFFFFF'}
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.circleText}>{engine.loading ? 'Working...' : circleStyle.main}</Text>
              {circleStyle.sub ? <Text style={styles.circleSub}>{circleStyle.sub}</Text> : null}
            </Pressable>
          </Animated.View>
        </View>
        <Text style={styles.helperText}>{helperText}</Text>

        <View style={styles.metaCard}>
          <Text style={styles.metaHeading}>Timing</Text>
          {scheduledDate ? (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Scheduled</Text>
                <Text style={styles.metaValue}>{scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              {windowStartLabel && windowEndLabel ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Live window</Text>
                  <Text style={styles.metaValue}>
                    {windowStartLabel.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {windowEndLabel.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Scheduled</Text>
              <Text style={styles.metaValue}>Soon</Text>
            </View>
          )}
          {engine.isLive && engine.stream?.started_at ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Live since</Text>
              <Text style={styles.metaValue}>
                {new Date(engine.stream.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ) : timeUntil !== null ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Time until adhan</Text>
              <Text style={styles.metaValue}>{formatCountdown(timeUntil)}</Text>
            </View>
          ) : null}
        </View>

        {engine.isLive ? (
          <Pressable onPress={handlePrimaryPress} style={({ pressed }) => [styles.secondaryAction, { opacity: pressed ? 0.85 : 1 }]}>
            <Text style={styles.secondaryActionText}>End and mark adhan completed</Text>
          </Pressable>
        ) : null}

        <View style={styles.connectionRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="radio-outline" size={18} color="#0F172A" />
            <Text style={styles.connectionText}>{connectionStatus}</Text>
          </View>
          <Text style={styles.connectionMuted}>Listeners: --</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  content: { flex: 1, paddingHorizontal: 16, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: { fontWeight: '800', fontSize: 12 },
  banner: {
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 10,
  },
  bannerText: { color: '#166534', fontWeight: '700' },
  bannerError: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  bannerErrorText: { color: '#B91C1C' },
  circleWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 8 },
  circleOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  circleOuterReady: {
    backgroundColor: '#E0F2FE',
  },
  circle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  circleText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17, marginBottom: 2 },
  circleSub: { color: '#E0F2FE', fontWeight: '700', fontSize: 14 },
  helperText: { textAlign: 'center', color: '#475569', marginTop: 6, fontWeight: '600' },
  assignmentNote: { color: '#0F172A', fontWeight: '700', marginTop: 6 },
  metaCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  metaHeading: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { color: '#475569', fontWeight: '700' },
  metaValue: { color: '#0F172A', fontWeight: '800' },
  secondaryAction: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryActionText: { color: '#DC2626', fontWeight: '800' },
  connectionRow: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionText: { color: '#0F172A', fontWeight: '700' },
  connectionMuted: { color: '#94A3B8', fontWeight: '700' },
});
