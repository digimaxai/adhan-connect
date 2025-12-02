import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function UserTabs() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
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
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Mosques',
          tabBarIcon: ({ color }) => <Ionicons name="location-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={20} color={color} />,
        }}
      />

      {/* hidden routes for user area */}
      <Tabs.Screen name="now" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="live-player" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="mosque" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="mosque/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="manage-mosques" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
