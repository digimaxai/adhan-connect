// app/_layout.tsx
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';

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
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (!navigationState?.key || loading) return;

    if (!session && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, inAuthGroup, navigationState?.key, router]);

  if (loading || !navigationState?.key) {
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
