import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppButton } from '../components/ui/app-button';
import { AppCard } from '../components/ui/app-card';
import { AppText } from '../components/ui/app-text';
import { ScreenContainer } from '../components/ui/screen-container';
import { useAuth } from '../lib/auth';
import { getPreferredStaffEntry, setPreferredStaffEntry, type StaffEntryMode } from '../lib/roleEntryPreferences';
import { clearRoleEntrySelectionRequirement } from '../lib/roleEntrySession';
import {
  getAvailableWorkspaceModes,
  resolveRoleEntryTarget,
  resolveRouteTargetHref,
} from '../lib/roleRouting';
import { useRoleFlags } from '../lib/roles';
import { tokens } from '../theme/tokens';

type WorkspaceCard = {
  mode: StaffEntryMode;
  roleLabel: string;
  title: string;
  subtitle: string;
  defaultVariant?: 'primary' | 'secondary';
};

const WORKSPACE_CARD_DETAILS: Record<
  StaffEntryMode,
  Omit<WorkspaceCard, 'mode' | 'roleLabel'>
> = {
  listener: {
    title: 'Enter Listener',
    subtitle:
      'Follow mosques, view prayer information, plan Jumu’ah attendance, and use listener preferences.',
    defaultVariant: 'primary',
  },
  admin: {
    title: 'Enter Admin',
    subtitle:
      'Open the mosque console to manage prayer times, muezzins, rota, and settings.',
    defaultVariant: 'secondary',
  },
  muezzin: {
    title: 'Enter Muezzin',
    subtitle: 'Go straight to your rota, cover requests, and live adhan tools.',
    defaultVariant: 'secondary',
  },
};

function workspaceLabel(mode: StaffEntryMode) {
  if (mode === 'listener') return 'Listener workspace';
  if (mode === 'admin') return 'Admin workspace';
  return 'Muezzin workspace';
}

export default function RoleEntryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const roles = useRoleFlags();
  const [busy, setBusy] = useState<StaffEntryMode | null>(null);
  const [preferredEntry, setPreferredEntry] = useState<StaffEntryMode | null>(null);
  const [preferredLoaded, setPreferredLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user?.id ?? null;
  const availableModes = useMemo(() => getAvailableWorkspaceModes(roles), [roles]);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!session || roles.loading) return;
      if (roles.hasMultipleWorkspaceAccess) return;
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
    const cards = availableModes.map<WorkspaceCard>((mode) => ({
      mode,
      roleLabel:
        mode === 'admin'
          ? roles.isMainAdmin
            ? 'Main Admin'
            : 'Local Admin'
          : mode === 'muezzin'
            ? 'Muezzin'
            : 'Listener',
      ...WORKSPACE_CARD_DETAILS[mode],
    }));

    return cards.sort((left, right) => {
      if (!preferredEntry) return 0;
      if (left.mode === preferredEntry) return -1;
      if (right.mode === preferredEntry) return 1;
      return 0;
    });
  }, [availableModes, preferredEntry, roles.isMainAdmin]);

  const handleSelect = async (mode: StaffEntryMode) => {
    if (!userId || !availableModes.includes(mode) || busy) return;
    setBusy(mode);
    setError(null);
    try {
      await Promise.all([
        setPreferredStaffEntry(userId, mode),
        clearRoleEntrySelectionRequirement(userId),
      ]);
      setPreferredEntry(mode);
      const target = resolveRoleEntryTarget(roles, mode);
      if (target === '/role-entry') {
        throw new Error('The selected workspace is no longer available.');
      }
      router.replace(resolveRouteTargetHref(target) as any);
    } catch {
      setError(
        'We could not save that workspace choice. Check your connection and try again.'
      );
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
          Choose your workspace
        </AppText>
        <AppText variant="body" color={tokens.color.text.secondary} style={styles.subtitle}>
          Listener access stays available to every account. Staff workspaces
          appear from your verified mosque assignments.
        </AppText>
        {preferredEntry && availableModes.includes(preferredEntry) ? (
          <AppText variant="caption" color={tokens.color.text.secondary} style={styles.recommendationCopy}>
            {`Recommended: ${workspaceLabel(preferredEntry)} based on your last session.`}
          </AppText>
        ) : null}
        {error ? (
          <AppText variant="caption" color={tokens.color.status.danger}>
            {error}
          </AppText>
        ) : null}
      </View>

      {orderedCards.map((card) => {
        const recommended = preferredEntry === card.mode;
        const isListener = card.mode === 'listener';
        const isMuezzin = card.mode === 'muezzin';
        return (
          <View key={card.mode} style={styles.cardWrapper}>
            <AppCard style={[styles.card, recommended && styles.cardRecommended]}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.badge,
                    isListener && styles.badgeListener,
                    isMuezzin && styles.badgeMuezzin,
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={[
                      styles.badgeText,
                      isListener && styles.badgeListenerText,
                      isMuezzin && styles.badgeMuezzinText,
                    ]}
                  >
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
          </View>
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
  cardWrapper: {
    borderRadius: 24,
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
  badgeListener: {
    backgroundColor: '#F1F5F9',
  },
  badgeMuezzin: {
    backgroundColor: '#DCFCE7',
  },
  badgeText: {
    color: '#0369A1',
    fontWeight: tokens.typography.weight.bold,
  },
  badgeListenerText: {
    color: '#334155',
  },
  badgeMuezzinText: {
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
