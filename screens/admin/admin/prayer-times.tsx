// app/(tabs)/admin/prayer-times.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, List, Text } from 'react-native-paper';

import { useAuth } from '@/lib/auth';
import { pickAndImportPrayerCsv } from '@/lib/prayerTimesImport';
import { supabase } from '@/lib/supabase';

type AdminMosque = {
  mosque_id: string;
  name: string;
};

export default function PrayerTimesAdminScreen() {
  const router = useRouter();
  const { authUser, loading: authLoading } = useAuth();
  const [mosques, setMosques] = useState<AdminMosque[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [importingFor, setImportingFor] = useState<string | null>(null);

  const userId = authUser?.id ?? '';

  // Load mosques where the user is an admin
  useEffect(() => {
    let cancelled = false;

    async function loadAdminMosques() {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('mosque_admins')
          .select('mosque_id, mosques(name)')
          .eq('user_id', userId);

        if (error) throw error;

        if (!cancelled) {
          const mapped: AdminMosque[] =
            data?.map((row: any) => ({
              mosque_id: row.mosque_id,
              name: row.mosques?.name ?? 'Unnamed mosque',
            })) ?? [];
          setMosques(mapped);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('Error loading admin mosques', e);
          Alert.alert('Error', 'Could not load your mosques.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAdminMosques();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleImportForMosque = async (mosqueId: string, mosqueName: string) => {
    if (!userId) {
      Alert.alert('Not signed in', 'You must be signed in to import prayer times.');
      return;
    }

    setImportingFor(mosqueId);
    try {
      const result = await pickAndImportPrayerCsv({ mosqueId, userId });

      if (result.errors.length > 0) {
        Alert.alert(
          'Import finished with issues',
          `Imported ${result.imported} rows for ${mosqueName}.\n\nErrors:\n${result.errors.join(
            '\n'
          )}`
        );
      } else {
        Alert.alert('Success', `Imported ${result.imported} rows for ${mosqueName}.`);
      }
    } catch (e: any) {
      console.warn('CSV import error', e);
      Alert.alert('Error', e?.message ?? 'Failed to import CSV.');
    } finally {
      setImportingFor(null);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading your mosques…</Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ textAlign: 'center', marginBottom: 12 }}>
          You need to be signed in to manage prayer times.
        </Text>
        <Button mode="contained" onPress={() => router.replace('/(auth)/sign-in')}>
          Go to sign-in
        </Button>
      </View>
    );
  }

  if (mosques.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ textAlign: 'center', marginBottom: 8 }}>
          You are not assigned as an admin for any mosques.
        </Text>
        <Text style={{ textAlign: 'center', opacity: 0.7 }}>
          Ask the main admin to grant you access in the Admin panel.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleLarge" style={{ marginBottom: 8 }}>
        Prayer Times (CSV Import)
      </Text>
      <Text style={{ opacity: 0.7, marginBottom: 16 }}>
        Upload a CSV with columns:{' '}
        <Text style={{ fontWeight: '600' }}>
          date,fajr,sunrise,dhuhr,asr,maghrib,isha
        </Text>{' '}
        for each mosque below. Existing rows with the same date will be updated.
      </Text>

      {mosques.map((m) => (
        <List.Item
          key={m.mosque_id}
          title={m.name}
          description="Import or update prayer timetable from CSV"
          right={() => (
            <Button
              mode="contained"
              compact
              loading={importingFor === m.mosque_id}
              disabled={!!importingFor && importingFor !== m.mosque_id}
              onPress={() => handleImportForMosque(m.mosque_id, m.name)}
            >
              Import CSV
            </Button>
          )}
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            marginBottom: 12,
          }}
        />
      ))}
    </ScrollView>
  );
}
