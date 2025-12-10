import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoleFlags } from '@/lib/roles';
import { useAuth } from '@/lib/auth';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';

const safeStorage = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    return mod.default ?? mod;
  } catch {
    const globalKey = '__ac_default_mosque_store__';
    const memory: Record<string, string> = (globalThis as any)[globalKey] ?? ((globalThis as any)[globalKey] = {});
    return {
      getItem: async (key: string) => memory[key] ?? null,
      setItem: async (key: string, val: string) => {
        memory[key] = val;
      },
      removeItem: async (key: string) => {
        delete memory[key];
      },
    };
  }
})();

export default function AdminSettingsScreen() {
  const { loading: roleLoading, isAdmin, isLocalAdmin } = useRoleFlags();
  const { session, signOut } = useAuth();
  const { mosques, selectedMosque, setSelectedMosque, loading: mosqueLoading } = useAdminMosque();
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const stored = await safeStorage.getItem('default_mosque_id');
        setDefaultId(stored ?? null);
      } catch {
        setDefaultId(null);
      }
    })();
  }, []);

  const adminMosques = useMemo(() => mosques ?? [], [mosques]);
  const canSelect = isAdmin || isLocalAdmin;

  const handleSetDefault = async (mosqueId: string) => {
    if (!canSelect) return;
    setSaving(true);
    try {
      await safeStorage.setItem('default_mosque_id', mosqueId);
      setDefaultId(mosqueId);
      setSelectedMosque?.(mosqueId);
      Alert.alert('Default saved', 'This mosque will be used for dashboards by default.');
    } catch {
      Alert.alert('Unable to save', 'Could not persist your default mosque.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDefault = async () => {
    setSaving(true);
    try {
      await safeStorage.removeItem('default_mosque_id');
      setDefaultId(null);
      Alert.alert('Default cleared', 'Your next session will pick the first available mosque.');
    } catch {
      Alert.alert('Unable to clear', 'Could not clear the default mosque.');
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0EA5E9" />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!isAdmin && !isLocalAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>You do not have local admin access.</Text>
        <Pressable onPress={() => router.replace('/(user)')} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}>
          <Text style={styles.primaryText}>Go to home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Admin Settings</Text>
      <Text style={styles.subheading}>Manage your account and default admin mosque.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.cardLine}>User ID: {session?.user?.id ?? 'unknown'}</Text>
        <Text style={styles.cardLine}>Email: {(session?.user as any)?.email ?? 'unknown'}</Text>
        <Text style={styles.cardLine}>Role: {session?.user?.role ?? 'unknown'}</Text>
        <Pressable onPress={() => signOut?.()} style={({ pressed }) => [styles.danger, { opacity: pressed ? 0.9 : 1 }]}>
          <Text style={styles.dangerText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Default Admin Mosque</Text>
        <Text style={styles.cardLine}>Current default: {defaultId ?? 'not set'}</Text>
        {!adminMosques.length ? <Text style={styles.muted}>No admin mosques found for your account.</Text> : null}
        <View style={{ gap: 10, marginTop: 10 }}>
          {adminMosques.map((m) => {
            const active = defaultId === m.mosqueId || selectedMosque?.mosqueId === m.mosqueId;
            return (
              <Pressable
                key={m.mosqueId}
                onPress={() => handleSetDefault(m.mosqueId)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.mosqueRow,
                  active && styles.mosqueRowActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View>
                  <Text style={[styles.mosqueName, active && styles.mosqueNameActive]} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={styles.mosqueMeta} numberOfLines={1}>
                    {[m.city, m.country].filter(Boolean).join(', ') || 'Mosque'}
                  </Text>
                </View>
                <Text style={[styles.badge, active && styles.badgeActive]}>{active ? 'Selected' : 'Set default'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={handleClearDefault} disabled={saving} style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.9 : 1 }]}>
          <Text style={styles.secondaryText}>Clear default</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}>
        <Text style={styles.primaryText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  muted: { color: '#64748B', textAlign: 'center' },
  heading: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subheading: { color: '#475569' },
  card: { borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, backgroundColor: '#FFFFFF', gap: 8 },
  cardTitle: { fontWeight: '800', fontSize: 16, color: '#0F172A' },
  cardLine: { color: '#475569' },
  primary: { backgroundColor: '#0EA5E9', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  secondary: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: { color: '#0F172A', fontWeight: '700' },
  danger: { marginTop: 12, backgroundColor: '#FEE2E2', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  dangerText: { color: '#B91C1C', fontWeight: '800' },
  mosqueRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mosqueRowActive: { borderColor: '#0EA5E9', backgroundColor: '#E0F2FE' },
  mosqueName: { fontWeight: '800', color: '#0F172A' },
  mosqueNameActive: { color: '#0C4A6E' },
  mosqueMeta: { color: '#64748B', fontSize: 12 },
  badge: { color: '#0F172A', fontWeight: '700', fontSize: 12 },
  badgeActive: { color: '#0369A1' },
});
