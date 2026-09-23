import { Stack } from 'expo-router';
import React from 'react';

export default function GuidanceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
