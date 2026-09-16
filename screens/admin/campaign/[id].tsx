import DateTimePicker from '@react-native-community/datetimepicker';
import { BackButton } from '@/components/ui/back-button';
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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components/ui/app-text';
import { ContentAttachmentsEditor } from '@/components/admin/ContentAttachmentsEditor';
import { tokens } from '@/theme/tokens';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { httpsUrl } from '@/lib/serviceListings';
import { supabase } from '@/lib/supabase';

type Status = 'active' | 'paused' | 'ended';

const STATUS_OPTIONS: { key: Status; label: string; description: string; color: string; bg: string }[] = [
  { key: 'active', label: 'Active',  description: 'Accepting donations',  color: '#059669', bg: '#ECFDF5' },
  { key: 'paused', label: 'Paused',  description: 'Temporarily on hold',  color: '#D97706', bg: '#FFFBEB' },
  { key: 'ended',  label: 'Ended',   description: 'Campaign closed',       color: '#475569', bg: '#F1F5F9' },
];

function returnToContentHub(router: ReturnType<typeof useRouter>) {
  router.replace({
    pathname: '/(admin)/events',
    params: { tab: 'campaigns', refresh: String(Date.now()) },
  } as any);
}

function fmtDate(d: Date | null) {
  if (!d) return 'Not set';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AdminCampaignForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedMosque, loading: mosqueLoading } = useAdminMosque();
  const isNew = !id || id === 'new';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [donationUrl, setDonationUrl] = useState('');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [status, setStatus] = useState<Status>('active');

  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew || !id) return;
    if (!selectedMosque) {
      if (!mosqueLoading) setError('No mosque selected.');
      setLoading(mosqueLoading);
      return;
    }
    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('campaigns')
        .select('id,mosque_id,title,description,donation_url,end_at,status')
        .eq('id', id)
        .eq('mosque_id', selectedMosque.mosqueId)
        .maybeSingle();
      if (e) throw e;
      if (!data) {
        setError('Campaign not found for the selected mosque.');
      } else {
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setDonationUrl(data.donation_url ?? '');
        setEndDate(data.end_at ? new Date(data.end_at) : null);
        setStatus((data.status as Status) ?? 'active');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load campaign.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, mosqueLoading, selectedMosque]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!selectedMosque) { setError('No mosque selected.'); return; }
    const link = donationUrl.trim() ? httpsUrl(donationUrl) : null;
    if (donationUrl.trim() && !link) { setError('Enter a valid HTTPS donation link.'); return; }
    if (status === 'active' && !link) { setError('Add the mosque’s donation link before making this appeal active.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || null,
        donation_url: link,
        end_at: endDate ? endDate.toISOString() : null,
        status,
      };
      if (isNew) {
        payload.mosque_id = selectedMosque!.mosqueId;
        const { error: e } = await supabase.from('campaigns').insert(payload);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .from('campaigns')
          .update(payload)
          .eq('id', id!)
          .eq('mosque_id', selectedMosque.mosqueId)
          .select('id')
          .maybeSingle();
        if (e) throw e;
        if (!data) throw new Error('No matching campaign found for the selected mosque.');
      }
      returnToContentHub(router);
    } catch (err: any) {
      setError(err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedMosque) {
      setError('No mosque selected.');
      return;
    }
    Alert.alert(
      'Delete Campaign',
      'This will permanently remove the campaign from the mosque page.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { data, error: e } = await supabase
                .from('campaigns')
                .delete()
                .eq('id', id!)
                .eq('mosque_id', selectedMosque.mosqueId)
                .select('id')
                .maybeSingle();
              if (e) throw e;
              if (!data) throw new Error('No matching campaign found for the selected mosque.');
              returnToContentHub(router);
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
          <BackButton fallbackHref="/(admin)/events" />
          <AppText variant="sectionTitle" style={styles.navTitle}>{isNew ? 'New Campaign' : 'Edit Campaign'}</AppText>
          <View style={styles.navRight} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={16} color={tokens.color.status.danger} />
              <AppText variant="caption" color={tokens.color.status.danger} style={{ flex: 1 }}>{error}</AppText>
            </View>
          )}

          {/* Campaign name */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>CAMPAIGN NAME</AppText>
            <View style={styles.fieldCard}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Masjid Roof Repair Fund"
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
                placeholder="Explain what the funds will be used for..."
                placeholderTextColor={tokens.color.text.muted}
                multiline
                numberOfLines={6}
                maxLength={4000}
                textAlignVertical="top"
              />
            </View>
            <AppText variant="caption" color={tokens.color.text.muted} style={styles.charCount}>
              {description.length} / 4000
            </AppText>
          </View>

          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>MOSQUE DONATION LINK</AppText>
            <TextInput accessibilityLabel="Mosque donation link" style={styles.input} value={donationUrl} onChangeText={setDonationUrl} placeholder="https://…" autoCapitalize="none" keyboardType="url" maxLength={2048} />
            <AppText variant="caption">Donations open on this external page. Amounts, receipts and Gift Aid are handled by your provider.</AppText>
            {httpsUrl(donationUrl) && <AppText variant="caption">Destination: {new URL(httpsUrl(donationUrl)!).hostname}</AppText>}
            {!isNew && <Pressable onPress={() => router.push({ pathname: '/(admin)/campaign-preview/[id]', params: { id } } as any)}><AppText style={{ color: '#155F4E', paddingVertical: 12 }}>Preview saved appeal →</AppText></Pressable>}
          </View>

          {/* End date */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>END DATE</AppText>
            <View style={styles.fieldCard}>
              <Pressable
                onPress={() => { if (!endDate) setEndDate(new Date()); setShowEndPicker(true); }}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Ionicons name="calendar-outline" size={18} color={tokens.color.text.secondary} />
                <AppText variant="body" style={[styles.rowLabel, !endDate && styles.placeholder]}>
                  {endDate ? fmtDate(endDate) : 'No end date (open-ended)'}
                </AppText>
                {endDate ? (
                  <Pressable onPress={() => setEndDate(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={tokens.color.text.muted} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
                )}
              </Pressable>
            </View>
          </View>

          {Platform.OS === 'ios' && showEndPicker && (
            <View style={styles.inlinePicker}>
              <DateTimePicker themeVariant="light"
                value={endDate ?? new Date()}
                mode="date"
                display="spinner"
                onChange={(_, d) => { if (d) setEndDate(d); }}
              />
              <Pressable onPress={() => setShowEndPicker(false)} style={styles.pickerDone}>
                <AppText style={styles.pickerDoneText}>Done</AppText>
              </Pressable>
            </View>
          )}
          {Platform.OS === 'android' && showEndPicker && (
            <DateTimePicker themeVariant="light"
              value={endDate ?? new Date()}
              mode="date"
              onChange={(_, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
            />
          )}

          {/* Status */}
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>STATUS</AppText>
            <View style={styles.statusGroup}>
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
                    <View style={styles.statusCardTop}>
                      <AppText style={[styles.statusLabel, active && { color: opt.color }]}>{opt.label}</AppText>
                      {active && <Ionicons name="checkmark-circle" size={16} color={opt.color} />}
                    </View>
                    <AppText variant="caption" color={tokens.color.text.secondary}>{opt.description}</AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Cover image & attachments — kept last so the core fields above stay quick to reach */}
          {!isNew && selectedMosque ? (
            <ContentAttachmentsEditor mosqueId={selectedMosque.mosqueId} contentType="campaign" contentId={id!} />
          ) : (
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>COVER IMAGE</AppText>
              <View style={styles.fieldCard}>
                <View style={styles.row}>
                  <AppText variant="body" color={tokens.color.text.muted} style={styles.rowLabel}>
                    Save the campaign to add a cover image and attachments.
                  </AppText>
                </View>
              </View>
            </View>
          )}

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, saving && styles.btnDisabled]}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <AppText style={styles.saveBtnText}>{isNew ? 'Launch Campaign' : 'Save Changes'}</AppText>
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
                    <AppText style={styles.deleteBtnText}>Delete Campaign</AppText>
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
  multiline: { minHeight: 140, paddingTop: 14 },
  placeholder: { color: tokens.color.text.muted },
  charCount: { textAlign: 'right', paddingRight: 4 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: tokens.typography.weight.medium, color: tokens.color.text.primary },

  currencyBadge: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.md,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: { fontSize: 18, fontWeight: tokens.typography.weight.bold, color: '#059669' },

  progressCard: {
    padding: 16,
    gap: 8,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressRaised: { fontSize: 17, fontWeight: tokens.typography.weight.bold, color: tokens.color.text.primary },
  progressPct: { fontSize: 13, fontWeight: tokens.typography.weight.bold, color: '#059669' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#E11D48' },

  inlinePicker: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    overflow: 'hidden',
  },
  pickerDone: { alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border.subtle },
  pickerDoneText: { color: '#2563EB', fontSize: 15, fontWeight: tokens.typography.weight.bold },

  statusGroup: { gap: 8 },
  statusCard: {
    padding: 14,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    backgroundColor: tokens.color.bg.surface,
    gap: 2,
  },
  statusCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { fontSize: 15, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },

  saveBtn: {
    height: 52,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#E11D48',
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
