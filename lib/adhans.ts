import { scheduleReminders } from './notify';
import { supabase } from './supabase';

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type BroadcastStatus = 'scheduled' | 'live' | 'completed' | 'missed' | 'cancelled';

export type AdhanBroadcast = {
  id: string;
  mosque_id: string;
  mosque_name?: string | null;
  prayer: PrayerName;
  scheduled_for: string; // ISO timestamp (UTC)
  status: BroadcastStatus;
  started_at?: string | null;
  ended_at?: string | null;
  time_zone?: string | null;
};

const EARLY_START_MIN = 10; // allow starting up to 10 minutes early
const LATE_GRACE_MIN = 5; // allow starting up to 5 minutes after the scheduled time

export function labelForPrayer(prayer: PrayerName) {
  switch (prayer) {
    case 'fajr':
      return 'Fajr';
    case 'dhuhr':
      return 'Dhuhr';
    case 'asr':
      return 'Asr';
    case 'maghrib':
      return 'Maghrib';
    case 'isha':
      return 'Isha';
    default:
      return prayer;
  }
}

export function toDate(broadcast: AdhanBroadcast) {
  return new Date(broadcast.scheduled_for);
}

export function secondsUntil(target: Date, now = new Date()) {
  return Math.floor((target.getTime() - now.getTime()) / 1000);
}

export function canStartBroadcast(broadcast: AdhanBroadcast, now = new Date()) {
  const target = toDate(broadcast);
  const diffSeconds = secondsUntil(target, now);
  const early = EARLY_START_MIN * 60;
  const late = LATE_GRACE_MIN * 60;
  return diffSeconds <= early && diffSeconds >= -late;
}

export function statusBadge(broadcast: AdhanBroadcast, now = new Date()) {
  if (broadcast.status === 'live') return 'Live now';
  if (broadcast.status === 'completed') return 'Completed';
  if (broadcast.status === 'missed') return 'Missed';
  if (broadcast.status === 'cancelled') return 'Cancelled';

  const diff = secondsUntil(toDate(broadcast), now);
  if (diff > 3600) {
    const hrs = Math.round(diff / 360) / 10;
    return `In ${hrs}h`;
  }
  if (diff > 60) return `In ${Math.floor(diff / 60)} min`;
  if (diff > 0) return `In ${diff}s`;
  if (diff > -300) return 'Starting';
  return 'Scheduled';
}

export async function fetchUpcomingBroadcasts(limit = 3) {
  const { data, error } = await supabase.rpc('get_upcoming_broadcasts_for_user', {
    limit_rows: limit,
  });
  if (error) throw error;
  return (data as AdhanBroadcast[]) ?? [];
}

export async function fetchBroadcastById(id: string) {
  const { data, error } = await supabase.rpc('get_broadcast_by_id', {
    broadcast_id: id,
  });
  if (error) throw error;
  return (data as AdhanBroadcast | null) ?? null;
}

export async function startBroadcast(id: string) {
  const { data, error } = await supabase.rpc('begin_broadcast_client', { broadcast_id: id });
  if (error) throw error;
  return data as AdhanBroadcast;
}

export async function completeBroadcast(id: string, asMissed = false) {
  const { data, error } = await supabase.rpc('complete_broadcast_client', { broadcast_id: id, mark_missed: asMissed });
  if (error) throw error;
  return data as AdhanBroadcast;
}

export async function scheduleLocalRemindersForBroadcast(
  broadcast: AdhanBroadcast,
  offsetsMins: number[] = [15, 5]
) {
  const when = toDate(broadcast);
  const label = `${labelForPrayer(broadcast.prayer)} at ${when.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
  return scheduleReminders(when, offsetsMins, label);
}

export function formatTimeWithTz(broadcast: AdhanBroadcast) {
  const d = toDate(broadcast);
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };
  if (broadcast.time_zone) {
    opts.timeZone = broadcast.time_zone;
    opts.timeZoneName = 'short';
  }
  return d.toLocaleTimeString([], opts);
}
