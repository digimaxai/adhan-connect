import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Engagement = { party_size: number; liked: boolean; favourited: boolean };

export function EventEngagement({ eventId, startsAt }: { eventId: string; startsAt?: string | null }) {
  const { session } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Engagement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    const current = ++generation.current;
    setData(null); setLoading(true); setError(null); busy.current = false; setSaving(false);
    void supabase.rpc('get_event_engagement', { p_event_id: eventId }).then(({ data: result, error: failure }) => {
      if (current !== generation.current) return;
      if (failure) setError('Unable to load event responses. Please retry.');
      else setData(result as Engagement);
      setLoading(false);
    });
    return () => { generation.current++; };
  // Refetch on account changes and explicit retry, as well as screen focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, session?.user?.id, retry]));

  const respond = async (action: 'attendance' | 'like' | 'favourite', value: number) => {
    if (!session) { router.push('/(auth)/sign-in'); return; }
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(null);
    const current = generation.current;
    try {
      const { data: result, error: failure } = await supabase.rpc('set_event_engagement', {
        p_event_id: eventId, p_action: action, p_value: value,
      });
      if (current !== generation.current) return;
      if (failure) setError(failure.message);
      else setData(result as Engagement);
    } catch {
      if (current === generation.current) setError('Unable to save your response. Please try again.');
    } finally {
      if (current === generation.current) { busy.current = false; setSaving(false); }
    }
  };
  const started = !!startsAt && new Date(startsAt).getTime() <= Date.now();

  return <View style={styles.card}>
    <Text style={styles.title}>Are you coming?</Text>
    {loading ? <ActivityIndicator /> : data ? <>
      <Text style={styles.note}>Help the organisers plan. This is an attendance plan, not a ticket.</Text>
      <Text style={styles.label}>{started ? 'This event has started' : data.party_size ? `Your party: ${data.party_size} ${data.party_size === 1 ? 'person' : 'people'}` : 'Choose your party size'}</Text>
      <View style={styles.actions}>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((size) => {
          const selected = data.party_size === size;
          const disabled = saving || started;
          return <Pressable key={size} accessibilityRole="button" accessibilityLabel={`Attend with ${size} ${size === 1 ? 'person' : 'people'}`} accessibilityState={{ selected, disabled }}
            disabled={disabled} onPress={() => void respond('attendance', size)} style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}>
            <Text style={[styles.choiceText, selected && styles.selectedText]}>{size}</Text>
          </Pressable>;
        })}
      </View>
      {data.party_size > 0 ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => void respond('attendance', 0)} style={styles.cancel}><Text style={styles.link}>Cancel attendance plan</Text></Pressable> : null}
      <View style={styles.actions}>
        {(['like', 'favourite'] as const).map((action) => {
          const selected = action === 'like' ? data.liked : data.favourited;
          return <Pressable key={action} accessibilityRole="button" accessibilityState={{ selected, disabled: saving }} disabled={saving}
            onPress={() => void respond(action, selected ? 0 : 1)} style={[styles.reaction, selected && styles.reactionSelected]}>
            <Ionicons name={action === 'like' ? selected ? 'heart' : 'heart-outline' : selected ? 'bookmark' : 'bookmark-outline'} size={20} color={selected ? '#047857' : '#475569'} />
            <Text style={styles.choiceText}>{action === 'like' ? selected ? 'Liked' : 'Like' : selected ? 'Favourited' : 'Favourite'}</Text>
          </Pressable>;
        })}
      </View>
      {!session ? <Text style={styles.note}>Sign in to attend, like or favourite this event.</Text> : null}
      {saving ? <ActivityIndicator accessibilityLabel="Saving response" /> : null}
    </> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!loading && !data ? <Pressable accessibilityRole="button" onPress={() => setRetry(x => x + 1)} style={styles.cancel}><Text style={styles.link}>Retry</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, gap: 12 },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  note: { color: '#64748B', fontSize: 12, lineHeight: 18 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12 },
  choiceText: { color: '#334155', fontSize: 14, fontWeight: '600' },
  selected: { backgroundColor: '#047857', borderColor: '#047857' },
  selectedText: { color: '#fff' },
  disabled: { opacity: 0.45 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 44, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12 },
  reactionSelected: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  cancel: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#0369A1', fontWeight: '600' },
  error: { color: '#B91C1C', fontSize: 13 },
});
