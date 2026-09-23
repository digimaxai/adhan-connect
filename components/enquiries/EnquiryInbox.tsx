import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui/back-button';
import { tokens } from '@/theme/tokens';
import { useAuth } from '../../lib/auth';
import { useAdminMosque } from '../../lib/hooks/useAdminMosque';
import { configureEnquiries, enabledEnquiryCategories, listEnquiries, MosqueEnquiry } from '../../lib/api/mosqueEnquiries';
import { ENQUIRY_CATEGORIES, ENQUIRY_STATUS_LABELS, EnquiryCategoryId, enquiryCategory } from '../../lib/mosqueEnquiryCategories';

const BLUE = '#1D4ED8';
const BLUE_SOFT = '#EFF6FF';

const CATEGORY_STYLE: Record<EnquiryCategoryId, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }> = {
  prayer_facilities: { icon: 'business-outline', color: '#155F4E', bg: '#E7F3EE' },
  education: { icon: 'school-outline', color: '#1D4ED8', bg: '#EFF6FF' },
  nikah: { icon: 'heart-outline', color: '#9D174D', bg: '#FCE7F3' },
  funeral: { icon: 'flower-outline', color: '#57534E', bg: '#F5F5F4' },
  new_muslim: { icon: 'sparkles-outline', color: '#BE123C', bg: '#FFE4E6' },
  practical_support: { icon: 'hand-left-outline', color: '#B45309', bg: '#FEF3C7' },
  donations_volunteering: { icon: 'gift-outline', color: '#0D9488', bg: '#F0FDFA' },
  events_visits: { icon: 'calendar-outline', color: '#EA580C', bg: '#FFF7ED' },
  feedback: { icon: 'chatbox-ellipses-outline', color: '#4338CA', bg: '#E0E7FF' },
  other: { icon: 'help-circle-outline', color: '#475569', bg: '#F1F5F9' },
};
const categoryStyle = (id: string) => CATEGORY_STYLE[id as EnquiryCategoryId] ?? CATEGORY_STYLE.other;

const STATUS_STYLE: Record<keyof typeof ENQUIRY_STATUS_LABELS, { color: string; bg: string }> = {
  new: { color: '#1D4ED8', bg: '#EFF6FF' },
  in_progress: { color: '#B45309', bg: '#FEF3C7' },
  waiting_for_listener: { color: '#0D9488', bg: '#F0FDFA' },
  resolved: { color: '#047857', bg: '#ECFDF5' },
};

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  if (diffMs < 3600000) return 'Just now';
  if (diffMs < day) return `${Math.max(1, Math.round(diffMs / 3600000))}h ago`;
  if (diffMs < day * 7) return `${Math.round(diffMs / day)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_for_listener', label: 'Waiting for you' },
  { value: 'resolved', label: 'Resolved' },
];

export function EnquiryInbox({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const { session } = useAuth();
  const mosque = useAdminMosque({ enabled: admin });
  const mosqueId = mosque.selectedMosque?.mosqueId;
  const [rows, setRows] = useState<MosqueEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('all');
  const [archived, setArchived] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const version = useRef(0);

  const load = useCallback(async () => {
    const current = ++version.current;
    setError(null);
    if (!session?.user.id || (admin && !mosqueId)) {
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const result = await listEnquiries(admin ? { mosqueId, archived } : { accountId: session.user.id });
      const options = admin && mosqueId ? await enabledEnquiryCategories(mosqueId) : [];
      if (current === version.current) {
        setRows(result);
        setCategories(options);
      }
    } catch {
      if (current === version.current) {
        setRows([]);
        setError('Could not load enquiries. Pull down to try again.');
      }
    } finally {
      if (current === version.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [admin, mosqueId, session?.user.id, archived]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setSettingsOpen(false);
      void load();
      return () => {
        version.current++;
      };
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const saveCategories = async () => {
    if (!mosqueId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await configureEnquiries(mosqueId, categories);
      setSettingsOpen(false);
    } catch {
      setError('Could not save contact options. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => rows.filter((e) => status === 'all' || e.status === status), [rows, status]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const openEnquiry = (id: string) =>
    router.push({ pathname: admin ? '/(admin)/enquiry-detail' : '/(user)/mosque-enquiry', params: { enquiryId: id } } as any);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
      >
        <View style={styles.headerRow}>
          {!admin && <BackButton />}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{admin ? 'Enquiries' : 'My enquiries'}</Text>
            {admin && <Text style={styles.subtitle}>{mosque.selectedMosque?.name ?? 'Select a mosque'}</Text>}
          </View>
          {admin && mosqueId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage contact options"
              onPress={() => setSettingsOpen((v) => !v)}
              style={[styles.iconBtn, settingsOpen && styles.iconBtnActive]}
            >
              <Ionicons name="options-outline" size={19} color={settingsOpen ? '#FFFFFF' : tokens.color.text.secondary} />
            </Pressable>
          )}
        </View>

        {admin && mosque.mosques.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mosqueRow}>
            {mosque.mosques.map((m) => (
              <Pressable
                key={m.mosqueId}
                onPress={() => mosque.setSelectedMosque(m.mosqueId)}
                style={[styles.mosqueChip, m.mosqueId === mosqueId && styles.mosqueChipActive]}
              >
                <Text style={[styles.mosqueChipText, m.mosqueId === mosqueId && styles.mosqueChipTextActive]}>{m.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={15} color={tokens.color.status.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!session ? (
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </Pressable>
        ) : (
          <>
            {admin && mosqueId && (
              <View style={styles.segmentRow}>
                <Pressable onPress={() => setArchived(false)} style={[styles.segment, !archived && styles.segmentActive]}>
                  <Text style={[styles.segmentText, !archived && styles.segmentTextActive]}>Active</Text>
                </Pressable>
                <Pressable onPress={() => setArchived(true)} style={[styles.segment, archived && styles.segmentActive]}>
                  <Text style={[styles.segmentText, archived && styles.segmentTextActive]}>Archived</Text>
                </Pressable>
              </View>
            )}

            {settingsOpen && (
              <View style={styles.settingsCard}>
                <Text style={styles.settingsTitle}>What can people contact you about?</Text>
                <Text style={styles.settingsHint}>Enable only services your mosque agrees to handle. All local admins see these enquiries.</Text>
                <View style={{ gap: 8 }}>
                  {ENQUIRY_CATEGORIES.map((c) => {
                    const on = categories.includes(c.id);
                    const locked = c.id === 'other';
                    return (
                      <Pressable
                        key={c.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on, disabled: locked }}
                        disabled={locked || saving}
                        onPress={() => setCategories((old) => (old.includes(c.id) ? old.filter((v) => v !== c.id) : [...old, c.id]))}
                        style={[styles.categoryRow, on && styles.categoryRowOn]}
                      >
                        <Ionicons
                          name={on ? 'checkmark-circle' : locked ? 'lock-closed-outline' : 'ellipse-outline'}
                          size={19}
                          color={on ? BLUE : tokens.color.text.muted}
                        />
                        <Text style={[styles.categoryRowText, on && styles.categoryRowTextOn]}>
                          {c.label}
                          {c.optional ? ' · opt-in' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable style={[styles.primaryBtn, saving && styles.disabled]} disabled={saving} onPress={saveCategories}>
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Save contact options</Text>}
                </Pressable>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {STATUS_FILTERS.map((f) => {
                const on = status === f.value;
                const count = counts[f.value] ?? 0;
                if (f.value !== 'all' && !count) return null;
                return (
                  <Pressable key={f.value} onPress={() => setStatus(f.value)} style={[styles.filterChip, on && styles.filterChipOn]}>
                    <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{f.label}</Text>
                    {count > 0 && (
                      <View style={[styles.filterCount, on && styles.filterCountOn]}>
                        <Text style={[styles.filterCountText, on && styles.filterCountTextOn]}>{count}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {loading || (admin && mosque.loading) ? (
              <ActivityIndicator color={BLUE} style={{ marginTop: 24 }} />
            ) : filtered.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="chatbubbles-outline" size={28} color={BLUE} />
                <Text style={styles.emptyTitle}>{archived ? 'No archived enquiries' : 'No enquiries yet'}</Text>
                <Text style={styles.emptyText}>
                  {admin
                    ? 'Enquiries from your mosque page will appear here.'
                    : 'Open a mosque page and choose Contact your mosque to submit one.'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {filtered.map((e) => {
                  const cat = categoryStyle(e.category);
                  const statusStyle = STATUS_STYLE[e.status];
                  const statusLabel = !admin && e.status === 'waiting_for_listener' ? 'Reply received' : ENQUIRY_STATUS_LABELS[e.status];
                  return (
                    <Pressable key={e.id} accessibilityRole="button" onPress={() => openEnquiry(e.id)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                      <View style={[styles.rowIcon, { backgroundColor: cat.bg }]}>
                        <Ionicons name={cat.icon} size={20} color={cat.color} />
                      </View>
                      <View style={styles.rowBody}>
                        <View style={styles.rowTopLine}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {admin ? e.contact_name : enquiryCategory(e.category)?.label}
                          </Text>
                          <Text style={styles.rowDate}>{relativeDate(e.updated_at)}</Text>
                        </View>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {!admin ? `${e.mosques?.name ?? 'Mosque'} · ` : `${enquiryCategory(e.category)?.label} · `}
                          {e.reason}
                        </Text>
                        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                          <View style={[styles.statusDot, { backgroundColor: statusStyle.color }]} />
                          <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusLabel}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={tokens.color.text.muted} />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {admin && (
              <Pressable style={styles.footerLink} onPress={() => router.push('/(admin)/previous-conversations' as any)}>
                <Ionicons name="time-outline" size={16} color={tokens.color.text.secondary} />
                <Text style={styles.footerLinkText}>Previous conversations</Text>
                <Ionicons name="chevron-forward" size={14} color={tokens.color.text.muted} />
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  body: { padding: 18, gap: 14, paddingBottom: 40, maxWidth: 780, width: '100%', alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: tokens.color.text.primary },
  subtitle: { fontSize: 13, color: tokens.color.text.secondary, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tokens.color.border.subtle },
  iconBtnActive: { backgroundColor: BLUE, borderColor: BLUE },
  mosqueRow: { gap: 8 },
  mosqueChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: tokens.color.border.muted },
  mosqueChipActive: { backgroundColor: BLUE, borderColor: BLUE },
  mosqueChipText: { fontSize: 13, fontWeight: '700', color: tokens.color.text.primary },
  mosqueChipTextActive: { color: '#FFFFFF' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12 },
  errorText: { flex: 1, color: tokens.color.status.danger, fontSize: 13, fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, borderRadius: 12, paddingVertical: 13 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  segmentRow: { flexDirection: 'row', backgroundColor: '#EEF2F6', borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segmentActive: { backgroundColor: '#FFFFFF', ...tokens.shadow.card, shadowOpacity: 0.06 },
  segmentText: { fontSize: 13, fontWeight: '700', color: tokens.color.text.secondary },
  segmentTextActive: { color: tokens.color.text.primary },
  settingsCard: { gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: tokens.color.border.subtle },
  settingsTitle: { fontSize: 15, fontWeight: '800', color: tokens.color.text.primary },
  settingsHint: { fontSize: 12, color: tokens.color.text.secondary, lineHeight: 17, marginTop: -6 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10, backgroundColor: '#F8FAFC' },
  categoryRowOn: { backgroundColor: BLUE_SOFT },
  categoryRowText: { fontSize: 13, fontWeight: '600', color: tokens.color.text.secondary, flex: 1 },
  categoryRowTextOn: { color: BLUE, fontWeight: '700' },
  filterRow: { gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: tokens.color.border.muted },
  filterChipOn: { backgroundColor: BLUE, borderColor: BLUE },
  filterChipText: { fontSize: 13, fontWeight: '700', color: tokens.color.text.primary },
  filterChipTextOn: { color: '#FFFFFF' },
  filterCount: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountOn: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { fontSize: 10, fontWeight: '800', color: tokens.color.text.secondary },
  filterCountTextOn: { color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: tokens.color.border.subtle },
  rowPressed: { opacity: 0.85 },
  rowIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowBody: { flex: 1, gap: 4 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: tokens.color.text.primary },
  rowDate: { fontSize: 11, color: tokens.color.text.muted, fontWeight: '600' },
  rowMeta: { fontSize: 13, color: tokens.color.text.secondary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800' },
  emptyCard: { alignItems: 'center', gap: 8, padding: 28, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: tokens.color.border.subtle },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: tokens.color.text.primary },
  emptyText: { fontSize: 13, color: tokens.color.text.secondary, textAlign: 'center', lineHeight: 19 },
  footerLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  footerLinkText: { fontSize: 13, fontWeight: '700', color: tokens.color.text.secondary },
});
