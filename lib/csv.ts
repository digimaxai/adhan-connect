// lib/csv.ts
export type PrayerCsvRow = {
  date: string;
  fajr: string;
  sunrise?: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

export function parsePrayerCsv(csv: string): PrayerCsvRow[] {
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

  // basic sanity check
  if (idx.date === -1 || idx.fajr === -1 || idx.dhuhr === -1 || idx.asr === -1 || idx.maghrib === -1 || idx.isha === -1) {
    throw new Error('CSV must contain at least date,fajr,dhuhr,asr,maghrib,isha columns.');
  }

  const rows: PrayerCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (!cols[idx.date]) continue;

    rows.push({
      date: cols[idx.date],      // e.g. "2025-01-01"
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
