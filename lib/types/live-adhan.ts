// Shared types for the Live Adhan backend contract (Stage 1 placeholders).
// These are not imported by existing screens to keep this stage non-breaking.

export type LiveStreamState = {
  id?: string;
  mosque_id: string;
  is_live: boolean | null;
  current_prayer?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  stream_url?: string | null;
};

export type AdhanScheduleEntry = {
  id?: string;
  mosque_id: string;
  prayer: string;
  scheduled_at: string;
  status?: 'scheduled' | 'live' | 'completed' | 'cancelled' | string;
  started_at?: string | null;
  ended_at?: string | null;
  stream_id?: string | null;
};
