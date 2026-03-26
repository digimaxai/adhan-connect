// app/(tabs)/muezzin.tsx
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  AdhanBroadcast,
  canStartBroadcast,
  fetchUpcomingBroadcasts,
  formatTimeWithTz,
  labelForPrayer,
  scheduleLocalRemindersForBroadcast,
  startBroadcast,
  statusBadge,
} from '../../lib/adhans';
import { useRoleFlags } from '../../lib/roles';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function NextCard({
  broadcast,
  onStart,
  starting,
}: {
  broadcast: AdhanBroadcast;
  onStart: () => void;
  starting: boolean;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const startable = canStartBroadcast(broadcast, now);
  const badge = statusBadge(broadcast, now);
  const countdown = useMemo(() => {
    const seconds = Math.max(0, Math.floor((new Date(broadcast.scheduled_for).getTime() - now.getTime()) / 1000));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [broadcast.scheduled_for, now]);

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
      }}
    >
      <Text style={{ fontWeight: '800', fontSize: 18 }}>
        Next Adhan: {labelForPrayer(broadcast.prayer)}
      </Text>
      <Text style={{ color: '#0EA5E9', fontWeight: '700' }}>{broadcast.mosque_name ?? 'Your mosque'}</Text>
      <Text style={{ color: '#0F172A', fontSize: 16 }}>
        {formatTimeWithTz(broadcast)}
      </Text>
      <Text style={{ color: '#64748B' }}>Status: {badge} • Starts in {countdown}</Text>

      <TouchableOpacity
        onPress={onStart}
        disabled={!startable || starting}
        style={{
          marginTop: 8,
          backgroundColor: startable ? '#0EA5E9' : '#CBD5E1',
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
          {starting ? 'Starting…' : startable ? 'Start live broadcast' : 'Too early to start'}
        </Text>
      </TouchableOpacity>
      {!startable && (
        <Text style={{ color: '#94A3B8', fontSize: 12 }}>
          You can start within 10 minutes before the scheduled time.
        </Text>
      )}
    </View>
  );
}

export default function MuezzinDashboard() {
  const { loading, isMuezzin } = useRoleFlags();
  const [upcoming, setUpcoming] = useState<AdhanBroadcast | null>(null);
  const [more, setMore] = useState<AdhanBroadcast[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const rows = await fetchUpcomingBroadcasts(5);
      setUpcoming(rows[0] ?? null);
      setMore(rows.slice(1));
      if (rows[0]) {
        // opportunistically set local reminders
        scheduleLocalRemindersForBroadcast(rows[0]).catch(() => {});
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load schedule');
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onStart = useCallback(async () => {
    if (!upcoming) return;
    setBusy(true);
    try {
      const updated = await startBroadcast(upcoming.id);
      setUpcoming(updated);
      Alert.alert('Live', 'Broadcast marked live. Start your stream now.');
    } catch (e: any) {
      Alert.alert('Cannot start', e?.message ?? 'Failed to start broadcast.');
    } finally {
      setBusy(false);
    }
  }, [upcoming]);

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
    <ScrollView
      style={{ flex: 1, padding: 16, backgroundColor: '#F8FAFC' }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        Muezzin tools
      </Text>
      <Text style={{ color: '#64748B', marginBottom: 16 }}>
        Review your next adhan, reminders, and start live when the window opens.
      </Text>

      {err && (
        <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <Text style={{ color: '#B91C1C' }}>{err}</Text>
        </View>
      )}

      {upcoming ? (
        <NextCard broadcast={upcoming} onStart={onStart} starting={busy} />
      ) : (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontWeight: '700', color: '#0F172A' }}>No upcoming adhans</Text>
          <Text style={{ color: '#64748B', marginTop: 4 }}>
            Upload your timetable to see upcoming broadcasts.
          </Text>
        </View>
      )}

      {more.length > 0 && (
        <Section title="Later today">
          {more.map((b) => (
            <View
              key={b.id}
              style={{
                backgroundColor: '#FFFFFF',
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                marginBottom: 8,
              }}
            >
              <Text style={{ fontWeight: '700' }}>
                {labelForPrayer(b.prayer)} — {formatTimeWithTz(b)}
              </Text>
              <Text style={{ color: '#64748B' }}>{b.mosque_name ?? 'Mosque'}</Text>
            </View>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}
