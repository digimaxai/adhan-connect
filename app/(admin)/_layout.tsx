import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoleFlags } from '../../lib/roles';
import { tokens } from '../../theme/tokens';

// Local Admin brand accent — distinct from Listener (blue) and Muezzin (blue),
// so the tab bar itself signals which workspace is active. Reused from the
// Classes & courses / Prayer Times admin UI for a single consistent identity.
const ADMIN_ACCENT = '#155F4E';
const ADMIN_ACCENT_SOFT = '#E7F3EE';

export default function AdminTabs() {
  const roles = useRoleFlags({ reuseResolvedSessionAccess: true });

  if (roles.loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ADMIN_ACCENT} />
      </View>
    );
  }

  if (!roles.isAdmin) {
    return <Redirect href={'/listener-home' as any} />;
  }

  const pillIcon = (outlineIcon: keyof typeof Ionicons.glyphMap, filledIcon: keyof typeof Ionicons.glyphMap) => {
    const Icon = ({ color, focused }: { color: string; focused: boolean }) => (
      <View
        style={{
          width: 42,
          height: 30,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: tokens.radius.pill,
          backgroundColor: focused ? ADMIN_ACCENT_SOFT : 'transparent',
        }}
      >
        <Ionicons name={focused ? filledIcon : outlineIcon} size={focused ? 21 : 20} color={focused ? ADMIN_ACCENT : color} />
      </View>
    );
    Icon.displayName = `PillIcon(${outlineIcon})`;
    return Icon;
  };

  return (
    <Tabs
      initialRouteName="admin-home"
      screenOptions={{
        headerShown: false,
        lazy: true,
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
      {/*
        Five visible tabs, matching Listener's count exactly. Chosen by how
        often a local admin repeatedly DOES something on that screen (not
        just glances at it): Prayer Times and Classes are edit/correct
        workflows used all the time; Enquiries is a reply-driven inbox that
        benefits from always being one tap away. Settings stays last across
        every role for the same "workspace switch always lives here" reason
        established for Listener/Muezzin. Staff Rota, Content (events/
        campaigns/notices) and Attendance & Engagement move to Home — Rota
        and Content by explicit request, Attendance because it's a glance-
        and-leave report rather than a repeated action, and reports read
        better as a Home card than as a tab (see the engagement summary
        card on Home).

        Labels are single words (or "My Mosque"-length two-word labels,
        already proven not to truncate on Listener) so none of the five
        clip on a narrow phone.
      */}
      <Tabs.Screen
        name="admin-home"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: pillIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="prayer-times/index"
        options={{
          title: 'Prayers',
          tabBarAccessibilityLabel: 'Prayer times',
          tabBarIcon: pillIcon('time-outline', 'time'),
        }}
      />
      <Tabs.Screen
        name="services/index"
        options={{
          title: 'Classes',
          tabBarAccessibilityLabel: 'Classes and courses',
          tabBarIcon: pillIcon('school-outline', 'school'),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Enquiries',
          tabBarAccessibilityLabel: 'Enquiries',
          tabBarIcon: pillIcon('chatbubbles-outline', 'chatbubbles'),
        }}
      />
      <Tabs.Screen
        name="admin-settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: pillIcon('settings-outline', 'settings'),
        }}
      />

      {/* ── Hidden routes: reached from Home tiles, editors and detail screens ── */}
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="admin-account" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="admin-manage-mosques" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="admin-muezzin" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="announcement/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="attendance" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="broadcast-editor/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="campaign-editor/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="campaign-preview/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="enquiry-detail" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="event-editor/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="events" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="iqamah-schedules/index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="jumuah" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="messages-thread" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="mosque-facilities" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="mosque-onboarding" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="mosque-services" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="muezzins" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="previous-conversations" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="staff-rota/index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="services/[id]" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
