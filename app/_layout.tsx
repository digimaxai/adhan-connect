// app/_layout.tsx
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { useRoleFlags } from '../lib/roles';

// Notifications setup
import * as Notifications from 'expo-notifications';
import { ensureAndroidChannel } from '../lib/notify';

// Global notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function RootNavigator() {
  const { session, loading } = useAuth();
  const roles = useRoleFlags();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const inAuthGroup = segments[0] === '(auth)';
  const inRecoveryFlow =
    segments.includes('(auth)') && (segments.includes('callback') || segments.includes('new-password'));
  const isAdmin = roles.isAdmin || roles.isLocalAdmin;
  const isMuezzin = roles.isMuezzin;
  const isMainAdmin = roles.isMainAdmin;
  const targetStack = isMuezzin ? '/(muezzin)' : isMainAdmin ? '/admin' : isAdmin ? '/(admin)' : '/(user)';

  useEffect(() => {
    if (!navigationState?.key || loading || roles.loading) return;

    const currentRoot = `/${segments[0] ?? ''}`;
    if (!session) {
      if (!inAuthGroup) router.replace('/sign-in');
      return;
    }

    // During recovery/password reset, stay in auth stack.
    if (inRecoveryFlow) return;

    // Always prioritize muezzin stack if muezzin flag is true, regardless of admin role.
    if (currentRoot !== targetStack) {
      router.replace(targetStack);
    }
  }, [session, loading, roles.loading, targetStack, inAuthGroup, inRecoveryFlow, navigationState?.key, router, segments]);

  if (loading || roles.loading || !navigationState?.key) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(user)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="(muezzin)" />
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
  );
}

export default function RootLayout() {
  // One-time Android notification channel setup
  useEffect(() => {
    if (Platform.OS === 'android') {
      ensureAndroidChannel().catch(() => {
        // non-fatal: ignore setup errors in dev
      });
    }
  }, []);

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
