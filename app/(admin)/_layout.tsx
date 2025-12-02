import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRoleFlags } from '../../lib/roles';

export default function AdminStack() {
  const roles = useRoleFlags();
  const router = useRouter();

  useEffect(() => {
    if (roles.loading) return;
    if (roles.isMuezzin) {
      router.replace('/(muezzin)');
    }
  }, [roles.loading, roles.isMuezzin, router]);

  if (roles.loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#0EA5E9" />
      </View>
    );
  }

  if (roles.isMuezzin) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="manage-mosques" />
      <Stack.Screen name="events" />
      <Stack.Screen name="admin/prayer-times" />
      <Stack.Screen name="muezzin" />
      <Stack.Screen name="broadcast" />
      <Stack.Screen name="campaign" />
      <Stack.Screen name="event" />
    </Stack>
  );
}
