import { supabase } from '../../supabase';
import { PrayerName } from '../../adhans';

export type TodayAssignments = Partial<Record<PrayerName, string | null>>;

export async function getTodayAssignments(mosqueId: string, userId: string, dateIso: string): Promise<TodayAssignments> {
  const result: TodayAssignments = {};
  const { data, error } = await supabase
    .from('staff_rota')
    .select('prayer_name, adhan_time')
    .eq('mosque_id', mosqueId)
    .eq('muezzin_user_id', userId)
    .eq('date', dateIso);
  if (error && error.code !== 'PGRST116') throw error;
  (data ?? []).forEach((row: any) => {
    const key = (row.prayer_name ?? '').toLowerCase() as PrayerName;
    result[key] = row.adhan_time ?? null;
  });
  return result;
}
