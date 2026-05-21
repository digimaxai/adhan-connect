import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../lib/auth';
import {
  crowdState,
  formatJumuahTime,
  isFridayToday,
  JumuahIntent,
  JumuahSlot,
  JumuahSummary,
  legacyJumuahSlot,
  nextFridayDate,
  summaryFromRows,
  intentsFromRows,
} from '../../../lib/jumuah';
import { supabase } from '../../../lib/supabase';

type Mosque = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  jumuah1_time?: string | null;
  jumuah2_time?: string | null;
  slug?: string | null;
};

const PARTY_SIZES = [1, 2, 3];

function isUuid(value?: string | null) {
  return !!value && /^[0-9a-fA-F-]{36}$/.test(value);
}

function locationLabel(mosque: Mosque | null) {
  return [mosque?.city, mosque?.country].filter(Boolean).join(', ');
}

function fridayDisplayLabel() {
  const friday = nextFridayDate();
  return new Date(`${friday}T12:00:00`).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function applyIntentDeltas(
  summary: Record<string, JumuahSummary>,
  before: Record<string, number>,
  after: Record<string, number>
) {
  const next = { ...summary };
  const changedSlotIds = new Set([...Object.keys(before), ...Object.keys(after)]);

  changedSlotIds.forEach((slotId) => {
    const oldSize = before[slotId] ?? 0;
    const newSize = after[slotId] ?? 0;
    if (oldSize === newSize) return;

    const current = next[slotId] ?? { slot_id: slotId, attendee_count: 0, household_count: 0 };
    next[slotId] = {
      ...current,
      attendee_count: Math.max(0, (current.attendee_count ?? 0) + newSize - oldSize),
      household_count: Math.max(0, (current.household_count ?? 0) + (newSize ? 1 : 0) - (oldSize ? 1 : 0)),
    };
  });

  return next;
}

export default function JumuahDetailScreen() {
  const { id, name: nameParam } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [slots, setSlots] = useState<JumuahSlot[]>([]);
  const [structuredSlotCount, setStructuredSlotCount] = useState(0);
  const [summary, setSummary] = useState<Record<string, JumuahSummary>>({});
  const [intents, setIntents] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const selectCols = 'id,name,city,country,jumuah1_time,jumuah2_time,slug';
        let base: Mosque | null = null;

        if (isUuid(id)) {
          const { data, error: mosqueError } = await supabase.from('mosques').select(selectCols).eq('id', id).maybeSingle();
          if (mosqueError) throw mosqueError;
          base = (data as Mosque | null) ?? null;
        }

        if (!base) {
          const lookup = nameParam ?? id;
          const { data, error: lookupError } = await supabase
            .from('mosques')
            .select(selectCols)
            .or(`slug.eq.${lookup},name.ilike.%${lookup}%`)
            .limit(1)
            .maybeSingle();
          if (lookupError) throw lookupError;
          base = (data as Mosque | null) ?? null;
        }

        if (!base?.id) throw new Error('Unable to find this mosque.');

        const { data: slotRows, error: slotError } = await supabase
          .from('mosque_jumuah_slots')
          .select('id,label,khutbah_at,salah_at,venue,language,imam,capacity,notes')
          .eq('mosque_id', base.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('salah_at', { ascending: true });
        if (slotError) throw slotError;

        const structuredSlots = Array.isArray(slotRows) ? (slotRows as JumuahSlot[]) : [];
        const fallbackSlots = [base.jumuah1_time, base.jumuah2_time]
          .filter(Boolean)
          .map((time, index) => legacyJumuahSlot(base.id, time as string, index));
        const displaySlots = structuredSlots.length ? structuredSlots : fallbackSlots;

        let summaryMap: Record<string, JumuahSummary> = {};
        let intentMap: Record<string, number> = {};

        if (structuredSlots.length) {
          const slotIds = structuredSlots.map((slot) => slot.id);
          const fridayDate = nextFridayDate();
          const [summaryRes, intentRes] = await Promise.all([
            supabase
              .from('jumuah_slot_attendance_summary')
              .select('slot_id,attendee_count,household_count')
              .eq('friday_date', fridayDate)
              .in('slot_id', slotIds),
            userId
              ? supabase
                  .from('jumuah_attendance_intents')
                  .select('slot_id,party_size')
                  .eq('mosque_id', base.id)
                  .eq('user_id', userId)
                  .eq('friday_date', fridayDate)
                  .in('slot_id', slotIds)
              : Promise.resolve({ data: [] as JumuahIntent[] }),
          ]);
          summaryMap = summaryFromRows(summaryRes.data as JumuahSummary[]);
          intentMap = intentsFromRows(intentRes.data as JumuahIntent[]);
        }

        if (!cancelled) {
          setMosque(base);
          setSlots(displaySlots);
          setStructuredSlotCount(structuredSlots.length);
          setSummary(summaryMap);
          setIntents(intentMap);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Unable to load Jumuah times.');
          setMosque(null);
          setSlots([]);
          setStructuredSlotCount(0);
          setSummary({});
          setIntents({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, nameParam, userId]);

  const fridayLabel = useMemo(() => fridayDisplayLabel(), []);
  const mosqueLocation = useMemo(() => locationLabel(mosque), [mosque]);
  const hasStructuredSlots = structuredSlotCount > 0;

  const handleIntent = async (slot: JumuahSlot, partySize: number | null) => {
    if (slot.id.startsWith('legacy-')) return;
    if (!mosque?.id || !userId || savingSlotId) {
      if (!userId) Alert.alert('Sign in required', 'Sign in to mark which Jumuah prayer you plan to attend.');
      return;
    }

    const before = intents;
    const previousForSlot = before[slot.id] ?? 0;
    const currentCount = summary[slot.id]?.attendee_count ?? 0;

    if (partySize && slot.capacity && currentCount - previousForSlot + partySize > slot.capacity) {
      Alert.alert('This time is full', 'Please choose another Jumuah time if one is available.');
      return;
    }

    const after: Record<string, number> = {};
    if (partySize) after[slot.id] = partySize;
    else {
      Object.entries(before).forEach(([slotId, size]) => {
        if (slotId !== slot.id) after[slotId] = size;
      });
    }

    setSavingSlotId(slot.id);
    setIntents(after);
    setSummary((prev) => applyIntentDeltas(prev, before, after));

    try {
      const fridayDate = nextFridayDate();
      if (partySize) {
        const { error: upsertError } = await supabase.from('jumuah_attendance_intents').upsert(
          {
            mosque_id: mosque.id,
            slot_id: slot.id,
            user_id: userId,
            friday_date: fridayDate,
            party_size: partySize,
          },
          { onConflict: 'mosque_id,user_id,friday_date' }
        );
        if (upsertError) throw upsertError;
      } else {
        const { error: deleteError } = await supabase
          .from('jumuah_attendance_intents')
          .delete()
          .eq('slot_id', slot.id)
          .eq('user_id', userId)
          .eq('friday_date', fridayDate);
        if (deleteError) throw deleteError;
      }
    } catch (err: any) {
      setIntents(before);
      setSummary((prev) => applyIntentDeltas(prev, after, before));
      Alert.alert('Could not save your plan', err?.message ?? 'Please try again.');
    } finally {
      setSavingSlotId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </Pressable>
          <Text style={styles.navTitle}>{"Jumu'ah"}</Text>
          <View style={styles.navSpacer} />
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#0EA5E9" />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Unable to load times</Text>
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{mosque?.name ?? nameParam ?? 'Mosque'}</Text>
              {mosqueLocation ? <Text style={styles.location}>{mosqueLocation}</Text> : null}
              <View style={styles.datePill}>
                <Ionicons name="calendar-outline" size={15} color="#0369A1" />
                <Text style={styles.datePillText}>{isFridayToday() ? 'Today' : fridayLabel}</Text>
              </View>
            </View>

            {slots.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{"No Jumu'ah times listed"}</Text>
                <Text style={styles.muted}>This mosque has not published Friday prayer times yet.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Choose a time</Text>
                    <Text style={styles.cardSubtitle}>One plan per Friday. You can change it any time.</Text>
                  </View>
                </View>

                {slots.map((slot, index) => {
                  const isLegacy = slot.id.startsWith('legacy-');
                  const count = summary[slot.id]?.attendee_count ?? 0;
                  const selectedParty = intents[slot.id] ?? 0;
                  const crowd = crowdState(count, slot.capacity);
                  const remaining = slot.capacity ? Math.max(0, slot.capacity - count) : null;
                  const progress = slot.capacity ? Math.min(100, Math.round((count / slot.capacity) * 100)) : 0;

                  return (
                    <View key={slot.id} style={[styles.slotRow, index === slots.length - 1 && styles.lastSlotRow]}>
                      <View style={styles.slotTop}>
                        <View style={styles.timeBox}>
                          <Text style={styles.time}>{formatJumuahTime(slot.salah_at) ?? '--:--'}</Text>
                          {slot.khutbah_at ? <Text style={styles.khutbah}>Khutbah {formatJumuahTime(slot.khutbah_at)}</Text> : null}
                        </View>

                        <View style={styles.slotBody}>
                          <View style={styles.slotTitleRow}>
                            <Text style={styles.slotTitle} numberOfLines={1}>{slot.label ?? "Jumu'ah"}</Text>
                            {!isLegacy ? (
                              <View
                                style={[
                                  styles.crowdPill,
                                  crowd.tone === 'danger'
                                    ? styles.crowdDanger
                                    : crowd.tone === 'warning'
                                    ? styles.crowdWarning
                                    : crowd.tone === 'busy'
                                    ? styles.crowdBusy
                                    : crowd.tone === 'calm'
                                    ? styles.crowdCalm
                                    : styles.crowdNeutral,
                                ]}
                              >
                                <Text style={styles.crowdText}>{crowd.label}</Text>
                              </View>
                            ) : null}
                          </View>

                          {[slot.venue, slot.language, slot.imam].filter(Boolean).length ? (
                            <Text style={styles.meta} numberOfLines={1}>{[slot.venue, slot.language, slot.imam].filter(Boolean).join(' / ')}</Text>
                          ) : null}
                          {slot.notes ? <Text style={styles.notes} numberOfLines={2}>{slot.notes}</Text> : null}

                          {!isLegacy ? (
                            <>
                              <View style={styles.capacityRow}>
                                <Text style={styles.capacityText}>
                                  {count} planning{slot.capacity ? ` / ${slot.capacity} capacity` : ''}
                                </Text>
                                {remaining !== null ? <Text style={styles.capacityText}>{remaining} spaces left</Text> : null}
                              </View>
                              {slot.capacity ? (
                                <View style={styles.progressTrack}>
                                  <View
                                    style={[
                                      styles.progressFill,
                                      crowd.tone === 'danger' && styles.progressDanger,
                                      { width: `${progress}%` },
                                    ]}
                                  />
                                </View>
                              ) : null}

                              <View style={styles.partyRow}>
                                {PARTY_SIZES.map((size) => {
                                  const projectedCount = count - selectedParty + size;
                                  const overCapacity = !!slot.capacity && projectedCount > slot.capacity && selectedParty !== size;
                                  const disabled = savingSlotId === slot.id || overCapacity;
                                  return (
                                    <Pressable
                                      key={size}
                                      disabled={disabled}
                                      onPress={() => handleIntent(slot, size)}
                                      style={({ pressed }) => [
                                        styles.partyChip,
                                        selectedParty === size && styles.partyChipActive,
                                        disabled && styles.partyChipDisabled,
                                        pressed && styles.pressed,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.partyChipText,
                                          selectedParty === size && styles.partyChipTextActive,
                                          disabled && styles.partyChipTextDisabled,
                                        ]}
                                      >
                                        {size === 1 ? 'Me' : `+${size - 1}`}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                                {selectedParty ? (
                                  <Pressable onPress={() => handleIntent(slot, null)} disabled={savingSlotId === slot.id} hitSlop={8}>
                                    <Text style={styles.clearText}>Clear</Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            </>
                          ) : (
                            <Text style={styles.mutedSmall}>{"Attendance planning appears when this mosque adds structured Jumu'ah slots."}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {hasStructuredSlots ? (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color="#0369A1" />
                <Text style={styles.infoText}>This helps the mosque estimate crowding. It does not reserve a seat.</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  nav: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  navSpacer: { width: 40 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 6, paddingBottom: 2 },
  title: { color: '#0F172A', fontSize: 26, fontWeight: '900' },
  location: { color: '#475569', fontSize: 14 },
  datePill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E0F2FE',
  },
  datePillText: { color: '#0369A1', fontSize: 12, fontWeight: '900' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  cardSubtitle: { color: '#64748B', fontSize: 12, marginTop: 3 },
  slotRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  lastSlotRow: { borderBottomWidth: 0, paddingBottom: 2 },
  slotTop: { flexDirection: 'row', gap: 12 },
  timeBox: { width: 76, gap: 3 },
  time: { color: '#0F172A', fontSize: 20, fontWeight: '900' },
  khutbah: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  slotBody: { flex: 1, gap: 7 },
  slotTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  slotTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900', flex: 1 },
  meta: { color: '#475569', fontSize: 12 },
  notes: { color: '#475569', fontSize: 12, lineHeight: 17 },
  crowdPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  crowdText: { color: '#0F172A', fontSize: 11, fontWeight: '900' },
  crowdNeutral: { backgroundColor: '#F1F5F9' },
  crowdCalm: { backgroundColor: '#DCFCE7' },
  crowdBusy: { backgroundColor: '#FEF3C7' },
  crowdWarning: { backgroundColor: '#FED7AA' },
  crowdDanger: { backgroundColor: '#FECACA' },
  capacityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  capacityText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#0EA5E9' },
  progressDanger: { backgroundColor: '#DC2626' },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  partyChip: {
    minWidth: 48,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  partyChipActive: { backgroundColor: '#E0F2FE', borderColor: '#0EA5E9' },
  partyChipDisabled: { opacity: 0.42 },
  partyChipText: { color: '#334155', fontSize: 12, fontWeight: '900' },
  partyChipTextActive: { color: '#0369A1' },
  partyChipTextDisabled: { color: '#94A3B8' },
  clearText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  muted: { color: '#64748B', fontSize: 13, lineHeight: 19 },
  mutedSmall: { color: '#64748B', fontSize: 12, lineHeight: 17 },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'flex-start',
  },
  infoText: { color: '#075985', fontSize: 12, lineHeight: 17, flex: 1, fontWeight: '700' },
  pressed: { opacity: 0.86 },
});
