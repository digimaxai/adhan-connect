// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import {
  AdhanBroadcast,
  PrayerName,
  canStartBroadcast,
  fetchUpcomingBroadcasts,
  formatTimeWithTz,
  statusBadge,
} from '../../lib/adhans';
import { useRoleFlags } from '../../lib/roles';
import { supabase } from '../../lib/supabase';
import { AppLogo } from '../../components/AppLogo';
import { AppButton } from '../../components/ui/app-button';
import { AppCard } from '../../components/ui/app-card';
import { ScreenContainer } from '../../components/ui/screen-container';
import { AppText } from '../../components/ui/app-text';
import { getDefaultMosqueId } from '../../lib/mosquePreferences';
import { useLiveStreamForMosque } from '../shared/hooks/useLiveStreamForMosque';
import { getDailyPrayerTimes } from '../../lib/api/prayerTimesUnified';
import { tokens } from '../../theme/tokens';

type Mosque = { id: string; name: string; city?: string | null; country?: string | null; status?: string | null };
type Subscription = { mosque_id: string };
type StreamRow = {
  id?: string;
  mosque_id: string;
  type?: string | null;
  is_live: boolean;
  status?: string | null;
  started_at?: string | null;
};
type PrayerTimes = Partial<Record<PrayerName, string | null>>;

const fallbackTimes: Record<PrayerName, string> = {
  fajr: '05:18',
  dhuhr: '12:58',
  asr: '15:27',
  maghrib: '17:42',
  isha: '19:05',
};

const formatHm = (val?: string | null) => {
  if (!val) return '--:--';
  const [h, m] = val.split(':');
  return `${h?.padStart(2, '0') ?? '00'}:${m?.padStart(2, '0') ?? '00'}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const roles = useRoleFlags();
  const userId = session?.user?.id ?? null;

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
  const [refreshing, setRefreshing] = useState(false);
  const staffPrimaryMosqueId = useMemo(
    () => (roles.isMainAdmin ? null : roles.primaryAdminMosqueId ?? roles.primaryMuezzinMosqueId ?? null),
    [roles.isMainAdmin, roles.primaryAdminMosqueId, roles.primaryMuezzinMosqueId]
  );

  const primaryMosque = useMemo(() => {
    const preferredId = staffPrimaryMosqueId ?? defaultMosqueId ?? subs[0]?.mosque_id ?? mosques[0]?.id;
    const found = mosques.find((m) => m.id === preferredId);
    if (found) return found;
    const altId = staffPrimaryMosqueId ?? defaultMosqueId ?? subs[0]?.mosque_id ?? mosques[0]?.id;
    return mosques.find((m) => m.id === altId) ?? null;
  }, [subs, mosques, defaultMosqueId, staffPrimaryMosqueId]);

  const subscribedIds = useMemo(() => new Set(subs.map((s) => s.mosque_id)), [subs]);

  const loadDefault = React.useCallback(async () => {
    try {
      const stored = await getDefaultMosqueId(userId);
      setDefaultMosqueId(stored ?? null);
      return stored ?? null;
    } catch {
      setDefaultMosqueId(null);
      return null;
    }
  }, [userId]);

  const loadHomeData = React.useCallback(async () => {
    const [mosqueRes, subsRes, streamsRes] = await Promise.all([
      supabase.from('mosques').select('id, name, city, country, status').order('name', { ascending: true }).limit(200),
      userId
        ? supabase.from('subscriptions').select('mosque_id').eq('user_id', userId)
        : Promise.resolve({ data: [] as Subscription[], error: null }),
      supabase
        .from('streams')
        .select('id, mosque_id, type, is_live, status, started_at')
        .eq('is_live', true)
        .order('started_at', { ascending: false, nullsFirst: false }),
    ]);
    if (!mosqueRes.error && mosqueRes.data) setMosques(mosqueRes.data);
    if (!subsRes.error && subsRes.data) setSubs(subsRes.data);
    if (!streamsRes.error && streamsRes.data) {
      const map: Record<string, StreamRow> = {};
      (streamsRes.data as StreamRow[]).forEach((s) => {
        if (s.is_live && !map[s.mosque_id]) map[s.mosque_id] = s;
      });
      setLiveStreams(map);
    } else {
      setLiveStreams({});
    }
    return {
      mosques: (mosqueRes.data ?? []) as Mosque[],
      subs: (subsRes.data ?? []) as Subscription[],
    };
  }, [userId]);

  const loadPrayerTimes = React.useCallback(
    async (mosqueId?: string | null) => {
      if (!mosqueId) {
        setPrayerTimes(null);
        setPrayerError(null);
        return;
      }
      try {
        const normalized = await getDailyPrayerTimes(mosqueId, new Date());
        setPrayerError(null);
        setPrayerTimes(mapNormalizedToLegacyShape(normalized));
      } catch {
        setPrayerError('Could not load prayer times.');
        setPrayerTimes(null);
      }
    },
    []
  );

  const loadMuezzin = React.useCallback(async () => {
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
  }, [roles.isMuezzin]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const storedDefaultId = await loadDefault();
      const { mosques: latestMosques, subs: latestSubs } = await loadHomeData();
      const preferredId = staffPrimaryMosqueId ?? storedDefaultId ?? latestSubs[0]?.mosque_id ?? latestMosques[0]?.id ?? null;
      await Promise.all([loadPrayerTimes(preferredId), loadMuezzin()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadDefault, loadHomeData, loadMuezzin, loadPrayerTimes, staffPrimaryMosqueId]);

  useFocusEffect(
    React.useCallback(() => {
      void loadHomeData();
      void loadDefault();
    }, [loadDefault, loadHomeData])
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
    loadMuezzin();
  }, [loadMuezzin]);

  const mapNormalizedToLegacyShape = (normalized: Awaited<ReturnType<typeof getDailyPrayerTimes>>): PrayerTimes | null => {
    if (!normalized) return null;
    const toHm = (d: Date | null) => (d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null);
    const mapped: PrayerTimes = {};
    (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).forEach((name) => {
      mapped[name] = toHm(normalized?.[name]?.adhan ?? null);
    });
    return mapped;
  };

  useEffect(() => {
    loadPrayerTimes(primaryMosque?.id);
  }, [loadPrayerTimes, primaryMosque?.id]);

  const computeNextPrayer = (times: PrayerTimes | null) => {
    const now = new Date();
    const entries: { name: PrayerName; time: string }[] = (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[])
      .map((name) => ({ name, time: (times?.[name] as string) ?? fallbackTimes[name] }))
      .filter((p) => p.time);

    const toDate = (timeStr: string, carryNextDay = false) => {
      const [h, m] = timeStr.split(':').map((t) => parseInt(t, 10));
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (carryNextDay && d <= now) d.setDate(d.getDate() + 1);
      return d;
    };

    const upcoming = entries
      .map((p) => ({ ...p, when: toDate(p.time) }))
      .filter((p) => p.when > now)
      .sort((a, b) => a.when.getTime() - b.when.getTime());

    const chosen = upcoming[0] ?? (entries.length ? { ...entries[0], when: toDate(entries[0].time, true) } : null);
    if (!chosen) return null;

    const diffMs = chosen.when.getTime() - now.getTime();
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

  const topPad = Platform.OS === 'android' ? 8 : 0;
  const liveInfo = useLiveStreamForMosque(primaryMosque?.id);

  const MuezzinHero = () => {
    const broadcast = nextBroadcast;
    const [now, setNow] = useState(new Date());
    useEffect(() => {
      const id = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(id);
    }, []);

    const startable = broadcast ? canStartBroadcast(broadcast, now) : false;
    const badge = broadcast ? statusBadge(broadcast, now) : null;
    const remaining = (() => {
      if (!broadcast) return null;
      const target = new Date(broadcast.scheduled_for);
      const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
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
                onPress={() => router.push('/(muezzin)/muezzin-home')}
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
    <AppCard style={styles.cardContainer}>
      <View style={styles.sectionHeader}>
        <AppText variant="sectionTitle">My Mosques</AppText>
        <Pressable onPress={() => router.push('/manage-mosques')} hitSlop={6}>
          <AppText variant="body" color={tokens.color.text.accent} style={styles.manageLink}>
            Manage
          </AppText>
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
                  <AppText style={styles.mosqueAvatarText}>{m!.name.slice(0, 2).toUpperCase()}</AppText>
                </View>
                <AppText style={styles.mosqueLabel} numberOfLines={1}>
                  {m!.name}
                </AppText>
                {m!.city ? (
                  <AppText variant="caption" style={styles.mosqueCity} numberOfLines={1}>
                    {m!.city}
                  </AppText>
                ) : null}
              </Pressable>
            ))}
        </ScrollView>
      ) : (
        <View style={{ paddingTop: 6 }}>
          <AppText variant="caption" style={styles.cardSubtitle}>
            Follow mosques to get live adhans.
          </AppText>
        </View>
      )}
    </AppCard>
  );

  if (roles.isMuezzin) {
    return (
      <ScreenContainer
        contentStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.color.text.accent} />}
      >
          <View style={styles.headerRow}>
            <AppLogo size={30} />
            <AppText variant="title" style={styles.appTitle}>
              Adhan Connect
            </AppText>
            <Pressable onPress={() => router.push('/(user)/settings')} hitSlop={12}>
              <Ionicons name="settings-outline" size={22} color="#0F172A" />
            </Pressable>
          </View>
          <MuezzinHero />
      </ScreenContainer>
    );
  }

  const otherLive = Object.entries(liveStreams).filter(
    ([mosqueId]) => mosqueId !== primaryMosque?.id && subscribedIds.has(mosqueId)
  );

  return (
    <ScreenContainer
      contentStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.color.text.accent} />}
    >
        <View style={styles.headerRow}>
          <AppLogo size={30} />
          <AppText variant="title" style={styles.appTitle}>
            Adhan Connect
          </AppText>
          <Pressable onPress={() => router.push('/(user)/settings')} hitSlop={12}>
            <Ionicons name="settings-outline" size={22} color="#0F172A" />
          </Pressable>
        </View>

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
            <AppText variant="label" style={styles.eyebrow}>
              Next Prayer
            </AppText>
            {primaryMosque?.name ? (
              <AppText variant="heroSubtle" style={styles.heroSource}>
                {primaryMosque.name}
              </AppText>
            ) : null}
          </View>
          <View style={{ gap: 6, marginTop: 10 }}>
            <AppText variant="hero" style={styles.nextTime}>
              {nextPrayer?.label ?? '05:18'}
            </AppText>
            <AppText style={styles.nextName}>
              {nextPrayer?.name ? nextPrayer.name.charAt(0).toUpperCase() + nextPrayer.name.slice(1) : 'Fajr'}
            </AppText>
            <AppText style={styles.nextEta}>{nextPrayer?.remaining ? `In ${nextPrayer.remaining}` : 'In 06:49'}</AppText>
          </View>
          <View style={{ marginTop: 12 }}>
            {liveInfo.isLive ? (
              <View style={styles.heroLiveRow}>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
                <Ionicons name="radio-outline" size={20} color="#E2E8F0" />
                <Pressable
                  onPress={() =>
                    primaryMosque
                      ? router.push({
                          pathname: '/(user)/now',
                          params: { mosqueId: primaryMosque.id },
                        })
                      : null
                  }
                  style={({ pressed }) => [styles.listenBtn, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <AppText variant="caption" color={tokens.color.text.inverse} style={styles.listenText}>
                    Listen Live
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Pressable>

        <AppCard style={styles.cardContainer}>
          <View style={styles.sectionHeader}>
            <AppText variant="sectionTitle">Today&apos;s Prayer Times</AppText>
          </View>
          {primaryMosque?.name ? (
            <AppText variant="caption" style={styles.cardSubtitle}>
              Based on {primaryMosque.name}
            </AppText>
          ) : null}
          <View style={styles.titleDivider} />
          <View style={styles.prayerTable}>
            {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).map((p) => (
              <View key={p} style={styles.prayerRow}>
                <AppText style={styles.prayerName}>{p.charAt(0).toUpperCase() + p.slice(1)}</AppText>
                <AppText style={styles.prayerTimeText}>{formatHm(prayerTimes?.[p] as string) ?? fallbackTimes[p]}</AppText>
              </View>
            ))}
          </View>
          {prayerError && <AppText style={styles.errorText}>{prayerError}</AppText>}
        </AppCard>

        <MyMosques />

        {otherLive.length > 0 && (
          <AppCard style={[styles.cardContainer, { gap: 10 }]}>
            <AppText variant="sectionTitle">Other Live Broadcasts</AppText>
            {otherLive.map(([mosqueId]) => {
              const m = mosques.find((ms) => ms.id === mosqueId);
              if (!m) return null;
              const city = [m.city, m.country].filter(Boolean).join(', ');
              return (
                <View key={mosqueId} style={styles.otherLiveRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="radio-outline" size={18} color="#0F172A" />
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.otherLiveName} numberOfLines={1}>
                        {m.name}
                      </AppText>
                      <AppText variant="caption" style={styles.otherLiveSub} numberOfLines={1}>
                        {city || 'Live broadcast'}
                      </AppText>
                    </View>
                    <View style={styles.liveBadge}>
                      <AppText variant="caption" color={tokens.color.text.inverse} style={styles.liveBadgeText}>
                        LIVE
                      </AppText>
                    </View>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(user)/now',
                        params: { mosqueId },
                      })
                    }
                    hitSlop={6}
                  >
                    <AppText variant="body" color={tokens.color.text.accent} style={styles.listenLink}>
                      Listen
                    </AppText>
                  </Pressable>
                </View>
              );
            })}
          </AppCard>
        )}

        <AppCard subtle style={styles.discoveryCard}>
          <AppText variant="sectionTitle">Find Mosques Near You</AppText>
          <AppText variant="body" style={styles.discoverySubtitle}>
            Discover mosques to follow and listen to live adhans.
          </AppText>
          <AppButton title="Discover" onPress={() => router.push('/(user)/discover')} style={styles.discoveryBtn} />
        </AppCard>
    </ScreenContainer>
  );
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
});
