import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components/ui/app-text';
import { ScreenContainer } from '@/components/ui/screen-container';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import { useAuth } from '@/lib/auth';

type ToolDef = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  requiresMosque: boolean;
};

type ToolSectionProps = {
  label: string;
  tools: ToolDef[];
  disabledAll: boolean;
  router: ReturnType<typeof useRouter>;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { loading: roleLoading, isAdmin, isMuezzin, isLocalAdmin, isMainAdmin, role, hasDualStaffAccess } = useRoleFlags();
  const { mosques, selectedMosque, loading: mosqueLoading, error, setSelectedMosque } = useAdminMosque();
  const { session } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const disableActions = !selectedMosque;
  const locationLabel = selectedMosque
    ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') || null
    : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {} finally {
      setRefreshing(false);
    }
  };

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tokens.color.status.info} />
        <AppText variant="body" style={styles.loadingText}>Loading…</AppText>
      </View>
    );
  }

  if (isMuezzin && !isAdmin) return <Redirect href={'/' as any} />;

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.muted}>
          You do not have access to the admin console.
        </AppText>
      </View>
    );
  }

  const dailyTools: ToolDef[] = [
    {
      title: 'Prayer Times',
      description: isMainAdmin
        ? 'Upload timetable files or make manual corrections.'
        : 'Set adhan and iqama times for each prayer.',
      href: '/(admin)/prayer-times',
      icon: 'time-outline',
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
      requiresMosque: true,
    },
    {
      title: 'Jumuah',
      description: 'Manage Friday slots, capacity guidance, and attendance planning.',
      href: '/(admin)/jumuah',
      icon: 'business-outline',
      iconBg: '#ECFDF5',
      iconColor: '#059669',
      requiresMosque: true,
    },
    {
      title: 'Staff Rota',
      description: 'Assign muezzins and keep daily coverage organised.',
      href: '/(admin)/staff-rota',
      icon: 'people-outline',
      iconBg: '#F5F3FF',
      iconColor: '#7C3AED',
      requiresMosque: true,
    },
    {
      title: 'Muezzins',
      description: 'Invite, activate, and manage cover requests.',
      href: '/(admin)/muezzins',
      icon: 'mic-outline',
      iconBg: '#ECFDF5',
      iconColor: '#059669',
      requiresMosque: true,
    },
  ];

  const contentTools: ToolDef[] = [
    {
      title: 'Events',
      description: 'Review and manage upcoming mosque events.',
      href: '/(admin)/events',
      icon: 'calendar-outline',
      iconBg: '#FFF7ED',
      iconColor: '#EA580C',
      requiresMosque: true,
    },
    {
      title: 'Reflection Planner',
      description: 'Build a reusable library and schedule reflections in batches.',
      href: '/(admin)/quotes',
      icon: 'book-outline',
      iconBg: '#FFFBF2',
      iconColor: '#D97706',
      requiresMosque: true,
    },
    {
      title: 'Admin Settings',
      description: 'Default mosque and account preferences.',
      href: '/(admin)/settings',
      icon: 'settings-outline',
      iconBg: '#F1F5F9',
      iconColor: '#475569',
      requiresMosque: false,
    },
  ];

  const systemTools: ToolDef[] = isMainAdmin
    ? [
        {
          title: 'Create Mosque',
          description: 'Register a new mosque and assign local admins.',
          href: '/(admin)/mosque-onboarding',
          icon: 'add-circle-outline',
          iconBg: '#F0FDFA',
          iconColor: '#0D9488',
          requiresMosque: false,
        },
      ]
    : [];

  return (
    <ScreenContainer
      contentStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.color.status.info} />
      }
    >
      {/* ── Mosque header ── */}
      <View style={styles.header}>
        <AppText variant="label" style={styles.eyebrow}>Local Admin</AppText>
        <View style={styles.mosqueRow}>
          <AppText variant="sectionTitle" style={styles.mosqueName} numberOfLines={1}>
            {selectedMosque?.name ?? 'No mosque assigned'}
          </AppText>
          {selectedMosque && (
            <View style={styles.readyBadge}>
              <View style={styles.readyDot} />
              <AppText variant="caption" style={styles.readyText}>Ready</AppText>
            </View>
          )}
        </View>
        {locationLabel ? (
          <AppText variant="body" color={tokens.color.text.secondary}>{locationLabel}</AppText>
        ) : !selectedMosque ? (
          <AppText variant="body" color={tokens.color.text.secondary}>
            Assign a mosque to unlock daily operations.
          </AppText>
        ) : null}
        {hasDualStaffAccess ? (
          <Pressable
            onPress={() => router.push('/role-entry' as any)}
            style={({ pressed }) => [styles.switchWorkspaceBtn, pressed && styles.pressed]}
          >
            <Ionicons name="swap-horizontal-outline" size={15} color="#2563EB" />
            <AppText style={styles.switchWorkspaceBtnText}>Switch to Muezzin view</AppText>
          </Pressable>
        ) : null}
      </View>

      {/* ── Multi-mosque switcher ── */}
      {mosques.length > 1 && (
        <View style={styles.switcher}>
          <AppText variant="caption" color={tokens.color.text.muted} style={styles.switcherLabel}>
            SWITCH MOSQUE
          </AppText>
          <View style={styles.switcherRow}>
            {mosques.map((m) => {
              const active = selectedMosque?.mosqueId === m.mosqueId;
              return (
                <Pressable
                  key={m.mosqueId}
                  onPress={() => setSelectedMosque(m.mosqueId)}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText
                    style={[styles.chipText, active && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {m.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* ── No mosque assigned ── */}
      {!mosques.length && (
        <View style={styles.emptyCard}>
          <Ionicons name="alert-circle-outline" size={28} color={tokens.color.text.muted} />
          <AppText variant="body" color={tokens.color.text.secondary} style={styles.emptyText}>
            You are not assigned as local admin for any mosque yet. Contact the main admin to be set up.
          </AppText>
          {error ? (
            <AppText variant="caption" color={tokens.color.status.danger}>{error}</AppText>
          ) : null}
        </View>
      )}

      {/* ── Daily operations ── */}
      <ToolSection
        label="Daily operations"
        tools={dailyTools}
        disabledAll={disableActions}
        router={router}
      />

      {/* ── System management (main admin only) ── */}
      {systemTools.length > 0 && (
        <ToolSection
          label="System management"
          tools={systemTools}
          disabledAll={false}
          router={router}
        />
      )}

      {/* ── Content & settings ── */}
      <ToolSection
        label="Content & settings"
        tools={contentTools}
        disabledAll={false}
        router={router}
      />

      {/* ── Dev diagnostics ── */}
      {__DEV__ && (
        <View style={styles.debugCard}>
          <AppText variant="caption" color={tokens.color.text.muted} style={styles.debugHeader}>
            Diagnostics
          </AppText>
          {[
            `User: ${session?.user?.id ?? 'unknown'}`,
            `Role: ${role ?? 'unknown'}  ·  Email: ${(session?.user as any)?.email ?? 'unknown'}`,
            `isAdmin: ${isAdmin}  ·  isLocalAdmin: ${isLocalAdmin}  ·  isMuezzin: ${isMuezzin}`,
            `Mosques: ${mosques.length}  ·  Selected: ${selectedMosque?.name ?? 'none'}${selectedMosque ? ` (${selectedMosque.mosqueId})` : ''}`,
          ].map((line, i) => (
            <AppText key={i} variant="caption" style={styles.debugLine}>{line}</AppText>
          ))}
          {error ? (
            <AppText variant="caption" color={tokens.color.status.danger}>Error: {error}</AppText>
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
}

function ToolSection({ label, tools, disabledAll, router }: ToolSectionProps) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" color={tokens.color.text.muted} style={styles.sectionLabel}>
        {label.toUpperCase()}
      </AppText>
      <View style={styles.sectionCard}>
        {tools.map((tool, index) => {
          const isDisabled = disabledAll && tool.requiresMosque;
          const isLast = index === tools.length - 1;
          return (
            <React.Fragment key={tool.href}>
              <Pressable
                onPress={() => { if (!isDisabled) router.push(tool.href as any); }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && !isDisabled && styles.rowPressed,
                  isDisabled && styles.rowDisabled,
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: isDisabled ? '#F1F5F9' : tool.iconBg }]}>
                  <Ionicons
                    name={tool.icon}
                    size={20}
                    color={isDisabled ? tokens.color.text.muted : tool.iconColor}
                  />
                </View>
                <View style={styles.rowText}>
                  <AppText variant="body" style={[styles.rowTitle, isDisabled && styles.rowTitleDisabled]}>
                    {tool.title}
                  </AppText>
                  <AppText variant="caption" color={tokens.color.text.secondary} style={styles.rowDesc} numberOfLines={1}>
                    {isDisabled ? 'Select a mosque to unlock' : tool.description}
                  </AppText>
                </View>
                <Ionicons
                  name={isDisabled ? 'lock-closed-outline' : 'chevron-forward'}
                  size={16}
                  color={tokens.color.text.muted}
                />
              </Pressable>
              {!isLast && <View style={styles.divider} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 24 },
  loadingText: { color: tokens.color.text.secondary },
  muted: { textAlign: 'center' },
  pressed: { opacity: 0.88 },
  container: { gap: 20, paddingBottom: 48 },

  // Header
  header: { gap: 4, paddingTop: 4 },
  eyebrow: { color: '#0369A1', fontWeight: tokens.typography.weight.bold, fontSize: tokens.typography.size.sm },
  mosqueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  mosqueName: { fontSize: 26, lineHeight: 32, fontWeight: tokens.typography.weight.extrabold, flex: 1 },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#ECFDF5',
  },
  readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669' },
  readyText: { color: '#047857', fontWeight: tokens.typography.weight.bold },

  // Switch workspace
  switchWorkspaceBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  switchWorkspaceBtnText: { fontSize: 13, fontWeight: tokens.typography.weight.semibold, color: '#2563EB' },

  // Mosque switcher
  switcher: { gap: 8 },
  switcherLabel: { fontSize: 11, letterSpacing: 0.6, fontWeight: tokens.typography.weight.bold },
  switcherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    backgroundColor: tokens.color.bg.surface,
  },
  chipActive: { borderColor: '#0EA5E9', backgroundColor: '#E0F2FE' },
  chipText: { fontSize: tokens.typography.size.sm, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.secondary },
  chipTextActive: { color: '#0C4A6E', fontWeight: tokens.typography.weight.bold },

  // Empty state
  emptyCard: {
    gap: 10,
    padding: 20,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.subtle,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    alignItems: 'center',
  },
  emptyText: { textAlign: 'center', lineHeight: 22 },

  // Tool section
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: tokens.typography.weight.bold },
  sectionCard: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    overflow: 'hidden',
    ...tokens.shadow.card,
  },

  // Tool row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: tokens.color.bg.surface,
  },
  rowPressed: { backgroundColor: '#F8FAFC' },
  rowDisabled: { opacity: 0.5 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text.primary },
  rowTitleDisabled: { color: tokens.color.text.muted },
  rowDesc: { fontSize: tokens.typography.size.xs, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.color.border.subtle, marginLeft: 70 },

  // Debug
  debugCard: {
    gap: 4,
    padding: 14,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.bg.subtle,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
  },
  debugHeader: { fontWeight: tokens.typography.weight.bold, marginBottom: 4 },
  debugLine: { color: '#64748B' },
});
