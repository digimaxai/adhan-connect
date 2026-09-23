/** Shared, deterministic review validation. No network, database or device timezone. */
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export const COLUMNS = ['date', ...PRAYERS.flatMap(p => [p, `${p}_iqama`])];
export const PROFILE_FIELDS = ['website', 'address_line1', 'address_line2', 'city', 'postcode', 'country', 'contact_phone', 'contact_email', 'management_info', 'services_info'] as const;
export type ProfileField = typeof PROFILE_FIELDS[number];
export type Evidence = { value: string; source_url: string; evidence: string };
export type ExtractedTable = { title: string; source_url: string; headers: string[]; rows: string[][]; notes: string[] };
export type Extraction = {
  website: string; match_reason: string; warnings: string[];
  fields: { field: ProfileField; value: string; source_url: string; evidence: string }[];
  tables: ExtractedTable[];
};
export type Review = {
  profile: Partial<Record<ProfileField, Evidence>>;
  table: ExtractedTable | null;
  mapping: Record<string, number>;
  timeZone: string;
  websiteConfirmed: boolean;
  warningsAccepted: boolean;
};
export type NormalizedRow = { date: string; [column: string]: string | null };
export function safeSourceUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
    const h = u.hostname.toLowerCase();
    if (!h.includes('.') || /[\[\]:]/.test(h) || /^[\d.]+$/.test(h) || /\.(local|localhost|internal|test|invalid)$/.test(h)) return null;
    return u.href;
  } catch { return null; }
}
export function suggestMapping(headers: string[]) {
  const result: Record<string, number> = {};
  headers.forEach((header, i) => {
    const h = header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\bzuhr\b/g, 'dhuhr');
    if (/^(date|day|prayer date|schedule date)$/.test(h)) result.date ??= i;
    for (const p of PRAYERS) {
      if (!new RegExp(`\\b${p}\\b`).test(h)) continue;
      const iqama = /iqam[ah]*|jama[ath]*|jamat|congregation/.test(h);
      result[iqama ? `${p}_iqama` : p] ??= i;
    }
  });
  return result;
}
export function normalizeTime(raw: string): string | null {
  if (!raw.trim()) return null;
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/);
  if (!m) throw new Error(`Unrecognised time “${raw}”. Use HH:MM or an explicit am/pm suffix.`);
  let h = Number(m[1]); const min = Number(m[2]);
  if (min > 59 || h > 23 || (m[3] && (h < 1 || h > 12))) throw new Error(`Invalid time “${raw}”.`);
  if (m[3]) h = h % 12 + (m[3] === 'pm' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
export function normalizeDate(raw: string, month: string): string {
  let value = raw.trim();
  if (/^\d{1,2}$/.test(value)) value = `${month}-${value.padStart(2, '0')}`;
  const dmy = value.match(/^(\d{2})[/.\-](\d{2})[/.\-](\d{4})$/);
  if (dmy) value = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`Invalid date “${raw}”.`);
  if (!value.startsWith(`${month}-`)) throw new Error(`Date ${value} is outside the requested month ${month}.`);
  return value;
}
export function validateReview(review: Review, month: string, today = new Date().toISOString().slice(0, 10)) {
  const errors: string[] = []; const warnings: string[] = []; const rows: NormalizedRow[] = [];
  if (!review.websiteConfirmed) errors.push('Confirm that the sources belong to this mosque.');
  for (const [key, field] of Object.entries(review.profile)) {
    if (!(PROFILE_FIELDS as readonly string[]).includes(key) || !field || typeof field.value !== 'string' || field.value.length > 5000 || !field.value.trim() || !safeSourceUrl(field.source_url) || typeof field.evidence !== 'string') errors.push(`Invalid value or source for ${key}.`);
    if (key === 'website' && field && !safeSourceUrl(field.value)) errors.push('Website must be a public HTTPS URL.');
    if (key === 'contact_email' && field && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) errors.push('Contact email is invalid.');
  }
  if (review.table) {
    try { new Intl.DateTimeFormat('en', { timeZone: review.timeZone }).format(); } catch { errors.push('Choose a valid IANA mosque timezone.'); }
    if (!safeSourceUrl(review.table.source_url)) errors.push('A public HTTPS timetable source is required.');
    const used = new Set<number>();
    for (const c of COLUMNS) {
      const i = review.mapping[c];
      if (i === undefined || i === -1) {
        if (c === 'date' || (PRAYERS as readonly string[]).includes(c)) errors.push(`Map the ${c} column.`);
      } else if (!Number.isInteger(i) || i < 0 || i >= review.table.headers.length || used.has(i)) errors.push(`Invalid or duplicate mapping for ${c}.`);
      else used.add(i);
    }
    if (!review.table.rows.length || review.table.rows.length > 31) errors.push('Select between 1 and 31 daily rows.');
    const seen = new Set<string>();
    review.table.rows.forEach((cells, index) => {
      try {
        const row: NormalizedRow = { date: normalizeDate(cells[review.mapping.date] ?? '', month) };
        if (seen.has(row.date)) throw new Error(`Duplicate date ${row.date}. Select one timetable variant.`);
        seen.add(row.date);
        for (const c of COLUMNS.slice(1)) {
          row[c] = normalizeTime(cells[review.mapping[c]] ?? '');
          if ((PRAYERS as readonly string[]).includes(c) && !row[c]) throw new Error(`Missing ${c} beginning time.`);
        }
        let last = '';
        for (const p of PRAYERS) {
          const t = row[p]!;
          if (last && t <= last) warnings.push(`${row.date}: prayer beginnings are not in order; check AM/PM.`);
          if (row[`${p}_iqama`] && row[`${p}_iqama`]! < t) warnings.push(`${row.date}: ${p} iqama is earlier than its beginning.`);
          last = t;
        }
        rows.push(row);
      } catch (e) { errors.push(`Row ${index + 1}: ${(e as Error).message}`); }
    });
    if (used.size < review.table.headers.length) warnings.push('Unmapped columns will stay in the source record and will not be published.');
    const sorted = rows.map(r => r.date).sort();
    if (sorted.length && sorted[sorted.length - 1] < today) warnings.push('This timetable has expired.');
    const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
    if (rows.length < days) warnings.push(`Partial month: ${rows.length} of ${days} dates; other dates will remain unchanged.`);
    warnings.push(...review.table.notes);
  }
  if (!review.table && !Object.keys(review.profile).length) errors.push('Select at least one profile field or a timetable to publish.');
  return { rows, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
export function toCsv(rows: NormalizedRow[]) {
  return [COLUMNS.join(','), ...rows.map(r => COLUMNS.map(c => r[c] ?? '').join(','))].join('\n');
}

/** Prepared by the worker, before anybody opens the owner workspace. */
export function prepareExtraction(extraction: Extraction, month: string, timeZone: string) {
  const profile: Review['profile'] = {};
  for (const f of extraction.fields) {
    if ((PROFILE_FIELDS as readonly string[]).includes(f.field) && !profile[f.field]) profile[f.field] = { value: f.value, source_url: f.source_url, evidence: f.evidence };
  }
  const conversions = extraction.tables.map(table => {
    const mapping = suggestMapping(table.headers);
    // Source approval is intentionally separate from deterministic conversion.
    const check = validateReview({ profile: {}, table, mapping, timeZone, websiteConfirmed: true, warningsAccepted: false }, month);
    return { title: table.title, source_url: table.source_url, mapping, ...check, csv: check.errors.length ? null : toCsv(check.rows), status: check.errors.length ? 'needs_attention' : 'converted' };
  });
  const table = extraction.tables.length === 1 ? extraction.tables[0] : null;
  const preparedReview: Review = { profile, table, mapping: table ? suggestMapping(table.headers) : {}, timeZone, websiteConfirmed: false, warningsAccepted: false };
  return { preparedReview, conversions };
}
