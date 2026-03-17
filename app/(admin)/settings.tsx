import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreenShell } from '@/components/admin/AdminScreenShell';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAuth } from '@/lib/auth';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { persistentStorage } from '@/lib/persistentStorage';

export default function AdminSettingsScreen() {
  const { loading: roleLoading, isAdmin, isLocalAdmin } = useRoleFlags();
  const { session, signOut } = useAuth();
  const { mosques, selectedMosque, setSelectedMosque, loading: mosqueLoading } = useAdminMosque();
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const adminMosques = useMemo(() => mosques ?? [], [mosques]);
  const canSelect = isAdmin || isLocalAdmin;
  const defaultMosqueName = useMemo(
    () => adminMosques.find((m) => m.mosqueId === defaultId)?.name ?? defaultId,
    [adminMosques, defaultId]
  );

  const loadDefaultMosque = useCallback(async () => {
    try {
      const stored = await persistentStorage.getItem('default_mosque_id');
      setDefaultId(stored ?? null);
      setError(null);
    } catch {
      setDefaultId(null);
      setError('Could not load the saved default mosque for this account.');
    }
  }, []);

  useEffect(() => {
    loadDefaultMosque();
  }, [loadDefaultMosque]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDefaultMosque();
    } finally {
      setRefreshing(false);
    }
  }, [loadDefaultMosque]);

  const handleSetDefault = async (mosqueId: string) => {
    if (!canSelect) return;
    setSaving(true);
    try {
      await persistentStorage.setItem('default_mosque_id', mosqueId);
      setDefaultId(mosqueId);
      setSelectedMosque?.(mosqueId);
      setNotice('Default admin mosque updated.');
      setError(null);
      Alert.alert('Default saved', 'This mosque will be used for dashboards by default.');
    } catch {
      setError('Could not persist your default mosque.');
      Alert.alert('Unable to save', 'Could not persist your default mosque.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDefault = async () => {
    setSaving(true);
    try {
      await persistentStorage.removeItem('default_mosque_id');
      setDefaultId(null);
      setNotice('Default admin mosque cleared.');
      setError(null);
      Alert.alert('Default cleared', 'Your next session will pick the first available mosque.');
    } catch {
      setError('Could not clear the default mosque.');
      Alert.alert('Unable to clear', 'Could not clear the default mosque.');
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0EA5E9" />
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.feedbackText}>
          Loading...
        </AppText>
      </View>
    );
  }

  if (!isAdmin && !isLocalAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.muted}>
          You do not have local admin access.
        </AppText>
        <AppButton title="Go to Home" onPress={() => router.replace('/(user)')} />
      </View>
    );
  }

  return (
    <AdminScreenShell
      title="Admin Settings"
      subtitle="Manage your account and keep the current workspace aligned across sessions."
      backHref="/(admin)"
      backLabel="Back to Console"
      mosqueName={selectedMosque?.name ?? null}
      mosqueMeta={selectedMosque ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') || 'Admin preferences' : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} /> as any}
    >
      <AppCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.sectionPill}>
            <AppText variant="caption" style={styles.sectionPillText}>
              Account
            </AppText>
          </View>
          <AppText variant="title">Session details</AppText>
        </View>
        <View style={styles.detailList}>
          <DetailRow label="User ID" value={session?.user?.id ?? 'unknown'} />
          <DetailRow label="Email" value={(session?.user as any)?.email ?? 'unknown'} />
          <DetailRow label="Role" value={session?.user?.role ?? 'unknown'} />
        </View>
        <AppButton title="Sign Out" variant="secondary" onPress={() => signOut?.()} style={styles.signOutButton} />
      </AppCard>

      {notice ? <AdminBanner tone="success" title="Settings updated" message={notice} /> : null}
      {error ? <AdminBanner tone="danger" title="Settings issue" message={error} /> : null}

      <AppCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.sectionPill}>
            <AppText variant="caption" style={styles.sectionPillText}>
              Default mosque
            </AppText>
          </View>
          <AppText variant="title">Choose your admin base</AppText>
        </View>
        <View style={styles.currentDefaultCard}>
          <AppText variant="caption" color={tokens.color.text.secondary}>
            Current default
          </AppText>
          <AppText variant="title" style={styles.currentDefaultTitle}>
            {defaultMosqueName ?? 'Not set'}
          </AppText>
        </View>
        {!adminMosques.length ? (
          <AdminBanner
            tone="warning"
            title="No mosque access"
            message="No admin mosques were found for your account. Ask the main admin to add your local admin access."
          />
        ) : null}
        <View style={styles.mosqueList}>
          {adminMosques.map((m) => {
            const active = defaultId === m.mosqueId || selectedMosque?.mosqueId === m.mosqueId;
            return (
              <Pressable
                key={m.mosqueId}
                onPress={() => handleSetDefault(m.mosqueId)}
                disabled={saving}
                style={({ pressed }) => [styles.mosqueRow, active && styles.mosqueRowActive, pressed && styles.pressed]}
              >
                <View style={styles.mosqueCopy}>
                  <AppText style={[styles.mosqueName, active && styles.mosqueNameActive]} numberOfLines={1}>
                    {m.name}
                  </AppText>
                  <AppText variant="caption" color={active ? '#075985' : tokens.color.text.secondary} numberOfLines={1}>
                    {[m.city, m.country].filter(Boolean).join(', ') || 'Mosque'}
                  </AppText>
                </View>
                <AppText variant="caption" color={active ? '#0369A1' : tokens.color.text.primary} style={styles.badge}>
                  {active ? 'Selected' : 'Set default'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppButton title="Clear Default" variant="ghost" onPress={handleClearDefault} disabled={saving} style={styles.clearButton} />
      </AppCard>
    </AdminScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  feedbackText: {
    marginTop: 8,
  },
  muted: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  card: {
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderColor: '#E1E9F2',
  },
  cardHeader: {
    gap: 8,
  },
  sectionPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#EEF7FF',
  },
  sectionPillText: {
    color: '#0369A1',
    fontWeight: tokens.typography.weight.bold,
  },
  detailList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEF2F7',
  },
  detailRow: {
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  detailLabel: {
    flex: 0.9,
  },
  detailValue: {
    flex: 1.4,
    textAlign: 'right',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    minWidth: 128,
  },
  currentDefaultCard: {
    gap: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8FBFE',
    borderWidth: 1,
    borderColor: '#E5EDF5',
  },
  currentDefaultTitle: {
    fontSize: 18,
    lineHeight: 22,
  },
  mosqueList: {
    gap: 10,
  },
  mosqueRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5ECF3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mosqueRowActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#E0F2FE',
  },
  mosqueCopy: {
    flex: 1,
    gap: 2,
  },
  mosqueName: {
    fontWeight: tokens.typography.weight.extrabold,
    color: '#0F172A',
  },
  mosqueNameActive: {
    color: '#0C4A6E',
  },
  badge: {
    fontWeight: tokens.typography.weight.bold,
    fontSize: 11,
  },
  clearButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
});

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText variant="caption" color={tokens.color.text.secondary} style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText variant="caption" color={tokens.color.text.primary} style={styles.detailValue}>
        {value}
      </AppText>
    </View>
  );
}
