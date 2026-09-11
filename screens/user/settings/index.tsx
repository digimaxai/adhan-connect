import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../../lib/auth';
import { requireRoleEntrySelection } from '../../../lib/roleEntrySession';
import { useRoleFlags } from '../../../lib/roles';

type RowProps = {
  title: string;
  subtitle?: string;
  href?: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  last?: boolean;
};

function SettingsRow({ title, subtitle, href, onPress, disabled, icon, last }: RowProps) {
  const row = (
    <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={{
          paddingVertical: 16,
          paddingHorizontal: 16,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: '#E2E8F0',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {icon ? (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#E0F2FE',
              marginRight: 12,
            }}
          >
            <Ionicons name={icon} size={18} color="#0284C7" />
          </View>
        ) : null}
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
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" style={{ marginLeft: 10 }} />
      </Pressable>
  );

  if (href) {
    return (
      <Link href={href as any} asChild>
        {row}
      </Link>
    );
  }

  return row;
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
  const router = useRouter();
  const [switchingWorkspace, setSwitchingWorkspace] = React.useState(false);
  const {
    loading,
    isMuezzin,
    isLocalAdmin,
    isMainAdmin,
    role,
    error,
    hasDualStaffAccess,
    hasMultipleWorkspaceAccess,
  } = useRoleFlags({ reuseResolvedSessionAccess: true });
  const segments = useSegments();
  const isMuezzinWorkspace = segments[0] === '(muezzin)';
  const settingsBase = isMuezzinWorkspace
    ? '/(muezzin)/muezzin-settings'
    : '/(user)/settings';
  const displayName = user?.display_name || user?.email?.split('@')[0] || 'User';

  const roleLabels: string[] = ['Listener'];
  if (isMainAdmin) roleLabels.push('Main admin');
  if (isLocalAdmin) roleLabels.push('Local admin');
  if (isMuezzin) roleLabels.push('Muezzin');

  const showWorkspaceTools = !loading && hasMultipleWorkspaceAccess;
  const availableWorkspaceLabels = [
    'Listener',
    isMainAdmin ? 'Main Admin' : isLocalAdmin ? 'Local Admin' : null,
    isMuezzin ? 'Muezzin' : null,
  ].filter((value): value is string => !!value);

  const openWorkspaceChooser = async () => {
    if (!user?.id || switchingWorkspace) return;
    setSwitchingWorkspace(true);
    try {
      await requireRoleEntrySelection(user.id);
      router.replace('/role-entry' as any);
    } finally {
      setSwitchingWorkspace(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }} contentContainerStyle={{ paddingBottom: 36 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 56, paddingBottom: 18 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', letterSpacing: 0.2 }}>Your account</Text>
        <Text style={{ fontSize: 27, fontWeight: '800', color: '#0F172A', marginTop: 6 }}>Settings</Text>
        <Text style={{ fontSize: 15, color: '#475569', marginTop: 6 }}>
          {isMuezzinWorkspace
            ? 'Operational settings for your duties. Your Listener workspace remains available for personal listening preferences.'
            : 'Personal listening and account preferences. Staff tools stay in their own workspace.'}
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
        <SettingsRow
          title="Account & data"
          subtitle="Sign-in methods, data export, and account deletion"
          href={`${settingsBase}/account`}
          icon="person-outline"
        />
        <SettingsRow
          title="Notifications"
          subtitle={isMuezzinWorkspace
            ? 'Duty reminders, rota updates, and LIVE status'
            : 'Adhan and current-area alerts'}
          href={`${settingsBase}/notifications`}
          icon="notifications-outline"
          last={isMuezzinWorkspace}
        />
        {!isMuezzinWorkspace ? (
          <>
            <SettingsRow
              title="Audio mixer"
              subtitle="Per-mosque volume and mute settings"
              href={`${settingsBase}/mixer`}
              icon="options-outline"
            />
            <SettingsRow
              title="Mosque subscriptions"
              subtitle="Manage followed mosques"
              href="/(user)/manage-mosques"
              icon="business-outline"
              last
            />
          </>
        ) : null}
      </SectionCard>

      {!isMuezzinWorkspace ? (
        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: '#64748B',
              marginBottom: 8,
              marginHorizontal: 18,
            }}
          >
            Get your mosque on Adhan Connect
          </Text>
          <SectionCard>
            <SettingsRow title="My enquiries" subtitle="View your mosque requests and replies" href="/(user)/mosque-enquiries" icon="mail-outline" />
            <SettingsRow
              title="Get your mosque listed"
              subtitle="Register, invite, or ask us to reach out — free for mosques"
              href="/(user)/mosque-onboarding-hub"
              icon="business-outline"
              last
            />
          </SectionCard>
        </View>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginHorizontal: 18 }}>Privacy & legal</Text>
        <SectionCard>
          <SettingsRow
            title="Privacy notice"
            subtitle="How Adhan Connect uses and protects data"
            href="https://www.maksums.com/adhan-connect/privacy/"
            icon="shield-checkmark-outline"
          />
          <SettingsRow
            title="Terms of use"
            subtitle="The rules for using Adhan Connect"
            href="https://www.maksums.com/adhan-connect/terms/"
            icon="document-text-outline"
            last
          />
        </SectionCard>
      </View>

      {showWorkspaceTools ? (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginHorizontal: 18 }}>Workspaces</Text>
          <SectionCard>
            <SettingsRow
              title={switchingWorkspace ? 'Opening workspaces…' : 'Switch workspace'}
              subtitle={`Listener is included · Choose ${availableWorkspaceLabels.join(', ')}`}
              onPress={() => void openWorkspaceChooser()}
              disabled={switchingWorkspace}
              icon="swap-horizontal-outline"
              last
            />
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
          <Text style={{ fontSize: 12, color: '#475569' }}>
            multipleWorkspaces: {hasMultipleWorkspaceAccess ? 'true' : 'false'}
          </Text>
          <Text style={{ fontSize: 12, color: '#475569' }}>error: {error ?? 'none'}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
