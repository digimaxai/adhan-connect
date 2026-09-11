import { supabase } from '../supabase';
import { resolveApiUrl, supportsServerApi } from './apiBaseUrl';
import { ENQUIRY_STATUS_LABELS } from '../mosqueEnquiryCategories';
export type MosqueEnquiry = {
  mosques?: { name: string }; id: string; mosque_id: string; account_id: string | null; contact_name: string; contact_email: string;
  deleted_by_listener: boolean; email_verified: boolean; callback_phone: string | null; category: string; reason: string; details: string;
  status: keyof typeof ENQUIRY_STATUS_LABELS; created_at: string; updated_at: string; archived_by_admin: boolean;
};
export type EnquiryReply = { id: string; enquiry_id: string; sender_type: 'listener' | 'admin'; body: string; created_at: string };
export async function enabledEnquiryCategories(mosqueId: string): Promise<string[]> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in to continue.');
  const result = await submitEnquiryAction({ action: 'options', id: mosqueId, mosque_id: mosqueId }, data.session.user.id);
  return result.enabled_categories;

}
export async function listEnquiries(options: { mosqueId?: string; accountId?: string; archived?: boolean }) {
  const rows: MosqueEnquiry[] = [];
  for (let start = 0; ; start += 200) {
    let q = supabase.from('mosque_enquiries').select('*, mosques(name)');
    if (options.mosqueId) q = q.eq('mosque_id', options.mosqueId);
    if (options.accountId) q = q.eq('account_id', options.accountId).eq('deleted_by_listener', false);
    else q = q.eq('archived_by_admin', options.archived ?? false);
    const { data, error } = await q.order('updated_at', { ascending: false }).order('id').range(start, start + 199);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 200) return rows;
  }
}
export async function getEnquiry(id: string, accountId?: string) {
  let q = supabase.from('mosque_enquiries').select('*, mosques(name)').eq('id', id);
  if (accountId) q = q.eq('account_id', accountId).eq('deleted_by_listener', false);
  const { data, error } = await q.single();
  if (error) throw error;
  const replies: EnquiryReply[] = [];
  for (let start = 0; ; start += 200) {
    const { data: page, error: replyError } = await supabase.from('mosque_enquiry_replies').select('*').eq('enquiry_id', id).order('created_at').order('id').range(start, start + 199);
    if (replyError) throw replyError;
    replies.push(...(page ?? []));
    if (!page || page.length < 200) break;
  }
  return { enquiry: data as MosqueEnquiry, replies };
}
export async function submitEnquiryAction(payload: Record<string, unknown>, expectedAccountId: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== expectedAccountId) throw new Error('Your session changed. Please reopen this enquiry.');
  const url = resolveApiUrl('/api/mosque-enquiries/submit');
  if (!url || !supportsServerApi()) throw new Error('Enquiries are unavailable in this environment.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.result) throw new Error(body?.error ?? 'Could not save. Please retry.');
  return body.result;
}
export async function manageEnquiry(id: string, action: string) {
  const { error } = await supabase.rpc('manage_mosque_enquiry', { p_id: id, p_action: action });
  if (error) throw error;
}
export async function configureEnquiries(mosqueId: string, categories: string[]) {
  const { error } = await supabase.rpc('configure_mosque_enquiries', { p_mosque: mosqueId, p_categories: categories });
  if (error) throw error;
}
