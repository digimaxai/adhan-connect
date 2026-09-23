import { supabase } from '../../supabase';
import type { PrayerName } from '../../adhans';

export type IqamahScheduleRow = {
  id: string;
  mosque_id: string;
  prayer: PrayerName;
  iqama_time: string;
  start_date: string;
  end_date: string | null;
  label: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function listIqamahSchedules(mosqueId: string): Promise<IqamahScheduleRow[]> {
  const { data, error } = await supabase.rpc('list_mosque_iqamah_schedules', { p_mosque_id: mosqueId });
  if (error) throw error;
  return (data ?? []) as IqamahScheduleRow[];
}

export async function upsertIqamahSchedule(input: {
  id?: string | null;
  mosqueId: string;
  prayer: PrayerName;
  iqamaTime: string;
  startDate: string;
  endDate: string | null;
  label?: string | null;
}): Promise<IqamahScheduleRow> {
  const { data, error } = await supabase.rpc('upsert_mosque_iqamah_schedule', {
    p_id: input.id ?? null,
    p_mosque_id: input.mosqueId,
    p_prayer: input.prayer,
    p_iqama_time: input.iqamaTime,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_label: input.label ?? null,
  });
  if (error) throw error;
  return data as IqamahScheduleRow;
}

export async function deleteIqamahSchedule(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_mosque_iqamah_schedule', { p_id: id });
  if (error) throw error;
}

export function findExpiringWithoutSuccessor(
  schedules: IqamahScheduleRow[],
  withinDays = 7,
  today: Date = new Date()
): IqamahScheduleRow[] {
  const todayIso = today.toISOString().slice(0, 10);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + withinDays);
  const horizonIso = horizon.toISOString().slice(0, 10);

  return schedules.filter((row) => {
    if (!row.end_date) return false;
    if (row.end_date < todayIso || row.end_date > horizonIso) return false;
    const nextDayIso = addDaysIso(row.end_date, 1);
    const hasSuccessor = schedules.some(
      (other) =>
        other.id !== row.id &&
        other.prayer === row.prayer &&
        other.start_date <= nextDayIso &&
        (!other.end_date || other.end_date >= nextDayIso)
    );
    return !hasSuccessor;
  });
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
