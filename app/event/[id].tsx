import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type EventRow = {
  id: string;
  title?: string | null;
  start_at?: string | null;
  location?: string | null;
  capacity?: number | null;
  description?: string | null;
  mosque_name?: string | null;
};

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export default function EventDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from('events')
          .select('id,title,start_at,location,capacity,description,mosques(name)')
          .eq('id', id)
          .eq('status', 'published')
          .eq('is_public', true)
          .gte('start_at', startOfTodayIso())
          .maybeSingle();
        setEvent(
          data
            ? {
                id: data.id,
                title: data.title,
                start_at: data.start_at,
                location: data.location,
                capacity: data.capacity,
                description: data.description,
                mosque_name: (data as any).mosques?.name ?? null,
              }
            : null
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const starts = event?.start_at ? new Date(event.start_at) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color="#111111" />
          </Pressable>
          <Text style={styles.title}>Event Details</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color="#1E7BF6" /></View>
        ) : event ? (
          <View style={[styles.card, styles.shadow]}>
            <Text style={styles.eventTitle}>{event.title ?? 'Event'}</Text>
            {event.mosque_name ? <Text style={styles.subtle}>{event.mosque_name}</Text> : null}
            <View style={styles.infoBox}>
              <Info label="Date" value={starts ? starts.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '--'} />
              <Info label="Time" value={starts ? starts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} />
              <Info label="Location" value={event.location ?? 'To be confirmed'} />
              <Info label="Capacity" value={event.capacity ? `${event.capacity}` : 'Open'} />
            </View>
            {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}
          </View>
        ) : (
          <View style={[styles.card, styles.shadow]}>
            <Text style={styles.eventTitle}>Event unavailable</Text>
            <Text style={styles.desc}>This event may be private, cancelled, or no longer upcoming.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F8F9' },
  body: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  centered: { paddingVertical: 48, alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  title: { fontSize: 20, fontWeight: '800', color: '#111111' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginTop: 8,
  },
  eventTitle: { fontSize: 20, fontWeight: '800', color: '#111111' },
  subtle: { color: '#585858', marginTop: 4 },
  infoBox: { marginTop: 16, gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  infoLabel: { color: '#585858', fontSize: 13 },
  infoValue: { color: '#111111', fontWeight: '700', fontSize: 14, flex: 1, textAlign: 'right' },
  desc: { marginTop: 16, color: '#111111', fontSize: 14, lineHeight: 20 },
  shadow: { shadowColor: '#111111', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
