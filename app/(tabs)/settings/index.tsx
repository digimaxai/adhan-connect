// app/(tabs)/settings/index.tsx
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../../lib/auth';
import { useRoleFlags } from '../../../lib/roles';

type RowProps = {
  title: string;
  subtitle?: string;
  href: string;
};

function SettingsRow({ title, subtitle, href }: RowProps) {
  return (
    <Link href={href as any} asChild>
      <Pressable
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { loading, isAdmin, isMuezzin } = useRoleFlags();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>Settings</Text>
        <Text style={{ color: '#64748B', marginTop: 4 }}>
          Signed in as {user?.email ?? 'Unknown'}
        </Text>
      </View>

      {/* Notifications, audio, subs – visible to all */}
      <View style={{ backgroundColor: '#fff', marginTop: 8 }}>
        <SettingsRow
          title="Notifications"
          subtitle="Adhan alerts & reminders"
          href="/(tabs)/settings/notifications"
        />
        <SettingsRow
          title="Audio mixer"
          subtitle="Per-mosque volume & mute"
          href="/(tabs)/settings/mixer"
        />
        <SettingsRow
          title="Mosque subscriptions"
          subtitle="Manage followed mosques"
          href="/(tabs)/settings/subscriptions"
        />
      </View>

      {/* Role-specific sections */}
      {!loading && (isMuezzin || isAdmin) && (
        <View style={{ backgroundColor: '#fff', marginTop: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: '#64748B',
              paddingHorizontal: 16,
              paddingTop: 12,
            }}
          >
            STAFF TOOLS
          </Text>

          {isMuezzin && (
            <SettingsRow
              title="Muezzin tools"
              subtitle="My rota & adhan schedule"
              href="/(tabs)/muezzin"
            />
          )}

          {isAdmin && (
            <SettingsRow
              title="Admin console"
              subtitle="Mosque settings, events & donations"
              href="/(tabs)/admin"
            />
          )}
        </View>
      )}

      <View style={{ backgroundColor: '#fff', marginTop: 24, marginBottom: 40 }}>
        <Pressable
          onPress={signOut}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: '#DC2626', fontWeight: '600' }}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
