import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/app-text';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { supabase } from '@/lib/supabase';
import { tokens } from '@/theme/tokens';

type SlotForm = {
  id?: string;
  label: string;
  khutbahAt: string;
  salahAt: string;
  venue: string;
  language: string;
  imam: string;
  capacity: string;
  notes: string;
  isActive: boolean;
  sortOrder: number;
  isNew?: boolean;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function blankSlot(index: number): SlotForm {
  return {
    label: `Jumu'ah ${index + 1}`,
    khutbahAt: '',
    salahAt: '',
    venue: '',
    language: '',
    imam: '',
    capacity: '',
    notes: '',
    isActive: true,
    sortOrder: index,
    isNew: true,
  };
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const compact = trimmed.replace('.', ':');
  if (/^\d{1,2}$/.test(compact)) return `${compact.padStart(2, '0')}:00`;
  const match = compact.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return compact;
  return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
}

function timeForInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 5);
}

function toDbTime(value: string) {
  const normalized = normalizeTime(value);
  return normalized ? `${normalized}:00` : null;
}

export default function AdminJumuahScreen() {
  const router = useRouter();
  const { selectedMosque, loading: mosqueLoading } = useAdminMosque();
  const [slots, setSlots] = useState<SlotForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mosqueId = selectedMosque?.mosqueId ?? null;

  const load = useCallback(async () => {
    if (!mosqueId) {
      setSlots([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('mosque_jumuah_slots')
        .select('id,label,khutbah_at,salah_at,venue,language,imam,capacity,notes,is_active,sort_order')
        .eq('mosque_id', mosqueId)
        .order('sort_order', { ascending: true })
        .order('salah_at', { ascending: true });
      if (e) throw e;
      setSlots(
        (data ?? []).map((row: any, index) => ({
          id: row.id,
          label: row.label ?? `Jumu'ah ${index + 1}`,
          khutbahAt: timeForInput(row.khutbah_at),
          salahAt: timeForInput(row.salah_at),
          venue: row.venue ?? '',
          language: row.language ?? '',
          imam: row.imam ?? '',
          capacity: row.capacity != null ? String(row.capacity) : '',
          notes: row.notes ?? '',
          isActive: row.is_active !== false,
          sortOrder: row.sort_order ?? index,
        }))
      );
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load Jumuah slots.');
    } finally {
      setLoading(false);
    }
  }, [mosqueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => slots.filter((slot) => slot.isActive).length, [slots]);

  const updateSlot = (index: number, patch: Partial<SlotForm>) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const addSlot = () => setSlots((prev) => [...prev, blankSlot(prev.length)]);

  const moveSlot = (index: number, delta: -1 | 1) => {
    setSlots((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((slot, i) => ({ ...slot, sortOrder: i }));
    });
  };

  const removeSlot = (index: number) => {
    const slot = slots[index];
    if (!slot.id) {
      setSlots((prev) => prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, sortOrder: i })));
      return;
    }
    Alert.alert(
      'Remove Jumuah slot',
      'This removes the slot and its planning counts. Mark it inactive instead if this is a temporary change.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            setError(null);
            try {
              const { error: e } = await supabase.from('mosque_jumuah_slots').delete().eq('id', slot.id);
              if (e) throw e;
              setSlots((prev) => prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, sortOrder: i })));
            } catch (err: any) {
              setError(err?.message ?? 'Unable to remove slot.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const validate = () => {
    for (const [index, slot] of slots.entries()) {
      const label = slot.label.trim() || `Slot ${index + 1}`;
      const khutbah = normalizeTime(slot.khutbahAt);
      const salah = normalizeTime(slot.salahAt);
      if (!salah || !TIME_RE.test(salah)) return `${label}: enter a Salah time as HH:MM.`;
      if (khutbah && !TIME_RE.test(khutbah)) return `${label}: enter a Khutbah time as HH:MM.`;
      const capacity = slot.capacity.trim();
      if (capacity && (!/^\d+$/.test(capacity) || Number(capacity) <= 0)) {
        return `${label}: capacity must be a whole number.`;
      }
    }
    return null;
  };

  const save = async () => {
    if (!mosqueId || saving) return;
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      for (const [index, slot] of slots.entries()) {
        const payload = {
          mosque_id: mosqueId,
          label: slot.label.trim() || `Jumu'ah ${index + 1}`,
          khutbah_at: toDbTime(slot.khutbahAt),
          salah_at: toDbTime(slot.salahAt),
          venue: slot.venue.trim() || null,
          language: slot.language.trim() || null,
          imam: slot.imam.trim() || null,
          capacity: slot.capacity.trim() ? Number(slot.capacity.trim()) : null,
          notes: slot.notes.trim() || null,
          is_active: slot.isActive,
          sort_order: index,
        };
        if (slot.id) {
          const { error: e } = await supabase.from('mosque_jumuah_slots').update(payload).eq('id', slot.id);
          if (e) throw e;
        } else {
          const { data, error: e } = await supabase.from('mosque_jumuah_slots').insert(payload).select('id').single();
          if (e) throw e;
          slot.id = data?.id;
        }
      }
      setNotice('Jumuah slots saved.');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Unable to save Jumuah slots.');
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (mosqueLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.centered}><ActivityIndicator color={tokens.color.status.info} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.push('/(admin)' as any)} style={({ pressed }) => [styles.navBack, pressed && styles.pressed]} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={tokens.color.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="sectionTitle" style={styles.navTitle}>Jumuah</AppText>
          {selectedMosque ? (
            <AppText variant="caption" color={tokens.color.text.secondary} numberOfLines={1}>{selectedMosque.name}</AppText>
          ) : null}
        </View>
        <Pressable onPress={addSlot} disabled={!mosqueId} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed, !mosqueId && styles.disabled]}>
          <Ionicons name="add" size={16} color="#fff" />
          <AppText style={styles.addBtnText}>Slot</AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tokens.color.status.info} />}
      >
        {!mosqueId ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={28} color={tokens.color.text.muted} />
            <AppText variant="body" color={tokens.color.text.secondary} style={styles.centerText}>
              Select a mosque in the console to manage Friday prayer slots.
            </AppText>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={tokens.color.status.danger} />
            <AppText variant="caption" color={tokens.color.status.danger} style={{ flex: 1 }}>{error}</AppText>
          </View>
        ) : null}
        {notice ? (
          <View style={styles.noticeCard}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#047857" />
            <AppText variant="caption" style={styles.noticeText}>{notice}</AppText>
          </View>
        ) : null}

        <View style={styles.guidanceCard}>
          <AppText style={styles.guidanceTitle}>Capacity guidance, not ticketing</AppText>
          <AppText variant="caption" color={tokens.color.text.secondary} style={styles.guidanceText}>
            Followers can say they are planning to attend. Counts help you open overflow space or nudge people to quieter slots, but they do not reserve seats.
          </AppText>
        </View>

        {loading ? (
          <View style={styles.centeredInline}><ActivityIndicator color={tokens.color.status.info} /></View>
        ) : slots.length ? (
          slots.map((slot, index) => (
            <View key={slot.id ?? `new-${index}`} style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color={tokens.color.text.muted}>SLOT {index + 1}</AppText>
                  <TextInput
                    value={slot.label}
                    onChangeText={(value) => updateSlot(index, { label: value })}
                    placeholder={`Jumu'ah ${index + 1}`}
                    placeholderTextColor={tokens.color.text.muted}
                    style={styles.titleInput}
                  />
                </View>
                <View style={styles.headerActions}>
                  <Pressable onPress={() => moveSlot(index, -1)} disabled={index === 0} hitSlop={8} style={index === 0 && styles.disabled}>
                    <Ionicons name="chevron-up" size={18} color={tokens.color.text.secondary} />
                  </Pressable>
                  <Pressable onPress={() => moveSlot(index, 1)} disabled={index === slots.length - 1} hitSlop={8} style={index === slots.length - 1 && styles.disabled}>
                    <Ionicons name="chevron-down" size={18} color={tokens.color.text.secondary} />
                  </Pressable>
                  <Pressable onPress={() => removeSlot(index)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={tokens.color.status.danger} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.grid}>
                <Field label="Khutbah" value={slot.khutbahAt} onChangeText={(value) => updateSlot(index, { khutbahAt: value })} placeholder="13:15" />
                <Field label="Salah" value={slot.salahAt} onChangeText={(value) => updateSlot(index, { salahAt: value })} placeholder="13:30" required />
                <Field label="Capacity" value={slot.capacity} onChangeText={(value) => updateSlot(index, { capacity: value.replace(/[^0-9]/g, '') })} placeholder="250" keyboardType="number-pad" />
                <Field label="Venue" value={slot.venue} onChangeText={(value) => updateSlot(index, { venue: value })} placeholder="Main hall" />
                <Field label="Language" value={slot.language} onChangeText={(value) => updateSlot(index, { language: value })} placeholder="English" />
                <Field label="Imam" value={slot.imam} onChangeText={(value) => updateSlot(index, { imam: value })} placeholder="Optional" />
              </View>

              <View style={styles.notesBox}>
                <AppText variant="caption" color={tokens.color.text.muted}>NOTES</AppText>
                <TextInput
                  value={slot.notes}
                  onChangeText={(value) => updateSlot(index, { notes: value })}
                  placeholder="Parking, overflow, sisters' area, or arrival guidance"
                  placeholderTextColor={tokens.color.text.muted}
                  multiline
                  style={styles.notesInput}
                />
              </View>

              <View style={styles.activeRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.activeTitle}>Active this Friday</AppText>
                  <AppText variant="caption" color={tokens.color.text.secondary}>Turn off temporary slots without deleting them.</AppText>
                </View>
                <Switch
                  value={slot.isActive}
                  onValueChange={(value) => updateSlot(index, { isActive: value })}
                  trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }}
                  thumbColor={slot.isActive ? '#2563EB' : '#9CA3AF'}
                />
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={28} color={tokens.color.text.muted} />
            <AppText variant="body" color={tokens.color.text.secondary} style={styles.centerText}>
              Add your first Jumuah slot so followers can choose the prayer they plan to attend.
            </AppText>
          </View>
        )}

        {mosqueId ? (
          <Pressable onPress={save} disabled={saving || !slots.length} style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, (saving || !slots.length) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <AppText style={styles.saveBtnText}>{`Save ${activeCount} active slot${activeCount === 1 ? '' : 's'}`}</AppText>}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color={tokens.color.text.muted}>{label.toUpperCase()}{required ? ' *' : ''}</AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.text.muted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centeredInline: { paddingVertical: 32, alignItems: 'center' },
  centerText: { textAlign: 'center', lineHeight: 22 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  navBack: { padding: 4 },
  navTitle: { fontSize: 22, fontWeight: tokens.typography.weight.extrabold },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#2563EB',
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: tokens.typography.weight.bold },
  body: { padding: tokens.spacing.lg, gap: tokens.spacing.md, paddingBottom: 52 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  noticeText: { flex: 1, color: '#047857', fontWeight: tokens.typography.weight.semibold },
  guidanceCard: {
    gap: 4,
    padding: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  guidanceTitle: { color: '#1E3A8A', fontWeight: tokens.typography.weight.bold },
  guidanceText: { lineHeight: 18 },
  slotCard: {
    gap: 14,
    padding: 16,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    ...tokens.shadow.card,
  },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleInput: {
    paddingVertical: 4,
    color: tokens.color.text.primary,
    fontSize: 18,
    fontWeight: tokens.typography.weight.extrabold,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grid: { gap: 10 },
  field: {
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
  },
  input: { color: tokens.color.text.primary, fontSize: 15, fontWeight: tokens.typography.weight.semibold, paddingVertical: 2 },
  notesBox: {
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
  },
  notesInput: { minHeight: 56, color: tokens.color.text.primary, fontSize: 14, textAlignVertical: 'top' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeTitle: { fontSize: 15, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  saveBtn: {
    height: 52,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: tokens.typography.weight.bold },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
  },
});
