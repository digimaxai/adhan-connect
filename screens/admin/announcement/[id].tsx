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

type Status = 'draft' | 'published';

const STATUS_OPTIONS: { key: Status; label: string; description: string; color: string; bg: string }[] = [
  { key: 'published', label: 'Published', description: 'Visible to mosque followers', color: '#059669', bg: '#ECFDF5' },
  { key: 'draft',     label: 'Draft',     description: 'Hidden until published',      color: '#475569', bg: '#F1F5F9' },
];

export default function AdminAnnouncementForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedMosque } = useAdminMosque();
  const isNew = !id || id === 'new';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<Status>('published');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('announcements')
        .select('id,title,summary,status,is_urgent,is_pinned')
        .eq('id', id)
        .maybeSingle();
      if (e) throw e;
      if (data) {
        setTitle(data.title ?? '');
        setBody(data.summary ?? '');
        setStatus((data.status as Status) ?? 'published');
        setIsUrgent(data.is_urgent ?? false);
        setIsPinned(data.is_pinned ?? false);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load announcement.');
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
        summary: body.trim() || null,
        status,
        is_urgent: isUrgent,
        is_pinned: isPinned,
      };
      if (isNew) {
        payload.mosque_id = selectedMosque!.mosqueId;
        const { error: e } = await supabase.from('announcements').insert(payload);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('announcements').update(payload).eq('id', id!);
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
      'Delete Notice',
      'This will permanently remove the announcement from the mosque page.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error: e } = await supabase.from('announcements').delete().eq('id', id!);
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
          <AppText variant="sectionTitle" style={styles.navTitle}>{isNew ? 'New Notice' : 'Edit Notice'}</AppText>
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
                placeholder="e.g. Eid prayer time confirmed"
                placeholderTextColor={tokens.color.text.muted}
                maxLength={120}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Body */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>MESSAGE</AppText>
            <View style={styles.fieldCard}>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={body}
                onChangeText={setBody}
                placeholder="Write the full announcement here..."
                placeholderTextColor={tokens.color.text.muted}
                multiline
                numberOfLines={5}
                maxLength={2000}
                textAlignVertical="top"
              />
            </View>
            <AppText variant="caption" color={tokens.color.text.muted} style={styles.charCount}>
              {body.length} / 2000
            </AppText>
          </View>

          {/* Options */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>OPTIONS</AppText>
            <View style={styles.fieldCard}>
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <View style={[styles.switchDot, { backgroundColor: '#DC2626' }]} />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.switchLabel}>Mark as Urgent</AppText>
                    <AppText variant="caption" color={tokens.color.text.muted} style={styles.switchDesc}>
                      Highlights notice in red on the mosque page
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={isUrgent}
                  onValueChange={setIsUrgent}
                  trackColor={{ false: tokens.color.border.subtle, true: '#FECACA' }}
                  thumbColor={isUrgent ? '#DC2626' : tokens.color.bg.surface}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <View style={[styles.switchDot, { backgroundColor: '#D97706' }]} />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.switchLabel}>Pin to Top</AppText>
                    <AppText variant="caption" color={tokens.color.text.muted} style={styles.switchDesc}>
                      Always shown at the top of announcements
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={isPinned}
                  onValueChange={setIsPinned}
                  trackColor={{ false: tokens.color.border.subtle, true: '#FDE68A' }}
                  thumbColor={isPinned ? '#D97706' : tokens.color.bg.surface}
                />
              </View>
            </View>
          </View>

          {/* Visibility */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>VISIBILITY</AppText>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setStatus(opt.key)}
                    style={({ pressed }) => [
                      styles.statusCard,
                      active && { borderColor: opt.color, backgroundColor: opt.bg },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.statusCardHeader}>
                      <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                      <AppText style={[styles.statusLabel, active && { color: opt.color }]}>{opt.label}</AppText>
                      {active && <Ionicons name="checkmark-circle" size={16} color={opt.color} style={{ marginLeft: 'auto' }} />}
                    </View>
                    <AppText variant="caption" color={tokens.color.text.muted} style={styles.statusDesc}>{opt.description}</AppText>
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
              : <AppText style={styles.saveBtnText}>{isNew ? 'Post Notice' : 'Save Changes'}</AppText>
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
                    <AppText style={styles.deleteBtnText}>Delete Notice</AppText>
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
  charCount: { textAlign: 'right', paddingRight: 4 },

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
  multiline: { minHeight: 120, paddingTop: 14 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  switchInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchDot: { width: 10, height: 10, borderRadius: 5 },
  switchLabel: { fontSize: 15, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  switchDesc: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: tokens.color.border.subtle, marginHorizontal: 16 },

  statusRow: { flexDirection: 'row', gap: 10 },
  statusCard: {
    flex: 1,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1.5,
    borderColor: tokens.color.border.subtle,
    padding: 14,
    gap: 6,
  },
  statusCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 14, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  statusDesc: { fontSize: 12 },

  saveBtn: {
    height: 52,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#7C3AED',
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
