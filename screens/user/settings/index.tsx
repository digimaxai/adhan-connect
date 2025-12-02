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
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#0F172A' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: 12,
              color: '#64748B',
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

function RoleChip({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: '#E0F2FE',
        marginRight: 6,
        marginTop: 6,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: '#0369A1',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const {
    loading,
    isAdmin,
    isMuezzin,
    isLocalAdmin,
    isMainAdmin,
    isUser,
    role,
    error,
  } = useRoleFlags();

  const displayName =
    user?.display_name ||
    user?.email?.split('@')[0] ||
    'User';

  // Debug panel to surface role flags in-app
  const debugPanel = (
    <View
      style={{
        marginTop: 12,
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
      }}
    >
      <Text style={{ fontSize: 12, color: '#475569', fontWeight: '700' }}>Debug (roles)</Text>
      <Text style={{ fontSize: 12, color: '#475569' }}>role: {loading ? 'loading…' : role || 'null'}</Text>
      <Text style={{ fontSize: 12, color: '#475569' }}>isMuezzin: {isMuezzin ? 'true' : 'false'}</Text>
      <Text style={{ fontSize: 12, color: '#475569' }}>isLocalAdmin: {isLocalAdmin ? 'true' : 'false'}</Text>
      <Text style={{ fontSize: 12, color: '#475569' }}>isMainAdmin: {isMainAdmin ? 'true' : 'false'}</Text>
      <Text style={{ fontSize: 12, color: '#475569' }}>error: {error ?? 'none'}</Text>
    </View>
  );

  // Build role labels for the header
  const roleLabels: string[] = [];
  if (isMainAdmin) roleLabels.push('Main admin');
  if (isLocalAdmin) roleLabels.push('Local admin');
  if (isMuezzin) roleLabels.push('Muezzin');
  if (!isMainAdmin && !isLocalAdmin && !isMuezzin && isUser) {
    roleLabels.push('Listener');
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Profile header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: '800',
            color: '#0F172A',
          }}
        >
          Settings
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 18,
            fontWeight: '600',
            color: '#0F172A',
          }}
        >
          {displayName}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: 13,
            color: '#64748B',
          }}
        >
          {user?.email ?? 'No email'}
        </Text>

        {debugPanel}

        {!loading && roleLabels.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginTop: 10,
            }}
          >
            {roleLabels.map((label) => (
              <RoleChip key={label} label={label} />
            ))}
          </View>
        )}
      </View>

      {/* Playback & alerts */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          marginTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
        }}
      >
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
      </View>

      {/* Mosque preferences */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          marginTop: 16,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
        }}
      >
        <SettingsRow
          title="Mosque subscriptions"
          subtitle="Manage followed mosques"
          href="/(tabs)/settings/subscriptions"
        />
      </View>

      {/* Staff tools – role-driven */}
      {!loading && (isMuezzin || isAdmin) && (
        <View style={{ marginTop: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: '#64748B',
              paddingHorizontal: 16,
              marginBottom: 4,
            }}
          >
            STAFF TOOLS
          </Text>

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopWidth: 1,
              borderTopColor: '#E2E8F0',
              borderBottomWidth: 1,
              borderBottomColor: '#E2E8F0',
            }}
          >
            {isMuezzin && (
              <SettingsRow
                title="Muezzin tools"
                subtitle="My rota & adhan schedule"
                href="/(muezzin)/muezzin"
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
        </View>
      )}

      {/* Sign out */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          marginTop: 24,
        }}
      >
        <Pressable
          onPress={signOut}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
        >
          <Text
            style={{
              color: '#DC2626',
              fontWeight: '600',
              fontSize: 15,
            }}
          >
            Sign out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
