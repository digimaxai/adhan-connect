// app/(tabs)/index.tsx
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import {
  AdhanBroadcast,
  canStartBroadcast,
  fetchUpcomingBroadcasts,
  formatTimeWithTz,
  labelForPrayer,
  statusBadge,
} from '../../lib/adhans';
import { useRoleFlags } from '../../lib/roles';
import { supabase } from '../../lib/supabase';

type Mosque = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
};

type Subscription = {
  mosque_id: string;
};

type StreamRow = {
  mosque_id: string;
  type?: string | null;
  is_live: boolean;
  status?: string | null;
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
  const [muezzinLoading, setMuezzinLoading] = useState(false);
  const [muezzinError, setMuezzinError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState(''); // applied value

  const subscribedIds = useMemo(
    () => new Set(subs.map((s) => s.mosque_id)),
    [subs]
  );

  /** Load mosques, subscriptions, and live streams */
  const load = async () => {
    try {
      setLoading(true);

      const [mosqueRes, subsRes, streamsRes] = await Promise.all([
        supabase
          .from('mosques')
          .select('id, name, city, country, status')
          .or('status.eq.active,status.is.null')
          .order('name', { ascending: true })
          .limit(200),
        userId
          ? supabase
              .from('subscriptions')
              .select('mosque_id')
              .eq('user_id', userId)
          : Promise.resolve({ data: [] as Subscription[], error: null }),
        supabase
          .from('streams')
          .select('mosque_id, type, is_live, status')
          .eq('is_live', true)
          .eq('status', 'active'),
      ]);

      if (!mosqueRes.error && mosqueRes.data) {
        setMosques(mosqueRes.data);
      }

      if (!subsRes.error && subsRes.data) {
        setSubs(subsRes.data);
      }

      if (!streamsRes.error && streamsRes.data) {
        const liveMap: Record<string, StreamRow> = {};
        (streamsRes.data as StreamRow[]).forEach((s) => {
          if (s.is_live) {
            liveMap[s.mosque_id] = s;
          }
        });
        setLiveStreams(liveMap);
      } else {
        setLiveStreams({});
      }
    } catch (e) {
      console.warn('home load error', e);
      setLiveStreams({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /** Pull to refresh */
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (!value.trim()) {
      setQuery('');
    }
  };

  const applySearch = () => {
    setQuery(searchInput.trim().toLowerCase());
  };

  /** All mosques filtered by query */
  const filtered = useMemo(() => {
    if (!query) return mosques;
    return mosques.filter((m) => {
      const haystack = [m.name, m.city ?? '', m.country ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [mosques, query]);

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
      if (!upcoming.length) {
        setMuezzinError('No upcoming adhans scheduled.');
      }
    } catch (e: any) {
      setMuezzinError(e?.message ?? 'Could not load upcoming adhans.');
      setNextBroadcast(null);
    } finally {
      setMuezzinLoading(false);
    }
  };

  useEffect(() => {
    loadMuezzin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.isMuezzin]);

  /** Subscribed mosques (for "Your mosques") */
  const yourMosques = useMemo(
    () => filtered.filter((m) => subscribedIds.has(m.id)),
    [filtered, subscribedIds]
  );

  /** Remaining mosques (to avoid duplication in the main list) */
  const otherMosques = useMemo(
    () => filtered.filter((m) => !subscribedIds.has(m.id)),
    [filtered, subscribedIds]
  );

  const topPad = Platform.OS === 'android' ? 8 : 0;

  const NextAdhanHero = () => {
    if (!roles.isMuezzin) return null;

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
      return {
        text: `Adhan in ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
        diffSec,
      };
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
            <Text style={styles.heroSubtitle}>Loading your schedule�?�</Text>
          </View>
        )}
        {!muezzinLoading && broadcast && (
          <>
            <Text style={styles.heroSubtitle}>
              {labelForPrayer(broadcast.prayer)} • {formatTimeWithTz(broadcast)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
              <View style={[styles.livePill, { backgroundColor: broadcast.status === 'live' ? '#FEE2E2' : '#E2E8F0' }]}>
                <View
                  style={[
                    styles.liveDot,
                    { backgroundColor: broadcast.status === 'live' ? '#DC2626' : '#94A3B8' },
                  ]}
                />
                <Text
                  style={[
                    styles.livePillText,
                    { color: broadcast.status === 'live' ? '#B91C1C' : '#0F172A' },
                  ]}
                >
                  {broadcast.status === 'live' ? 'LIVE' : 'Ready'}
                </Text>
              </View>
              {badge && <Text style={styles.heroBadge}>{badge}</Text>}
            </View>
            {remaining && (
              <Text style={[styles.heroCountdown, { color: urgency.color }]}>
                {remaining.text}
              </Text>
            )}
            <Text style={[styles.heroUrgency, { color: urgency.color }]}>{urgency.label}</Text>
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
              <Pressable
                onPress={() => router.push(`/broadcast/${broadcast.id}`)}
                style={({ pressed }) => [
                  styles.heroButton,
                  { backgroundColor: startable ? '#EF4444' : '#0EA5E9', opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.heroButtonText}>{startable ? 'Go live' : 'View details'}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/muezzin')}
                style={({ pressed }) => [
                  styles.heroButton,
                  { backgroundColor: '#E0F2FE', opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.heroButtonText, { color: '#0369A1' }]}>Full schedule</Text>
              </Pressable>
            </View>
          </>
        )}
        {!muezzinLoading && !broadcast && (
          <Text style={styles.heroSubtitle}>
            {muezzinError || 'No upcoming adhans found. Upload a timetable to get reminders.'}
          </Text>
        )}
      </View>
    );
  };

  /** Card used in both sections */
  const MosqueCard = ({ item }: { item: Mosque }) => {
    const isActive = item.status === 'active' || !item.status;
    const isSub = subscribedIds.has(item.id);
    const liveMeta = liveStreams[item.id];
    const isLive = !!liveMeta;

    return (
      <View style={[styles.card, styles.shadow]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mosqueName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.locationText}>
              {[item.city, item.country].filter(Boolean).join(', ')}
            </Text>
          </View>

          <View style={styles.chipRow}>
            {isLive && (
              <View style={[styles.chip, styles.chipLive]}>
                <View style={styles.liveDot} />
                <Text style={styles.chipLiveText}>LIVE</Text>
                {liveMeta?.type && (
                  <Text style={styles.chipLiveMeta}>
                    {liveMeta.type.toUpperCase()}
                  </Text>
                )}
              </View>
            )}
            {isSub && (
              <View style={[styles.chip, styles.chipSub]}>
                <Text style={styles.chipSubText}>Subscribed</Text>
              </View>
            )}
            {!isLive && isActive && (
              <View style={[styles.chip, styles.chipActive]}>
                <Text style={styles.chipActiveText}>ACTIVE</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Link href="/(tabs)/now" asChild>
            <Pressable style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>
                {isLive ? 'Listen live' : 'Go to Now'}
              </Text>
            </Pressable>
          </Link>

          <Link href="/(tabs)/settings/subscriptions" asChild>
            <Pressable style={[styles.btn, styles.btnSecondary]}>
              <Text style={styles.btnSecondaryText}>
                {isSub ? 'Manage' : 'Follow'}
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  };

  // Dedicated layout for muezzin: focus on control panel only
  if (roles.isMuezzin) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Text style={styles.appTitle}>Adhan Connect</Text>
          <Text style={styles.subtitle}>Your Adhan control panel</Text>
          <NextAdhanHero />
          {!nextBroadcast && (
            <Text style={[styles.heroSubtitle, { marginTop: 8 }]}>
              No upcoming adhans found. Ensure adhan_broadcasts has future rows for your mosque and policies allow access.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={styles.appTitle}>Adhan Connect</Text>
        <Text style={styles.subtitle}>
          Find your mosques, listen live, donate
        </Text>

        <NextAdhanHero />

        <View style={styles.searchWrap}>
          <TextInput
            placeholder="Search by name or city"
            placeholderTextColor="#94A3B8"
            value={searchInput}
            onChangeText={handleSearchChange}
            onSubmitEditing={applySearch}
            returnKeyType="search"
            style={styles.searchInput}
          />
          <Pressable
            onPress={applySearch}
            style={styles.searchBtn}
            accessibilityRole="button"
            accessibilityLabel="Apply search"
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#0EA5E9" />
            <Text style={styles.loadingText}>Loading mosques…</Text>
          </View>
        )}

        {!loading && subs.length > 0 && (
          <Text style={styles.yourMosquesHint}>
            You follow {subs.length} mosque{subs.length > 1 ? 's' : ''}.
          </Text>
        )}
      </View>

      <FlatList
        data={otherMosques}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MosqueCard item={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          yourMosques.length > 0 ? (
            <View style={styles.yourMosquesSection}>
              <Text style={styles.sectionTitle}>Your mosques</Text>
              <FlatList
                data={yourMosques}
                keyExtractor={(m) => m.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 8 }}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item }) => {
                  const liveMeta = liveStreams[item.id];
                  return (
                    <View style={[styles.smallCard, styles.shadow]}>
                      <View style={styles.smallHeader}>
                        <Text style={styles.smallName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {!!liveMeta && (
                          <View style={[styles.chip, styles.chipLive, { marginLeft: 4 }]}>
                            <View style={styles.liveDot} />
                            <Text style={styles.chipLiveText}>LIVE</Text>
                            {liveMeta?.type && (
                              <Text style={styles.chipLiveMeta}>
                                {liveMeta.type.toUpperCase()}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                      <Text style={styles.smallLocation} numberOfLines={1}>
                        {[item.city, item.country].filter(Boolean).join(', ')}
                      </Text>

                      <View style={styles.smallButtonsRow}>
                        <Link href="/(tabs)/now" asChild>
                          <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]}>
                            <Text style={styles.smallBtnPrimaryText}>
                              {liveMeta ? 'Listen live' : 'Listen'}
                            </Text>
                          </Pressable>
                        </Link>
                        <Link href="/(tabs)/settings/subscriptions" asChild>
                          <Pressable style={[styles.smallBtn, styles.smallBtnSecondary]}>
                            <Text style={styles.smallBtnSecondaryText}>Manage</Text>
                          </Pressable>
                        </Link>
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {query
                ? 'No mosques match your search.'
                : 'No mosques found yet.'}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#0F172A',
  },
  subtitle: {
    color: '#64748B',
    marginTop: 4,
    fontSize: 13,
  },

  searchWrap: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
  },
  searchBtn: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#64748B',
    fontSize: 13,
  },
  yourMosquesHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
  },
  yourMosquesSection: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: {
      elevation: 2,
    },
  }) as object,

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mosqueName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  locationText: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748B',
  },

  chipRow: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#ECFDF3',
  },
  chipActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  chipSub: {
    backgroundColor: '#EEF2FF',
  },
  chipSubText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  chipLive: {
    backgroundColor: '#FEF2F2',
  },
  chipLiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 4,
  },
  chipLiveMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DC2626',
  },

  cardFooter: {
    flexDirection: 'row',
    marginTop: 12,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#0EA5E9',
    marginRight: 8,
  },
  btnSecondary: {
    backgroundColor: '#0F172A',
    marginLeft: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondaryText: {
    color: '#E5E7EB',
    fontWeight: '600',
    fontSize: 14,
  },

  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    marginBottom: 12,
  },
  heroEyebrow: {
    color: '#67E8F9',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 20,
    marginTop: 4,
  },
  heroSubtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 6,
  },
  heroBadge: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  heroCountdown: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '800',
  },
  heroUrgency: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  livePillText: {
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 6,
  },
  heroButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButtonText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  debugCard: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  debugLine: {
    fontSize: 12,
    color: '#475569',
  },

  emptyText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
  },

  // "Your mosques" small cards
  smallCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  smallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  smallLocation: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  smallButtonsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  smallBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnPrimary: {
    backgroundColor: '#0EA5E9',
    marginRight: 6,
  },
  smallBtnSecondary: {
    backgroundColor: '#0F172A',
    marginLeft: 6,
  },
  smallBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  smallBtnSecondaryText: {
    color: '#E5E7EB',
    fontWeight: '600',
    fontSize: 13,
  },
});
