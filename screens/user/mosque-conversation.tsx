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
  deleteListenerThread,
  fetchListenerThread,
  markThreadReadByListener,
  MosqueMessage,
  sendMessage,
} from '../../lib/api/mosqueMessages';
import { supabase } from '../../lib/supabase';
import { supportsServerApi } from '../../lib/api/apiBaseUrl';

export default function MosqueMessagesScreen() {
  const { mosqueId } = useLocalSearchParams<{ mosqueId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [mosqueName, setMosqueName] = useState('Mosque');
  const [messages, setMessages] = useState<MosqueMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scope = useRef('');
  scope.current = `${userId}:${mosqueId}`;
  const loadVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  React.useEffect(() => {
    setDraft('');
    setSending(false);
    setSendError(null);
  }, [userId, mosqueId]);

  const loadThread = useCallback(async () => {
    const version = ++loadVersion.current;
    if (!mosqueId || !userId) { setMessages([]); setLoading(false); return; }
    setLoadError(null);
    try {
      const msgs = await fetchListenerThread(mosqueId, userId);
      if (version !== loadVersion.current) return;
      setMessages(msgs);
      markThreadReadByListener(mosqueId, msgs.map((m) => m.id)).catch(() => {});
      scrollRef.current?.scrollToEnd({ animated: false });
    } catch {
      if (version === loadVersion.current) setLoadError('Could not load messages. Please retry.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [mosqueId, userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setMessages([]);
      void loadThread();
      return () => { loadVersion.current += 1; };
    }, [loadThread])
  );

  // Load mosque name
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
    if (sending || !draft.trim() || !mosqueId || !session?.access_token) return;
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
        senderType: 'listener',
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

  const handleDelete = () => {
    const perform = async () => {
      if (!mosqueId) return;
      try {
        await deleteListenerThread(mosqueId);
        router.back();
      } catch {
        setSendError('Could not delete conversation. Please try again.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('This removes your copy of the conversation. The mosque may retain copies.')) void perform();
    } else {
      Alert.alert('Delete conversation', 'This removes your copy of the conversation. The mosque may retain copies.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { void perform(); } },
      ]);
    }
  };

  if (!userId) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </Pressable>
          <Text style={styles.title}>Messages</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Sign in to message</Text>
          <Text style={styles.emptyBody}>You need to be signed in to send messages to a mosque.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canSend = false;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title} numberOfLines={1}>{mosqueName}</Text>
          <Text style={styles.subtitle}>Previous conversation</Text>
        </View>
        {messages.length > 0 ? (
          <Pressable onPress={handleDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={18} color="#94A3B8" />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <Pressable accessibilityRole="button" onPress={() => { void loadThread(); }} style={{ padding: 12 }}>
        <Text style={{ color: loadError ? '#DC2626' : '#0369A1', textAlign: 'center' }}>{loadError ?? 'Refresh messages'}</Text>
      </Pressable>
      {loading ? (
        <View style={styles.empty}>
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
              <View style={styles.emptyThread}>
                <Text style={styles.emptyThreadIcon}>🕌</Text>
                <Text style={styles.emptyThreadTitle}>Start a conversation</Text>
                <Text style={styles.emptyThreadBody}>
                  {"Send a message to "}
                  {mosqueName}
                  {". Their team will reply when they can — usually within a few days."}
                </Text>
              </View>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_type === 'listener';
                const time = new Date(m.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <View key={m.id} style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                      <Text style={isMe ? styles.bubbleTextMe : styles.bubbleTextThem}>{m.body}</Text>
                      <Text style={isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem}>{time}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.composer}>
            {!supportsServerApi() ? <Text style={styles.sendError}>Messaging is unavailable in this environment.</Text> : null}
            {sendError ? (
              <Text style={styles.sendError}>{sendError}</Text>
            ) : null}
            <View style={styles.composerRow}>
              <TextInput
                editable={false}
                style={styles.composerInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Message the mosque…"
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={2000}
                returnKeyType="default"
              />
              <Pressable
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptyBody: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  messageList: { padding: 16, gap: 8, flexGrow: 1 },
  emptyThread: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  emptyThreadIcon: { fontSize: 40 },
  emptyThreadTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptyThreadBody: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },

  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, gap: 4 },
  bubbleMe: { backgroundColor: '#0EA5E9', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' },
  bubbleTextMe: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  bubbleTextThem: { color: '#0F172A', fontSize: 14, lineHeight: 20 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)', fontSize: 10, textAlign: 'right' },
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
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
  sendError: { fontSize: 12, color: '#DC2626', paddingHorizontal: 4 },
});
