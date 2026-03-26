import { SupabaseClient } from '@supabase/supabase-js';
import { PrayerName } from './adhans';
import { fetchSessionAccess } from './sessionAccess';

type PrimaryMosque = { mosqueId: string; mosqueName?: string | null; stream?: any | null };

const primaryMosqueCache = new Map<string, PrimaryMosque>();

function cachePrimaryMosque(userId: string, mosque: PrimaryMosque | null) {
  if (mosque?.mosqueId) {
    primaryMosqueCache.set(userId, mosque);
  }
  return mosque;
}

async function lookupMosqueNameById(supabase: SupabaseClient, mosqueId: string) {
  try {
    const { data, error } = await supabase.from('mosques').select('name').eq('id', mosqueId).maybeSingle();
    if (error) return null;
    return (data as any)?.name ?? null;
  } catch {
    return null;
  }
}

async function resolveMuezzinMosqueFromSessionAccess(preferredMosqueId?: string | null): Promise<PrimaryMosque | null> {
  try {
    const sessionAccess = await fetchSessionAccess({ preferCache: true });
    const mosques = sessionAccess.muezzinMosques ?? [];
    const matched = preferredMosqueId ? mosques.find((mosque) => mosque.mosqueId === preferredMosqueId) ?? null : null;
    const fallbackMosque = matched ?? mosques[0] ?? null;
    if (!fallbackMosque?.mosqueId) return null;

    return {
      mosqueId: fallbackMosque.mosqueId,
      mosqueName: fallbackMosque.name ?? null,
      stream: null,
    };
  } catch {
    return null;
  }
}

async function hydratePrimaryMosque(supabase: SupabaseClient, mosque: PrimaryMosque | null): Promise<PrimaryMosque | null> {
  if (!mosque?.mosqueId) return mosque;
  if (mosque.mosqueName) return mosque;

  const fromSessionAccess = await resolveMuezzinMosqueFromSessionAccess(mosque.mosqueId);
  if (fromSessionAccess?.mosqueName) {
    return { ...mosque, mosqueName: fromSessionAccess.mosqueName };
  }

  const name = await lookupMosqueNameById(supabase, mosque.mosqueId);
  return name ? { ...mosque, mosqueName: name } : mosque;
}

async function findMosqueFromStaffRota(supabase: SupabaseClient, userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formatDate = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayIso = formatDate(today);
  const ownerFilter = `muezzin_user_id.eq.${userId},staff_user_id.eq.${userId}`;

  let futureRotaQuery = await supabase
    .from('staff_rota')
    .select('mosque_id, date, duty_date')
    .or(ownerFilter)
    .gte('date', todayIso)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (futureRotaQuery.error?.code === '42703') {
    futureRotaQuery = await supabase
      .from('staff_rota')
      .select('mosque_id, date, duty_date')
      .or(ownerFilter)
      .gte('duty_date', todayIso)
      .order('duty_date', { ascending: true })
      .limit(1)
      .maybeSingle();
  }

  let rotaRow = futureRotaQuery.data ?? null;
  if (!rotaRow) {
    let pastRotaQuery = await supabase
      .from('staff_rota')
      .select('mosque_id, date, duty_date')
      .or(ownerFilter)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pastRotaQuery.error?.code === '42703') {
      pastRotaQuery = await supabase
        .from('staff_rota')
        .select('mosque_id, date, duty_date')
        .or(ownerFilter)
        .order('duty_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    }
    rotaRow = pastRotaQuery.data ?? null;
  }

  return rotaRow;
}

export async function getMuezzinPrimaryMosque(supabase: SupabaseClient, userId: string): Promise<PrimaryMosque | null> {
  const cached = primaryMosqueCache.get(userId) ?? null;
  try {
    const log = (...args: any[]) => console.log('[liveAdhan.getMuezzinPrimaryMosque]', ...args);
    log('lookup start', { userId });
    const sessionMosque = await resolveMuezzinMosqueFromSessionAccess();
    if (sessionMosque?.mosqueId) {
      log('server fallback result', { sessionMosque });
      return cachePrimaryMosque(userId, sessionMosque);
    }

    const { data, error } = await supabase
      .from('muezzins')
      .select('mosque_id, mosques(name)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }) // prefer the most recently assigned active mosque
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      log('lookup result', { data });
      const direct = await hydratePrimaryMosque(supabase, {
        mosqueId: (data as any).mosque_id,
        mosqueName: (data as any)?.mosques?.name ?? null,
        stream: null,
      });
      return cachePrimaryMosque(userId, direct);
    }

    if (error || !data) {
      log('lookup result', { data, error });
      try {
        const rotaRow = await findMosqueFromStaffRota(supabase, userId);
        if (rotaRow?.mosque_id) {
          log('rota fallback result', { rotaRow });
          const hydrated = await hydratePrimaryMosque(supabase, {
            mosqueId: rotaRow.mosque_id,
            mosqueName: null,
            stream: null,
          });
          return cachePrimaryMosque(userId, hydrated);
        }
      } catch (rotaFallbackError) {
        log('rota fallback error', rotaFallbackError);
      }
      return cached;
    }
    return cached;
  } catch (e) {
    console.log('[liveAdhan.getMuezzinPrimaryMosque] error', e);
    return cached;
  }
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
  const allowed: (PrayerName | string)[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const resolved = resolvePrayer(args);
  const prayer =
    args.mode === 'test'
      ? 'maghrib'
      : allowed.includes((resolved ?? '').toString().toLowerCase())
      ? resolved
      : 'maghrib';
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
    started_at: now,
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
      .upsert(
        {
          mosque_id: args.mosqueId,
          is_live: true,
          status: 'active',
          last_health_check: now,
          current_prayer: prayer,
          started_at: now,
        ended_at: null,
      } as any,
      { onConflict: 'mosque_id' }
    )
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
      .update({ status: 'completed', broadcast_ended_at: now, ended_at: now })
      .eq('id', targetAdhanId)
      .select()
      .maybeSingle();
    if (error) throw error;
    adhan = data ?? null;
  }

  const { data: stream, error: streamErr } = await supabase
    .from('streams')
    .update({ is_live: false, status: 'active', last_health_check: now, ended_at: now })
    .eq('mosque_id', args.mosqueId)
    .select()
    .maybeSingle();
  if (streamErr) throw streamErr;

  return { adhan, stream };
}
