export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type RotaPrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type LiveStatus = 'scheduled' | 'ready' | 'live' | 'completed';

export interface StaffRotaEntry {
  id: string;
  mosque_id: string;
  date: string; // ISO date (staff_rota.date)
  prayer_name: RotaPrayerName;
  muezzin_user_id: string | null;
  staff_user_id?: string | null;
  duty_date?: string | null; // legacy column
  prayer?: string | null; // legacy column
  role_on_duty?: string | null;
  adhan_time?: string | Date | null;
  iqama_time?: string | Date | null;
  notes?: string | null;
}

export interface MuezzinSlot {
  id: string;
  mosqueId: string;
  mosqueName: string;
  prayerName: PrayerName;
  adhanTime: Date | null;
  liveWindowStart: Date | null;
  liveWindowEnd: Date | null;
  status: LiveStatus; // computed on the client
  isAssignedToMe: boolean;
  assignedMuezzinUserId?: string | null;
  assignedMuezzinName?: string | null;
  iqamaTime?: Date | null;
  notes?: string | null;
}

export interface MuezzinSchedule {
  mosqueId: string | null;
  mosqueName: string | null;
  slots: MuezzinSlot[];
  nextAssignedSlot: MuezzinSlot | null;
  date?: Date | null;
}
