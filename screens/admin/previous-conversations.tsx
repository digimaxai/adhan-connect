import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminMosque } from '../../lib/hooks/useAdminMosque';
import {
  ConversationSummary,
  fetchAdminConversations,
} from '../../lib/api/mosqueMessages';

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesInboxScreen() {
  const router = useRouter();
  const { selectedMosque, loading: mosqueLoading, error: mosqueError } = useAdminMosque({ enabled: true });
  const loadVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    const version = ++loadVersion.current;
    if (!selectedMosque?.mosqueId) { setConversations([]); setLoading(false); setRefreshing(false); return; }
    setLoadError(null);
    try {
      const msgs = await fetchAdminConversations(selectedMosque.mosqueId);
      if (version === loadVersion.current) setConversations(msgs);
    } catch {
      if (version === loadVersion.current) setLoadError('Could not load conversations. Pull down to retry.');
    } finally {
      if (version === loadVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [selectedMosque?.mosqueId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setConversations([]);
      void loadConversations();
      return () => { loadVersion.current += 1; };
    }, [loadConversations])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const openThread = (conv: ConversationSummary) => {
    router.push({
      pathname: '/(admin)/messages-thread',
      params: {
        listenerId: conv.listener_id,
        mosqueId: conv.mosque_id,
      },
    } as any);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 22 }} />
      </View>

      {selectedMosque && (
        <Text style={styles.mosqueName}>{selectedMosque.name}</Text>
      )}

      {(mosqueLoading || loading) && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0EA5E9" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {loadError || mosqueError ? <Text accessibilityRole="alert" style={{ color: '#DC2626' }}>{loadError ?? mosqueError}</Text> : null}
          {!selectedMosque ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No mosque selected</Text>
              <Text style={styles.emptyBody}>Select a mosque from the admin dashboard to view messages.</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>
                {"When listeners send messages to "}
                {selectedMosque.name}
                {", they will appear here."}
              </Text>
            </View>
          ) : (
            conversations.map((conv) => (
              <Pressable
                key={conv.listener_id}
                onPress={() => openThread(conv)}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
                accessibilityRole="button"
              >
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={20} color="#0369A1" />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowName}>Listener</Text>
                    <Text style={styles.rowTime}>{timeAgo(conv.lastAt)}</Text>
                  </View>
                  <Text style={styles.rowPreview} numberOfLines={1}>{conv.lastBody}</Text>
                </View>
                {conv.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{conv.unreadCount}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F8F9' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#0F172A' },
  mosqueName: { textAlign: 'center', fontSize: 12, color: '#64748B', paddingVertical: 6, backgroundColor: '#FFFFFF' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 8, flexGrow: 1 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptyBody: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowName: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  rowTime: { color: '#94A3B8', fontSize: 12 },
  rowPreview: { color: '#64748B', fontSize: 13, lineHeight: 18 },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
});
