import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
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

  const iconText = (label: string, color: string) => (
    <Text style={{ color, fontSize: 14, fontWeight: '800' }}>{label}</Text>
  );

  const isMz = roles.isMuezzin;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: true,
        headerTitle: 'Adhan Connect',
        lazy: true,
        tabBarActiveTintColor: '#0EA5E9',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
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
          tabBarIcon: ({ color }) => iconText('Home', color),
        }}
      />

      {isMz ? (
        <Tabs.Screen
          name="muezzin"
          options={{
            title: 'Muezzin',
            tabBarIcon: ({ color }) => iconText('Adhan', color),
          }}
        />
      ) : (
        <>
          <Tabs.Screen
            name="now"
            options={{
              title: 'Now',
              tabBarIcon: ({ color }) => iconText('Now', color),
            }}
          />
          <Tabs.Screen
            name="events"
            options={{
              title: 'Events',
              tabBarIcon: ({ color }) => iconText('Events', color),
            }}
          />
        </>
      )}

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => iconText('Settings', color),
        }}
      />

      {/* Internal routes not shown as tabs */}
      {roles.isAdmin && <Tabs.Screen name="admin" options={{ href: null }} />}
      {!isMz && <Tabs.Screen name="muezzin" options={{ href: null }} />}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
