// app/(tabs)/admin.tsx
import { Redirect } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRoleFlags } from '../../lib/roles';

export default function AdminDashboard() {
  const { loading, isAdmin, isMuezzin } = useRoleFlags();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading admin permissions…</Text>
      </View>
    );
  }

  if (isMuezzin) {
    return <Redirect href="/(muezzin)" />;
  }

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#DC2626', textAlign: 'center' }}>
          You do not have access to the admin console.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 16 }}>Admin console</Text>
      <Text style={{ color: '#64748B' }}>
        This is your admin dashboard placeholder. Add cards for mosque profile, adhan schedules, events, campaigns, and donations here.
      </Text>
    </ScrollView>
  );
}
