import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components/ui/app-text';
import { tokens } from '@/theme/tokens';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { supabase } from '@/lib/supabase';

type Status = 'draft' | 'published' | 'cancelled';

const STATUS_OPTIONS: { key: Status; label: string; color: string; bg: string }[] = [
  { key: 'draft',     label: 'Draft',     color: '#475569', bg: '#F1F5F9' },
  { key: 'published', label: 'Published', color: '#059669', bg: '#ECFDF5' },
  { key: 'cancelled', label: 'Cancelled', color: '#DC2626', bg: '#FEF2F2' },
];

export default function AdminEventForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedMosque } = useAdminMosque();
  const isNew = !id || id === 'new';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [dateTime, setDateTime] = useState<Date | null>(null);
  const [status, setStatus] = useState<Status>('published');
  const [isPublic, setIsPublic] = useState(true);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('events')
        .select('id,title,description,location,capacity,start_at,status,is_public')
        .eq('id', id)
        .maybeSingle();
      if (e) throw e;
      if (data) {
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setLocation(data.location ?? '');
        setCapacity(data.capacity != null ? String(data.capacity) : '');
        setDateTime(data.start_at ? new Date(data.start_at) : null);
        setStatus((data.status as Status) ?? 'published');
        setIsPublic(data.is_public !== false);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load event.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!selectedMosque && isNew) { setError('No mosque selected.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        capacity: capacity.trim() ? parseInt(capacity.trim(), 10) : null,
        start_at: dateTime ? dateTime.toISOString() : null,
        status,
        is_public: isPublic,
      };
      if (isNew) {
        payload.mosque_id = selectedMosque!.mosqueId;
        const { error: e } = await supabase.from('events').insert(payload);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('events').update(payload).eq('id', id!);
        if (e) throw e;
      }
      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'This will permanently delete the event and remove it from the mosque page.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error: e } = await supabase.from('events').delete().eq('id', id!);
              if (e) throw e;
              router.back();
            } catch (err: any) {
              setError(err?.message ?? 'Delete failed.');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const openPicker = (mode: 'date' | 'time') => {
    if (!dateTime) setDateTime(new Date());
    setPickerMode(mode);
    if (Platform.OS === 'android') {
      setShowDatePicker(mode === 'date');
      setShowTimePicker(mode === 'time');
    } else {
      setShowDatePicker(true);
    }
  };

  const onPickerChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
    if (selected) setDateTime(selected);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.centered}><ActivityIndicator color={tokens.color.status.info} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.navBack, pressed && styles.pressed]} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={tokens.color.text.primary} />
          </Pressable>
          <AppText variant="sectionTitle" style={styles.navTitle}>{isNew ? 'New Event' : 'Edit Event'}</AppText>
          <View style={styles.navRight} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={16} color={tokens.color.status.danger} />
              <AppText variant="caption" color={tokens.color.status.danger} style={{ flex: 1 }}>{error}</AppText>
            </View>
          )}

          {/* Title */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>TITLE</AppText>
            <View style={styles.fieldCard}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Eid Prayer &amp; Celebration"
                placeholderTextColor={tokens.color.text.muted}
                maxLength={120}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>DESCRIPTION</AppText>
            <View style={styles.fieldCard}>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add details about the event..."
                placeholderTextColor={tokens.color.text.muted}
                multiline
                numberOfLines={4}
                maxLength={1000}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>DATE &amp; TIME</AppText>
            <View style={styles.fieldCard}>
              <Pressable
                onPress={() => openPicker('date')}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Ionicons name="calendar-outline" size={18} color={tokens.color.text.secondary} />
                <AppText variant="body" style={[styles.rowLabel, !dateTime && styles.placeholder]}>
                  {dateTime
                    ? dateTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Set date'}
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
              </Pressable>
              <View style={styles.rowDivider} />
              <Pressable
                onPress={() => openPicker('time')}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Ionicons name="time-outline" size={18} color={tokens.color.text.secondary} />
                <AppText variant="body" style={[styles.rowLabel, !dateTime && styles.placeholder]}>
                  {dateTime
                    ? dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Set time'}
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
              </Pressable>
            </View>
          </View>

          {Platform.OS === 'ios' && showDatePicker && (
            <View style={styles.inlinePicker}>
              <DateTimePicker
                value={dateTime ?? new Date()}
                mode={pickerMode}
                display="spinner"
                onChange={onPickerChange}
              />
              <Pressable onPress={() => setShowDatePicker(false)} style={styles.pickerDone}>
                <AppText style={styles.pickerDoneText}>Done</AppText>
              </Pressable>
            </View>
          )}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker value={dateTime ?? new Date()} mode="date" onChange={onPickerChange} />
          )}
          {Platform.OS === 'android' && showTimePicker && (
            <DateTimePicker value={dateTime ?? new Date()} mode="time" onChange={onPickerChange} />
          )}

          {/* Location & Capacity */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>DETAILS</AppText>
            <View style={styles.fieldCard}>
              <View style={styles.row}>
                <Ionicons name="location-outline" size={18} color={tokens.color.text.secondary} />
                <TextInput
                  style={[styles.input, styles.rowInput]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Location (optional)"
                  placeholderTextColor={tokens.color.text.muted}
                  maxLength={200}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.rowDivider} />
              <View style={styles.row}>
                <Ionicons name="people-outline" size={18} color={tokens.color.text.secondary} />
                <TextInput
                  style={[styles.input, styles.rowInput]}
                  value={capacity}
                  onChangeText={setCapacity}
                  placeholder="Capacity (optional)"
                  placeholderTextColor={tokens.color.text.muted}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                />
              </View>
            </View>
          </View>

          {/* Visibility */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>VISIBILITY</AppText>
            <View style={styles.fieldCard}>
              <View style={styles.row}>
                <Ionicons name="eye-outline" size={18} color={tokens.color.text.secondary} />
                <AppText variant="body" style={styles.rowLabel}>Show on mosque page</AppText>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }}
                  thumbColor={isPublic ? '#2563EB' : '#9CA3AF'}
                />
              </View>
            </View>
          </View>

          {/* Status */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>STATUS</AppText>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setStatus(opt.key)}
                    style={({ pressed }) => [
                      styles.statusPill,
                      active && { backgroundColor: opt.bg, borderColor: opt.color },
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppText style={[styles.statusLabel, active && { color: opt.color, fontWeight: tokens.typography.weight.bold }]}>
                      {opt.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, saving && styles.btnDisabled]}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <AppText style={styles.saveBtnText}>{isNew ? 'Create Event' : 'Save Changes'}</AppText>
            }
          </Pressable>

          {!isNew && (
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed, deleting && styles.btnDisabled]}
            >
              {deleting
                ? <ActivityIndicator color={tokens.color.status.danger} />
                : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="trash-outline" size={16} color={tokens.color.status.danger} />
                    <AppText style={styles.deleteBtnText}>Delete Event</AppText>
                  </View>
                )
              }
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    gap: 12,
  },
  navBack: { padding: 4 },
  navTitle: { flex: 1, fontSize: 20, fontWeight: tokens.typography.weight.extrabold },
  navRight: { width: 28 },

  body: { padding: tokens.spacing.lg, gap: tokens.spacing.lg, paddingBottom: 48 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  section: { gap: 6 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.muted,
    paddingLeft: 4,
  },

  fieldCard: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    overflow: 'hidden',
  },
  input: {
    fontSize: 15,
    color: tokens.color.text.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontWeight: tokens.typography.weight.medium,
  },
  multiline: { minHeight: 96, paddingTop: 14 },
  rowInput: { flex: 1, paddingLeft: 10, paddingRight: 16, paddingVertical: 14 },
  placeholder: { color: tokens.color.text.muted },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: tokens.typography.weight.medium, color: tokens.color.text.primary },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.color.border.subtle, marginLeft: 16 },

  inlinePicker: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    overflow: 'hidden',
  },
  pickerDone: { alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border.subtle },
  pickerDoneText: { color: '#2563EB', fontSize: 15, fontWeight: tokens.typography.weight.bold },

  statusRow: { flexDirection: 'row', gap: 8 },
  statusPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    backgroundColor: tokens.color.bg.surface,
    alignItems: 'center',
  },
  statusLabel: { fontSize: tokens.typography.size.sm, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.secondary },

  saveBtn: {
    height: 52,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: tokens.typography.weight.bold },
  deleteBtn: {
    height: 48,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: tokens.color.status.danger, fontSize: 15, fontWeight: tokens.typography.weight.semibold },
  btnDisabled: { opacity: 0.55 },
});
