import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { useRoleFlags } from '../../lib/roles';

// app/(tabs)/_layout.tsx
export default function TabsLayout() {
  const { session, loading } = useAuth();
  const roles = useRoleFlags();

  if (loading || roles.loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: true,
        headerTitle: 'Adhan Connect',
        lazy: true,
        tabBarActiveTintColor: '#0EA5E9',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontWeight: '700', fontSize: 12 },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          height: Platform.OS === 'android' ? 64 : 80,
          paddingBottom: Platform.OS === 'android' ? 10 : 16,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={20} color={color} />,
        }}
      />

      <Tabs.Screen
        name="discover"
        options={{
          title: 'Mosques',
          tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" size={20} color={color} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={20} color={color} />,
        }}
      />

      {/* Internal routes not shown as tabs */}
      <Tabs.Screen name="admin" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="admin/prayer-times" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="muezzin" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="now" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="explore" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="mosque" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="events" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="manage-mosques" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="live-player" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="event" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="campaign" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
