'use client';

import React from 'react';
import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="prayer-times/index" />
      <Stack.Screen name="users/index" />
      <Stack.Screen name="mosques/index" />
      <Stack.Screen name="mosques/[id]" />
      <Stack.Screen name="mosques/[id]/prayer-times" />
    </Stack>
  );
}
