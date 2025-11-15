// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform } from 'react-native';

export default function AuthLayout() {
  return (
    <>
      <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />

      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          // Native stack doesn’t support headerBackTitleVisible; omitted on purpose
        }}
      >
        <Stack.Screen
          name="sign-in"
          options={{
            title: 'Sign In',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="sign-up"
          options={{
            title: 'Create Account',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="reset"
          options={{
            title: 'Reset Password',
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </>
  );
}
