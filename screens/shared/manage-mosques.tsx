import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { clearDefaultMosqueId, getDefaultMosqueId, setDefaultMosqueId } from '../../lib/mosquePreferences';
import { supabase } from '../../lib/supabase';

type FollowedMosque = {
  mosque_id: string;
  name: string;
  city?: string | null;
  country?: string | null;
};

type SubscriptionRow = {
  mosque_id: string;
};

type MosqueRow = {
  id: string;
  name?: string | null;
  city?: string | null;
  country?: string | null;
};

export default function ManageMosques() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [items, setItems] = useState<FollowedMosque[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultId, setDefaultId] = useState<string | null>(null);

  const count = items.length;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('mosque_id')
        .eq('user_id', userId);

      if (subsError) throw subsError;

      const orderedIds = Array.from(
        new Set(((subsData ?? []) as SubscriptionRow[]).map((row) => row.mosque_id).filter(Boolean))
      );

      if (!orderedIds.length) {
        setItems([]);
        return;
      }

      const { data: mosqueData, error: mosqueError } = await supabase
        .from('mosques')
        .select('id, name, city, country')
        .in('id', orderedIds);

      if (mosqueError) throw mosqueError;

      const mosqueMap = new Map<string, MosqueRow>(
        ((mosqueData ?? []) as MosqueRow[]).map((mosque) => [mosque.id, mosque])
      );

      const mapped: FollowedMosque[] = orderedIds.map((mosqueId) => {
        const mosque = mosqueMap.get(mosqueId);
        return {
          mosque_id: mosqueId,
          name: mosque?.name ?? 'Mosque',
          city: mosque?.city ?? null,
          country: mosque?.country ?? null,
        };
      });

      setItems(mapped);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const getDefault = async () => {
      try {
        const stored = await getDefaultMosqueId(userId);
        setDefaultId(stored ?? null);
      } catch {}
    };
    getDefault();
  }, [userId]);

  const moveItem = (index: number, newIndex: number) => {
    if (newIndex < 0 || newIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(newIndex, 0, moved);
    setItems(next);
  };

  const confirmUnfollow = (mosqueId: string) => {
    const mosque = items.find((i) => i.mosque_id === mosqueId);
    Alert.alert(
      'Unfollow mosque',
      `Are you sure you want to unfollow ${mosque?.name ?? 'this mosque'}?`,
      [
        { text: 'Unfollow', style: 'destructive', onPress: () => doUnfollow(mosqueId) },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const doUnfollow = async (mosqueId: string) => {
    if (!userId) return;
    await supabase.from('subscriptions').delete().eq('user_id', userId).eq('mosque_id', mosqueId);
    setItems((prev) => prev.filter((i) => i.mosque_id !== mosqueId));
    if (defaultId === mosqueId) {
      setDefaultId(null);
      await clearDefaultMosqueId(userId);
    }
  };

  const setDefault = async (mosqueId: string) => {
    try {
      await setDefaultMosqueId(userId, mosqueId);
      setDefaultId(mosqueId);
    } catch {
      setDefaultId(mosqueId);
    }
  };

  const renderRow = ({ item, index }: { item: FollowedMosque; index: number }) => {
    const isDefault = item.mosque_id === defaultId;
    return (
      <View style={[styles.rowCard, styles.shadow, isDefault && styles.rowDefault]}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {[item.city, item.country].filter(Boolean).join(', ')}
          </Text>
          {isDefault ? (
            <View style={styles.defaultChip}>
              <Text style={styles.defaultChipText}>Default</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowActions}>
          <Pressable
            onPress={() => setDefault(item.mosque_id)}
            style={({ pressed }) => [styles.btnMini, isDefault && styles.btnMiniActive, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={[styles.btnMiniText, isDefault && styles.btnMiniTextActive]}>{isDefault ? 'Default' : 'Set default'}</Text>
          </Pressable>
          <Pressable onPress={() => moveItem(index, index - 1)} hitSlop={8} style={({ pressed }) => [styles.handle, { opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name="reorder-three-outline" size={18} color="#0F172A" />
          </Pressable>
          <Pressable onPress={() => confirmUnfollow(item.mosque_id)} style={({ pressed }) => [styles.btnOutline, { opacity: pressed ? 0.85 : 1 }]}>
            <Text style={styles.btnOutlineText}>Unfollow</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.title}>Manage My Mosques</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{`You are following ${count} mosque${count === 1 ? '' : 's'}`}</Text>
      </View>

      {items.length === 0 && !loading ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>You are not following any mosques yet.</Text>
          <Text style={styles.emptySubtitle}>Discover mosques to get live adhans.</Text>
          <Pressable onPress={() => router.push('discover' as any)} style={({ pressed }) => [styles.discoverBtn, { opacity: pressed ? 0.9 : 1 }]}>
            <Text style={styles.discoverText}>Discover Mosques</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.mosque_id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

  summary: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  summaryText: { color: '#0F172A', fontWeight: '700', fontSize: 13 },

  list: { paddingBottom: 20 },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    alignItems: 'flex-start',
    gap: 12,
  },
  rowDefault: { borderWidth: 1, borderColor: '#2DBE7E30' },
  rowLeft: { width: '100%', gap: 6 },
  rowTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  rowSub: { color: '#475569', fontSize: 13 },
  defaultChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#E8FFF2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  defaultChipText: { color: '#167C52', fontSize: 12, fontWeight: '700' },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginTop: 10 },
  handle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnOutlineText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  btnMini: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  btnMiniActive: { borderColor: '#2DBE7E', backgroundColor: '#E8FFF2' },
  btnMiniText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  btnMiniTextActive: { color: '#167C52' },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { fontWeight: '800', fontSize: 15, color: '#0F172A', textAlign: 'center' },
  emptySubtitle: { color: '#64748B', fontSize: 13, marginTop: 6, textAlign: 'center' },
  discoverBtn: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  discoverText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  shadow: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
