export const TIMEZONE_OPTIONS = [
  { label: 'UTC', value: 'UTC' },
  { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
  { label: 'Europe/Paris (CET/CEST)', value: 'Europe/Paris' },
  { label: 'Europe/Berlin (CET/CEST)', value: 'Europe/Berlin' },
  { label: 'Europe/Amsterdam (CET/CEST)', value: 'Europe/Amsterdam' },
  { label: 'Europe/Madrid (CET/CEST)', value: 'Europe/Madrid' },
  { label: 'Europe/Istanbul (TRT)', value: 'Europe/Istanbul' },
  { label: 'Africa/Cairo (EET)', value: 'Africa/Cairo' },
  { label: 'Africa/Casablanca (WET/WEST)', value: 'Africa/Casablanca' },
  { label: 'Africa/Lagos (WAT)', value: 'Africa/Lagos' },
  { label: 'Africa/Nairobi (EAT)', value: 'Africa/Nairobi' },
  { label: 'Africa/Johannesburg (SAST)', value: 'Africa/Johannesburg' },
  { label: 'Asia/Riyadh (AST +03)', value: 'Asia/Riyadh' },
  { label: 'Asia/Dubai (GST +04)', value: 'Asia/Dubai' },
  { label: 'Asia/Kuwait (AST +03)', value: 'Asia/Kuwait' },
  { label: 'Asia/Baghdad (AST +03)', value: 'Asia/Baghdad' },
  { label: 'Asia/Tehran (IRST +03:30)', value: 'Asia/Tehran' },
  { label: 'Asia/Karachi (PKT +05)', value: 'Asia/Karachi' },
  { label: 'Asia/Kolkata (IST +05:30)', value: 'Asia/Kolkata' },
  { label: 'Asia/Dhaka (BST +06)', value: 'Asia/Dhaka' },
  { label: 'Asia/Jakarta (WIB +07)', value: 'Asia/Jakarta' },
  { label: 'Asia/Kuala_Lumpur (MYT +08)', value: 'Asia/Kuala_Lumpur' },
  { label: 'Asia/Singapore (SGT +08)', value: 'Asia/Singapore' },
  { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
  { label: 'America/Chicago (CST/CDT)', value: 'America/Chicago' },
  { label: 'America/Denver (MST/MDT)', value: 'America/Denver' },
  { label: 'America/Los_Angeles (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'America/Toronto (EST/EDT)', value: 'America/Toronto' },
  { label: 'America/Vancouver (PST/PDT)', value: 'America/Vancouver' },
  { label: 'Australia/Sydney (AEST/AEDT)', value: 'Australia/Sydney' },
  { label: 'Australia/Perth (AWST)', value: 'Australia/Perth' },
] as const;

export function isValidTimeZone(value?: string | null) {
  const timeZone = value?.trim();
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}
