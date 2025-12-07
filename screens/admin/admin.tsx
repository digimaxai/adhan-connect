// app/(tabs)/admin.tsx
import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoleFlags } from '../../lib/roles';

export default function AdminDashboard() {
  const { loading, isAdmin, isMuezzin } = useRoleFlags();
  const router = useRouter();

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
    <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40, gap: 12 }}>
      <Text style={styles.title}>Admin console</Text>
      <Text style={styles.subtitle}>
        Manage your mosque’s schedule, staff, and content from a single place.
      </Text>

      <AdminCard
        router={router}
        title="Manage Prayer Times"
        description="Edit adhan and iqama times for any date."
        href="/(admin)/prayer-times"
      />

      <AdminCard
        router={router}
        title="Manage Staff Rota"
        description="Assign muezzins for each prayer."
        href="/(admin)/staff-rota"
      />
    </ScrollView>
  );
}

type CardProps = {
  title: string;
  description: string;
  href: string;
  router: ReturnType<typeof useRouter>;
};

function AdminCard({ title, description, href, router }: CardProps) {
  const handlePress = () => {
    router.push(href);
  };
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
      <Text style={styles.cardLink}>Open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', marginBottom: 6, color: '#0F172A' },
  subtitle: { color: '#64748B', marginBottom: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    gap: 6,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  cardDescription: { color: '#475569' },
  cardLink: { color: '#0EA5E9', fontWeight: '700', marginTop: 6 },
});
