import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRoleFlags } from '../../lib/roles';

export default function AdminStack() {
  const roles = useRoleFlags();

  if (roles.loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#0EA5E9" />
      </View>
    );
  }

  if (!roles.isAdmin) {
    return <Redirect href={'/listener-home' as any} />;
  }

  return (
    <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="admin-manage-mosques" />
      <Stack.Screen name="events" />
      <Stack.Screen name="jumuah" />
      <Stack.Screen name="prayer-times/index" />
      <Stack.Screen name="staff-rota/index" />
      <Stack.Screen name="muezzins" />
      <Stack.Screen name="admin-muezzin" />
      <Stack.Screen name="broadcast-editor/[id]" />
      <Stack.Screen name="campaign-editor/[id]" />
      <Stack.Screen name="event-editor/[id]" />
      <Stack.Screen name="announcement/[id]" />
      <Stack.Screen name="admin-settings" />
      <Stack.Screen name="admin-account" />
      <Stack.Screen name="mosque-onboarding" />
      <Stack.Screen name="quotes" />
    </Stack>
  );
}
