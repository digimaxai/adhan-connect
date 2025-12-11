import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function UserTabs() {
  const pillIcon = (icon: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <View
        style={{
          padding: 8,
          borderRadius: 12,
          backgroundColor: focused ? '#E0F2FE' : 'transparent',
        }}
      >
        <Ionicons name={icon} size={22} color={focused ? '#0EA5E9' : color} />
      </View>
    );

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarActiveTintColor: '#0F172A',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontWeight: '800', fontSize: 13, marginTop: 4 },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: 'transparent',
          height: Platform.OS === 'android' ? 78 : 86,
          paddingBottom: Platform.OS === 'android' ? 12 : 16,
          paddingTop: 10,
          paddingHorizontal: 18,
          shadowColor: '#0F172A',
          shadowOpacity: 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: pillIcon('home-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: pillIcon('settings-outline'),
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
