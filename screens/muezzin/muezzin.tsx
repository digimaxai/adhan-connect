import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { AdhanBroadcast, PrayerName, formatTimeWithTz, labelForPrayer } from '../../lib/adhans';
import { useAuth } from '../../lib/auth';
import { useRoleFlags } from '../../lib/roles';
import { supabase } from '../../lib/supabase';
import { getMuezzinPrimaryMosque } from '../../lib/liveAdhan';
import { useLiveStreamForMosque } from '../shared/hooks/useLiveStreamForMosque';
import { useMosquePrayerTimes } from '../shared/hooks/useMosquePrayerTimes';

type BroadcastLike = Omit<AdhanBroadcast, 'prayer'> & {
  prayer: PrayerName | string;
  scheduled_at?: string | null;
};

type MosqueInfo = { id: string; name?: string | null };

type NextState = 'NO_UPCOMING' | 'TOO_EARLY' | 'READY' | 'LIVE' | 'COMPLETED';

const WINDOW_START_MS = 2 * 60 * 1000;
const WINDOW_END_MS = 3 * 60 * 1000;

const normalizeBroadcast = (row: Partial<BroadcastLike> | null, fallbackMosque?: MosqueInfo | null): BroadcastLike | null => {
  if (!row) return null;
  const scheduled =
    (row as any).scheduled_for ??
    (row as any).scheduled_at ??
    (row as any).scheduledAt ??
    (row as any).scheduled_time ??
    new Date().toISOString();

  return {
    id: (row as any).id ?? `${(row as any).mosque_id ?? 'mosque'}-${scheduled}`,
    mosque_id: (row as any).mosque_id ?? fallbackMosque?.id ?? '',
    mosque_name: (row as any).mosque_name ?? fallbackMosque?.name ?? null,
    prayer: (row as any).prayer ?? 'maghrib',
    scheduled_for: scheduled,
    scheduled_at: (row as any).scheduled_at ?? null,
    status: (row as any).status ?? 'scheduled',
    time_zone: (row as any).time_zone ?? null,
  };
};

const formatCountdown = (seconds: number) => {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const secs = Math.max(0, Math.floor(seconds % 60));
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

function deriveState(broadcast: BroadcastLike | null, isLive: boolean, now: Date): { state: NextState; countdownText: string | null } {
  if (isLive || broadcast?.status === 'live') return { state: 'LIVE', countdownText: null };

  const scheduledIso = broadcast?.scheduled_for ?? broadcast?.scheduled_at;
  if (!scheduledIso) return { state: 'NO_UPCOMING', countdownText: null };

  const scheduled = new Date(scheduledIso);
  const windowStart = scheduled.getTime() - WINDOW_START_MS;
  const windowEnd = scheduled.getTime() + WINDOW_END_MS;
  const diffMs = scheduled.getTime() - now.getTime();

  if (now.getTime() < windowStart) {
    const opensIn = Math.max(0, Math.floor((windowStart - now.getTime()) / 1000));
    return { state: 'TOO_EARLY', countdownText: formatCountdown(opensIn) };
  }
  if (now.getTime() <= windowEnd) {
    const untilAdhan = Math.max(0, Math.floor(diffMs / 1000));
    return { state: 'READY', countdownText: formatCountdown(untilAdhan) };
  }

  return { state: 'COMPLETED', countdownText: null };
}

function displayPrayer(prayer: PrayerName | string) {
  return labelForPrayer(prayer as PrayerName);
}

export default function MuezzinToolsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { loading, isMuezzin } = useRoleFlags();
  const log = (...args: any[]) => console.log('[MuezzinScreen]', ...args);

  const [primaryMosque, setPrimaryMosque] = useState<MosqueInfo | null>(null);
  const [upcoming, setUpcoming] = useState<BroadcastLike | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const liveInfo = useLiveStreamForMosque(primaryMosque?.id);
  const prayerTimes = useMosquePrayerTimes(primaryMosque?.id);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      const userId = session?.user?.id;
      log('load start', { userId, isMuezzin });
      if (!userId) throw new Error('No user session');

      const primary = await getMuezzinPrimaryMosque(supabase as any, userId);
      const normalizedPrimary = primary?.mosqueId ? { id: primary.mosqueId, name: primary.mosqueName } : null;
      log('primary mosque lookup', { normalizedPrimary, raw: primary });
      setPrimaryMosque(normalizedPrimary);

      if (normalizedPrimary?.id) {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from('adhans')
          .select('id, mosque_id, prayer, status, scheduled_at')
          .eq('mosque_id', normalizedPrimary.id)
          .gte('scheduled_at', `${today}T00:00:00Z`)
          .order('scheduled_at', { ascending: true })
          .limit(1);

        if (error) throw error;
        log('upcoming adhan row', { data, error });
        setUpcoming(normalizeBroadcast(data?.[0] ?? null, normalizedPrimary));
      } else {
        setUpcoming(null);
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to load schedule';
      // Ignore legacy column errors from environments that lack scheduled_for or time_zone
      const lower = msg.toLowerCase();
      if (!lower.includes('scheduled_for') && !lower.includes('time_zone')) {
        setErr(msg);
      } else {
        setErr(null);
      }
      setUpcoming(null);
    } finally {
      setBusy(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  const handlePrimaryAction = () => {
    if (!primaryMosque) return;
    if (derived.state === 'TOO_EARLY') return;

    const target =
      nextFromPrayerTimes && derived.state !== 'NO_UPCOMING'
        ? {
            id: activeBroadcast?.id ?? `${primaryMosque.id}-${nextFromPrayerTimes.name}`,
            mosque_id: primaryMosque.id,
            mosque_name: primaryMosque.name,
            prayer: nextFromPrayerTimes.name,
            scheduled_for: nextFromPrayerTimes.when.toISOString(),
            status: activeBroadcast?.status ?? 'scheduled',
          }
        : {
            mosque_id: primaryMosque.id,
            mosque_name: primaryMosque.name,
            prayer: 'Test adhan',
            scheduled_for: new Date().toISOString(),
            status: 'scheduled',
          };

    router.push({
      pathname: '/(muezzin)/muezzin-live',
      params: {
        mosqueId: primaryMosque.id,
        mosqueName: primaryMosque.name ?? 'Your mosque',
        prayerName: target.prayer.toString(),
        scheduledTime: (target as any).scheduled_for ?? (target as any).scheduled_at ?? new Date().toISOString(),
        mode: derived.state === 'NO_UPCOMING' ? 'test' : 'normal',
        adhanId: target.id ?? '',
      },
    });
  };

  const orderedPrayers: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const timesMap = prayerTimes.times ?? {};
  const todayRows = orderedPrayers.map((p) => ({
    prayer: p,
    time: timesMap[p] ?? '--:--',
    status: 'Upcoming',
  }));

  const nextFromPrayerTimes = (() => {
    const nowDate = new Date();
    const entries = orderedPrayers
      .map((name) => {
        const t = timesMap[name];
        if (!t) return null;
        const [h, m] = t.split(':').map((v) => parseInt(v, 10));
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return { name, when: d, timeLabel: t };
      })
      .filter(Boolean) as Array<{ name: PrayerName; when: Date; timeLabel: string }>;

    const upcomingSorted = entries.filter((e) => e.when > nowDate).sort((a, b) => a.when.getTime() - b.when.getTime());
    return upcomingSorted[0] ?? null;
  })();

  const syntheticFromTimes =
    nextFromPrayerTimes && primaryMosque
      ? normalizeBroadcast(
          {
            mosque_id: primaryMosque.id,
            mosque_name: primaryMosque.name,
            prayer: nextFromPrayerTimes.name,
            scheduled_for: nextFromPrayerTimes.when.toISOString(),
            status: 'scheduled',
          },
          primaryMosque
        )
      : null;

  const activeBroadcast = normalizeBroadcast(upcoming ?? liveInfo.currentAdhan ?? syntheticFromTimes, primaryMosque);
  const derived = deriveState(activeBroadcast, liveInfo.isLive, now);
  const scheduledIso = activeBroadcast?.scheduled_for ?? activeBroadcast?.scheduled_at ?? null;
  const scheduledLabel = scheduledIso ? formatTimeWithTz(activeBroadcast as any) : null;
  useEffect(() => {
    log('derived state', {
      derived,
      activeBroadcast,
      isLive: liveInfo.isLive,
      primaryMosque,
      prayerTimes: prayerTimes.times,
    });
  }, [derived.state, derived.countdownText, activeBroadcast?.id, liveInfo.isLive, primaryMosque?.id, prayerTimes.times]);

  const heroButtonLabel =
    derived.state === 'LIVE'
      ? 'Manage live broadcast'
      : derived.state === 'READY'
      ? 'Live Broadcast Adhan'
      : derived.state === 'TOO_EARLY'
      ? `Live broadcast opens in ${derived.countdownText ?? '--:--'}`
      : 'Start test live adhan';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
      >
        <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 6 }}>Muezzin tools</Text>
        <Text style={{ color: '#64748B', marginBottom: 8 }}>
          Review your next adhan and start live when the time comes.
        </Text>

      {loading || (busy && !primaryMosque) ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
          <ActivityIndicator color="#0EA5E9" />
          <Text style={{ marginTop: 8, color: '#475569' }}>Loading muezzin tools...</Text>
        </View>
      ) : !isMuezzin && !primaryMosque ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#DC2626', textAlign: 'center', fontWeight: '700' }}>
            You are not assigned as a muezzin for any mosque.
          </Text>
        </View>
      ) : !primaryMosque ? (
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: '#0F172A' }}>You're not assigned to a mosque yet</Text>
          <Text style={{ color: '#475569', marginTop: 8 }}>
            Ask your mosque admin to add you as a muezzin in Adhan Connect.
          </Text>
        </View>
      ) : (
        <>
          {primaryMosque?.name ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: '#E2E8F0',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#0F172A', fontWeight: '700' }}>Serving {primaryMosque.name}</Text>
            </View>
          ) : null}

          {err && (
            <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#B91C1C' }}>{err}</Text>
            </View>
          )}

          <View
            style={{
              backgroundColor: '#0D1529',
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: '#0F172A',
              gap: 10,
            }}
          >
            <Text style={{ color: '#0EA5E9', fontWeight: '800', fontSize: 12 }}>Muezzin - {primaryMosque.name ?? 'Mosque'}</Text>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 20 }}>Next Adhan</Text>

            {nextFromPrayerTimes ? (
              <>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>
                  {displayPrayer(nextFromPrayerTimes.name)} - {nextFromPrayerTimes.timeLabel}
                </Text>
                {derived.countdownText || derived.state === 'LIVE' ? (
                  <Text style={{ color: derived.state === 'READY' ? '#22C55E' : '#A5B4FC', fontWeight: '700', fontSize: 14 }}>
                    {derived.state === 'LIVE' ? 'Adhan is live now' : `In ${derived.countdownText}`}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={{ color: '#CBD5E1', fontWeight: '700' }}>No adhans remaining today.</Text>
              </>
            )}

            <TouchableOpacity
              onPress={handlePrimaryAction}
              disabled={derived.state === 'TOO_EARLY'}
              style={{
                marginTop: 10,
                backgroundColor: derived.state === 'LIVE' ? '#EF4444' : derived.state === 'READY' ? '#0EA5E9' : '#1E293B',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                opacity: derived.state === 'TOO_EARLY' ? 0.65 : 1,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{heroButtonLabel}</Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              marginTop: 14,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 16, color: '#0F172A' }}>Today's adhans</Text>
            {primaryMosque?.name ? <Text style={{ color: '#64748B', marginTop: 4 }}>Based on {primaryMosque.name}</Text> : null}
            <View style={{ marginTop: 12, gap: 10 }}>
              {todayRows.map((row) => (
                <View key={row.prayer} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#0F172A', fontWeight: '700' }}>{labelForPrayer(row.prayer)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: '#64748B' }}>{row.time}</Text>
                    <Text style={{ color: '#0284C7', fontWeight: '700' }}>{row.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}
