import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import {
  archiveAdminThread,
  fetchAdminThread,
  markThreadReadByAdmin,
  MosqueMessage,
  sendMessage,
} from '../../lib/api/mosqueMessages';
import { supportsServerApi } from '../../lib/api/apiBaseUrl';
import { supabase } from '../../lib/supabase';

export default function AdminMessagesThreadScreen() {
  const { listenerId, mosqueId } = useLocalSearchParams<{ listenerId: string; mosqueId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [mosqueName, setMosqueName] = useState('Mosque');
  const [messages, setMessages] = useState<MosqueMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scope = useRef('');
  scope.current = `${session?.user.id}:${mosqueId}:${listenerId}`;
  const loadVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  React.useEffect(() => {
    setDraft('');
    setSending(false);
    setSendError(null);
  }, [session?.user.id, mosqueId, listenerId]);

  const loadThread = useCallback(async () => {
    const version = ++loadVersion.current;
    if (!mosqueId || !listenerId || !session?.user.id) { setMessages([]); setLoading(false); return; }
    setLoadError(null);
    try {
      const msgs = await fetchAdminThread(mosqueId, listenerId);
      if (version !== loadVersion.current) return;
      setMessages(msgs);
      markThreadReadByAdmin(mosqueId, listenerId, msgs.map((m) => m.id)).catch(() => {});
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    } catch {
      if (version === loadVersion.current) setLoadError('Could not load messages. Please retry.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [mosqueId, listenerId, session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setMessages([]);
      void loadThread();
      return () => { loadVersion.current += 1; };
    }, [loadThread])
  );

  React.useEffect(() => {
    if (!mosqueId) return;
    supabase
      .from('mosques')
      .select('name')
      .eq('id', mosqueId)
      .maybeSingle<{ name: string }>()
      .then(({ data }) => { if (data?.name) setMosqueName(data.name); });
  }, [mosqueId]);

  const handleSend = async () => {
    if (sending || !draft.trim() || !mosqueId || !listenerId || !session?.access_token) return;
    if (!supportsServerApi()) {
      setSendError('Messaging is not available in this environment.');
      return;
    }
    const sendScope = scope.current;
    setSending(true);
    setSendError(null);
    try {
      const msg = await sendMessage({
        mosqueId,
        body: draft.trim(),
        accessToken: session.access_token,
        senderType: 'admin',
        listenerId,
      });
      if (scope.current !== sendScope) return;
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      void loadThread();
      setDraft('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      if (scope.current !== sendScope) return;
      setSendError(e?.message ?? 'Failed to send. Please try again.');
    } finally {
      if (scope.current === sendScope) setSending(false);
    }
  };

  const handleArchive = () => {
    const perform = async () => {
      if (!mosqueId || !listenerId) return;
      try {
        await archiveAdminThread(mosqueId, listenerId);
        router.back();
      } catch {
        setSendError('Could not archive conversation. Please try again.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('This will remove it from your inbox. No messages are deleted.')) void perform();
    } else {
      Alert.alert('Archive conversation', 'This will remove it from your inbox. No messages are deleted.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => { void perform(); } },
      ]);
    }
  };

  const canSend = draft.trim().length > 0 && !sending && supportsServerApi();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title} numberOfLines={1}>Listener message</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{mosqueName}</Text>
        </View>
        {messages.length > 0 ? (
          <Pressable onPress={handleArchive} hitSlop={10}>
            <Ionicons name="archive-outline" size={18} color="#94A3B8" />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <Pressable accessibilityRole="button" onPress={() => { void loadThread(); }} style={{ padding: 12 }}>
        <Text style={{ color: loadError ? '#DC2626' : '#0369A1', textAlign: 'center' }}>{loadError ?? 'Refresh messages'}</Text>
      </Pressable>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0EA5E9" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyBody}>This thread is empty.</Text>
              </View>
            ) : (
              messages.map((m) => {
                const isAdmin = m.sender_type === 'admin';
                const time = new Date(m.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <View key={m.id} style={[styles.bubbleRow, isAdmin ? styles.bubbleRowMe : styles.bubbleRowThem]}>
                    <View style={[styles.bubble, isAdmin ? styles.bubbleMe : styles.bubbleThem]}>
                      <Text style={isAdmin ? styles.bubbleTextMe : styles.bubbleTextThem}>{m.body}</Text>
                      <Text style={isAdmin ? styles.bubbleTimeMe : styles.bubbleTimeThem}>{time}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.composer}>
            {!supportsServerApi() ? <Text style={styles.sendError}>Messaging is unavailable in this environment.</Text> : null}
            {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
            <View style={styles.composerRow}>
              <TextInput
                style={styles.composerInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Reply to listener…"
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={2000}
              />
              <Pressable
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send reply"
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: 16, gap: 8, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  emptyBody: { fontSize: 13, color: '#64748B' },

  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, gap: 4 },
  bubbleMe: { backgroundColor: '#0F172A', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' },
  bubbleTextMe: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  bubbleTextThem: { color: '#0F172A', fontSize: 14, lineHeight: 20 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.5)', fontSize: 10, textAlign: 'right' },
  bubbleTimeThem: { color: '#94A3B8', fontSize: 10 },

  composer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    gap: 6,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
  sendError: { fontSize: 12, color: '#DC2626', paddingHorizontal: 4 },
});
