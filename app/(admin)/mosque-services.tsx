import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AdminScreenShell } from '@/components/admin/AdminScreenShell';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { supabase } from '@/lib/supabase';
import { MOSQUE_SERVICE_OPTIONS } from '@/lib/mosqueServices';

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
type Prayer = (typeof PRAYERS)[number];

function prayerLabel(prayer: Prayer) {
  return prayer.charAt(0).toUpperCase() + prayer.slice(1);
}

export default function MosqueServicesScreen() {
  const { loading: roleLoading, isAdmin } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading } = useAdminMosque();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [notOffered, setNotOffered] = useState<Prayer[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [services, setServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState('');

  const mosqueId = selectedMosque?.mosqueId ?? null;

  const load = useCallback(async () => {
    if (!mosqueId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await supabase
        .from('mosques')
        .select('services, prayers_not_offered, prayers_not_offered_reasons')
        .eq('id', mosqueId)
        .single();
      if (loadError) throw loadError;
      setNotOffered(((data?.prayers_not_offered ?? []) as Prayer[]).filter((p) => PRAYERS.includes(p)));
      setReasons((data?.prayers_not_offered_reasons ?? {}) as Record<string, string>);
      setServices((data?.services ?? []) as string[]);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load mosque service profile.');
    } finally {
      setLoading(false);
    }
  }, [mosqueId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  };

  const toggleNotOffered = (prayer: Prayer) => {
    setNotice(null);
    setNotOffered((prev) =>
      prev.includes(prayer) ? prev.filter((p) => p !== prayer) : [...prev, prayer]
    );
  };

  const toggleService = (service: string) => {
    setNotice(null);
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  const addCustomService = () => {
    const trimmed = customService.trim();
    if (!trimmed) return;
    if (trimmed.length > 100) {
      Alert.alert('Too long', 'A service name must be 100 characters or fewer.');
      return;
    }
    if (services.includes(trimmed)) {
      setCustomService('');
      return;
    }
    setServices((prev) => [...prev, trimmed]);
    setCustomService('');
  };

  const removeService = (service: string) => {
    setServices((prev) => prev.filter((s) => s !== service));
  };

  const customServices = services.filter(
    (s) => !(MOSQUE_SERVICE_OPTIONS as readonly string[]).includes(s)
  );

  const handleSave = async () => {
    if (!mosqueId) return;
    const missingReason = notOffered.find((p) => !reasons[p]?.trim());
    if (missingReason) {
      setError(`Please explain why ${prayerLabel(missingReason)} is not offered.`);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { error: saveError } = await supabase.rpc('set_mosque_service_profile', {
        p_mosque_id: mosqueId,
        p_services: services,
        p_prayers_not_offered: notOffered,
        p_prayers_not_offered_reasons: Object.fromEntries(
          notOffered.map((p) => [p, reasons[p]?.trim() ?? ''])
        ),
      });
      if (saveError) throw saveError;
      setNotice('Saved. Listeners will see these updates on the mosque page.');
    } catch (e: any) {
      setError(e?.message ?? 'Unable to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const workspaceLoading = roleLoading || mosqueLoading;

  if (workspaceLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tokens.color.status.info} />
        <AppText variant="body" style={styles.loadingText}>Loading…</AppText>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body" color={tokens.color.text.secondary}>
          You do not have access to the admin console.
        </AppText>
      </View>
    );
  }

  return (
    <AdminScreenShell
      title="Prayer Availability & Services"
      subtitle="What listeners see on your mosque page"
      mosqueName={selectedMosque?.name}
      mosqueMeta={
        selectedMosque
          ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ')
          : null
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />
      }
    >
      {!mosques.length ? (
        <AdminBanner
          tone="warning"
          title="No mosque assigned"
          message="You are not assigned as local admin for any mosque yet. Contact the main admin to be set up."
        />
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={tokens.color.status.info} />
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <AppText variant="sectionTitle" style={styles.sectionTitle}>Daily prayer availability</AppText>
            <AppText variant="caption" color={tokens.color.text.secondary} style={styles.helper}>
              Tick any prayers that are not held in congregation at this location. Listeners will see
              &ldquo;Not offered here&rdquo; instead of a blank time.
            </AppText>
            <View style={styles.chipRow}>
              {PRAYERS.map((prayer) => {
                const excluded = notOffered.includes(prayer);
                return (
                  <Pressable
                    key={prayer}
                    accessibilityRole="button"
                    accessibilityState={{ selected: excluded }}
                    onPress={() => toggleNotOffered(prayer)}
                    style={[styles.chip, excluded && styles.chipExcluded]}
                  >
                    <Ionicons
                      name={excluded ? 'checkbox' : 'square-outline'}
                      size={16}
                      color={excluded ? '#B91C1C' : '#64748B'}
                    />
                    <AppText style={[styles.chipText, excluded && styles.chipTextExcluded]}>
                      {prayerLabel(prayer)} not offered
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {notOffered.map((prayer) => (
              <View key={prayer} style={styles.reasonField}>
                <AppText style={styles.reasonLabel}>
                  Why {prayerLabel(prayer)} is not offered (required)
                </AppText>
                <TextInput
                  multiline
                  maxLength={500}
                  value={reasons[prayer] ?? ''}
                  onChangeText={(value) => {
                    setNotice(null);
                    setReasons((prev) => ({ ...prev, [prayer]: value }));
                  }}
                  placeholder="Explain the reason to listeners"
                  placeholderTextColor={tokens.color.text.muted}
                  style={styles.reasonInput}
                />
                <AppText variant="caption" color={tokens.color.text.muted}>
                  Shown publicly when listeners open the prayer info icon. Up to 500 characters.
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <AppText variant="sectionTitle" style={styles.sectionTitle}>Services offered</AppText>
            <AppText variant="caption" color={tokens.color.text.secondary} style={styles.helper}>
              Displayed on your mosque profile page so followers know what to expect.
            </AppText>
            <View style={styles.serviceGrid}>
              {MOSQUE_SERVICE_OPTIONS.map((service) => {
                const checked = services.includes(service);
                return (
                  <Pressable
                    key={service}
                    accessibilityRole="button"
                    accessibilityState={{ selected: checked }}
                    onPress={() => toggleService(service)}
                    style={[styles.serviceItem, checked && styles.serviceItemChecked]}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={16}
                      color={checked ? '#0F172A' : '#94A3B8'}
                    />
                    <AppText style={styles.serviceText} numberOfLines={2}>{service}</AppText>
                  </Pressable>
                );
              })}
            </View>

            {customServices.length > 0 ? (
              <View style={styles.customList}>
                <AppText variant="caption" color={tokens.color.text.secondary} style={styles.customHeading}>
                  Your custom services
                </AppText>
                {customServices.map((service) => (
                  <View key={service} style={styles.customChip}>
                    <AppText style={styles.customChipText} numberOfLines={1}>{service}</AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${service}`}
                      onPress={() => removeService(service)}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.addCustomRow}>
              <TextInput
                value={customService}
                onChangeText={setCustomService}
                placeholder="Add a custom service (e.g. Marriage counselling)"
                placeholderTextColor={tokens.color.text.muted}
                style={styles.addCustomInput}
                maxLength={100}
                onSubmitEditing={addCustomService}
                returnKeyType="done"
              />
              <Pressable
                accessibilityRole="button"
                onPress={addCustomService}
                disabled={!customService.trim()}
                style={[styles.addCustomButton, !customService.trim() && styles.addCustomButtonDisabled]}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {notice ? <AppText style={styles.notice}>{notice}</AppText> : null}

          <AppButton
            variant="primary"
            onPress={() => void handleSave()}
            disabled={saving}
            title={saving ? 'Saving…' : 'Save changes'}
          />
        </>
      )}
    </AdminScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { marginTop: 12 },
  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  sectionTitle: { color: '#0F172A' },
  helper: { lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chipExcluded: { borderColor: '#EF4444', backgroundColor: '#FFF7F7' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  chipTextExcluded: { color: '#B91C1C' },
  reasonField: { marginTop: 8, gap: 6 },
  reasonLabel: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    textAlignVertical: 'top',
    color: '#0F172A',
    fontSize: 14,
  },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D9E3',
    backgroundColor: '#FFFFFF',
    minWidth: 150,
    flexGrow: 1,
    flexBasis: '46%',
  },
  serviceItemChecked: { borderColor: '#0F172A', backgroundColor: '#F0F4FF' },
  serviceText: { fontSize: 13, fontWeight: '600', color: '#0F172A', flexShrink: 1 },
  customList: { marginTop: 10, gap: 8 },
  customHeading: { fontWeight: '700' },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0F172A',
    backgroundColor: '#F0F4FF',
  },
  customChipText: { fontSize: 13, fontWeight: '600', color: '#0F172A', flex: 1, marginRight: 8 },
  addCustomRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  addCustomInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 14,
  },
  addCustomButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomButtonDisabled: { opacity: 0.4 },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 12 },
  notice: { color: '#047857', fontSize: 13, marginTop: 12 },
});
