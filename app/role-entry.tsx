import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../components/ui/app-button';
import { AppCard } from '../components/ui/app-card';
import { AppText } from '../components/ui/app-text';
import { ScreenContainer } from '../components/ui/screen-container';
import { useAuth } from '../lib/auth';
import { getPreferredStaffEntry, setPreferredStaffEntry, type StaffEntryMode } from '../lib/roleEntryPreferences';
import { clearRoleEntrySelectionRequirement } from '../lib/roleEntrySession';
import { resolveRoleEntryTarget, resolveRouteTargetHref } from '../lib/roleRouting';
import { useRoleFlags } from '../lib/roles';
import { tokens } from '../theme/tokens';

type WorkspaceCard = {
  mode: StaffEntryMode;
  roleLabel: string;
  title: string;
  subtitle: string;
  defaultVariant?: 'primary' | 'secondary';
};

const WORKSPACE_CARDS: WorkspaceCard[] = [
  {
    mode: 'admin',
    roleLabel: 'Local Admin',
    title: 'Enter Admin',
    subtitle: 'Open the mosque console to manage prayer times, muezzins, rota, and settings.',
    defaultVariant: 'primary',
  },
  {
    mode: 'muezzin',
    roleLabel: 'Muezzin',
    title: 'Enter Muezzin',
    subtitle: 'Go straight to your rota, cover requests, and live adhan tools.',
    defaultVariant: 'secondary',
  },
];

export default function RoleEntryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const roles = useRoleFlags();
  const [busy, setBusy] = useState<StaffEntryMode | null>(null);
  const [preferredEntry, setPreferredEntry] = useState<StaffEntryMode | null>(null);
  const [preferredLoaded, setPreferredLoaded] = useState(false);
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!session || roles.loading) return;
      if (roles.hasDualStaffAccess) return;
      const storedPreference = await getPreferredStaffEntry(userId);
      if (cancelled) return;
      const target = resolveRoleEntryTarget(roles, storedPreference);
      if (target !== '/role-entry') {
        router.replace(resolveRouteTargetHref(target) as any);
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [roles, router, session, userId]);

  useEffect(() => {
    let cancelled = false;
    setPreferredLoaded(false);

    async function loadPreferred() {
      const storedPreference = await getPreferredStaffEntry(userId);
      if (!cancelled) {
        setPreferredEntry(storedPreference);
        setPreferredLoaded(true);
      }
    }

    loadPreferred();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const orderedCards = useMemo(() => {
    return [...WORKSPACE_CARDS].sort((left, right) => {
      if (!preferredEntry) return 0;
      if (left.mode === preferredEntry) return -1;
      if (right.mode === preferredEntry) return 1;
      return 0;
    });
  }, [preferredEntry]);

  const handleSelect = async (mode: StaffEntryMode) => {
    setBusy(mode);
    try {
      await Promise.all([
        setPreferredStaffEntry(userId, mode),
        clearRoleEntrySelectionRequirement(userId),
      ]);
      setPreferredEntry(mode);
      const target = mode === 'admin' ? '/(admin)' : '/(muezzin)';
      router.replace(resolveRouteTargetHref(target) as any);
    } finally {
      setBusy(null);
    }
  };

  if (!session || roles.loading || !preferredLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.color.text.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.container}>
      <View style={styles.hero}>
        <AppText variant="label" style={styles.eyebrow}>
          Choose Workspace
        </AppText>
        <AppText variant="hero" style={styles.title}>
          Enter as staff
        </AppText>
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.subtitle}>
          This account can operate as both Local Admin and Muezzin. Choose the workspace you need for this session.
        </AppText>
        {preferredEntry ? (
          <AppText variant="caption" color={tokens.color.text.secondary} style={styles.recommendationCopy}>
            {`Recommended: ${preferredEntry === 'admin' ? 'Admin workspace' : 'Muezzin workspace'} based on your last session.`}
          </AppText>
        ) : null}
      </View>

      {orderedCards.map((card) => {
        const recommended = preferredEntry === card.mode;
        const isMuezzin = card.mode === 'muezzin';
        return (
          <Pressable key={card.mode} onPress={() => handleSelect(card.mode)} style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}>
            <AppCard style={[styles.card, recommended && styles.cardRecommended]}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, isMuezzin && styles.badgeAlt]}>
                  <AppText variant="caption" style={[styles.badgeText, isMuezzin && styles.badgeAltText]}>
                    {card.roleLabel}
                  </AppText>
                </View>
                {recommended ? (
                  <View style={styles.recommendedBadge}>
                    <AppText variant="caption" style={styles.recommendedBadgeText}>
                      Recommended
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="title">{card.title}</AppText>
              <AppText variant="body" color={tokens.color.text.secondary} style={styles.copy}>
                {card.subtitle}
              </AppText>
              <AppButton
                title={busy === card.mode ? 'Opening...' : card.title}
                onPress={() => handleSelect(card.mode)}
                disabled={!!busy}
                variant={recommended ? 'primary' : card.defaultVariant ?? 'primary'}
              />
            </AppCard>
          </Pressable>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 32,
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    color: '#0369A1',
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    lineHeight: 21,
  },
  recommendationCopy: {
    marginTop: 2,
  },
  cardPressable: {
    borderRadius: 24,
  },
  pressed: {
    opacity: 0.96,
  },
  card: {
    gap: 12,
    borderRadius: 24,
    padding: 18,
  },
  cardRecommended: {
    borderWidth: 1,
    borderColor: '#7DD3FC',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#E0F2FE',
  },
  badgeAlt: {
    backgroundColor: '#DCFCE7',
  },
  badgeText: {
    color: '#0369A1',
    fontWeight: tokens.typography.weight.bold,
  },
  badgeAltText: {
    color: '#166534',
  },
  recommendedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#0F172A',
  },
  recommendedBadgeText: {
    color: '#FFFFFF',
    fontWeight: tokens.typography.weight.bold,
  },
  copy: {
    lineHeight: 20,
  },
});
