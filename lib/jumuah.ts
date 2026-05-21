export type JumuahSlot = {
  id: string;
  label?: string | null;
  khutbah_at?: string | null;
  salah_at?: string | null;
  venue?: string | null;
  language?: string | null;
  imam?: string | null;
  capacity?: number | null;
  notes?: string | null;
};

export type JumuahSummary = { slot_id: string; attendee_count: number | null; household_count: number | null };
export type JumuahIntent = { slot_id: string; party_size: number };

export function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nextFridayDate() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  date.setDate(date.getDate() + daysUntilFriday);
  return dateOnly(date);
}

export function isFridayToday() {
  return new Date().getDay() === 5;
}

export function formatJumuahTime(value?: string | null) {
  if (!value) return null;
  return value.slice(0, 5);
}

export function crowdState(count: number, capacity?: number | null) {
  if (!capacity || capacity <= 0) return { label: count > 0 ? 'Planning' : 'Open', tone: 'neutral' as const, pct: 0 };
  const pct = Math.min(100, Math.round((count / capacity) * 100));
  if (pct >= 100) return { label: 'Full', tone: 'danger' as const, pct };
  if (pct >= 85) return { label: 'Nearly full', tone: 'warning' as const, pct };
  if (pct >= 60) return { label: 'Getting busy', tone: 'busy' as const, pct };
  return { label: 'Light', tone: 'calm' as const, pct };
}

export function legacyJumuahSlot(id: string, time: string, index: number): JumuahSlot {
  return {
    id: `legacy-${id}-${index}`,
    label: `Jumu'ah ${index + 1}`,
    salah_at: time,
  };
}

export function summaryFromRows(rows: JumuahSummary[] | null | undefined) {
  return (rows ?? []).reduce<Record<string, JumuahSummary>>((acc, row) => {
    if (row.slot_id) acc[row.slot_id] = row;
    return acc;
  }, {});
}

export function intentsFromRows(rows: JumuahIntent[] | null | undefined) {
  return (rows ?? []).reduce<Record<string, number>>((acc, row) => {
    if (row.slot_id) acc[row.slot_id] = row.party_size;
    return acc;
  }, {});
}
