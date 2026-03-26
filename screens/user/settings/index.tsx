import { Link } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../../lib/auth';
import { useRoleFlags } from '../../../lib/roles';

type RowProps = {
  title: string;
  subtitle?: string;
  href: string;
  last?: boolean;
};

function SettingsRow({ title, subtitle, href, last }: RowProps) {
  return (
    <Link href={href as any} asChild>
      <Pressable
        style={{
          paddingVertical: 16,
          paddingHorizontal: 16,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: '#E2E8F0',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{title}</Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: 13,
                color: '#64748B',
                marginTop: 3,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: '#94A3B8', fontSize: 18, marginLeft: 10 }}>{'>'}</Text>
      </Pressable>
    </Link>
  );
}

function SectionCard({ children, marginTop = 0 }: { children: React.ReactNode; marginTop?: number }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        marginHorizontal: 18,
        marginTop,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { loading, isAdmin, isMuezzin, isLocalAdmin, isMainAdmin, isUser, role, error, hasDualStaffAccess } = useRoleFlags();

  const displayName = user?.display_name || user?.email?.split('@')[0] || 'User';

  const roleLabels: string[] = [];
  if (isMainAdmin) roleLabels.push('Main admin');
  if (isLocalAdmin) roleLabels.push('Local admin');
  if (isMuezzin) roleLabels.push('Muezzin');
  if (!isMainAdmin && !isLocalAdmin && !isMuezzin && isUser) {
    roleLabels.push('Listener');
  }

  const showStaffTools = !loading && (isAdmin || isMuezzin);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }} contentContainerStyle={{ paddingBottom: 36 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 56, paddingBottom: 18 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', letterSpacing: 0.2 }}>Your account</Text>
        <Text style={{ fontSize: 27, fontWeight: '800', color: '#0F172A', marginTop: 6 }}>Settings</Text>
        <Text style={{ fontSize: 15, color: '#475569', marginTop: 6 }}>
          Keep your listener preferences and staff tools in one consistent place.
        </Text>
        <View
          style={{
            marginTop: 14,
            backgroundColor: '#0EA5E9',
            borderRadius: 18,
            padding: 18,
            shadowColor: '#0EA5E9',
            shadowOpacity: 0.16,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#FFFFFF' }}>{displayName}</Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{user?.email ?? 'No email'}</Text>
          {!loading && roleLabels.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
              {roleLabels.map((label) => (
                <View
                  key={label}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.16)',
                    marginRight: 6,
                    marginTop: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <SectionCard>
        <SettingsRow title="Notifications" subtitle="Adhan alerts, staff updates, and reminders" href="./notifications" />
        <SettingsRow title="Audio mixer" subtitle="Per-mosque volume and mute settings" href="./mixer" />
        <SettingsRow title="Mosque subscriptions" subtitle="Manage followed mosques" href="../manage-mosques" last />
      </SectionCard>

      {showStaffTools ? (
        <View style={{ marginTop: 20, marginHorizontal: 18 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8 }}>Staff tools</Text>
          <SectionCard>
            {hasDualStaffAccess ? (
              <SettingsRow
                title="Choose workspace"
                subtitle="Enter Admin or Muezzin for this session"
                href="/role-entry"
              />
            ) : null}
            {isAdmin ? (
              <SettingsRow
                title="Admin workspace"
                subtitle="Prayer times, rota, muezzins, and mosque settings"
                href="/(admin)"
                last={!isMuezzin}
              />
            ) : null}
            {isMuezzin ? (
              <SettingsRow
                title="Muezzin workspace"
                subtitle="Live adhan, rota, and cover requests"
                href="/(muezzin)"
                last
              />
            ) : null}
          </SectionCard>
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: '#FFFFFF',
          marginHorizontal: 18,
          marginTop: 24,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#FECACA',
          overflow: 'hidden',
        }}
      >
        <Pressable
          onPress={signOut}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: '#DC2626',
              fontWeight: '700',
              fontSize: 15,
            }}
          >
            Sign out
          </Text>
        </Pressable>
      </View>

      {__DEV__ ? (
        <View
          style={{
            marginTop: 16,
            marginHorizontal: 18,
            padding: 10,
            borderRadius: 10,
            backgroundColor: '#F1F5F9',
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontSize: 12, color: '#475569', fontWeight: '700' }}>Debug (roles)</Text>
          <Text style={{ fontSize: 12, color: '#475569' }}>role: {loading ? 'loading...' : role || 'null'}</Text>
          <Text style={{ fontSize: 12, color: '#475569' }}>isMuezzin: {isMuezzin ? 'true' : 'false'}</Text>
          <Text style={{ fontSize: 12, color: '#475569' }}>isLocalAdmin: {isLocalAdmin ? 'true' : 'false'}</Text>
          <Text style={{ fontSize: 12, color: '#475569' }}>isMainAdmin: {isMainAdmin ? 'true' : 'false'}</Text>
          <Text style={{ fontSize: 12, color: '#475569' }}>dualStaff: {hasDualStaffAccess ? 'true' : 'false'}</Text>
          <Text style={{ fontSize: 12, color: '#475569' }}>error: {error ?? 'none'}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
