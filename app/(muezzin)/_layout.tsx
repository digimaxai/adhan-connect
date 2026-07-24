import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoleFlags } from '../../lib/roles';
import { tokens } from '../../theme/tokens';

export default function MuezzinTabs() {
  const roles = useRoleFlags();

  if (roles.loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.color.status.info} />
      </View>
    );
  }

  if (!roles.isMuezzin) {
    return <Redirect href={'/listener-home' as any} />;
  }

  const pillIcon = (icon: keyof typeof Ionicons.glyphMap) => {
    const Icon = ({ color, focused }: { color: string; focused: boolean }) => (
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
    Icon.displayName = `PillIcon(${icon})`;
    return Icon;
  };

  return (
    <Tabs
      initialRouteName="muezzin-home"
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
          height: tokens.tabBar.muezzinHeight,
          paddingBottom: 12,
          paddingTop: 10,
          paddingHorizontal: 18,
          ...tokens.shadow.card,
        },
      }}
    >
      <Tabs.Screen
        name="muezzin-home"
        options={{
          title: 'Home',
          tabBarIcon: pillIcon('home-outline'),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="my-rota"
        options={{
          title: 'My Rota',
          tabBarIcon: pillIcon('calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="muezzin-settings"
        options={{
          title: 'Settings',
          tabBarIcon: pillIcon('settings-outline'),
        }}
      />
      <Tabs.Screen name="mosque-discovery" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="live-broadcast" options={{ href: null, headerShown: false }} />

      {/* hidden routes for muezzin area */}
      <Tabs.Screen name="muezzin" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="listener-now" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="listener-live-player" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="muezzin-live" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="live" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="listener-mosque/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="muezzin-manage-mosques" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
