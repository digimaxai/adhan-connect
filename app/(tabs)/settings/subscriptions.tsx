// app/(tabs)/settings/subscriptions.tsx
// (UI label keeps "Manage subscriptions" if you want continuity; functionally this manages "follows")
import { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Appbar, Button, Chip, Divider, List, Searchbar, Text } from 'react-native-paper';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type MosqueRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  reliability_score: number | null;
  distance_km: number | null;
  is_following: boolean;
};

const FOLLOW_LIMIT = 5;

export default function ManageFollows() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<MosqueRow[]>([]);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });

  const followCount = useMemo(() => items.filter(i => i.is_following).length, [items]);
  const remaining = FOLLOW_LIMIT - followCount;

  // Ask for location (best-effort; screen still works without it)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancel) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // ignore
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Fetch via RPC (text + distance + is_following)
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('search_mosques', {
          q: query.length ? query : null,
          user_lat: coords.lat,
          user_lng: coords.lng,
          radius_km: 50,
          limit_count: 100
        });
        if (error) throw error;
        if (!cancel) setItems(data ?? []);
      } catch (e) {
        console.warn('search_mosques error', e);
        if (!cancel) setItems([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    // re-run when query or coords change
  }, [query, coords.lat, coords.lng]);

  const follow = async (mosque_id: string) => {
    if (followCount >= FOLLOW_LIMIT) return;
    if (items.find(i => i.id === mosque_id)?.is_following) return;
    setSaving(true);
    // optimistic mark
    setItems(prev => prev.map(i => i.id === mosque_id ? ({ ...i, is_following: true }) : i));
    try {
      const { error } = await supabase.from('follows').insert({ mosque_id });
      if (error) throw error;
    } catch (e) {
      // revert
      setItems(prev => prev.map(i => i.id === mosque_id ? ({ ...i, is_following: false }) : i));
      console.warn('follow error', e);
    } finally {
      setSaving(false);
    }
  };

  const unfollow = async (mosque_id: string) => {
    if (!items.find(i => i.id === mosque_id)?.is_following) return;
    setSaving(true);
    const snapshot = items;
    // optimistic unmark
    setItems(prev => prev.map(i => i.id === mosque_id ? ({ ...i, is_following: false }) : i));
    try {
      const { error } = await supabase.from('follows').delete().eq('mosque_id', mosque_id);
      if (error) throw error;
    } catch (e) {
      // revert
      setItems(snapshot);
      console.warn('unfollow error', e);
    } finally {
      setSaving(false);
    }
  };

  const renderRow = ({ item }: { item: MosqueRow }) => {
    const subtitle = [item.city, item.country].filter(Boolean).join(', ');
    const dist = item.distance_km != null ? `${item.distance_km.toFixed(1)} km` : undefined;

    return (
      <>
        <List.Item
          title={item.name}
          description={subtitle}
          left={() => <List.Icon icon="home-city-outline" />}
          right={() => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {dist && <Chip compact>{dist}</Chip>}
              {item.is_following ? (
                <Button mode="outlined" onPress={() => unfollow(item.id)} disabled={saving}>Unfollow</Button>
              ) : (
                <Button mode="contained" onPress={() => follow(item.id)} disabled={saving || followCount >= FOLLOW_LIMIT}>Follow</Button>
              )}
            </View>
          )}
        />
        <Divider />
      </>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Manage subscriptions" />
        <Chip style={{ marginRight: 12 }} compact>{followCount}/{FOLLOW_LIMIT}</Chip>
      </Appbar.Header>

      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Searchbar
          placeholder="Search mosques"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Text style={{ opacity: 0.7, marginTop: 8 }}>
          {remaining > 0 ? `You can add ${remaining} more.` : 'You reached the limit.'}
        </Text>
        {loading && <Text style={{ marginTop: 16 }}>Loading…</Text>}
      </View>

      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        renderItem={renderRow}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      />
    </View>
  );
}
