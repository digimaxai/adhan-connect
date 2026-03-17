import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { ScreenContainer } from '@/components/ui/screen-container';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { useAuth } from '@/lib/auth';

export default function AdminDashboard() {
  const router = useRouter();
  const { loading: roleLoading, isAdmin, isMuezzin, isLocalAdmin, isMainAdmin } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading, error, setSelectedMosque } = useAdminMosque();
  const { session } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const disableActions = !selectedMosque;
  const locationLabel = selectedMosque
    ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') || 'Mosque dashboard'
    : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      router.replace('/(admin)');
    } finally {
      setRefreshing(false);
    }
  };

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <AppText variant="body" style={styles.loadingText}>
          Loading...
        </AppText>
      </View>
    );
  }

  if (isMuezzin && !isAdmin) {
    return <Redirect href="/(muezzin)" />;
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.muted}>
          You do not have access to the admin console.
        </AppText>
      </View>
    );
  }

  return (
    <ScreenContainer
      contentStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <AppText variant="label" style={styles.eyebrow}>
            Local Admin
          </AppText>
          <AppText variant="sectionTitle" style={styles.title}>
            Mosque console
          </AppText>
          <AppText variant="body" color={tokens.color.text.secondary} style={styles.subtitle}>
            Run the day-to-day operation from one tighter control surface.
          </AppText>
        </View>
        <AppCard style={styles.managingCard}>
          <View style={styles.managingHeader}>
            <AppText variant="caption" color={tokens.color.text.secondary}>
              Active workspace
            </AppText>
            <View style={styles.workspaceBadge}>
              <AppText variant="caption" style={styles.workspaceBadgeText}>
                {selectedMosque ? 'Ready' : 'Needs selection'}
              </AppText>
            </View>
          </View>
          <AppText variant="title" style={styles.managingTitle}>
            {selectedMosque?.name ?? 'Select a mosque'}
          </AppText>
          <AppText variant="body" color={tokens.color.text.secondary}>
            {selectedMosque ? locationLabel : 'Choose the mosque you want to manage before opening a tool.'}
          </AppText>
        </AppCard>
      </View>

      <View style={styles.statusGrid}>
        <AppCard style={styles.statCard}>
          <AppText variant="caption" color={tokens.color.text.secondary}>Role</AppText>
          <AppText variant="title" style={styles.statValue}>{isLocalAdmin ? 'Local admin' : 'Admin'}</AppText>
          <AppText variant="caption" color={tokens.color.text.secondary}>Mosque-scoped operational access</AppText>
        </AppCard>
        <AppCard style={styles.statCard}>
          <AppText variant="caption" color={tokens.color.text.secondary}>Mosques</AppText>
          <AppText variant="title" style={styles.statValue}>{mosques.length}</AppText>
          <AppText variant="caption" color={tokens.color.text.secondary}>Available in this console</AppText>
        </AppCard>
      </View>

      {mosques.length > 1 ? (
        <View style={styles.selectorSection}>
          <AppText variant="caption" color={tokens.color.text.secondary}>
            Switch mosque
          </AppText>
          <View style={styles.selectorRow}>
            {mosques.map((m) => {
              const active = selectedMosque?.mosqueId === m.mosqueId;
              return (
                <Pressable
                  key={m.mosqueId}
                  onPress={() => setSelectedMosque(m.mosqueId)}
                  style={({ pressed }) => [styles.mosqueChip, active && styles.mosqueChipActive, pressed && styles.pressed]}
                >
                  <AppText style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {m.name}
                  </AppText>
                  <AppText variant="caption" style={[styles.chipSub, active && styles.chipSubActive]} numberOfLines={1}>
                    {[m.city, m.country].filter(Boolean).join(', ') || 'Mosque'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {!mosques.length && !selectedMosque ? (
        <AppCard subtle style={styles.emptyState}>
          <AppText variant="title" style={styles.emptyTitle}>
            No admin mosque found
          </AppText>
          <AppText variant="body" color={tokens.color.text.secondary}>
            You are not set up as a local admin for any mosque yet. Contact the main admin to be assigned.
          </AppText>
          {error ? (
            <AppText variant="caption" color={tokens.color.status.danger}>
              {error}
            </AppText>
          ) : null}
        </AppCard>
      ) : null}

      {selectedMosque ? (
        <AdminBanner
          tone="info"
          title="Current workspace"
          message={`Managing ${selectedMosque.name}${locationLabel ? `, ${locationLabel}` : ''}. Pull down to refresh access or updates.`}
        />
      ) : null}

      <View style={styles.sectionHeader}>
        <AppText variant="caption" color={tokens.color.text.secondary}>Operations</AppText>
        <AppText variant="title" style={styles.sectionTitle}>Daily control</AppText>
      </View>
      <View style={styles.toolGrid}>
        <AdminCard
          router={router}
          title="Prayer Times"
          description={
            isMainAdmin
              ? 'Upload timetable files or make manual schedule exceptions across mosques.'
              : 'Make day-level adhan and iqama corrections for your assigned mosque.'
          }
          href="/(admin)/prayer-times"
          disabled={disableActions}
          accent="Schedule"
        />
        <AdminCard
          router={router}
          title="Staff Rota"
          description="Assign muezzins and keep daily coverage organised."
          href="/(admin)/staff-rota"
          disabled={disableActions}
          accent="Operations"
        />
      </View>
      {isMainAdmin && (
        <View style={styles.sectionHeader}>
          <AppText variant="caption" color={tokens.color.text.secondary}>System Management</AppText>
          <AppText variant="title" style={styles.sectionTitle}>Global Administration</AppText>
        </View>
      )}
      {isMainAdmin && (
        <View style={styles.toolGrid}>
          <AdminCard
            router={router}
            title="Create Mosque"
            description="Set up a new mosque with basic information and assign local admins."
            href="/(admin)/mosque-onboarding"
            disabled={false}
            accent="Setup"
          />
        </View>
      )}
      <View style={styles.sectionHeader}>
        <AppText variant="caption" color={tokens.color.text.secondary}>Content</AppText>
        <AppText variant="title" style={styles.sectionTitle}>Mosque presence</AppText>
      </View>
      <View style={styles.toolGrid}>
        <AdminCard
          router={router}
          title="Events"
          description="Review upcoming mosque events and open each listing in detail."
          href="/(admin)/events"
          disabled={disableActions}
          accent="Content"
        />
        <AdminCard
          router={router}
          title="Admin Settings"
          description="Review your default mosque and account-level preferences."
          href="/(admin)/settings"
          disabled={false}
          accent="Account"
        />
      </View>

      {__DEV__ ? (
        <AppCard subtle style={styles.debugCard}>
          <AppText variant="caption" color={tokens.color.text.secondary}>
            Diagnostics
          </AppText>
          <AppText variant="title" style={styles.debugTitle}>
            Environment snapshot
          </AppText>
          <AppText variant="caption" style={styles.debugLine}>User ID: {session?.user?.id ?? 'unknown'}</AppText>
          <AppText variant="caption" style={styles.debugLine}>Role: {session?.user?.role ?? 'unknown'}</AppText>
          <AppText variant="caption" style={styles.debugLine}>Email: {(session?.user as any)?.email ?? 'unknown'}</AppText>
          <AppText variant="caption" style={styles.debugLine}>isAdmin: {isAdmin ? 'true' : 'false'}</AppText>
          <AppText variant="caption" style={styles.debugLine}>isLocalAdmin: {isLocalAdmin ? 'true' : 'false'}</AppText>
          <AppText variant="caption" style={styles.debugLine}>isMuezzin: {isMuezzin ? 'true' : 'false'}</AppText>
          <AppText variant="caption" style={styles.debugLine}>Admin mosques: {mosques.length}</AppText>
          <AppText variant="caption" style={styles.debugLine}>
            Selected mosque: {selectedMosque ? `${selectedMosque.name} (${selectedMosque.mosqueId})` : 'none'}
          </AppText>
          {error ? (
            <AppText variant="caption" color={tokens.color.status.danger}>
              Error: {error}
            </AppText>
          ) : null}
        </AppCard>
      ) : null}
    </ScreenContainer>
  );
}

type CardProps = {
  title: string;
  description: string;
  href: string;
  accent: string;
  disabled?: boolean;
  router: ReturnType<typeof useRouter>;
};

function AdminCard({ title, description, href, router, disabled, accent }: CardProps) {
  const handlePress = () => {
    if (disabled) return;
    router.push(href as any);
  };

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.card, pressed && !disabled && styles.pressed, disabled && styles.cardDisabled]}>
      <View style={styles.cardTop}>
        <View style={styles.cardAccent}>
          <AppText variant="caption" style={styles.cardAccentText}>
            {accent}
          </AppText>
        </View>
        <AppText variant="caption" color={disabled ? tokens.color.text.muted : '#0369A1'} style={styles.cardState}>
          {disabled ? 'Locked' : 'Open'}
        </AppText>
      </View>
      <View style={styles.cardBody}>
        <AppText variant="title" style={styles.cardTitle}>
          {title}
        </AppText>
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.cardDescription}>
          {description}
        </AppText>
      </View>
      <View style={styles.cardFooter}>
        <AppText variant="body" color={disabled ? tokens.color.text.muted : '#0F172A'} style={styles.cardLink}>
          {disabled ? 'Select a mosque first' : 'Enter tool'}
        </AppText>
        <AppText variant="body" color={disabled ? tokens.color.text.muted : '#0369A1'} style={styles.cardChevron}>
          {`>`}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 8 },
  muted: { textAlign: 'center' },
  pressed: { opacity: 0.92 },
  container: { gap: 14 },
  hero: { gap: 10 },
  heroCopy: { gap: 6 },
  eyebrow: { color: '#0369A1' },
  title: { fontSize: 22, lineHeight: 26 },
  subtitle: { lineHeight: 20, fontSize: 13 },
  managingCard: { gap: 6, backgroundColor: '#FEFFFF', padding: 14, borderRadius: 20, borderColor: '#DCEAF6' },
  managingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  workspaceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#ECFDF5',
  },
  workspaceBadgeText: {
    color: '#047857',
    fontWeight: tokens.typography.weight.bold,
  },
  managingTitle: { fontSize: 19, lineHeight: 23 },
  statusGrid: { flexDirection: 'row', gap: tokens.spacing.sm },
  statCard: { flex: 1, gap: 6, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  statValue: { fontSize: 18, lineHeight: 22 },
  selectorSection: { gap: 10 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mosqueChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    padding: 12,
    backgroundColor: '#FFFFFF',
    minWidth: 140,
    gap: 3,
  },
  mosqueChipActive: { borderColor: '#0EA5E9', backgroundColor: '#E0F2FE' },
  chipText: { fontWeight: tokens.typography.weight.extrabold, color: '#0F172A' },
  chipTextActive: { color: '#0C4A6E' },
  chipSub: { color: '#64748B' },
  chipSubActive: { color: '#075985' },
  emptyState: { gap: 6, borderRadius: 18 },
  emptyTitle: { fontSize: 18 },
  sectionHeader: { gap: 0, marginTop: 2 },
  sectionTitle: { fontSize: 17, lineHeight: 22 },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48.5%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE8F1',
    padding: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
    minHeight: 168,
    justifyContent: 'space-between',
  },
  cardDisabled: { opacity: 0.6 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardAccent: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#E6F6FF',
  },
  cardAccentText: {
    color: '#0369A1',
    fontWeight: tokens.typography.weight.bold,
  },
  cardState: {
    fontWeight: tokens.typography.weight.bold,
  },
  cardBody: {
    gap: 8,
  },
  cardTitle: { fontSize: 20, lineHeight: 24 },
  cardDescription: { lineHeight: 19, fontSize: 13 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardLink: { fontWeight: tokens.typography.weight.extrabold, fontSize: 14 },
  cardChevron: { fontWeight: tokens.typography.weight.extrabold, fontSize: 16 },
  debugCard: { gap: 4, marginTop: tokens.spacing.xs },
  debugTitle: { fontSize: 16 },
  debugLine: { color: '#475569' },
});
