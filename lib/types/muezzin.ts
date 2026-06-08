export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type RotaPrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type LiveStatus = 'scheduled' | 'ready' | 'live' | 'completed';
export type AssignmentSource = 'manual' | 'default' | 'cover';

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

export type CoverRequestKind = 'release' | 'cover';

export type CoverRequestUrgency = 'standard' | 'urgent';

export type CoverRequestStatus =
  | 'open'
  | 'volunteered'
  | 'provisional_cover'
  | 'approved'
  | 'dismissed'
  | 'cancelled';

export interface MuezzinCoverRequest {
  id: string;
  mosque_id: string;
  date: string;
  prayer_name: RotaPrayerName;
  requester_user_id: string;
  original_muezzin_user_id: string;
  volunteer_user_id?: string | null;
  request_kind: CoverRequestKind;
  urgency: CoverRequestUrgency;
  status: CoverRequestStatus;
  reason?: string | null;
  requested_at?: string | null;
  responded_at?: string | null;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  requester_name?: string | null;
  volunteer_name?: string | null;
  resolved_by_name?: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  mosque_id?: string | null;
  actor_user_id?: string | null;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at?: string | null;
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
  assignmentSource?: AssignmentSource | null;
  iqamaTime?: Date | null;
  notes?: string | null;
}

export interface MuezzinSchedule {
  mosqueId: string | null;
  mosqueName: string | null;
  slots: MuezzinSlot[];
  nextAssignedSlot: MuezzinSlot | null;
  nextMosqueSlot?: MuezzinSlot | null;
  date?: Date | null;
}
