import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HapticTab } from '../../components/haptic-tab';
import { tokens } from '../../theme/tokens';

export default function UserTabs() {
  const pillIcon = (
    outlineIcon: keyof typeof Ionicons.glyphMap,
    filledIcon: keyof typeof Ionicons.glyphMap
  ) => {
    const Icon = ({ color, focused }: { color: string; focused: boolean }) => (
      <View
        style={{
          width: 42,
          height: 30,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: tokens.radius.pill,
          backgroundColor: focused ? '#E0F2FE' : 'transparent',
        }}
      >
        <Ionicons
          name={focused ? filledIcon : outlineIcon}
          size={focused ? 21 : 20}
          color={focused ? '#0284C7' : color}
        />
      </View>
    );
    Icon.displayName = `PillIcon(${outlineIcon})`;
    return Icon;
  };

  return (
    <Tabs
      initialRouteName="listener-home"
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: tokens.color.text.primary,
        tabBarInactiveTintColor: '#64748B',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontWeight: tokens.typography.weight.extrabold,
          fontSize: 10.5,
          lineHeight: 13,
          marginTop: 2,
        },
        tabBarItemStyle: { paddingTop: 7, paddingBottom: 3 },
        tabBarStyle: {
          backgroundColor: tokens.color.bg.surface,
          borderTopColor: '#E2E8F0',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'android' ? 70 : 78,
          paddingBottom: Platform.OS === 'android' ? 7 : 16,
          paddingTop: 2,
          paddingHorizontal: 8,
          shadowColor: '#0F172A',
          shadowOpacity: 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -5 },
          elevation: 16,
        },
      }}
    >
      <Tabs.Screen
        name="listener-home"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: pillIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="guidance"
        options={{
          title: 'Guidance',
          tabBarAccessibilityLabel: 'Guidance, Qur’an and reflection',
          tabBarIcon: pillIcon('sparkles-outline', 'sparkles'),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Mosques',
          tabBarAccessibilityLabel: 'Discover mosques',
          tabBarIcon: pillIcon('compass-outline', 'compass'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: pillIcon('settings-outline', 'settings'),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />

      {/* hidden routes for user area */}
      <Tabs.Screen name="quran" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="duas" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="now" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="live-player" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="mosque/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="event/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="campaign/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="jumuah/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="manage-mosques" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="invite-mosque" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="request-mosque" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
