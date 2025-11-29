// app/event/[id].tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type EventRow = {
  id: string;
  title?: string | null;
  starts_at?: string | null;
  location?: string | null;
  capacity?: number | null;
  description?: string | null;
  mosque_name?: string | null;
  status?: string | null;
};

export default function EventDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data } = await supabase
        .from('events')
        .select('id,title,starts_at,location,capacity,description,status, mosques(name)')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        setEvent({
          id: data.id,
          title: data.title,
          starts_at: data.starts_at,
          location: data.location,
          capacity: data.capacity,
          description: data.description,
          mosque_name: (data as any).mosques?.name ?? null,
          status: data.status,
        });
      }
    };
    load();
  }, [id]);

  const isClosed = event?.status === 'closed';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.back}>{'<'}</Text>
          </Pressable>
          <Text style={styles.title}>Event Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.card, styles.shadow]}>
          <Text style={styles.eventTitle}>{event?.title ?? 'Event'}</Text>
          <Text style={styles.subtle}>{event?.mosque_name ?? ''}</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {event?.starts_at ? new Date(event.starts_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '--'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>
                {event?.starts_at ? new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{event?.location ?? '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Capacity</Text>
              <Text style={styles.infoValue}>{event?.capacity ?? '—'}</Text>
            </View>
          </View>
          {event?.description ? <Text style={styles.desc}>{event.description}</Text> : null}
        </View>
      </ScrollView>
      <View style={styles.sticky}>
        <Pressable
          disabled={isClosed}
          onPress={() => alert('Registered')}
          style={({ pressed }) => [styles.primaryBtn, isClosed && styles.btnDisabled, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={styles.primaryText}>{isClosed ? 'Registration closed' : 'Register'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F8F9' },
  body: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  back: { fontSize: 22, color: '#111111', fontWeight: '700' },
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
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { color: '#585858', fontSize: 13 },
  infoValue: { color: '#111111', fontWeight: '700', fontSize: 14 },
  desc: { marginTop: 16, color: '#111111', fontSize: 14, lineHeight: 20 },
  sticky: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E7BF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  btnDisabled: { backgroundColor: '#94A3B8' },
  shadow: { shadowColor: '#111111', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
