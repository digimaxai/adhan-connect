// Copy of user home screen with hook order made safe for muezzin stack
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLogo from '../../components/AppLogo';
import { useAuth } from '../../lib/auth';
import {
  AdhanBroadcast,
  PrayerName,
  canStartBroadcast,
  fetchUpcomingBroadcasts,
  formatTimeWithTz,
  statusBadge,
} from '../../lib/adhans';
import { labelForPrayer } from '../../lib/adhans';
import { useRoleFlags } from '../../lib/roles';
import { supabase } from '../../lib/supabase';
import { useMuezzinSchedule } from '../../lib/hooks/useMuezzinSchedule';
import { useLiveBroadcastEngine } from '../../lib/hooks/useLiveBroadcastEngine';
import { useLiveStreamForMosque } from '../shared/hooks/useLiveStreamForMosque';
import { getDailyPrayerTimes } from '../../lib/api/prayerTimesUnified';

type Mosque = { id: string; name: string; city?: string | null; country?: string | null; status?: string | null };
type Subscription = { mosque_id: string };
type StreamRow = { mosque_id: string; type?: string | null; is_live: boolean; status?: string | null };
type PrayerTimes = Partial<Record<PrayerName, string | null>>;

const fallbackTimes: Record<PrayerName, string> = {
  fajr: '--:--',
  dhuhr: '--:--',
  asr: '--:--',
  maghrib: '--:--',
  isha: '--:--',
};

const mapNormalizedPrayerTimes = (normalized: Awaited<ReturnType<typeof getDailyPrayerTimes>>): PrayerTimes | null => {
  if (!normalized) return null;
  const toHm = (d: Date | null) => (d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null);
  const mapped: PrayerTimes = {};
  (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).forEach((name) => {
    mapped[name] = toHm(normalized?.[name]?.adhan ?? null);
  });
  return mapped;
};

const safeStorage = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    return mod.default ?? mod;
  } catch {
    const globalKey = '__ac_default_mosque_store__';
    const memory: Record<string, string> = (globalThis as any)[globalKey] ?? ((globalThis as any)[globalKey] = {});
    return {
      getItem: async (key: string) => memory[key] ?? null,
      setItem: async (key: string, val: string) => {
        memory[key] = val;
      },
      removeItem: async (key: string) => {
        delete memory[key];
      },
    };
  }
})();

const formatHm = (val?: string | null) => {
  if (!val) return '--:--';
  const [h, m] = val.split(':');
  return `${h?.padStart(2, '0') ?? '00'}:${m?.padStart(2, '0') ?? '00'}`;
};

export default function MuezzinUserHomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const roles = useRoleFlags();
  const userId = session?.user?.id ?? null;
  const {
    schedule: muezzinSchedule,
    nextAssignedSlot,
    loading: muezzinScheduleLoading,
    error: muezzinScheduleError,
    refresh: refreshMuezzinSchedule,
  } = useMuezzinSchedule();
  const muezzinMosqueId = muezzinSchedule?.mosqueId ?? null;
  const muezzinMosqueName = muezzinSchedule?.mosqueName ?? null;
  const liveEngine = useLiveBroadcastEngine(
    muezzinMosqueId,
    nextAssignedSlot && nextAssignedSlot.adhanTime
      ? {
          id: `${muezzinMosqueId ?? 'mosque'}-${nextAssignedSlot.prayerName}-${nextAssignedSlot.adhanTime.toISOString()}`,
          mosque_id: muezzinMosqueId ?? '',
          prayer: nextAssignedSlot.prayerName,
          scheduled_at: nextAssignedSlot.adhanTime.toISOString(),
        }
      : null
  );

  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [liveStreams, setLiveStreams] = useState<Record<string, StreamRow>>({});
  const [nextBroadcast, setNextBroadcast] = useState<AdhanBroadcast | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [prayerError, setPrayerError] = useState<string | null>(null);
  const [muezzinLoading, setMuezzinLoading] = useState(false);
  const [muezzinError, setMuezzinError] = useState<string | null>(null);
  const [nextPrayer, setNextPrayer] = useState<ReturnType<typeof computeNextPrayer> | null>(null);
  const [defaultMosqueId, setDefaultMosqueId] = useState<string | null>(null);
  const [nextCountdown, setNextCountdown] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const primaryMosque = useMemo(() => {
    const preferredId = muezzinMosqueId ?? defaultMosqueId ?? subs[0]?.mosque_id ?? mosques[0]?.id;
    const found = mosques.find((m) => m.id === preferredId);
    if (found) return found;
    const altId = subs[0]?.mosque_id ?? mosques[0]?.id;
    return mosques.find((m) => m.id === altId) ?? null;
  }, [subs, mosques, defaultMosqueId, muezzinMosqueId]);

  const subscribedIds = useMemo(() => new Set(subs.map((s) => s.mosque_id)), [subs]);

  const liveInfo = useLiveStreamForMosque(primaryMosque?.id);

  const parseTimeToDate = (timeStr?: string | null) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const slotAdhanDate = (slot?: { adhanTime: Date | null; prayerName: PrayerName | string }) => {
    if (!slot) return null;
    if (slot.adhanTime) return slot.adhanTime;
    const fallback = prayerTimes?.[slot.prayerName as PrayerName] as string | undefined;
    return parseTimeToDate(fallback ?? null);
  };

  const loadDefault = React.useCallback(async () => {
    try {
      const stored = await safeStorage.getItem('default_mosque_id');
      setDefaultMosqueId(stored ?? null);
    } catch {
      setDefaultMosqueId(null);
    }
  }, []);

  const loadHomeData = async () => {
    const [mosqueRes, subsRes, streamsRes] = await Promise.all([
      supabase.from('mosques').select('id, name, city, country, status').order('name', { ascending: true }).limit(200),
      userId
        ? supabase.from('subscriptions').select('mosque_id').eq('user_id', userId)
        : Promise.resolve({ data: [] as Subscription[], error: null }),
      supabase.from('streams').select('mosque_id, type, is_live, status').eq('is_live', true).eq('status', 'active'),
    ]);
    if (!mosqueRes.error && mosqueRes.data) setMosques(mosqueRes.data);
    if (!subsRes.error && subsRes.data) setSubs(subsRes.data);
    if (!streamsRes.error && streamsRes.data) {
      const map: Record<string, StreamRow> = {};
      (streamsRes.data as StreamRow[]).forEach((s) => {
        if (s.is_live) map[s.mosque_id] = s;
      });
      setLiveStreams(map);
    } else {
      setLiveStreams({});
    }
  };

  useEffect(() => {
    loadHomeData();
  }, [userId]);

  useEffect(() => {
    loadDefault();
  }, [loadDefault]);

  useFocusEffect(
    React.useCallback(() => {
      loadHomeData();
      loadDefault();
    }, [userId, loadDefault])
  );

  useEffect(() => {
    if (!defaultMosqueId) return;
    if (mosques.find((m) => m.id === defaultMosqueId)) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('mosques')
        .select('id, name, city, country, status')
        .eq('id', defaultMosqueId)
        .maybeSingle();
      if (!cancelled && data && !error) {
        setMosques((prev) => [...prev, data]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultMosqueId, mosques]);

  useEffect(() => {
    const loadMuezzin = async () => {
      if (!roles.isMuezzin) {
        setNextBroadcast(null);
        setMuezzinError(null);
        return;
      }
      setMuezzinLoading(true);
      setMuezzinError(null);
      try {
        const upcoming = await fetchUpcomingBroadcasts(1);
        setNextBroadcast(upcoming[0] ?? null);
        if (!upcoming.length) setMuezzinError('No upcoming adhans scheduled.');
      } catch (e: any) {
        setMuezzinError(e?.message ?? 'Could not load upcoming adhans.');
        setNextBroadcast(null);
      } finally {
        setMuezzinLoading(false);
      }
    };
    loadMuezzin();
  }, [roles.isMuezzin]);

  const fetchPrayerTimes = async (mosqueId: string) => {
    const normalized = await getDailyPrayerTimes(mosqueId, new Date());
    return { data: mapNormalizedPrayerTimes(normalized), error: null };
  };

  useEffect(() => {
    const loadPrayerTimes = async () => {
      const primaryId = primaryMosque?.id;
      if (!primaryId) {
        setPrayerTimes(null);
        setPrayerError(null);
        return;
      }
      const { data, error } = await fetchPrayerTimes(primaryId);
      if (error) {
        setPrayerError('Could not load prayer times.');
        setPrayerTimes(null);
      } else {
        setPrayerError(null);
        setPrayerTimes(data ?? null);
      }
    };
    loadPrayerTimes();
  }, [primaryMosque?.id]);

  const computeNextPrayer = (times: PrayerTimes | null) => {
    const nowDate = new Date();
  const entries: Array<{ name: PrayerName; time: string }> = (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[])
      .map((name) => ({ name, time: (times?.[name] as string) ?? null }))
      .filter((p): p is { name: PrayerName; time: string } => !!p.time);

    const toDate = (timeStr: string, carryNextDay = false) => {
      const [h, m] = timeStr.split(':').map((t) => parseInt(t, 10));
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (carryNextDay && d <= nowDate) d.setDate(d.getDate() + 1);
      return d;
    };

    const upcoming = entries
      .map((p) => ({ ...p, when: toDate(p.time) }))
      .filter((p) => p.when > nowDate)
      .sort((a, b) => a.when.getTime() - b.when.getTime());

    const chosen = upcoming[0] ?? (entries.length ? { ...entries[0], when: toDate(entries[0].time, true) } : null);
    if (!chosen) return null;

    const diffMs = chosen.when.getTime() - nowDate.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(diffMin / 60)
      .toString()
      .padStart(2, '0');
    const minutes = (diffMin % 60).toString().padStart(2, '0');

    return {
      name: chosen.name,
      label: formatTimeWithTz({
        id: '',
        mosque_id: '',
        status: 'scheduled',
        prayer: chosen.name,
        scheduled_for: chosen.when.toISOString(),
      }),
      remaining: `${hours}:${minutes}`,
    };
  };

  useEffect(() => {
    setNextPrayer(computeNextPrayer(prayerTimes));
    const id = setInterval(() => setNextPrayer(computeNextPrayer(prayerTimes)), 1000);
    return () => clearInterval(id);
  }, [prayerTimes]);

  useEffect(() => {
    const targetDate = slotAdhanDate(nextAssignedSlot) ?? null;
    if (!targetDate) {
      setNextCountdown(null);
      return;
    }
    const compute = () => {
      const target = targetDate.getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((target - now) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      return `In ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    setNextCountdown(compute());
    const id = setInterval(() => setNextCountdown(compute()), 1000);
    return () => clearInterval(id);
  }, [nextAssignedSlot?.adhanTime]);

  const topPad = Platform.OS === 'android' ? 8 : 0;

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadHomeData(), loadDefault()]);
      await refreshMuezzinSchedule();
      const primaryId = primaryMosque?.id;
      if (primaryId) {
        await fetchPrayerTimes(primaryId);
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadDefault, primaryMosque?.id, refreshMuezzinSchedule, userId]);

  const MuezzinHero = () => {
    const broadcast = nextBroadcast;
    const [nowState, setNowState] = useState(new Date());
    useEffect(() => {
      const id = setInterval(() => setNowState(new Date()), 1000);
      return () => clearInterval(id);
    }, []);

    const startable = broadcast ? canStartBroadcast(broadcast, nowState) : false;
    const badge = broadcast ? statusBadge(broadcast, nowState) : null;
    const remaining = (() => {
      if (!broadcast) return null;
      const target = new Date(broadcast.scheduled_for);
      const diffSec = Math.max(0, Math.floor((target.getTime() - nowState.getTime()) / 1000));
      const hours = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      return { text: `In ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`, diffSec };
    })();
    const urgency = (() => {
      if (!remaining) return { color: '#22C55E', label: 'Ready' };
      if (remaining.diffSec < 120) return { color: '#EF4444', label: 'Critical' };
      if (remaining.diffSec < 600) return { color: '#F59E0B', label: 'Soon' };
      return { color: '#22C55E', label: 'Ready' };
    })();

    return (
      <View style={[styles.heroCard, styles.shadow]}>
        <Text style={styles.heroEyebrow}>Muezzin</Text>
        <Text style={styles.heroTitle}>Your next Adhan</Text>
        {muezzinLoading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <ActivityIndicator color="#0EA5E9" />
            <Text style={styles.heroSubtitle}>Loading</Text>
          </View>
        )}
        {!muezzinLoading && broadcast && (
          <>
            <Text style={styles.heroSubtitle}>{formatTimeWithTz(broadcast)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
              <View style={[styles.livePill, { backgroundColor: broadcast.status === 'live' ? '#FEE2E2' : '#E2E8F0' }]}>
                <View style={[styles.liveDot, { backgroundColor: broadcast.status === 'live' ? '#DC2626' : '#94A3B8' }]} />
                <Text style={[styles.livePillText, { color: broadcast.status === 'live' ? '#B91C1C' : '#0F172A' }]}>
                  {broadcast.status === 'live' ? 'LIVE' : 'Ready'}
                </Text>
              </View>
              {badge && <Text style={styles.heroBadge}>{badge}</Text>}
            </View>
            {remaining && <Text style={[styles.heroCountdown, { color: urgency.color }]}>{remaining.text}</Text>}
            <Text style={[styles.heroUrgency, { color: urgency.color }]}>{urgency.label}</Text>
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
              <Pressable
                onPress={() => router.push(`/broadcast/${broadcast.id}`)}
                style={({ pressed }) => [styles.heroButton, { backgroundColor: startable ? '#EF4444' : '#0EA5E9', opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.heroButtonText}>{startable ? 'Go live' : 'View details'}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(muezzin)/muezzin')}
                style={({ pressed }) => [styles.heroButton, { backgroundColor: '#E0F2FE', opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[styles.heroButtonText, { color: '#0369A1' }]}>Schedule</Text>
              </Pressable>
            </View>
          </>
        )}
        {!muezzinLoading && !broadcast && <Text style={styles.heroSubtitle}>{muezzinError || 'No upcoming adhans.'}</Text>}
      </View>
    );
  };

  const MyMosques = () => (
    <View style={[styles.cardContainer, styles.shadow]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>My Mosques</Text>
        <Pressable onPress={() => router.push('/manage-mosques')} hitSlop={6}>
          <Text style={styles.manageLink}>Manage</Text>
        </Pressable>
      </View>
      {subs.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 24, paddingTop: 10, paddingBottom: 6, justifyContent: subs.length < 3 ? 'center' : 'flex-start', alignItems: 'center' }}
        >
          {subs
            .map((s) => mosques.find((m) => m.id === s.mosque_id))
            .filter(Boolean)
            .map((m) => (
              <Pressable
                key={m!.id}
                style={styles.mosqueChip}
                onPress={() =>
                  router.push({
                    pathname: '/mosque/[id]',
                    params: { id: m!.id, name: m!.name, city: m!.city ?? '', country: m!.country ?? '' },
                  })
                }
              >
                <View style={styles.mosqueAvatar}>
                  <Text style={styles.mosqueAvatarText}>{m!.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={styles.mosqueLabel} numberOfLines={1}>
                  {m!.name}
                </Text>
                {m!.city ? (
                  <Text style={styles.mosqueCity} numberOfLines={1}>
                    {m!.city}
                  </Text>
                ) : null}
              </Pressable>
            ))}
        </ScrollView>
      ) : (
        <View style={{ paddingTop: 6 }}>
          <Text style={styles.cardSubtitle}>Follow mosques to get live adhans.</Text>
        </View>
      )}
    </View>
  );

  const MuezzinLiveSummary = () => {
    const statusLabel = (() => {
      if (liveEngine.isLive) return 'LIVE';
      if (liveEngine.canStart) return 'Ready';
      if (liveEngine.isLate) return 'Completed';
      return 'Scheduled';
    })();
    const statusStyle = statusLabel === 'LIVE' ? styles.liveStatusLive : statusLabel === 'Ready' ? styles.liveStatusReady : styles.liveStatusMuted;
    const nextAdhanDate = slotAdhanDate(nextAssignedSlot);
    const nextTimeLabel = nextAdhanDate
      ? nextAdhanDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

    const handleManagePress = () => {
      if (!nextAssignedSlot) {
        Alert.alert('No adhans assigned', "You don't have any adhans assigned right now.");
        return;
      }
      router.push({
        pathname: '/(muezzin)/muezzin-live',
        params: {
          mosqueId: muezzinMosqueId ?? '',
          mosqueName: muezzinMosqueName ?? 'Your mosque',
          prayerName: nextAssignedSlot.prayerName,
          adhanTime: nextAssignedSlot.adhanTime?.toISOString() ?? '',
        },
      });
    };

    return (
      <View style={[styles.cardContainer, styles.shadow, { gap: 10 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>Next Adhan</Text>
          {statusLabel ? (
            <View style={[styles.statusPill, statusStyle]}>
              <Text style={styles.statusPillText}>{statusLabel}</Text>
            </View>
          ) : null}
        </View>
        {muezzinScheduleLoading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#0EA5E9" />
            <Text style={styles.cardSubtitle}>Loading schedule...</Text>
          </View>
        ) : !muezzinSchedule ? (
          <Text style={styles.cardSubtitle}>You are not set up as a muezzin for any mosque.</Text>
        ) : !nextAssignedSlot ? (
          <>
            <Text style={styles.heroSource}>{muezzinMosqueName ?? 'Your mosque'}</Text>
            <Text style={styles.cardSubtitle}>No adhans scheduled for you today.</Text>
          </>
        ) : (
          <>
            <Text style={styles.heroSource}>{muezzinMosqueName ?? 'Your mosque'}</Text>
            <Text style={styles.livePrayer}>{labelForPrayer(nextAssignedSlot.prayerName as PrayerName)}</Text>
            <Text style={styles.liveTime}>{nextTimeLabel ?? '--:--'}</Text>
            <Text style={styles.liveCountdown}>{nextCountdown ?? 'Starting soon'}</Text>
            <View style={[styles.assignedBadgeSoft, { alignSelf: 'flex-start' }]}>
              <Text style={styles.assignedBadgeText}>Assigned to you</Text>
            </View>
          </>
        )}
        <Pressable
          onPress={handleManagePress}
          disabled={!muezzinMosqueId}
          style={({ pressed }) => [
            styles.primaryCta,
            liveEngine.isLive ? styles.primaryCtaLive : null,
            { opacity: (!muezzinMosqueId ? 0.6 : pressed ? 0.9 : 1) },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {liveEngine.isLive ? <View style={styles.liveDotLarge} /> : null}
            <Text style={styles.primaryCtaText}>{liveEngine.isLive ? 'Manage Live Broadcast' : 'Manage Live Broadcast'}</Text>
          </View>
        </Pressable>
        {muezzinScheduleError ? <Text style={styles.errorText}>{muezzinScheduleError}</Text> : null}
        {liveEngine.errorMessage ? <Text style={styles.errorText}>{liveEngine.errorMessage}</Text> : null}
      </View>
    );
  };
  const TodaysAdhans = () => (
    <View style={[styles.cardContainer, styles.shadow]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>Today's Adhans</Text>
        {muezzinMosqueName ? <Text style={styles.cardSubtitle}>Based on {muezzinMosqueName}</Text> : null}
      </View>
      {muezzinScheduleLoading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <ActivityIndicator color="#0EA5E9" />
          <Text style={styles.cardSubtitle}>Loading</Text>
        </View>
      ) : todayScheduleRows.length ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          {todayScheduleRows.map((row) => {
            const statusText = row.assigned
              ? 'Assigned to you'
              : row.assignedTo
              ? `Assigned to ${row.assignedTo}`
              : row.status === 'assigned'
              ? 'Assigned'
              : 'Not assigned';
            return (
              <View
                key={row.id}
                style={[
                  styles.prayerRowWrap,
                  row.assigned ? styles.assignedRow : null,
                ]}
              >
                <View>
                  <Text style={styles.prayerName}>{labelForPrayer(row.prayer as PrayerName)}</Text>
                  <Text style={styles.heroMuted}>{row.time}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.statusPill, row.assigned ? styles.liveStatusReady : styles.statusPillMuted]}>
                    <Text style={styles.statusPillText}>{statusText}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.cardSubtitle}>No adhans scheduled for today.</Text>
      )}
    </View>
  );
  const primaryLive = primaryMosque ? liveStreams[primaryMosque.id] : null;
  const otherLive = Object.entries(liveStreams).filter(
    ([mosqueId]) => mosqueId !== primaryMosque?.id && subscribedIds.has(mosqueId)
  );
  const todayScheduleRows = (muezzinSchedule?.slots ?? []).map((slot) => ({
    id: slot.prayerName,
    prayer: slot.prayerName,
    time: (() => {
      const d = slotAdhanDate(slot);
      return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
    })(),
    status: slot.isAssignedToMe ? 'assigned' : slot.assignedMuezzinUserId ? 'assigned' : 'scheduled',
    assigned: slot.isAssignedToMe,
    assignedTo: slot.assignedMuezzinName ?? null,
  }));
  const muezzinBody = (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
        refreshControl={
          <RefreshControl refreshing={muezzinScheduleLoading} onRefresh={refreshMuezzinSchedule} />
        }
      >
        <View style={styles.headerRow}>
          <AppLogo size={30} />
          <Text style={styles.appTitle}>Adhan Connect</Text>
          <Pressable onPress={() => router.push('/(muezzin)/settings')} hitSlop={12}>
            <Ionicons name="settings-outline" size={22} color="#0F172A" />
          </Pressable>
        </View>
        <MuezzinHero />
      </ScrollView>
    </SafeAreaView>
  );

  const userBody = (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || muezzinScheduleLoading}
            onRefresh={handleRefresh}
            tintColor="#0EA5E9"
            colors={['#0EA5E9']}
          />
        }
      >
        <View style={styles.headerRow}>
          <AppLogo size={30} />
          <Text style={styles.appTitle}>Adhan Connect</Text>
          <Pressable onPress={() => router.push('/(user)/settings')} hitSlop={12}>
            <Ionicons name="settings-outline" size={22} color="#0F172A" />
          </Pressable>
        </View>
        {roles.isMuezzin ? <MuezzinLiveSummary /> : null}

        <Pressable
          disabled={!primaryMosque}
          onPress={() => {
            if (primaryMosque) {
              router.push({
                pathname: '/mosque/[id]',
                params: { id: primaryMosque.id, name: primaryMosque.name, city: primaryMosque.city ?? '', country: primaryMosque.country ?? '' },
              });
            }
          }}
          style={({ pressed }) => [
            styles.nextCard,
            { opacity: primaryMosque ? (pressed ? 0.92 : 1) : 0.7 },
          ]}
        >
          <View style={{ gap: 4 }}>
            <Text style={styles.eyebrow}>Next Prayer</Text>
            {primaryMosque?.name ? <Text style={styles.heroSource}>{primaryMosque.name}</Text> : null}
          </View>
          <View style={{ gap: 6, marginTop: 10 }}>
            <Text style={styles.nextTime}>{nextPrayer?.label ?? '--:--'}</Text>
            <Text style={styles.nextName}>
              {nextPrayer?.name ? nextPrayer.name.charAt(0).toUpperCase() + nextPrayer.name.slice(1) : 'Next prayer'}
            </Text>
            <Text style={styles.nextEta}>{nextPrayer?.remaining ? `In ${nextPrayer.remaining}` : 'In --:--'}</Text>
          </View>
          <View style={{ marginTop: 12 }}>
            {liveInfo.isLive ? (
              <View style={styles.heroLiveRow}>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
                <Ionicons name="radio-outline" size={20} color="#E2E8F0" />
                <Pressable
                  onPress={() => router.push('/(user)/now')}
                  style={({ pressed }) => [styles.listenBtn, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <Text style={styles.listenText}>Listen Live</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Pressable>

        <MyMosques />

        {roles.isMuezzin ? <TodaysAdhans /> : null}

        <View style={[styles.cardContainer, styles.shadow]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Today's Prayer Times</Text>
          </View>
          {primaryMosque?.name ? <Text style={styles.cardSubtitle}>Based on {primaryMosque.name}</Text> : null}
          <View style={styles.titleDivider} />
          <View style={styles.prayerTable}>
            {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).map((p) => (
              <View key={p} style={styles.prayerRow}>
                <Text style={styles.prayerName}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                <Text style={styles.prayerTimeText}>{formatHm(prayerTimes?.[p] as string) ?? fallbackTimes[p]}</Text>
              </View>
            ))}
          </View>
          {prayerError && <Text style={styles.errorText}>{prayerError}</Text>}
        </View>

        {otherLive.length > 0 && (
          <View style={[styles.cardContainer, styles.shadow, { gap: 10 }]}>
            <Text style={styles.cardTitle}>Other Live Broadcasts</Text>
            {otherLive.map(([mosqueId]) => {
              const m = mosques.find((ms) => ms.id === mosqueId);
              if (!m) return null;
              const city = [m.city, m.country].filter(Boolean).join(', ');
              return (
                <View key={mosqueId} style={styles.otherLiveRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="radio-outline" size={18} color="#0F172A" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.otherLiveName} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text style={styles.otherLiveSub} numberOfLines={1}>
                        {city || 'Live broadcast'}
                      </Text>
                    </View>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => router.push('/(user)/now')} hitSlop={6}>
                    <Text style={styles.listenLink}>Listen</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={[styles.discoveryCard, styles.shadow]}>
          <Text style={styles.cardTitle}>Find Mosques Near You</Text>
          <Text style={styles.discoverySubtitle}>Discover mosques to follow and listen to live adhans.</Text>
          <Pressable
            onPress={() => router.push('/(user)/discover')}
            style={({ pressed }) => [styles.discoveryBtn, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.discoveryBtnText}>Discover</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  return userBody;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FB' },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 36, gap: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 58, paddingHorizontal: 0 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', letterSpacing: 0.2, color: '#0F172A' },

  eyebrow: { color: '#0EA5E9', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  nextCard: { backgroundColor: '#0D1529', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E6E8EB', shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  nextTime: { color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  nextName: { color: '#B4E0FF', fontSize: 18, fontWeight: '800' },
  nextEta: { color: '#7EE0A3', fontSize: 13, fontWeight: '700' },
  heroSource: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  heroMuted: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  heroLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  liveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F53B57' },
  liveBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  listenBtn: {
    backgroundColor: '#0097F7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6E8EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  cardSubtitle: { color: '#7A8290', fontSize: 12, marginTop: 2 },
  manageLink: { color: '#0EA5E9', fontWeight: '700', fontSize: 13 },

  mosqueChip: {
    alignItems: 'center',
    width: 96,
    gap: 6,
  },
  mosqueAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mosqueAvatarText: { fontWeight: '800', color: '#0369A1', fontSize: 14 },
  mosqueLabel: { fontWeight: '700', fontSize: 13, color: '#0F172A', textAlign: 'center' },
  mosqueCity: { color: '#7A8290', fontSize: 12, textAlign: 'center' },

  prayerTable: { marginTop: 8, gap: 8 },
  prayerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, minHeight: 44 },
  prayerName: { fontWeight: '700', color: '#0F172A', letterSpacing: 0.1 },
  prayerTimeText: { color: '#0F172A', fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 10 },
  titleDivider: { height: 1, backgroundColor: '#E6E8EB', marginVertical: 12 },

  discoveryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 24,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: '#E6E8EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  discoveryBtn: {
    backgroundColor: '#0097F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 48,
    marginTop: 12,
  },
  discoveryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  discoverySubtitle: { color: '#64748B', fontSize: 13, marginTop: 6 },

  heroCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginTop: 12 },
  heroEyebrow: { color: '#67E8F9', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  heroTitle: { color: '#E2E8F0', fontWeight: '800', fontSize: 19, marginTop: 2 },
  heroSubtitle: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  heroBadge: { marginTop: 2, color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  heroCountdown: { marginTop: 6, fontSize: 16, fontWeight: '800' },
  heroUrgency: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  heroButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroButtonText: { color: '#F8FAFC', fontWeight: '800', fontSize: 14 },
  livePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  livePillText: { fontWeight: '800', fontSize: 12, marginLeft: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#DC2626' },

  otherLiveRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E6E8EB',
  },
  otherLiveName: { color: '#0F172A', fontWeight: '700' },
  otherLiveSub: { color: '#64748B', fontSize: 12 },
  listenLink: { color: '#0EA5E9', fontWeight: '700', fontSize: 13 },

  errorText: { color: '#F97316', marginTop: 6, fontSize: 12 },
  sourceText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  shadow: { shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#E2E8F0' },
  statusPillText: { fontWeight: '800', fontSize: 12, color: '#0F172A' },
  statusPillMuted: { backgroundColor: '#E2E8F0' },
  liveStatusLive: { backgroundColor: '#FEE2E2' },
  liveStatusReady: { backgroundColor: '#DCFCE7' },
  liveStatusMuted: { backgroundColor: '#E2E8F0' },
  primaryCta: {
    marginTop: 8,
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaLive: { backgroundColor: '#EF4444' },
  primaryCtaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  livePrayer: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  liveTime: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  liveCountdown: { color: '#0EA5E9', fontWeight: '800', marginTop: 4 },
  liveDotLarge: { width: 10, height: 10, borderRadius: 10, backgroundColor: '#FFFFFF' },
  prayerRowWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  assignedRow: { borderWidth: 1.4, borderColor: '#BFDBFE', borderRadius: 12, paddingHorizontal: 10, backgroundColor: '#F8FBFF' },
  assignedBadgeSoft: { backgroundColor: '#E0F2FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  assignedBadgeText: { color: '#0369A1', fontWeight: '800', fontSize: 11 },
});








