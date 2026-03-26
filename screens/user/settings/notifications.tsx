import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import { getAppNotifications, markAllAppNotificationsRead, markAppNotificationRead } from '../../../lib/api/appNotifications';
import type { AppNotification } from '../../../lib/types/muezzin';

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppNotifications();
      setItems(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleMarkAll = async () => {
    setBusy(true);
    try {
      await markAllAppNotificationsRead();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (item: AppNotification) => {
    if (!item.read_at) {
      try {
        await markAppNotificationRead(item.id);
        setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)));
      } catch {
        // ignore
      }
    }
  };

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Notifications" />
        <Appbar.Action icon="check-all" onPress={handleMarkAll} disabled={busy || !items.some((item) => !item.read_at)} />
      </Appbar.Header>

      <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View
          style={{
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A' }}>Assignment updates</Text>
          <Text style={{ marginTop: 6, color: '#475569' }}>
            Rota changes, cover requests, and approvals appear here.
          </Text>
        </View>

        {error ? (
          <View style={{ padding: 14, borderRadius: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text style={{ color: '#B91C1C', fontWeight: '700' }}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#0EA5E9" />
            <Text style={{ marginTop: 10, color: '#475569' }}>Loading notifications...</Text>
          </View>
        ) : items.length ? (
          items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleOpen(item)}
              style={{
                padding: 16,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: item.read_at ? '#E2E8F0' : '#7DD3FC',
                backgroundColor: item.read_at ? '#FFFFFF' : '#F0F9FF',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{item.title}</Text>
                {!item.read_at ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: '#0EA5E9',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>New</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ marginTop: 8, color: '#475569', lineHeight: 20 }}>{item.body}</Text>
              <Text style={{ marginTop: 8, fontSize: 12, color: '#94A3B8' }}>
                {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
              </Text>
            </Pressable>
          ))
        ) : (
          <View
            style={{
              padding: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>No notifications yet</Text>
            <Text style={{ marginTop: 6, color: '#475569' }}>
              Once rota assignments or cover requests start moving, they will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}
