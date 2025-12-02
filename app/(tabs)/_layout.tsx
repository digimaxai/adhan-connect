import { Redirect, Stack } from 'expo-router';
import React from 'react';

export default function LegacyTabsRedirect() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Redirect href="/(user)" />
    </Stack>
  );
}
