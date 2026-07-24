import { Redirect, Stack, router, usePathname, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../auth';
import { hasCurrentAccountConsent } from '../accountConsent';
import {
  isSocialAuthCompletionPending,
  subscribeSocialAuthCompletion,
} from '../authFlowState';
import {
  isGuestBrowsingEnabled,
  isGuestPublicRoute,
  setGuestBrowsingEnabled,
  subscribeGuestBrowsing,
} from '../guestAccess';
import { useRoleFlags } from '../roles';
import { getPreferredStaffEntry, subscribePreferredStaffEntry, type StaffEntryMode } from '../roleEntryPreferences';
import { isRoleEntrySelectionRequired, subscribeRoleEntrySelectionRequirement } from '../roleEntrySession';
import { resolveRoleEntryTarget, resolveRouteTargetHref } from '../roleRouting';

const DEBUG_ROOT_NAV = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_ROOT_NAV === '1';

function RootNavigator() {
  const { session, loading, signOut } = useAuth();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const [preferredEntry, setPreferredEntry] = useState<StaffEntryMode | null>(null);
  const [preferredEntryLoaded, setPreferredEntryLoaded] = useState(false);
  const [roleSelectionRequired, setRoleSelectionRequired] = useState(false);
  const [roleSelectionLoaded, setRoleSelectionLoaded] = useState(false);
  const [workspaceStateAccessToken, setWorkspaceStateAccessToken] =
    useState<string | null>(null);
  const [guestBrowsing, setGuestBrowsing] = useState(false);
  const [guestBrowsingLoaded, setGuestBrowsingLoaded] = useState(false);
  const [socialAuthPending, setSocialAuthPending] = useState(() =>
    isSocialAuthCompletionPending()
  );
  const [accessRetryKey, setAccessRetryKey] = useState(0);
  const [signingOutAfterAccessError, setSigningOutAfterAccessError] =
    useState(false);

  const inAuthFlow =
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    pathname === '/reset' ||
    pathname === '/callback' ||
    pathname === '/new-password';
  const inRoleEntry = pathname === '/role-entry' || segments[0] === 'role-entry';
  const inRecoveryFlow = pathname === '/callback' || pathname === '/new-password';
  const inAccountConsentFlow = pathname === '/complete-account';
  const inAccountRights = pathname === '/account';
  const inLegacyAccountPath = pathname === '/settings/account';
  const requiresAccountConsent =
    !!session?.user && !hasCurrentAccountConsent(session.user);
  const roles = useRoleFlags({
    enabled: Boolean(session?.user) && !requiresAccountConsent,
    refreshKey: accessRetryKey,
  });
  const roleResolutionSettled =
    !!session?.user &&
    !requiresAccountConsent &&
    roles.ready &&
    roles.resolvedUserId === session.user.id;
  const roleAccessReady = roleResolutionSettled && !roles.error;
  const targetStack =
    roles.hasMultipleWorkspaceAccess && roleSelectionRequired
      ? '/role-entry'
      : resolveRoleEntryTarget(roles, preferredEntry);
  const targetHref = resolveRouteTargetHref(targetStack);
  const debugSignatureRef = useRef<string | null>(null);
  const needsWorkspaceState =
    roleAccessReady && roles.hasMultipleWorkspaceAccess;
  const workspaceStateReady =
    !needsWorkspaceState ||
    (preferredEntryLoaded &&
      roleSelectionLoaded &&
      workspaceStateAccessToken === session?.access_token);
  const isBootstrapping =
    loading ||
    !guestBrowsingLoaded ||
    (!inRecoveryFlow &&
      !!session?.user &&
      !requiresAccountConsent &&
      !roleResolutionSettled) ||
    (!inRecoveryFlow && !workspaceStateReady);

  useEffect(() => {
    let cancelled = false;
    void isGuestBrowsingEnabled().then((enabled) => {
      if (cancelled) return;
      setGuestBrowsing(enabled);
      setGuestBrowsingLoaded(true);
    });
    const unsubscribe = subscribeGuestBrowsing((enabled) => {
      setGuestBrowsing(enabled);
      setGuestBrowsingLoaded(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(
    () => subscribeSocialAuthCompletion(setSocialAuthPending),
    []
  );

  useEffect(() => {
    if (!session?.user?.id || !guestBrowsing) return;
    // An authenticated session always replaces the limited guest state.
    void setGuestBrowsingEnabled(false);
  }, [guestBrowsing, session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    const userId = session?.user?.id ?? null;

    const accessToken = session?.access_token ?? null;

    if (!userId || !roleAccessReady) {
      setPreferredEntry(null);
      setPreferredEntryLoaded(false);
      setRoleSelectionRequired(false);
      setRoleSelectionLoaded(false);
      setWorkspaceStateAccessToken(null);
      return () => {
        cancelled = true;
      };
    }

    if (!roles.hasMultipleWorkspaceAccess) {
      setPreferredEntry(null);
      setPreferredEntryLoaded(true);
      setRoleSelectionRequired(false);
      setRoleSelectionLoaded(true);
      setWorkspaceStateAccessToken(accessToken);
      return () => {
        cancelled = true;
      };
    }

    setPreferredEntryLoaded(false);
    setRoleSelectionLoaded(false);
    setWorkspaceStateAccessToken(null);

    async function loadEntryState() {
      const [next, requiresSelection] = await Promise.all([
        getPreferredStaffEntry(userId),
        isRoleEntrySelectionRequired(userId),
      ]);
      if (!cancelled) {
        setPreferredEntry(next);
        setPreferredEntryLoaded(true);
        setRoleSelectionRequired(requiresSelection);
        setRoleSelectionLoaded(true);
        setWorkspaceStateAccessToken(accessToken);
      }
    }

    loadEntryState();
    return () => {
      cancelled = true;
    };
  }, [
    roleAccessReady,
    roles.hasMultipleWorkspaceAccess,
    session?.access_token,
    session?.user?.id,
  ]);

  useEffect(() => {
    const activeUserId = session?.user?.id ?? null;
    const unsubscribePreferred = subscribePreferredStaffEntry((userId, next) => {
      if (userId !== activeUserId) return;
      setPreferredEntry(next);
      setPreferredEntryLoaded(true);
    });
    const unsubscribeSelection = subscribeRoleEntrySelectionRequirement((userId, required) => {
      if (userId !== activeUserId) return;
      setRoleSelectionRequired(required);
      setRoleSelectionLoaded(true);
    });

    return () => {
      unsubscribePreferred();
      unsubscribeSelection();
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!DEBUG_ROOT_NAV) return;
    const signature = JSON.stringify({
      sessionUserId: session?.user?.id ?? null,
      authLoading: loading,
      rolesLoading: roles.loading,
      role: roles.role,
      pathname,
      segments,
      targetStack,
      targetHref,
      preferredEntry,
      preferredEntryLoaded,
      roleSelectionRequired,
      roleSelectionLoaded,
    });
    if (debugSignatureRef.current === signature) return;
    debugSignatureRef.current = signature;
    console.log('[RootNavigator]', {
      sessionUserId: session?.user?.id ?? null,
      authLoading: loading,
      rolesLoading: roles.loading,
      role: roles.role,
      pathname,
      segments,
      targetStack,
      targetHref,
      preferredEntry,
      preferredEntryLoaded,
      roleSelectionRequired,
      roleSelectionLoaded,
    });
  }, [
    loading,
    pathname,
    preferredEntry,
    preferredEntryLoaded,
    roleSelectionLoaded,
    roleSelectionRequired,
    roles.loading,
    roles.role,
    segments,
    session?.user?.id,
    targetHref,
    targetStack,
  ]);

  const currentRoot = `/${segments[0] ?? ''}`;
  if (isBootstrapping) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!isBootstrapping && !session && guestBrowsing && pathname === '/') {
    return <Redirect href={'/(user)/listener-home' as any} />;
  }
  const guestCanViewCurrentRoute = guestBrowsing && isGuestPublicRoute(pathname);
  if (!isBootstrapping && !session && !inAuthFlow && !guestCanViewCurrentRoute) {
    if (DEBUG_ROOT_NAV) {
      console.log('[RootNavigator] redirect sign-in', { pathname, segments });
    }
    return (
      <Redirect
        href={{
          pathname: '/sign-in',
          params: guestBrowsing ? { reason: 'required' } : undefined,
        } as any}
      />
    );
  }
  if (!isBootstrapping && session && inLegacyAccountPath) {
    return <Redirect href={'/account' as any} />;
  }
  if (
    !isBootstrapping &&
    session &&
    requiresAccountConsent &&
    !inRecoveryFlow &&
    !inAccountConsentFlow &&
    !inAccountRights
  ) {
    return <Redirect href={'/complete-account' as any} />;
  }

  if (
    session &&
    !requiresAccountConsent &&
    roles.error &&
    !inRecoveryFlow &&
    !inAccountRights
  ) {
    const leaveAccount = async () => {
      setSigningOutAfterAccessError(true);
      try {
        await signOut();
        await setGuestBrowsingEnabled(true);
        router.replace('/listener-home' as any);
      } catch {
        router.replace('/sign-in' as any);
      } finally {
        setSigningOutAfterAccessError(false);
      }
    };

    return (
      <View style={styles.accessErrorScreen}>
        <View style={styles.accessErrorCard}>
          <Text style={styles.accessErrorTitle}>Account access unavailable</Text>
          <Text style={styles.accessErrorBody}>
            We could not safely verify this account&apos;s current access. No
            personalised or staff workspace has been opened.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAccessRetryKey((current) => current + 1)}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryActionText}>Try again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/account' as any)}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Account &amp; data options</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={signingOutAfterAccessError}
            onPress={() => {
              void leaveAccount();
            }}
            style={styles.secondaryAction}
          >
            <Text style={styles.dangerActionText}>
              {signingOutAfterAccessError ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const shouldResolveEntryRoute =
    session &&
    !requiresAccountConsent &&
    !inRecoveryFlow &&
    !inAccountRights &&
    !socialAuthPending &&
    (pathname === '/' ||
      pathname === '/auth-complete' ||
      inAuthFlow ||
      inAccountConsentFlow ||
      (inRoleEntry && !roles.hasMultipleWorkspaceAccess));
  if (
    shouldResolveEntryRoute &&
    !(inRoleEntry && roles.hasMultipleWorkspaceAccess)
  ) {
    if (DEBUG_ROOT_NAV) {
      console.log('[RootNavigator] redirect target', {
        pathname,
        segments,
        currentRoot,
        targetStack,
        targetHref,
      });
    }
    return <Redirect href={targetHref as any} />;
  }

  const canBrowseUserStack =
    (!session && guestBrowsing) || roleAccessReady;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Protected guard={canBrowseUserStack}>
        <Stack.Screen name="(user)" />
      </Stack.Protected>
      <Stack.Protected guard={roleAccessReady && roles.isAdmin}>
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="admin-home" />
      </Stack.Protected>
      <Stack.Protected guard={roleAccessReady && roles.isMainAdmin}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="account" />
        <Stack.Screen name="auth-complete" />
        <Stack.Screen name="complete-account" />
      </Stack.Protected>
      <Stack.Protected guard={roleAccessReady && roles.isMuezzin}>
        <Stack.Screen name="(muezzin)" />
        <Stack.Screen name="muezzin/live-broadcast" />
        <Stack.Screen
          name="broadcast/[id]"
          options={{
            title: 'Adhan broadcast',
            presentation: 'modal',
          }}
        />
      </Stack.Protected>
      <Stack.Protected
        guard={roleAccessReady && roles.hasMultipleWorkspaceAccess}
      >
        <Stack.Screen name="role-entry" />
      </Stack.Protected>
      <Stack.Protected guard={roleAccessReady}>
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Quick Action',
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
  },
  accessErrorScreen: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  accessErrorCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 460,
    padding: 24,
    width: '100%',
  },
  accessErrorTitle: {
    color: '#0F172A',
    fontSize: 21,
    fontWeight: '800',
  },
  accessErrorBody: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
    marginTop: 8,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerActionText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
});
