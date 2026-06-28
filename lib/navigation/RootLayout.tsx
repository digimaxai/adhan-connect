import { Redirect, Stack, usePathname, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '../auth';
import { useRoleFlags } from '../roles';
import { getPreferredStaffEntry, subscribePreferredStaffEntry, type StaffEntryMode } from '../roleEntryPreferences';
import { isRoleEntrySelectionRequired, subscribeRoleEntrySelectionRequirement } from '../roleEntrySession';
import { resolveRoleEntryTarget, resolveRouteTargetHref } from '../roleRouting';

const DEBUG_ROOT_NAV = process.env.EXPO_PUBLIC_DEBUG_ROOT_NAV === '1';

function RootNavigator() {
  const { session, loading } = useAuth();
  const roles = useRoleFlags();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const [preferredEntry, setPreferredEntry] = useState<StaffEntryMode | null>(null);
  const [preferredEntryLoaded, setPreferredEntryLoaded] = useState(false);
  const [roleSelectionRequired, setRoleSelectionRequired] = useState(false);
  const [roleSelectionLoaded, setRoleSelectionLoaded] = useState(false);

  const inAuthFlow =
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    pathname === '/reset' ||
    pathname === '/callback' ||
    pathname === '/new-password';
  const inRoleEntry = pathname === '/role-entry' || segments[0] === 'role-entry';
  const inRecoveryFlow = pathname === '/callback' || pathname === '/new-password';
  const targetStack = roles.hasDualStaffAccess && roleSelectionRequired ? '/role-entry' : resolveRoleEntryTarget(roles, preferredEntry);
  const targetHref = resolveRouteTargetHref(targetStack);
  const targetIsGroupedRoot = /^\/\(.+\)$/.test(targetStack);
  const isAtGroupedRootIndex = pathname === '/' && segments.length === 0;
  const targetWorkspaceRoot =
    targetStack === '/listener-home'
      ? '/(user)'
      : targetStack === '/admin'
        ? '/admin'
        : targetIsGroupedRoot
          ? targetStack
          : null;
  const debugSignatureRef = useRef<string | null>(null);
  const isBootstrapping =
    loading || roles.loading || !navigationState?.key || !preferredEntryLoaded || !roleSelectionLoaded;

  useEffect(() => {
    let cancelled = false;
    const userId = session?.user?.id ?? null;

    if (!userId || roles.loading || !roles.hasDualStaffAccess) {
      setPreferredEntry(null);
      setPreferredEntryLoaded(true);
      setRoleSelectionRequired(false);
      setRoleSelectionLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    setPreferredEntryLoaded(false);
    setRoleSelectionLoaded(false);

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
      }
    }

    loadEntryState();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, roles.loading, roles.hasDualStaffAccess]);

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
  if (!isBootstrapping && !session && !inAuthFlow) {
    if (DEBUG_ROOT_NAV) {
      console.log('[RootNavigator] redirect sign-in', { pathname, segments });
    }
    return <Redirect href={'/sign-in' as any} />;
  }

  const isAtTarget =
    targetStack === '/role-entry'
      ? inRoleEntry
      : (targetStack === '/(muezzin)' && pathname === '/muezzin-home') ||
        (targetStack === '/(admin)' && pathname === '/admin-home') ||
        pathname === targetStack ||
        currentRoot === targetStack ||
        (targetWorkspaceRoot !== null && currentRoot === targetWorkspaceRoot) ||
        (targetIsGroupedRoot && isAtGroupedRootIndex);

  if (!isBootstrapping && session && !inRecoveryFlow && !isAtTarget) {
    if (!(inRoleEntry && roles.hasDualStaffAccess)) {
      if (DEBUG_ROOT_NAV) {
        console.log('[RootNavigator] redirect target', {
          pathname,
          segments,
          currentRoot,
          targetStack,
          targetHref,
          isAtGroupedRootIndex,
        });
      }
      return <Redirect href={targetHref as any} />;
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(user)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="admin-home" />
        <Stack.Screen name="(muezzin)" />
        <Stack.Screen name="role-entry" />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Quick Action',
          }}
        />
        <Stack.Screen
          name="broadcast/[id]"
          options={{
            title: 'Adhan broadcast',
            presentation: 'modal',
          }}
        />
      </Stack>
      {isBootstrapping ? (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.92)',
          }}
        >
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
