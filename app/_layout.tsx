// app/_layout.tsx
import { Stack, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';

// ✅ Notifications setup
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
  const segments = useSegments();

  const [routerReady, setRouterReady] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  

  // Ensure router segments are ready (avoid flicker)
  useEffect(() => {
    setRouterReady(true);
  }, [segments]);

  // Wait until initial auth check completes once
  useEffect(() => {
    if (!loading) {
      setIsSignedIn(!!session);
      setInitialCheckDone(true);
    }
  }, [loading, session]);

  // Show a loader until both router + auth are ready
  if (!routerReady || !initialCheckDone) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  // User not signed in → show auth stack
  if (!isSignedIn) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Quick Action',
          }}
        />
      </Stack>
    );
  }

  // Signed in → show main tabs
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="modal"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Quick Action',
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
