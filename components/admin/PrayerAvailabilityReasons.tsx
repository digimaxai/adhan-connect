import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export function PrayerAvailabilityReasons({ mosqueId, mosqueName }: { mosqueId: string; mosqueName: string }) {
  const [excluded, setExcluded] = useState<string[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);
  useFocusEffect(useCallback(() => {
    const current = ++generation.current;
    setLoading(true); setError(null); setMessage(null); setSaving(null); busy.current = false;
    void supabase.from('mosques').select('prayers_not_offered,prayers_not_offered_reasons').eq('id', mosqueId).single()
      .then(({ data, error: failure }) => {
        if (current !== generation.current) return;
        if (failure) setError('Unable to load prayer availability.');
        else { setExcluded(data.prayers_not_offered ?? []); setReasons(data.prayers_not_offered_reasons ?? {}); }
        setLoading(false);
      });
    return () => { generation.current++; };
    // Retry reloads the same mosque after a failed request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId, retry]));

  const save = async (prayer: string) => {
    if (busy.current) return;
    const reason = reasons[prayer]?.trim() ?? '';
    if (!reason || reason.length > 500) { setError('Please enter a reason between 1 and 500 characters.'); return; }
    busy.current = true; setSaving(prayer); setError(null); setMessage(null);
    const current = generation.current;
    try {
      const { error: failure } = await supabase.rpc('set_prayer_unavailability_reason', { p_mosque_id: mosqueId, p_prayer: prayer, p_reason: reason });
      if (current !== generation.current) return;
      if (failure) setError(failure.message); else setMessage('Reason saved. Listeners can read it from the prayer info icon.');
    } catch { if (current === generation.current) setError('Unable to save. Please try again.'); }
    finally { if (current === generation.current) { busy.current = false; setSaving(null); } }
  };
  return <View style={styles.card}>
    <Text style={styles.title}>Prayer availability reasons</Text>
    <Text style={styles.body}>{mosqueName} · Explain why a congregation is not offered. These reasons are public.</Text>
    {loading ? <ActivityIndicator /> : <>
      {prayers.filter(p => excluded.includes(p)).map(prayer => <View key={prayer} style={styles.field}>
        <Text style={styles.label}>{prayer.charAt(0).toUpperCase() + prayer.slice(1)} not offered</Text>
        <TextInput accessibilityLabel={`Reason ${prayer} is not offered`} multiline maxLength={500} editable={!saving}
          value={reasons[prayer] ?? ''} onChangeText={value => { setReasons(r => ({ ...r, [prayer]: value })); setMessage(null); }}
          placeholder="Explain the reason to listeners" placeholderTextColor="#64748B" style={styles.input} />
        <Pressable accessibilityRole="button" disabled={!!saving} onPress={() => void save(prayer)} style={styles.button}>
          <Text style={styles.buttonText}>{saving === prayer ? 'Saving…' : 'Save reason'}</Text>
        </Pressable>
      </View>)}
      {!excluded.length && !error ? <Text style={styles.body}>All five daily congregations are marked as offered.</Text> : null}
    </>}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(n => n + 1)} style={styles.retry}><Text>Reload availability</Text></Pressable></> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  body: { fontSize: 13, lineHeight: 19, color: '#64748B' },
  field: { gap: 8 },
  label: { color: '#334155', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#0F172A', fontSize: 14 },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#047857', borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
  success: { color: '#047857', fontSize: 13 },
  error: { color: '#B91C1C', fontSize: 13 },
  retry: { minHeight: 44, justifyContent: 'center' },
});
