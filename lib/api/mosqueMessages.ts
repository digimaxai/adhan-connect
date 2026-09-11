import { supabase } from '../supabase';
import { resolveApiUrl, supportsServerApi } from './apiBaseUrl';

export type MosqueMessage = {
  id: string;
  mosque_id: string;
  listener_id: string;
  sender_id: string;
  sender_type: 'listener' | 'admin';
  body: string;
  read_by_admin: boolean;
  read_by_listener: boolean;
  deleted_by_listener: boolean;
  archived_by_admin: boolean;
  created_at: string;
};

async function fetchThread(mosqueId: string, listenerId: string, listenerView: boolean): Promise<MosqueMessage[]> {
  const messages: MosqueMessage[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from('mosque_messages').select('*')
      .eq('mosque_id', mosqueId).eq('listener_id', listenerId);
    if (listenerView) query = query.eq('deleted_by_listener', false);
    const { data, error } = await query.order('created_at', { ascending: true })
      .order('id', { ascending: true }).range(offset, offset + 499);
    if (error) throw error;
    messages.push(...(data ?? []) as MosqueMessage[]);
    if (!data || data.length < 500) break;
  }
  return messages;
}

export function fetchListenerThread(mosqueId: string, listenerId: string) {
  return fetchThread(mosqueId, listenerId, true);
}

export function fetchAdminThread(mosqueId: string, listenerId: string) {
  return fetchThread(mosqueId, listenerId, false);
}

export type ConversationSummary = {
  listener_id: string;
  mosque_id: string;
  lastBody: string;
  lastAt: string;
  unreadCount: number;
};

export function buildConversations(messages: MosqueMessage[]): ConversationSummary[] {
  const map = new Map<string, ConversationSummary>();
  for (const m of messages) {
    const existing = map.get(m.listener_id);
    const unread = m.sender_type === 'listener' && !m.read_by_admin ? 1 : 0;
    if (!existing || m.created_at > existing.lastAt) {
      map.set(m.listener_id, {
        listener_id: m.listener_id,
        mosque_id: m.mosque_id,
        lastBody: m.body,
        lastAt: m.created_at,
        unreadCount: (existing?.unreadCount ?? 0) + unread,
      });
    } else {
      existing.unreadCount += unread;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function fetchAdminConversations(mosqueId: string): Promise<ConversationSummary[]> {
  const conversations: ConversationSummary[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc('mosque_message_conversations', { p_mosque_id: mosqueId })
      .order('listener_id').range(offset, offset + 499);
    if (error) throw error;
    for (const row of data ?? []) conversations.push({
      listener_id: row.listener_id, mosque_id: row.mosque_id,
      lastBody: row.last_body, lastAt: row.last_at, unreadCount: Number(row.unread_count),
    });
    if (!data || data.length < 500) break;
  }
  return conversations.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function sendMessage(params: {
  mosqueId: string;
  body: string;
  accessToken: string;
  senderType: 'listener' | 'admin';
  listenerId?: string;
}): Promise<MosqueMessage> {
  const { mosqueId, body, accessToken, senderType, listenerId } = params;
  if (!supportsServerApi()) throw new Error('Messaging is not available on this platform.');
  const url = resolveApiUrl('/api/mosque-messages/send');
  if (!url) throw new Error('Could not resolve server URL.');

  const payload: Record<string, string> = {
    mosque_id: mosqueId,
    body,
    sender_type: senderType,
  };
  if (senderType === 'admin' && listenerId) payload.listener_id = listenerId;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) throw new Error((json as any).error ?? 'Failed to send message.');
  return (json as any).message as MosqueMessage;
}

async function updateThread(mosqueId: string, action: string, listenerId?: string, messageIds?: string[]) {
  const { error } = await supabase.rpc('update_mosque_message_thread', {
    p_mosque_id: mosqueId, p_action: action,
    p_listener_id: listenerId ?? null, p_message_ids: messageIds ?? null,
  });
  if (error) throw error;
}

export function markThreadReadByListener(mosqueId: string, messageIds: string[]) {
  return updateThread(mosqueId, 'listener_read', undefined, messageIds);
}

export function markThreadReadByAdmin(mosqueId: string, listenerId: string, messageIds: string[]) {
  return updateThread(mosqueId, 'admin_read', listenerId, messageIds);
}

export function deleteListenerThread(mosqueId: string) {
  return updateThread(mosqueId, 'listener_delete');
}

export function archiveAdminThread(mosqueId: string, listenerId: string) {
  return updateThread(mosqueId, 'admin_archive', listenerId);
}
