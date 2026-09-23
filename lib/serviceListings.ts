import type { Ionicons } from "@expo/vector-icons";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type CategoryKey =
  | "quran_tajweed"
  | "hifz"
  | "arabic"
  | "madrasah"
  | "alim_alimah"
  | "adult_classes"
  | "new_muslims"
  | "youth"
  | "sisters"
  | "family_wellbeing"
  | "community_support";
export type AudienceKey = "children" | "youth" | "adults" | "women" | "men" | "everyone";
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type ActionType = "phone" | "whatsapp" | "email" | "website" | "drop_in";
export type ListingStatus = "draft" | "published" | "archived";

export type ServiceListing = {
  id: string;
  mosque_id: string;
  title: string;
  category_key: CategoryKey;
  description: string;
  audience_key: AudienceKey;
  age_note: string;
  location: string;
  days: DayKey[];
  time_from: string | null;
  time_to: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_text: string;
  taking_enrolments: boolean;
  action_type: ActionType;
  action_value: string;
  status: ListingStatus;
};

export type ServiceIntake = {
  id: string;
  service_id: string;
  mosque_id: string;
  title: string;
  audience_note: string;
  days: DayKey[];
  time_from: string | null;
  time_to: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_text: string;
  taking_enrolments: boolean;
  note: string;
};

export const CATEGORIES: { key: CategoryKey; label: string; short: string; icon: IconName; color: string; bg: string }[] = [
  { key: "quran_tajweed", label: "Qur'an & Tajweed", short: "Qur'an", icon: "book-outline", color: "#155F4E", bg: "#E3F1EC" },
  { key: "hifz", label: "Hifz (memorisation)", short: "Hifz", icon: "sparkles-outline", color: "#0F766E", bg: "#DDF4F1" },
  { key: "arabic", label: "Arabic language", short: "Arabic", icon: "language-outline", color: "#B45309", bg: "#FEF3C7" },
  { key: "madrasah", label: "Children's Islamic studies", short: "Madrasah", icon: "school-outline", color: "#1D4ED8", bg: "#DBEAFE" },
  { key: "alim_alimah", label: "Alim / Alimah programme", short: "Alim / Alimah", icon: "ribbon-outline", color: "#7E1D3F", bg: "#FCE7F3" },
  { key: "adult_classes", label: "Adult & evening classes", short: "Adults", icon: "moon-outline", color: "#4338CA", bg: "#E0E7FF" },
  { key: "new_muslims", label: "New Muslims", short: "New Muslims", icon: "heart-outline", color: "#BE123C", bg: "#FFE4E6" },
  { key: "youth", label: "Youth programme", short: "Youth", icon: "flash-outline", color: "#C2410C", bg: "#FFEDD5" },
  { key: "sisters", label: "Sisters' circle", short: "Sisters", icon: "flower-outline", color: "#9D174D", bg: "#FCE7F3" },
  { key: "family_wellbeing", label: "Family & wellbeing", short: "Family", icon: "people-outline", color: "#047857", bg: "#D1FAE5" },
  { key: "community_support", label: "Community support", short: "Support", icon: "hand-left-outline", color: "#374151", bg: "#F3F4F6" },
];
export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[3];

export const AUDIENCES: { key: AudienceKey; label: string }[] = [
  { key: "children", label: "Children" },
  { key: "youth", label: "Youth" },
  { key: "adults", label: "Adults" },
  { key: "women", label: "Women & girls" },
  { key: "men", label: "Men & boys" },
  { key: "everyone", label: "Everyone" },
];
export const audienceLabel = (key: string, ageNote = "") => {
  const base = AUDIENCES.find((a) => a.key === key)?.label ?? "Everyone";
  return ageNote.trim() ? `${base} · ${ageNote.trim()}` : base;
};

export const DAYS: { key: DayKey; short: string; label: string }[] = [
  { key: "mon", short: "Mon", label: "Monday" },
  { key: "tue", short: "Tue", label: "Tuesday" },
  { key: "wed", short: "Wed", label: "Wednesday" },
  { key: "thu", short: "Thu", label: "Thursday" },
  { key: "fri", short: "Fri", label: "Friday" },
  { key: "sat", short: "Sat", label: "Saturday" },
  { key: "sun", short: "Sun", label: "Sunday" },
];
const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export function sortDays(days: DayKey[]): DayKey[] {
  return DAY_ORDER.filter((d) => days.includes(d));
}
export function formatDays(days: DayKey[]): string {
  const d = sortDays(days);
  if (!d.length) return "";
  const idx = d.map((k) => DAY_ORDER.indexOf(k));
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (d.length === 7) return "Every day";
  if (d.length === 1) return `Every ${DAYS[idx[0]].label}`;
  if (d.length === 5 && idx[0] === 0 && idx[4] === 4) return "Mon–Fri";
  if (d.length === 2 && idx[0] === 5) return "Weekends";
  if (consecutive && d.length > 2) return `${DAYS[idx[0]].short}–${DAYS[idx[idx.length - 1]].short}`;
  return d.map((k) => DAYS[DAY_ORDER.indexOf(k)].short).join(" & ");
}
export function formatTime(hhmm: string | null): string {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = ((h + 11) % 12) + 1;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}
export function formatTimeRange(from: string | null, to: string | null): string {
  const a = formatTime(from);
  const b = formatTime(to);
  return a && b ? `${a}–${b}` : a || b;
}
export function formatWhen(item: { days: DayKey[]; time_from: string | null; time_to: string | null }): string {
  return [formatDays(item.days), formatTimeRange(item.time_from, item.time_to)].filter(Boolean).join(" · ");
}

export function httpsUrl(value: string): string | null {
  try {
    if (/\s/.test(value.trim())) return null;
    const url = new URL(value.trim());
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function displayDate(value: string | null, fallback = ""): string {
  return value && validDate(value)
    ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })
    : fallback;
}
export const toIsoDate = (d: Date) => londonToday(d);

export type ClassStatus = "upcoming" | "running" | "finished";
export function classStatus(item: { start_date: string | null; end_date: string | null }, today = londonToday()): ClassStatus {
  if (item.end_date && item.end_date < today) return "finished";
  if (item.start_date && item.start_date > today) return "upcoming";
  return "running";
}
/** Enrolment chip for a class or option: derived from dates plus the admin's switch. */
export function enrolmentChip(
  item: { start_date: string | null; end_date: string | null; taking_enrolments: boolean },
  today = londonToday(),
): { label: string; tone: "open" | "closed" | "info"; canApply: boolean } {
  const status = classStatus(item, today);
  if (status === "finished") return { label: "Finished", tone: "closed", canApply: false };
  if (!item.taking_enrolments) return { label: "Enrolment closed", tone: "closed", canApply: false };
  if (status === "upcoming") return { label: `Starts ${displayDate(item.start_date)}`, tone: "open", canApply: true };
  return { label: "Enrolling now", tone: "open", canApply: true };
}

export const ACTIONS: { key: ActionType; label: string; icon: IconName; placeholder: string; hint: string }[] = [
  { key: "phone", label: "Call", icon: "call-outline", placeholder: "07123 456789", hint: "Phone number people should call" },
  { key: "whatsapp", label: "WhatsApp", icon: "logo-whatsapp", placeholder: "+447123456789", hint: "Number in international format, starting with +" },
  { key: "email", label: "Email", icon: "mail-outline", placeholder: "classes@mosque.org", hint: "Email address for enquiries" },
  { key: "website", label: "Website", icon: "globe-outline", placeholder: "https://…", hint: "Secure (https) page or form" },
  { key: "drop_in", label: "Just turn up", icon: "walk-outline", placeholder: "", hint: "No booking needed" },
];
export function serviceAction(service: Pick<ServiceListing, "action_type" | "action_value">): { label: string; url: string | null; icon: IconName } {
  const value = (service.action_value || "").trim();
  switch (service.action_type) {
    case "website":
      return { label: "Apply on the mosque's website", url: httpsUrl(value), icon: "globe-outline" };
    case "phone":
      return { label: "Call about this class", url: /^\+?[0-9 ()-]{7,25}$/.test(value) ? `tel:${value.replace(/[ ()-]/g, "")}` : null, icon: "call-outline" };
    case "email":
      return { label: "Email about this class", url: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null, icon: "mail-outline" };
    case "whatsapp":
      return { label: "WhatsApp the mosque", url: /^\+[1-9]\d{6,14}$/.test(value) ? `https://wa.me/${value.slice(1)}` : null, icon: "logo-whatsapp" };
    default:
      return { label: "No booking needed — just turn up", url: null, icon: "walk-outline" };
  }
}
export function actionValueValid(type: ActionType, value: string): boolean {
  if (type === "drop_in") return true;
  return !!serviceAction({ action_type: type, action_value: value }).url;
}

export const LISTING_COLUMNS =
  "id,mosque_id,title,category_key,description,audience_key,age_note,location,days,time_from,time_to,start_date,end_date,fee_text,taking_enrolments,action_type,action_value,status";
export const INTAKE_COLUMNS =
  "id,service_id,mosque_id,title,audience_note,days,time_from,time_to,start_date,end_date,fee_text,taking_enrolments,note";
