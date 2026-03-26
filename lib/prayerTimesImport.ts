// lib/prayerTimesImport.ts
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';
import { readNativeFileAsText } from './nativeFileText';

// ---- Types ----
type PrayerCsvRow = {
  date: string;
  fajr: string;
  sunrise?: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

const BATCH_SIZE = 200;

// ---- CSV parsing (simple, header-based) ----
function parsePrayerCsv(csv: string): PrayerCsvRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = {
    date: header.indexOf('date'),
    fajr: header.indexOf('fajr'),
    sunrise: header.indexOf('sunrise'),
    dhuhr: header.indexOf('dhuhr'),
    asr: header.indexOf('asr'),
    maghrib: header.indexOf('maghrib'),
    isha: header.indexOf('isha'),
  };

  if (
    idx.date === -1 ||
    idx.fajr === -1 ||
    idx.dhuhr === -1 ||
    idx.asr === -1 ||
    idx.maghrib === -1 ||
    idx.isha === -1
  ) {
    throw new Error(
      'CSV must contain at least date,fajr,dhuhr,asr,maghrib,isha columns.'
    );
  }

  const rows: PrayerCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (!cols[idx.date]) continue;

    rows.push({
      date: cols[idx.date],
      fajr: cols[idx.fajr],
      sunrise: idx.sunrise !== -1 ? cols[idx.sunrise] : undefined,
      dhuhr: cols[idx.dhuhr],
      asr: cols[idx.asr],
      maghrib: cols[idx.maghrib],
      isha: cols[idx.isha],
    });
  }

  return rows;
}

// Normalise times like "6:5" → "06:05:00"
function toPgTime(t: string | undefined): string | null {
  if (!t) return null;
  const parts = t.split(':').map((p) => p.trim());
  if (parts.length < 2) return null;
  const [h, m] = parts;
  const hh = h.padStart(2, '0');
  const mm = m.padStart(2, '0');
  return `${hh}:${mm}:00`;
}

// ---- Public import function ----
export async function pickAndImportPrayerCsv(params: {
  mosqueId: string;
  userId: string;
}): Promise<{ imported: number; errors: string[] }> {
  const { mosqueId, userId } = params;
  const errors: string[] = [];

  // 1) Pick CSV file
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
  });

  if (res.canceled || !res.assets || res.assets.length === 0) {
    return { imported: 0, errors: ['User cancelled'] };
  }

  const asset = res.assets[0];
  const uri = asset.uri;

  // 2) Read file (UTF-8 by default)
  const contents = await readNativeFileAsText(uri);

  // 3) Parse CSV
  let rows: PrayerCsvRow[];
  try {
    rows = parsePrayerCsv(contents);
  } catch (e: any) {
    return { imported: 0, errors: [e?.message ?? 'Failed to parse CSV'] };
  }

  if (rows.length === 0) {
    return { imported: 0, errors: ['CSV has no valid rows'] };
  }

  // 4) Build payload for mosque_prayer_times
  const payload = rows.map((r) => ({
    mosque_id: mosqueId,
    prayer_date: r.date, // expecting YYYY-MM-DD
    fajr: toPgTime(r.fajr),
    sunrise: toPgTime(r.sunrise),
    dhuhr: toPgTime(r.dhuhr),
    asr: toPgTime(r.asr),
    maghrib: toPgTime(r.maghrib),
    isha: toPgTime(r.isha),
    source: 'csv',
    created_by: userId,
  }));

  const cleaned = payload.filter(
    (p) => p.prayer_date && p.fajr && p.dhuhr && p.asr && p.maghrib && p.isha
  );

  // 5) Batch upserts
  let imported = 0;
  for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {
    const chunk = cleaned.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('mosque_prayer_times')
      .upsert(chunk, { onConflict: 'mosque_id,prayer_date' });

    if (error) {
      errors.push(`Batch starting at row ${i + 1}: ${error.message}`);
    } else {
      imported += chunk.length;
    }
  }

  return { imported, errors };
}
