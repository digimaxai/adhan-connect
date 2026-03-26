import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tokens } from '../../theme/tokens';

export default function UserTabs() {
  const pillIcon = (icon: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <View
        style={{
          padding: tokens.spacing.xs,
          borderRadius: tokens.radius.md,
          backgroundColor: focused ? tokens.color.bg.tintSoft : 'transparent',
        }}
      >
        <Ionicons name={icon} size={tokens.icon.md} color={focused ? tokens.color.text.accent : color} />
      </View>
    );

  return (
    <Tabs
      initialRouteName="listener-home"
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarActiveTintColor: tokens.color.text.primary,
        tabBarInactiveTintColor: tokens.color.text.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontWeight: tokens.typography.weight.extrabold,
          fontSize: tokens.typography.size.sm,
          marginTop: tokens.spacing.xxs,
        },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarStyle: {
          backgroundColor: tokens.color.bg.surface,
          borderTopColor: tokens.color.border.transparent,
          height: Platform.OS === 'android' ? tokens.tabBar.userHeightAndroid : tokens.tabBar.userHeightIos,
          paddingBottom: Platform.OS === 'android' ? tokens.spacing.sm : tokens.spacing.md,
          paddingTop: 10,
          paddingHorizontal: 18,
          ...tokens.shadow.card,
        },
      }}
    >
      <Tabs.Screen
        name="listener-home"
        options={{
          title: 'Home',
          tabBarIcon: pillIcon('home-outline'),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: pillIcon('compass-outline'),
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
      <Tabs.Screen name="mosque/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="manage-mosques" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
