import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../lib/supabase';
import { useAdminMosque } from '../../lib/hooks/useAdminMosque';
import { tokens } from '../../theme/tokens';

type Quote = {
  id: string;
  quote_date: string;
  text_en: string;
  text_ar: string | null;
  source: string | null;
};

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const today = formatLocalDate(new Date());
  const tomorrow = formatLocalDate(addLocalDays(new Date(), 1));
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    days.push(formatLocalDate(addLocalDays(today, i)));
  }
  return days;
}

export default function QuotesScreen() {
  const router = useRouter();
  const { selectedMosque } = useAdminMosque();
  const mosqueId = selectedMosque?.mosqueId ?? null;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Edit state — keyed by date
  const [drafts, setDrafts] = useState<Record<string, Partial<Quote>>>({});

  const days = useMemo(() => nextNDays(7), []);

  const load = useCallback(async () => {
    if (!mosqueId) { setQuotes([]); setLoading(false); return; }
    setLoading(true);
    try {
      const from = days[0];
      const to = days[days.length - 1];
      const { data, error } = await supabase
        .from('mosque_daily_quotes')
        .select('id,quote_date,text_en,text_ar,source')
        .eq('mosque_id', mosqueId)
        .gte('quote_date', from)
        .lte('quote_date', to)
        .order('quote_date', { ascending: true });
      if (error) throw error;
      setQuotes((data ?? []) as Quote[]);
    } catch (e: any) {
      console.warn('[QuotesScreen] load failed', e?.message ?? e);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [days, mosqueId]);

  useEffect(() => { void load(); }, [load]);

  const quoteForDate = (date: string) =>
    quotes.find((q) => q.quote_date === date) ?? null;

  const draftFor = (date: string) => drafts[date] ?? {};

  const setDraft = (date: string, patch: Partial<Quote>) =>
    setDrafts((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));

  const save = async (date: string) => {
    if (!mosqueId) return;
    const existing = quoteForDate(date);
    const draft = draftFor(date);
    const text_en = (draft.text_en ?? existing?.text_en ?? '').trim();
    if (!text_en) {
      Alert.alert('Required', 'Please enter the quote text in English.');
      return;
    }
    if (text_en.length < 5) {
      Alert.alert('Too short', 'Please enter at least 5 characters for the quote.');
      return;
    }
    setSaving(date);
    try {
      const payload = {
        mosque_id: mosqueId,
        quote_date: date,
        text_en,
        text_ar: (draft.text_ar ?? existing?.text_ar ?? '').trim() || null,
        source: (draft.source ?? existing?.source ?? '').trim() || null,
      };
      if (existing) {
        const { error } = await supabase
          .from('mosque_daily_quotes')
          .update({ text_en: payload.text_en, text_ar: payload.text_ar, source: payload.source })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('mosque_daily_quotes').insert(payload);
        if (error) throw error;
      }
      setDrafts((prev) => { const next = { ...prev }; delete next[date]; return next; });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save quote.');
    } finally {
      setSaving(null);
    }
  };

  const remove = async (date: string) => {
    const existing = quoteForDate(date);
    if (!existing) return;
    Alert.alert('Remove quote', `Remove the quote for ${formatDateLabel(date)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          setSaving(date);
          try {
            const { error } = await supabase.from('mosque_daily_quotes').delete().eq('id', existing.id);
            if (error) throw error;
            setDrafts((prev) => { const next = { ...prev }; delete next[date]; return next; });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not remove quote.');
          } finally {
            setSaving(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={tokens.color.text.primary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Daily Quotes</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {selectedMosque?.name ?? 'No mosque selected'}
          </Text>
        </View>
      </View>

      {!mosqueId ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No mosque selected. Return to admin home and select a mosque.</Text>
        </View>
      ) : loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={tokens.color.text.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            Set a spiritual reflection for each day. Followers see it on their home screen under &ldquo;Daily Reflection&rdquo;.
          </Text>

          {days.map((date) => {
            const existing = quoteForDate(date);
            const draft = draftFor(date);
            const isSaving = saving === date;
            const isDirty = Object.keys(draft).length > 0;
            const displayText = draft.text_en ?? existing?.text_en ?? '';
            const displayAr = draft.text_ar ?? existing?.text_ar ?? '';
            const displaySource = draft.source ?? existing?.source ?? '';

            return (
              <View key={date} style={[styles.dayCard, existing && styles.dayCardSet]}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayLabelRow}>
                    <Text style={styles.dayLabel}>{formatDateLabel(date)}</Text>
                    <Text style={styles.dayDate}>{date}</Text>
                  </View>
                  {existing ? (
                    <Pressable onPress={() => remove(date)} hitSlop={8} disabled={isSaving}>
                      <Ionicons name="trash-outline" size={17} color="#EF4444" />
                    </Pressable>
                  ) : null}
                </View>

                {/* English quote */}
                <Text style={styles.fieldLabel}>Quote (English) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. The best of you are those who learn the Quran and teach it."
                  placeholderTextColor="#94A3B8"
                  value={displayText}
                  onChangeText={(v) => setDraft(date, { text_en: v })}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Arabic (optional) */}
                <Text style={styles.fieldLabel}>Arabic text (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputArabic]}
                  placeholder="النص بالعربية (اختياري)"
                  placeholderTextColor="#94A3B8"
                  value={displayAr}
                  onChangeText={(v) => setDraft(date, { text_ar: v })}
                  multiline
                  textAlign="right"
                />

                {/* Source */}
                <Text style={styles.fieldLabel}>Source (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Sahih al-Bukhari · Surah Al-Baqarah 2:286"
                  placeholderTextColor="#94A3B8"
                  value={displaySource}
                  onChangeText={(v) => setDraft(date, { source: v })}
                />

                <Pressable
                  onPress={() => save(date)}
                  disabled={isSaving || (!isDirty && !!existing)}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    (isSaving || (!isDirty && !!existing)) && styles.saveBtnDisabled,
                    pressed && styles.saveBtnPressed,
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {existing ? (isDirty ? 'Save Changes' : 'Saved') : 'Save Quote'}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: tokens.color.bg.surface,
    borderBottomWidth: 1, borderBottomColor: tokens.color.border.subtle,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: tokens.color.text.primary },
  headerSub: { fontSize: 13, color: tokens.color.text.secondary, marginTop: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: tokens.color.text.secondary, textAlign: 'center', lineHeight: 22 },

  body: { padding: 20, gap: 14, paddingBottom: 48 },
  hint: {
    fontSize: 13, color: tokens.color.text.secondary, lineHeight: 20,
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE',
  },

  dayCard: {
    backgroundColor: tokens.color.bg.surface, borderRadius: 16,
    padding: 16, gap: 8,
    borderWidth: 1, borderColor: tokens.color.border.subtle,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  dayCardSet: { borderColor: '#FDE68A', backgroundColor: '#FFFBF2' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  dayLabelRow: { gap: 4 },
  dayLabel: { fontSize: 15, fontWeight: '800', color: tokens.color.text.primary },
  dayDate: { fontSize: 11, color: tokens.color.text.muted, fontWeight: '600' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: tokens.color.border.muted,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: tokens.color.text.primary,
    backgroundColor: '#F8FAFC', minHeight: 42,
  },
  inputArabic: { fontWeight: '500', fontSize: 15 },

  saveBtn: {
    backgroundColor: '#0F172A', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: '#E2E8F0' },
  saveBtnPressed: { opacity: 0.88 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
