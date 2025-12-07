import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { useAuth } from '@/lib/auth';

export default function AdminDashboard() {
  const router = useRouter();
  const { loading: roleLoading, isAdmin, isMuezzin, isLocalAdmin } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading, error, setSelectedMosque } = useAdminMosque();
  const { session } = useAuth();

  const disableActions = !selectedMosque;

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (isMuezzin && !isAdmin) {
    return <Redirect href="/(muezzin)" />;
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>You do not have access to the admin console.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40, gap: 14 }}>
      <Text style={styles.title}>Admin console</Text>
      <Text style={styles.subtitle}>Manage your mosque’s schedule, staff, and content from a single place.</Text>

      {selectedMosque ? <Text style={styles.mosqueLine}>Managing: {selectedMosque.name}</Text> : null}
      {mosques.length > 1 ? (
        <View style={styles.selectorRow}>
          {mosques.map((m) => {
            const active = selectedMosque?.mosqueId === m.mosqueId;
            return (
              <Pressable
                key={m.mosqueId}
                onPress={() => setSelectedMosque(m.mosqueId)}
                style={({ pressed }) => [
                  styles.mosqueChip,
                  active && styles.mosqueChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={[styles.chipSub, active && styles.chipSubActive]} numberOfLines={1}>
                  {[m.city, m.country].filter(Boolean).join(', ') || 'Mosque'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!mosques.length && !selectedMosque ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No admin mosque found.</Text>
          <Text style={styles.emptySubtitle}>
            You’re not set up as a local admin for any mosque yet. Please contact your main admin.
          </Text>
          {error ? <Text style={styles.muted}>{error}</Text> : null}
        </View>
      ) : null}

      <AdminCard
        router={router}
        title="Manage Prayer Times"
        description="Edit adhan and iqama times for any date."
        href="/(admin)/prayer-times"
        disabled={disableActions}
      />

      <AdminCard
        router={router}
        title="Manage Staff Rota"
        description="Assign muezzins for each prayer."
        href="/(admin)/staff-rota"
        disabled={disableActions}
      />

      <View style={styles.debugCard}>
        <Text style={styles.debugTitle}>Debug info</Text>
        <Text style={styles.debugLine}>User ID: {session?.user?.id ?? 'unknown'}</Text>
        <Text style={styles.debugLine}>Role: {session?.user?.role ?? 'unknown'}</Text>
        <Text style={styles.debugLine}>Email: {(session?.user as any)?.email ?? 'unknown'}</Text>
        <Text style={styles.debugLine}>isAdmin: {isAdmin ? 'true' : 'false'}</Text>
        <Text style={styles.debugLine}>isLocalAdmin: {isLocalAdmin ? 'true' : 'false'}</Text>
        <Text style={styles.debugLine}>isMuezzin: {isMuezzin ? 'true' : 'false'}</Text>
        <Text style={styles.debugLine}>Admin mosques: {mosques.length}</Text>
        <Text style={styles.debugLine}>
          Selected mosque: {selectedMosque ? `${selectedMosque.name} (${selectedMosque.mosqueId})` : 'none'}
        </Text>
        {error ? <Text style={[styles.debugLine, styles.muted]}>Error: {error}</Text> : null}
      </View>
    </ScrollView>
  );
}

type CardProps = {
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
  router: ReturnType<typeof useRouter>;
};

function AdminCard({ title, description, href, router, disabled }: CardProps) {
  const handlePress = () => {
    if (disabled) return;
    router.push(href);
  };
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed && !disabled && { opacity: 0.9 },
        disabled && styles.cardDisabled,
      ]}
    >
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
      <Text style={[styles.cardLink, disabled && styles.cardLinkDisabled]}>{disabled ? 'Not available' : 'Open'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: '#475569', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 6, color: '#0F172A' },
  subtitle: { color: '#64748B', marginBottom: 8 },
  mosqueLine: { color: '#0F172A', fontWeight: '700' },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mosqueChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    backgroundColor: '#FFFFFF',
    minWidth: 140,
  },
  mosqueChipActive: { borderColor: '#0EA5E9', backgroundColor: '#E0F2FE' },
  chipText: { fontWeight: '800', color: '#0F172A' },
  chipTextActive: { color: '#0C4A6E' },
  chipSub: { color: '#64748B', fontSize: 12 },
  chipSubActive: { color: '#075985' },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  emptyTitle: { fontWeight: '800', fontSize: 16, color: '#0F172A' },
  emptySubtitle: { color: '#475569' },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    gap: 6,
  },
  cardDisabled: { opacity: 0.6 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  cardDescription: { color: '#475569' },
  cardLink: { color: '#0EA5E9', fontWeight: '700', marginTop: 6 },
  cardLinkDisabled: { color: '#94A3B8' },
  debugCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  debugTitle: { fontWeight: '800', color: '#0F172A' },
  debugLine: { color: '#475569', fontSize: 12 },
});
