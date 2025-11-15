// app/(tabs)/index.tsx
import { Link } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
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
  is_live: boolean;
  status?: string | null;
};

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState(''); // debounced value

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
          .select('mosque_id, is_live, status')
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
        const liveSet = new Set(
          (streamsRes.data as StreamRow[])
            .filter((s) => s.is_live)
            .map((s) => s.mosque_id)
        );
        setLiveIds(liveSet);
      } else {
        setLiveIds(new Set());
      }
    } catch (e) {
      console.warn('home load error', e);
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

  /** Debounce search input -> query */
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(searchInput.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(id);
  }, [searchInput]);

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

  /** Card used in both sections */
  const MosqueCard = ({ item }: { item: Mosque }) => {
    const isActive = item.status === 'active' || !item.status;
    const isSub = subscribedIds.has(item.id);
    const isLive = liveIds.has(item.id);

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

  /** Header with search + optional "Your mosques" section */
  const ListHeader = () => (
    <View style={[styles.header, { paddingTop: topPad }]}>
      <Text style={styles.appTitle}>Adhan Connect</Text>
      <Text style={styles.subtitle}>
        Find your mosques, listen live, donate
      </Text>

      <View style={styles.searchWrap}>
        <TextInput
          placeholder="Search by name or city"
          placeholderTextColor="#94A3B8"
          value={searchInput}
          onChangeText={setSearchInput}
          returnKeyType="search"
          style={styles.searchInput}
        />
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

      {yourMosques.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>Your mosques</Text>
          <FlatList
            data={yourMosques}
            keyExtractor={(m) => m.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            renderItem={({ item }) => (
              <View style={[styles.smallCard, styles.shadow]}>
                <View style={styles.smallHeader}>
                  <Text style={styles.smallName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {liveIds.has(item.id) && (
                    <View style={[styles.chip, styles.chipLive, { marginLeft: 4 }]}>
                      <View style={styles.liveDot} />
                      <Text style={styles.chipLiveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.smallLocation} numberOfLines={1}>
                  {[item.city, item.country].filter(Boolean).join(', ')}
                </Text>

                <View style={styles.smallButtonsRow}>
                  <Link href="/(tabs)/now" asChild>
                    <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]}>
                      <Text style={styles.smallBtnPrimaryText}>Listen</Text>
                    </Pressable>
                  </Link>
                  <Link href="/(tabs)/settings/subscriptions" asChild>
                    <Pressable style={[styles.smallBtn, styles.smallBtnSecondary]}>
                      <Text style={styles.smallBtnSecondaryText}>Manage</Text>
                    </Pressable>
                  </Link>
                </View>
              </View>
            )}
          />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={otherMosques}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MosqueCard item={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={<ListHeader />}
        ListHeaderComponentStyle={{ marginBottom: 4 }}
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
    paddingHorizontal: 4,
    paddingBottom: 12,
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
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
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
