import { SupabaseClient } from '@supabase/supabase-js';
import { PrayerName } from './adhans';

type PrimaryMosque = { mosqueId: string; mosqueName?: string | null; stream?: any | null };

export async function getMuezzinPrimaryMosque(supabase: SupabaseClient, userId: string): Promise<PrimaryMosque | null> {
  const { data, error } = await supabase
    .from('muezzins')
    .select('mosque_id, mosques(name), streams(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const stream = (data as any)?.streams ?? null;
  const mosqueName = (data as any)?.mosques?.name ?? null;
  return { mosqueId: (data as any).mosque_id, mosqueName, stream };
}

type StartArgs = {
  mosqueId: string;
  prayerName?: PrayerName | string;
  prayer?: PrayerName | string;
  scheduledTime?: string;
  mode?: 'normal' | 'test';
};

type EndArgs = {
  mosqueId: string;
  adhanId?: string;
};

function resolvePrayer(args: StartArgs) {
  return (args.prayerName ?? args.prayer ?? 'maghrib') as PrayerName | string;
}

export async function startBroadcast(supabase: SupabaseClient, args: StartArgs) {
  const now = new Date().toISOString();
  const scheduledAt = args.scheduledTime ?? now;
  const prayer = resolvePrayer(args);
  const source = args.mode === 'test' ? 'test' : 'live';

  const { data: existingLive } = await supabase
    .from('adhans')
    .select('*')
    .eq('mosque_id', args.mosqueId)
    .eq('status', 'live')
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    mosque_id: args.mosqueId,
    prayer,
    scheduled_at: scheduledAt,
    status: 'live',
    source,
    broadcast_started_at: now,
  };

  let adhan = existingLive ?? null;
  if (existingLive?.id) {
    const { data, error } = await supabase
      .from('adhans')
      .update(payload)
      .eq('id', existingLive.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    adhan = data ?? existingLive;
  } else {
    const { data, error } = await supabase.from('adhans').insert(payload).select().maybeSingle();
    if (error) throw error;
    adhan = data ?? null;
  }

  const { data: stream, error: streamErr } = await supabase
    .from('streams')
    .update({ is_live: true, status: 'live', last_health_check: now })
    .eq('mosque_id', args.mosqueId)
    .select()
    .maybeSingle();
  if (streamErr) throw streamErr;

  return { adhan, stream };
}

export async function endBroadcast(supabase: SupabaseClient, args: EndArgs) {
  const now = new Date().toISOString();

  let targetAdhanId = args.adhanId ?? null;
  if (!targetAdhanId) {
    const { data: existing } = await supabase
      .from('adhans')
      .select('id')
      .eq('mosque_id', args.mosqueId)
      .eq('status', 'live')
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    targetAdhanId = existing?.id ?? null;
  }

  let adhan = null;
  if (targetAdhanId) {
    const { data, error } = await supabase
      .from('adhans')
      .update({ status: 'completed', broadcast_ended_at: now })
      .eq('id', targetAdhanId)
      .select()
      .maybeSingle();
    if (error) throw error;
    adhan = data ?? null;
  }

  const { data: stream, error: streamErr } = await supabase
    .from('streams')
    .update({ is_live: false, status: 'active', last_health_check: now })
    .eq('mosque_id', args.mosqueId)
    .select()
    .maybeSingle();
  if (streamErr) throw streamErr;

  return { adhan, stream };
}
