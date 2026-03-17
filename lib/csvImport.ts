import { supabase } from './supabase';

export interface PrayerTimesCSVRow {
  day: string;
  date: string;
  weekday: string;
  fajr_start: string;
  fajr_jamaah: string;
  sunrise: string;
  dhuhr_start: string;
  dhuhr_jamaah: string;
  asr_start: string;
  asr_jamaah: string;
  maghrib_start: string;
  maghrib_jamaah: string;
  isha_start: string;
  isha_jamaah: string;
}

export async function importPrayerTimesFromCSV(
  mosqueId: string,
  csvRows: PrayerTimesCSVRow[],
  userId: string,
  year: number = 2026,
  month: number = 2 // February
) {
  const inserts = csvRows.map(row => {
    // Parse date - assuming format like "13" for day, and we add month/year
    const day = parseInt(row.date.split('/')[0]); // Handle dates like "30/1" for Jan 30
    const actualMonth = row.date.includes('/') ? parseInt(row.date.split('/')[1]) - 1 : month - 1; // 0-based
    const date = new Date(year, actualMonth, day);

    return {
      mosque_id: mosqueId,
      date: date.toISOString().split('T')[0], // YYYY-MM-DD format
      fajr_adhan_time: row.fajr_start ? `${date.toISOString().split('T')[0]}T${row.fajr_start}:00Z` : null,
      fajr_iqama_time: row.fajr_jamaah ? `${date.toISOString().split('T')[0]}T${row.fajr_jamaah}:00Z` : null,
      dhuhr_adhan_time: row.dhuhr_start ? `${date.toISOString().split('T')[0]}T${row.dhuhr_start}:00Z` : null,
      dhuhr_iqama_time: row.dhuhr_jamaah ? `${date.toISOString().split('T')[0]}T${row.dhuhr_jamaah}:00Z` : null,
      asr_adhan_time: row.asr_start ? `${date.toISOString().split('T')[0]}T${row.asr_start}:00Z` : null,
      asr_iqama_time: row.asr_jamaah ? `${date.toISOString().split('T')[0]}T${row.asr_jamaah}:00Z` : null,
      maghrib_adhan_time: row.maghrib_start ? `${date.toISOString().split('T')[0]}T${row.maghrib_start}:00Z` : null,
      maghrib_iqama_time: row.maghrib_jamaah ? `${date.toISOString().split('T')[0]}T${row.maghrib_jamaah}:00Z` : null,
      isha_adhan_time: row.isha_start ? `${date.toISOString().split('T')[0]}T${row.isha_start}:00Z` : null,
      isha_iqama_time: row.isha_jamaah ? `${date.toISOString().split('T')[0]}T${row.isha_jamaah}:00Z` : null,
      source_type: 'upload',
      created_by: userId,
      updated_by: userId,
    };
  });

  const { data, error } = await supabase
    .from('prayer_times')
    .insert(inserts)
    .select();

  if (error) throw error;
  return data;
}
