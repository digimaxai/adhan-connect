// app/(tabs)/settings/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function SettingsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // we already show a header from the Tabs level
      }}
    >
      {/* Settings screens inside this stack */}
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="location" />
      <Stack.Screen name="mixer" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
