'use client';

import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useRoleFlags } from '../../lib/roles';
import { tokens } from '../../theme/tokens';

export default function AdminLayout() {
  const roles = useRoleFlags();

  if (roles.loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.color.status.info} />
      </View>
    );
  }

  if (!roles.isMainAdmin) {
    return <Redirect href={'/listener-home' as any} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="prayer-times/index" />
      <Stack.Screen name="users/index" />
      <Stack.Screen name="mosques/index" />
      <Stack.Screen name="mosques/[id]" />
      <Stack.Screen name="mosques/[id]/prayer-times" />
    </Stack>
  );
}
