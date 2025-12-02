import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  AdhanBroadcast,
  canStartBroadcast,
  completeBroadcast,
  fetchBroadcastById,
  formatTimeWithTz,
  labelForPrayer,
  scheduleLocalRemindersForBroadcast,
  startBroadcast,
  statusBadge,
} from '../../lib/adhans';
import { supabase } from '../../lib/supabase';

export default function BroadcastDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [broadcast, setBroadcast] = useState<AdhanBroadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchBroadcastById(id);
        if (!data) {
          setErr('Broadcast not found');
        } else {
          setBroadcast(data);
          scheduleLocalRemindersForBroadcast(data).catch(() => {});
        }
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load broadcast.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const getBroadcastId = () => {
    if (broadcast?.id) return broadcast.id;
    if (typeof id === 'string') return id;
    if (Array.isArray(id)) return id[0];
    return null;
  };

  const onStart = async () => {
    const bId = getBroadcastId();
    if (!bId) {
      Alert.alert('Cannot start', 'Missing broadcast id.');
      return;
    }
    try {
      const updated = await startBroadcast(bId);
      setBroadcast(updated);
      Alert.alert('Live', 'Broadcast marked live. Start your stream now.');
    } catch (e: any) {
      Alert.alert('Cannot start', e?.message ?? 'Failed to start broadcast.');
    }
  };

  const onStop = async () => {
    const bId = getBroadcastId();
    if (!bId) {
      Alert.alert('Cannot stop', 'Missing broadcast id.');
      return;
    }
    try {
      const updated = await completeBroadcast(bId, false);
      setBroadcast(updated);
      Alert.alert('Stopped', 'Broadcast marked completed.');
    } catch (e: any) {
      Alert.alert('Cannot stop', e?.message ?? 'Failed to stop broadcast.');
    }
  };

  const onResetForTest = async () => {
    const bId = getBroadcastId();
    if (!bId) {
      Alert.alert('Cannot reset', 'Missing broadcast id.');
      return;
    }
    try {
      const inFive = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('adhan_broadcasts')
        .update({
          status: 'scheduled',
          started_at: null,
          started_by: null,
          ended_at: null,
          scheduled_for: inFive,
        })
        .eq('id', bId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setBroadcast(data as AdhanBroadcast);
        Alert.alert('Reset', 'Broadcast reset to scheduled in 5 minutes.');
      } else {
        Alert.alert('Reset', 'No row updated.');
      }
    } catch (e: any) {
      Alert.alert('Cannot reset', e?.message ?? 'Failed to reset broadcast.');
    }
  };

  const onComplete = async (missed = false) => {
    const bId = getBroadcastId();
    if (!bId) {
      Alert.alert('Cannot update', 'Missing broadcast id.');
      return;
    }
    try {
      const updated = await completeBroadcast(bId, missed);
      setBroadcast(updated);
      Alert.alert('Saved', missed ? 'Marked as missed.' : 'Marked as completed.');
      router.back();
    } catch (e: any) {
      Alert.alert('Cannot update', e?.message ?? 'Failed to update broadcast.');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={{ marginTop: 8 }}>Loading broadcast…</Text>
      </View>
    );
  }

  if (err || !broadcast) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#DC2626', textAlign: 'center' }}>{err ?? 'Broadcast not found'}</Text>
      </View>
    );
  }

  const startable = canStartBroadcast(broadcast, now);
  const badge = statusBadge(broadcast, now);
  const scheduled = broadcast.scheduled_for ? new Date(broadcast.scheduled_for) : null;
  const isLive = broadcast.status === 'live';

  const countdown = (() => {
    if (!scheduled) return null;
    const diffSec = Math.max(0, Math.floor((scheduled.getTime() - now.getTime()) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return { text: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`, diffSec };
  })();

  const urgencyColor = (() => {
    if (!countdown) return '#22C55E';
    if (countdown.diffSec < 120) return '#EF4444';
    if (countdown.diffSec < 600) return '#F59E0B';
    return '#22C55E';
  })();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 16 }}>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '800' }}>{labelForPrayer(broadcast.prayer)}</Text>
        <Text style={{ color: '#0EA5E9', fontWeight: '700' }}>{broadcast.mosque_name ?? 'Mosque'}</Text>
        <Text style={{ fontSize: 16 }}>{scheduled ? formatTimeWithTz(broadcast) : 'Time TBD'}</Text>
        <Text style={{ color: '#64748B' }}>Status: {badge}</Text>

        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <TouchableOpacity
            onPress={isLive ? onStop : onStart}
            disabled={!startable && !isLive}
            style={{
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: isLive ? '#0F172A' : startable ? '#EF4444' : '#CBD5E1',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Text style={{ color: '#F8FAFC', fontWeight: '900', fontSize: 16, textAlign: 'center' }}>
              {isLive ? 'Stop Broadcast' : 'Broadcast Adhan Now'}
            </Text>
            {countdown && (
              <Text style={{ color: urgencyColor, fontWeight: '800', fontSize: 18, marginTop: 6 }}>
                {countdown.text}
              </Text>
            )}
            {!countdown && <Text style={{ color: '#0F172A', marginTop: 6 }}>No time set</Text>}
          </TouchableOpacity>

          <Text style={{ color: '#475569', marginTop: 10, fontSize: 12 }}>
            {startable ? 'Within go-live window' : 'Too early; window opens soon'}
          </Text>

          <TouchableOpacity
            onPress={isLive ? onStop : onStart}
            style={{
              marginTop: 10,
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 12,
              backgroundColor: isLive ? '#0F172A' : '#0EA5E9',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
              {isLive ? 'Stop broadcast' : 'Test broadcast now'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onResetForTest}
            style={{
              marginTop: 10,
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 12,
              backgroundColor: '#E2E8F0',
            }}
          >
            <Text style={{ color: '#0F172A', fontWeight: '800' }}>Reset for testing</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => onComplete(false)}
          style={{
            marginTop: 8,
            backgroundColor: '#0F172A',
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Mark completed</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onComplete(true)}
          style={{
            marginTop: 8,
            backgroundColor: '#FEE2E2',
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#FCA5A5',
          }}
        >
          <Text style={{ color: '#B91C1C', fontWeight: '700' }}>Mark missed</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
