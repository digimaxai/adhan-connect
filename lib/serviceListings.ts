export type ServiceListing = {
  id: string;
  mosque_id: string;
  title: string;
  category: string;
  kind: "course" | "drop_in" | "appointment";
  description: string;
  audience: string;
  location: string;
  schedule: string;
  fee_text: string;
  action_type: "website" | "phone" | "email" | "whatsapp" | "drop_in";
  action_value: string;
  status: "draft" | "published" | "archived";
  review_on: string | null;
};
export type ServiceIntake = {
  id: string;
  service_id: string;
  mosque_id: string;
  title: string;
  audience: string;
  prerequisites: string;
  start_date: string | null;
  end_date: string | null;
  schedule: string;
  duration_text: string;
  fee_text: string;
  enrolment: "open" | "waitlist" | "closed" | "contact";
  enrolment_closes_on: string | null;
  state: "upcoming" | "running" | "completed" | "cancelled";
  notes: string;
};
export function httpsUrl(value: string): string | null {
  try {
    if (/\s/.test(value.trim())) return null;
    const url = new URL(value.trim());
    return url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function displayDate(value: string | null): string {
  return value && validDate(value)
    ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/London",
      })
    : "Confirm with mosque";
}
export function intakeAvailability(
  intake: ServiceIntake,
  today = londonToday(),
) {
  const state =
    intake.state === "cancelled"
      ? "cancelled"
      : intake.state === "completed" ||
          (intake.end_date && intake.end_date < today)
        ? "completed"
        : intake.start_date && intake.start_date <= today
          ? "running"
          : intake.state;
  const closed =
    state === "completed" ||
    state === "cancelled" ||
    intake.enrolment === "closed" ||
    !!(intake.enrolment_closes_on && intake.enrolment_closes_on < today);
  return {
    state,
    canApply: !closed,
    label: closed
      ? "Enrolment closed"
      : intake.enrolment === "open"
        ? "Enrolment open"
        : intake.enrolment === "waitlist"
          ? "Waiting list"
          : "Contact mosque for availability",
  };
}
export function serviceAction(
  service: Pick<ServiceListing, "action_type" | "action_value">,
): { label: string; url: string | null } {
  const value = service.action_value.trim();
  switch (service.action_type) {
    case "website":
      return { label: "Apply on mosque’s website ↗", url: httpsUrl(value) };
    case "phone":
      return {
        label: "Call about enrolment",
        url: /^\+?[0-9 ()-]{7,25}$/.test(value)
          ? `tel:${value.replace(/[ ()-]/g, "")}`
          : null,
      };
    case "email":
      return {
        label: "Email an enquiry",
        url: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          ? `mailto:${value}`
          : null,
      };
    case "whatsapp":
      return {
        label: "Enquire on WhatsApp ↗",
        url: /^\+[1-9]\d{6,14}$/.test(value)
          ? `https://wa.me/${value.slice(1)}`
          : null,
      };
    default:
      return { label: "No booking needed", url: null };
  }
}
