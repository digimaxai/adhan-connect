// app/(tabs)/muezzin.tsx
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRoleFlags } from '../../lib/roles';

export default function MuezzinDashboard() {
  const { loading, isMuezzin } = useRoleFlags();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading muezzin status…</Text>
      </View>
    );
  }

  if (!isMuezzin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#DC2626', textAlign: 'center' }}>
          You are not assigned as a muezzin for any mosque.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        Muezzin tools
      </Text>
      <Text style={{ color: '#64748B' }}>
        Here you’ll see your upcoming adhan rota, reminders, and quick actions
        to start or upload adhans.
      </Text>
    </ScrollView>
  );
}
