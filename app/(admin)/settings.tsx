import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components/ui/app-text';
import { ScreenContainer } from '@/components/ui/screen-container';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { clearDefaultMosqueId, getDefaultMosqueId, setDefaultMosqueId } from '@/lib/mosquePreferences';
import {
  getAdminNotifCoverRequests,
  getAdminNotifRotaChanges,
  getAdminTimeFormat,
  setAdminNotifCoverRequests,
  setAdminNotifRotaChanges,
  setAdminTimeFormat,
} from '@/lib/adminPreferences';

export default function AdminSettingsScreen() {
  const { loading: roleLoading, isAdmin, isLocalAdmin, role, isMuezzin } = useRoleFlags();
  const { session, signOut } = useAuth();
  const { mosques, setSelectedMosque, loading: mosqueLoading } = useAdminMosque();
  const router = useRouter();

  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preferences
  const [notifCover, setNotifCover] = useState(true);
  const [notifRota, setNotifRota] = useState(true);
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [savingNotifCover, setSavingNotifCover] = useState(false);
  const [savingNotifRota, setSavingNotifRota] = useState(false);
  const [savingTimeFormat, setSavingTimeFormat] = useState(false);

  // Prayer source config — loaded from the active mosque for London mosques only
  const [prayerSource, setPrayerSource] = useState<'aladhan' | 'elm'>('aladhan');
  const [prayerSchool, setPrayerSchool] = useState<0 | 1>(0);
  const [savingPrayerConfig, setSavingPrayerConfig] = useState(false);

  const accountUserId = session?.user?.id ?? null;
  const email = (session?.user as any)?.email as string | null ?? null;
  const adminMosques = useMemo(() => mosques ?? [], [mosques]);

  // The London mosque to show prayer-source settings for: prefer the default mosque
  // if it's in London, otherwise the first London mosque in their list.
  const londonMosque = useMemo(() => {
    const isLondon = (city?: string | null) => city?.trim().toLowerCase().includes('london') ?? false;
    const defaultMosque = adminMosques.find((m) => m.mosqueId === defaultId);
    if (defaultMosque && isLondon(defaultMosque.city)) return defaultMosque;
    return adminMosques.find((m) => isLondon(m.city)) ?? null;
  }, [adminMosques, defaultId]);

  const loadAll = useCallback(async () => {
    try {
      const [stored, cover, rota, fmt] = await Promise.all([
        getDefaultMosqueId(accountUserId),
        getAdminNotifCoverRequests(accountUserId),
        getAdminNotifRotaChanges(accountUserId),
        getAdminTimeFormat(accountUserId),
      ]);
      setDefaultId(stored ?? null);
      setNotifCover(cover);
      setNotifRota(rota);
      setTimeFormat(fmt);
      setError(null);
    } catch {
      setError('Could not load preferences.');
    }
  }, [accountUserId]);

  // Load prayer config whenever the active London mosque changes
  useEffect(() => {
    if (!londonMosque) return;
    supabase
      .from('mosques')
      .select('prayer_source, prayer_school')
      .eq('id', londonMosque.mosqueId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPrayerSource(data.prayer_source === 'elm' ? 'elm' : 'aladhan');
        setPrayerSchool(data.prayer_school === 1 ? 1 : 0);
      });
  }, [londonMosque]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  }, [loadAll]);

  const handleSetDefault = async (mosqueId: string) => {
    setSaving(true);
    try {
      await setDefaultMosqueId(accountUserId, mosqueId);
      setDefaultId(mosqueId);
      setSelectedMosque?.(mosqueId);
      setError(null);
    } catch {
      setError('Could not save your default mosque.');
      Alert.alert('Unable to save', 'Could not persist your default mosque.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDefault = async () => {
    setSaving(true);
    try {
      await clearDefaultMosqueId(accountUserId);
      setDefaultId(null);
      setError(null);
    } catch {
      setError('Could not clear the default mosque.');
      Alert.alert('Unable to clear', 'Could not clear the default mosque.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCover = async (val: boolean) => {
    if (savingNotifCover || val === notifCover) return;
    const previous = notifCover;
    setNotifCover(val);
    setSavingNotifCover(true);
    try {
      await setAdminNotifCoverRequests(accountUserId, val);
      setError(null);
    } catch {
      setNotifCover(previous);
      setError('Could not save cover request alert preference.');
    } finally {
      setSavingNotifCover(false);
    }
  };

  const handleToggleRota = async (val: boolean) => {
    if (savingNotifRota || val === notifRota) return;
    const previous = notifRota;
    setNotifRota(val);
    setSavingNotifRota(true);
    try {
      await setAdminNotifRotaChanges(accountUserId, val);
      setError(null);
    } catch {
      setNotifRota(previous);
      setError('Could not save rota change alert preference.');
    } finally {
      setSavingNotifRota(false);
    }
  };

  const handleTimeFormat = async (fmt: '12h' | '24h') => {
    if (savingTimeFormat || fmt === timeFormat) return;
    const previous = timeFormat;
    setTimeFormat(fmt);
    setSavingTimeFormat(true);
    try {
      await setAdminTimeFormat(accountUserId, fmt);
      setError(null);
    } catch {
      setTimeFormat(previous);
      setError('Could not save time format preference.');
    } finally {
      setSavingTimeFormat(false);
    }
  };

  const handleSavePrayerConfig = async (nextSource: 'aladhan' | 'elm', nextSchool: 0 | 1) => {
    if (!londonMosque || savingPrayerConfig) return;
    const prevSource = prayerSource;
    const prevSchool = prayerSchool;
    setPrayerSource(nextSource);
    setPrayerSchool(nextSchool);
    setSavingPrayerConfig(true);
    try {
      const { error: rpcError } = await supabase.rpc('update_mosque_prayer_config', {
        p_mosque_id: londonMosque.mosqueId,
        p_prayer_source: nextSource,
        p_prayer_school: nextSchool,
      });
      if (rpcError) {
        setPrayerSource(prevSource);
        setPrayerSchool(prevSchool);
        setError('Could not save prayer times configuration.');
      } else {
        setError(null);
      }
    } catch {
      setPrayerSource(prevSource);
      setPrayerSchool(prevSchool);
      setError('Could not save prayer times configuration.');
    } finally {
      setSavingPrayerConfig(false);
    }
  };

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tokens.color.status.info} />
        <AppText variant="body" color={tokens.color.text.secondary}>Loading…</AppText>
      </View>
    );
  }

  if (!isAdmin && !isLocalAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.muted}>
          You do not have local admin access.
        </AppText>
        <Pressable onPress={() => router.replace('/' as any)} style={styles.homeBtn}>
          <AppText style={styles.homeBtnText}>Go to Home</AppText>
        </Pressable>
      </View>
    );
  }

  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '??';
  const roleLabel = role ?? 'unknown';
  const truncatedId = accountUserId
    ? `${accountUserId.slice(0, 8)}…${accountUserId.slice(-4)}`
    : 'unknown';

  return (
    <ScreenContainer
      contentStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />
      }
    >
      {/* ── Nav header ── */}
      <View style={styles.navHeader}>
        <Pressable
          onPress={() => router.push('/(admin)' as any)}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={20} color={tokens.color.text.primary} />
          <AppText style={styles.backLabel}>Console</AppText>
        </Pressable>
        <AppText style={styles.pageTitle}>Settings</AppText>
        <View style={styles.backBtn} pointerEvents="none" />
      </View>

      {/* ── Profile card ── */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <AppText style={styles.avatarText}>{initials}</AppText>
        </View>
        <View style={styles.profileInfo}>
          <AppText style={styles.profileEmail} numberOfLines={1}>{email ?? 'No email'}</AppText>
          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <AppText style={styles.roleBadgeText}>{roleLabel}</AppText>
            </View>
            {isMuezzin && (
              <View style={[styles.roleBadge, styles.muezzinBadge]}>
                <AppText style={[styles.roleBadgeText, styles.muezzinBadgeText]}>Muezzin</AppText>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Account ── */}
      <View style={styles.section}>
        <AppText style={styles.sectionLabel}>ACCOUNT</AppText>
        <View style={styles.groupCard}>
          <View style={styles.detailRow}>
            <AppText style={styles.detailLabel}>User ID</AppText>
            <AppText style={styles.detailValue}>{truncatedId}</AppText>
          </View>
          <View style={styles.hairline} />
          <View style={styles.detailRow}>
            <AppText style={styles.detailLabel}>Role</AppText>
            <AppText style={styles.detailValue}>{roleLabel}</AppText>
          </View>
          <View style={styles.hairline} />
          <View style={styles.detailRow}>
            <AppText style={styles.detailLabel}>Muezzin access</AppText>
            <AppText style={[styles.detailValue, isMuezzin && styles.detailValueGreen]}>
              {isMuezzin ? 'Available' : 'Not assigned'}
            </AppText>
          </View>
        </View>
      </View>

      {/* ── Notifications ── */}
      <View style={styles.section}>
        <AppText style={styles.sectionLabel}>NOTIFICATIONS</AppText>
        <View style={styles.groupCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <AppText style={styles.toggleTitle}>Cover request alerts</AppText>
              <AppText style={styles.toggleDesc}>Notify when a muezzin requests or cancels cover</AppText>
            </View>
            <Switch
              value={notifCover}
              onValueChange={handleToggleCover}
              disabled={savingNotifCover}
              trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }}
              thumbColor={notifCover ? '#0EA5E9' : '#CBD5E1'}
            />
          </View>
          <View style={styles.hairline} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <AppText style={styles.toggleTitle}>Rota change alerts</AppText>
              <AppText style={styles.toggleDesc}>Notify when a rota assignment is updated</AppText>
            </View>
            <Switch
              value={notifRota}
              onValueChange={handleToggleRota}
              disabled={savingNotifRota}
              trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }}
              thumbColor={notifRota ? '#0EA5E9' : '#CBD5E1'}
            />
          </View>
        </View>
      </View>

      {/* ── Display ── */}
      <View style={styles.section}>
        <AppText style={styles.sectionLabel}>DISPLAY</AppText>
        <View style={styles.groupCard}>
          <View style={styles.formatRow}>
            <View style={styles.toggleText}>
              <AppText style={styles.toggleTitle}>Prayer time format</AppText>
              <AppText style={styles.toggleDesc}>How adhan and iqama times are shown</AppText>
            </View>
            <View style={styles.segmentedControl}>
              {(['12h', '24h'] as const).map((fmt) => (
                <Pressable
                  key={fmt}
                  onPress={() => handleTimeFormat(fmt)}
                  disabled={savingTimeFormat || fmt === timeFormat}
                  style={({ pressed }) => [
                    styles.segment,
                    timeFormat === fmt && styles.segmentActive,
                    pressed && timeFormat !== fmt && styles.pressed,
                  ]}
                >
                  <AppText style={[styles.segmentText, timeFormat === fmt && styles.segmentTextActive]}>
                    {fmt}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ── Prayer times source — London mosques only ── */}
      {londonMosque ? (
        <View style={styles.section}>
          <AppText style={styles.sectionLabel}>PRAYER TIMES SOURCE</AppText>
          <View style={styles.groupCard}>
            <View style={styles.prayerSourceRow}>
              <View style={styles.toggleText}>
                <AppText style={styles.toggleTitle}>Auto-calculate (Aladhan)</AppText>
                <AppText style={styles.toggleDesc}>Astronomically calculated from coordinates and calculation method</AppText>
              </View>
              <Pressable
                onPress={() => handleSavePrayerConfig('aladhan', prayerSchool)}
                disabled={savingPrayerConfig || prayerSource === 'aladhan'}
                style={({ pressed }) => [styles.radioBtn, prayerSource === 'aladhan' && styles.radioBtnActive, pressed && prayerSource !== 'aladhan' && styles.pressed]}
              >
                <Ionicons
                  name={prayerSource === 'aladhan' ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={prayerSource === 'aladhan' ? '#0EA5E9' : tokens.color.border.subtle}
                />
              </Pressable>
            </View>
            <View style={styles.hairline} />
            <View style={styles.prayerSourceRow}>
              <View style={styles.toggleText}>
                <AppText style={styles.toggleTitle}>East London Mosque timetable</AppText>
                <AppText style={styles.toggleDesc}>Official ELM published schedule with adhan and jamaat times</AppText>
              </View>
              <Pressable
                onPress={() => handleSavePrayerConfig('elm', prayerSchool)}
                disabled={savingPrayerConfig || prayerSource === 'elm'}
                style={({ pressed }) => [styles.radioBtn, prayerSource === 'elm' && styles.radioBtnActive, pressed && prayerSource !== 'elm' && styles.pressed]}
              >
                <Ionicons
                  name={prayerSource === 'elm' ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={prayerSource === 'elm' ? '#0EA5E9' : tokens.color.border.subtle}
                />
              </Pressable>
            </View>
            <View style={styles.hairline} />
            <View style={styles.prayerSourceRow}>
              <View style={styles.toggleText}>
                <AppText style={styles.toggleTitle}>Asr school</AppText>
                <AppText style={styles.toggleDesc}>
                  {prayerSchool === 1 ? 'Hanafi — shadow 2× (later Asr)' : 'Shafi — shadow 1× (earlier Asr)'}
                </AppText>
              </View>
              <View style={styles.segmentedControl}>
                {([['Shafi', 0], ['Hanafi', 1]] as const).map(([label, val]) => (
                  <Pressable
                    key={label}
                    onPress={() => handleSavePrayerConfig(prayerSource, val)}
                    disabled={savingPrayerConfig || prayerSchool === val}
                    style={({ pressed }) => [
                      styles.segment,
                      prayerSchool === val && styles.segmentActive,
                      pressed && prayerSchool !== val && styles.pressed,
                    ]}
                  >
                    <AppText style={[styles.segmentText, prayerSchool === val && styles.segmentTextActive]}>
                      {label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <AppText variant="caption" color={tokens.color.text.muted} style={styles.hint}>
            Applies to {londonMosque.name}. Used when no manual schedule has been uploaded.
          </AppText>
        </View>
      ) : null}

      {/* ── Default mosque ── */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <AppText style={styles.sectionLabel}>DEFAULT MOSQUE</AppText>
          {defaultId && (
            <Pressable
              onPress={handleClearDefault}
              disabled={saving}
              style={({ pressed }) => ({ opacity: pressed || saving ? 0.6 : 1 })}
            >
              <AppText style={styles.clearLink}>Clear</AppText>
            </Pressable>
          )}
        </View>

        {!adminMosques.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={22} color={tokens.color.text.muted} />
            <AppText variant="caption" color={tokens.color.text.secondary} style={styles.emptyText}>
              No admin mosques found. Ask the main admin to assign you.
            </AppText>
          </View>
        ) : (
          <View style={styles.groupCard}>
            {adminMosques.map((m, index) => {
              // Bug fix: drive selection only from persisted defaultId, not session state
              const isActive = defaultId === m.mosqueId;
              const isLast = index === adminMosques.length - 1;
              return (
                <React.Fragment key={m.mosqueId}>
                  <Pressable
                    onPress={() => handleSetDefault(m.mosqueId)}
                    disabled={saving || isActive}
                    style={({ pressed }) => [
                      styles.mosqueRow,
                      isActive && styles.mosqueRowActive,
                      pressed && !isActive && styles.pressed,
                    ]}
                  >
                    <View style={styles.mosqueCopy}>
                      <AppText style={[styles.mosqueName, isActive && styles.mosqueNameActive]} numberOfLines={1}>
                        {m.name}
                      </AppText>
                      <AppText
                        variant="caption"
                        color={isActive ? '#075985' : tokens.color.text.secondary}
                        numberOfLines={1}
                      >
                        {[m.city, m.country].filter(Boolean).join(', ') || 'Mosque'}
                      </AppText>
                    </View>
                    <Ionicons
                      name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isActive ? '#0EA5E9' : tokens.color.border.subtle}
                    />
                  </Pressable>
                  {!isLast && <View style={styles.hairline} />}
                </React.Fragment>
              );
            })}
          </View>
        )}

        {!defaultId && adminMosques.length > 0 && (
          <AppText variant="caption" color={tokens.color.text.muted} style={styles.hint}>
            No default set — tap a mosque to save it as your starting workspace.
          </AppText>
        )}
      </View>

      {/* ── Sign out ── */}
      <View style={styles.section}>
        <View style={styles.groupCard}>
          <Pressable
            onPress={() => signOut?.()}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            </View>
            <AppText style={[styles.actionLabel, styles.actionLabelDanger]}>Sign out</AppText>
            <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
          </Pressable>
        </View>
      </View>

      {error && (
        <AppText variant="caption" color={tokens.color.status.danger} style={styles.hint}>
          {error}
        </AppText>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  muted: { textAlign: 'center' },
  pressed: { opacity: 0.88 },
  container: { gap: 20, paddingBottom: 48 },
  homeBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: tokens.radius.pill, borderWidth: 1, borderColor: tokens.color.border.subtle },
  homeBtnText: { fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },

  // Nav
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, minHeight: 40 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 80 },
  backLabel: { fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary, fontSize: 15 },
  pageTitle: { fontWeight: tokens.typography.weight.bold, fontSize: 17, color: tokens.color.text.primary },

  // Profile
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    borderRadius: tokens.radius.xl, backgroundColor: tokens.color.bg.surface,
    borderWidth: 1, borderColor: tokens.color.border.subtle, ...tokens.shadow.card,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: tokens.typography.weight.extrabold, color: '#0369A1' },
  profileInfo: { flex: 1, gap: 6 },
  profileEmail: { fontSize: 14, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: tokens.radius.pill, backgroundColor: '#EEF7FF' },
  roleBadgeText: { fontSize: 11, fontWeight: tokens.typography.weight.bold, color: '#0369A1' },
  muezzinBadge: { backgroundColor: '#ECFDF5' },
  muezzinBadgeText: { color: '#059669' },

  // Sections
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: tokens.typography.weight.bold, color: tokens.color.text.muted },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearLink: { fontSize: 13, fontWeight: tokens.typography.weight.semibold, color: '#0369A1' },

  // Shared group card
  groupCard: {
    borderRadius: tokens.radius.xl, backgroundColor: tokens.color.bg.surface,
    borderWidth: 1, borderColor: tokens.color.border.subtle,
    overflow: 'hidden', ...tokens.shadow.card,
  },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.color.border.subtle, marginHorizontal: 16 },

  // Detail rows (read-only)
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  detailLabel: { fontSize: 14, color: tokens.color.text.secondary },
  detailValue: { fontSize: 13, color: tokens.color.text.primary, fontWeight: tokens.typography.weight.semibold, textAlign: 'right', flex: 1 },
  detailValueGreen: { color: '#059669' },

  // Toggle rows
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  prayerSourceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  radioBtn: { padding: 2 },
  radioBtnActive: {},
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  toggleDesc: { fontSize: tokens.typography.size.xs, color: tokens.color.text.secondary, lineHeight: 16 },

  // Time format
  formatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  segmentedControl: { flexDirection: 'row', borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.color.border.subtle, overflow: 'hidden' },
  segment: { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: tokens.color.bg.surface },
  segmentActive: { backgroundColor: '#E0F2FE' },
  segmentText: { fontSize: 13, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.secondary },
  segmentTextActive: { color: '#0369A1' },

  // Action row
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  actionIcon: { width: 34, height: 34, borderRadius: tokens.radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  actionLabelDanger: { color: '#DC2626' },

  // Mosque rows
  mosqueRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  mosqueRowActive: { backgroundColor: '#F0F9FF' },
  mosqueCopy: { flex: 1, gap: 2 },
  mosqueName: { fontSize: 15, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  mosqueNameActive: { color: '#0C4A6E' },

  // Misc
  emptyCard: { gap: 10, padding: 20, borderRadius: tokens.radius.xl, backgroundColor: tokens.color.bg.subtle, borderWidth: 1, borderColor: tokens.color.border.subtle, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  hint: { paddingHorizontal: 4 },
});
