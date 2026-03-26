import { supabase } from '../../supabase';
import { PrayerName } from '../../adhans';

export type TodayAssignments = Partial<Record<PrayerName, string | null>>;

export async function getTodayAssignments(mosqueId: string, userId: string, dateIso: string): Promise<TodayAssignments> {
  const result: TodayAssignments = {};
  let data: any[] | null = null;
  let error: any = null;
  ({ data, error } = await supabase
    .from('staff_rota')
    .select('prayer_name, adhan_time, muezzin_user_id, staff_user_id')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso));

  if (error?.code === '42703') {
    const fallback = await supabase
      .from('staff_rota')
      .select('prayer_name, muezzin_user_id, staff_user_id')
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso);
    data = fallback.data ?? [];
    error = fallback.error ?? null;
  }

  if (error && error.code !== 'PGRST116') throw error;

  const { data: coverRows, error: coverError } = await supabase
    .from('muezzin_cover_requests')
    .select('date, prayer_name, volunteer_user_id, status')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .in('status', ['provisional_cover', 'approved']);

  if (coverError && coverError.code !== 'PGRST116') throw coverError;

  const coverMap: Record<string, string> = {};
  ((coverRows ?? []) as {
    prayer_name?: string | null;
    volunteer_user_id?: string | null;
  }[]).forEach((row) => {
    const prayerName = (row.prayer_name ?? '').toLowerCase();
    if (prayerName && row.volunteer_user_id) {
      coverMap[prayerName] = row.volunteer_user_id;
    }
  });

  (data ?? []).forEach((row: any) => {
    const key = (row.prayer_name ?? '').toLowerCase() as PrayerName;
    const assignedUserId = coverMap[key] ?? row.muezzin_user_id ?? row.staff_user_id ?? null;
    if (assignedUserId === userId) {
      result[key] = row.adhan_time ?? null;
    }
  });
  return result;
}
