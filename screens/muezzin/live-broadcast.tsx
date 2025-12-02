import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrayerName, labelForPrayer } from '../../lib/adhans';
import { endBroadcast, startBroadcast } from '../../lib/liveAdhan';
import { supabase } from '../../lib/supabase';
import { useLiveStreamForMosque } from '../shared/hooks/useLiveStreamForMosque';
import { useMosquePrayerTimes } from '../shared/hooks/useMosquePrayerTimes';

type Params = {
  mosqueId?: string;
  mosqueName?: string;
  prayerName?: string;
  scheduledTime?: string;
  mode?: string;
  adhanId?: string;
};

type LiveState = 'TOO_EARLY' | 'READY' | 'LIVE' | 'ENDED';

const WINDOW_START_MS = 2 * 60 * 1000;
const WINDOW_END_MS = 3 * 60 * 1000;

const formatCountdown = (seconds: number) => {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const secs = Math.max(0, Math.floor(seconds % 60));
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function MuezzinLiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const mosqueId = params.mosqueId ?? '';
  const mosqueName = params.mosqueName ?? 'Mosque';
  const prayerName = params.prayerName ?? 'Adhan';
  const prayerKey = (prayerName ?? '').toString().toLowerCase() as PrayerName;
  const mode = params.mode === 'test' ? 'test' : 'normal';

  const [liveState, setLiveState] = useState<LiveState>('READY');
  const [adhanId, setAdhanId] = useState<string | null>(params.adhanId ?? null);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [broadcastStart, setBroadcastStart] = useState<Date | null>(null);

  const liveInfo = useLiveStreamForMosque(mosqueId);
  const prayerTimes = useMosquePrayerTimes(mosqueId);

  const scheduledDate = (() => {
    // 1) explicit param
    if (params.scheduledTime) return new Date(params.scheduledTime);
    // 2) live adhan row
    const raw = (liveInfo.currentAdhan as any)?.scheduled_for ?? (liveInfo.currentAdhan as any)?.scheduled_at;
    if (raw) return new Date(raw);
    // 3) today's prayer time from mosque prayer times
    const fromTimes = prayerTimes.times?.[prayerKey];
    if (fromTimes) {
      const [h, m] = fromTimes.split(':').map((v) => parseInt(v, 10));
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    // 4) for test mode, set a near-future time for meaningful countdown
    if (mode === 'test') {
      const d = new Date();
      d.setSeconds(d.getSeconds() + 120);
      return d;
    }
    return null;
  })();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (liveInfo.currentAdhan?.id) setAdhanId(liveInfo.currentAdhan.id);
    if (liveInfo.currentAdhan?.broadcast_started_at) {
      setBroadcastStart(new Date(liveInfo.currentAdhan.broadcast_started_at as any));
    }
    if (liveInfo.isLive) {
      setLiveState('LIVE');
    }
  }, [liveInfo.isLive, liveInfo.currentAdhan]);

  const windowStart = scheduledDate ? scheduledDate.getTime() - WINDOW_START_MS : null;
  const windowEnd = scheduledDate ? scheduledDate.getTime() + WINDOW_END_MS : null;

  useEffect(() => {
    if (liveInfo.isLive) return;
    if (!windowStart || !windowEnd) return;
    if (now.getTime() < windowStart) {
      setLiveState('TOO_EARLY');
    } else if (now.getTime() <= windowEnd) {
      setLiveState('READY');
    } else if (liveState === 'LIVE') {
      setLiveState('READY');
    }
  }, [now, windowStart, windowEnd, liveInfo.isLive, liveState]);

  const timeUntil = scheduledDate ? Math.max(0, Math.floor((scheduledDate.getTime() - now.getTime()) / 1000)) : null;
  const windowStartLabel = windowStart ? new Date(windowStart) : null;
  const windowEndLabel = windowEnd ? new Date(windowEnd) : null;

  const elapsed = broadcastStart ? Math.max(0, Math.floor((now.getTime() - broadcastStart.getTime()) / 1000)) : null;

  const startLive = async () => {
    if (!mosqueId) {
      Alert.alert('Missing data', 'No mosque provided for this broadcast.');
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const { adhan } = await startBroadcast(supabase as any, {
        mosqueId,
        prayerName,
        scheduledTime: scheduledDate?.toISOString() ?? new Date().toISOString(),
        mode,
      });
      if (adhan?.id) setAdhanId(adhan.id);
      if (adhan?.broadcast_started_at) setBroadcastStart(new Date(adhan.broadcast_started_at as any));
      else setBroadcastStart(new Date());
      setLiveState('LIVE');
      setBanner('Broadcast started');
    } catch (e: any) {
      Alert.alert('Cannot start', e?.message ?? 'Failed to start broadcast.');
    } finally {
      setBusy(false);
    }
  };

  const endLive = async () => {
    if (!mosqueId) return;
    setBusy(true);
    setBanner(null);
    try {
      await endBroadcast(supabase as any, { mosqueId, adhanId: adhanId ?? undefined });
      setLiveState('ENDED');
      setBanner('Broadcast ended');
    } catch (e: any) {
      Alert.alert('Cannot end', e?.message ?? 'Failed to end broadcast.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrimaryPress = () => {
    if (liveState === 'TOO_EARLY') return;
    if (liveState === 'LIVE') {
      endLive();
      return;
    }
    startLive();
  };

  const statusPill = (() => {
    if (mode === 'test') return { label: 'Test mode', bg: '#E2E8F0', color: '#0F172A' };
    if (liveState === 'LIVE') return { label: 'LIVE', bg: '#FEE2E2', color: '#B91C1C' };
    if (liveState === 'READY') return { label: 'Ready to go live', bg: '#DCFCE7', color: '#166534' };
    return { label: 'Too early', bg: '#E2E8F0', color: '#475569' };
  })();

  const circleStyle = (() => {
    if (liveState === 'LIVE') return { bg: '#DC2626', main: 'Live', sub: elapsed !== null ? `Elapsed ${formatCountdown(elapsed)}` : 'Tap to end', cta: 'Tap to end' };
    if (liveState === 'READY')
      return {
        bg: '#0EA5E9',
        main: 'Ready',
        sub: timeUntil !== null ? `Starts in ${formatCountdown(timeUntil)}` : 'Tap to start',
        cta: 'Tap to start',
      };
    if (liveState === 'ENDED') return { bg: '#0F172A', main: 'Ended', sub: 'Tap to end', cta: 'Tap to end' };
    return { bg: '#E2E8F0', main: 'Too early', sub: timeUntil !== null ? `Opens in ${formatCountdown(timeUntil)}` : '', cta: 'Too early' };
  })();

  const connectionStatus = liveInfo.isLive ? 'Stream connected' : busy ? 'Connecting...' : 'Ready to connect';

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

        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        <View style={styles.circleWrap}>
          <View style={[styles.circleOuter, liveState === 'READY' && timeUntil !== null ? styles.circleOuterReady : null]}>
            <Pressable
              disabled={liveState === 'TOO_EARLY' || busy}
              onPress={handlePrimaryPress}
              style={({ pressed }) => [
                styles.circle,
                {
                  backgroundColor: circleStyle.bg,
                  opacity: pressed && liveState !== 'TOO_EARLY' ? 0.9 : liveState === 'TOO_EARLY' ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons
                name="mic"
                size={36}
                color={liveState === 'TOO_EARLY' ? '#475569' : '#FFFFFF'}
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.circleText}>{busy ? 'Working...' : circleStyle.main}</Text>
              {circleStyle.sub ? <Text style={styles.circleSub}>{circleStyle.sub}</Text> : null}
            </Pressable>
          </View>
        </View>

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
          {liveState === 'LIVE' && broadcastStart ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Live since</Text>
              <Text style={styles.metaValue}>{broadcastStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ) : timeUntil !== null ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Time until adhan</Text>
              <Text style={styles.metaValue}>{formatCountdown(timeUntil)}</Text>
            </View>
          ) : null}
        </View>

        {liveState === 'LIVE' ? (
          <Pressable onPress={endLive} style={({ pressed }) => [styles.secondaryAction, { opacity: pressed ? 0.85 : 1 }]}>
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
