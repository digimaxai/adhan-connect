import * as DocumentPicker from 'expo-document-picker';
import { PrayerTimesRow, PrayerTimesWriteMeta } from './api/admin/prayerTimes';
import { publishPrayerScheduleImportAudit } from './api/admin/prayerScheduleImports';
import { readNativeFileAsText } from './nativeFileText';

type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
type Slot = { adhan: string | null; iqama: string | null };
type DelimiterKey = 'comma' | 'semicolon' | 'tab' | 'pipe';
type DateSourceKind = 'full_date' | 'day_of_month' | 'partial_date' | 'month_day_columns';

export type PrayerScheduleImportIssue = {
  rowNumber: number | null;
  severity: 'error' | 'warning';
  message: string;
};

export type PrayerSchedulePreviewRow = {
  date: string;
  fajr: Slot;
  dhuhr: Slot;
  asr: Slot;
  maghrib: Slot;
  isha: Slot;
};

export type PrayerSchedulePreview = {
  fileName?: string | null;
  rows: PrayerSchedulePreviewRow[];
  validRows: PrayerSchedulePreviewRow[];
  issues: PrayerScheduleImportIssue[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    warningCount: number;
    errorCount: number;
    startDate: string | null;
    endDate: string | null;
  };
  detection?: {
    delimiter: DelimiterKey;
    headerRows: number[];
    dateSource: DateSourceKind | null;
    dateSourceLabel: string | null;
    monthYearContext: string | null;
  };
  columnMapping?: {
    dateColumn: string | null;
    prayers: Record<PrayerKey, { adhan: string | null; iqama: string | null }>;
  };
};

export type PrayerScheduleImportMode =
  | 'smart_auto'
  | 'explicit_iqama'
  | 'adhan_only'
  | 'adhan_plus_fixed_offset';

export type PrayerScheduleImportOptions = {
  mode?: PrayerScheduleImportMode;
  fixedIqamaOffsetMinutes?: number | null;
  dateContext?: {
    month?: number | null;
    year?: number | null;
    label?: string | null;
  } | null;
};

const PRAYER_KEYS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const DELIMITER_CANDIDATES: { key: DelimiterKey; value: string }[] = [
  { key: 'comma', value: ',' },
  { key: 'semicolon', value: ';' },
  { key: 'tab', value: '\t' },
  { key: 'pipe', value: '|' },
];

const COLUMN_ALIASES: Record<
  PrayerKey,
  {
    adhan: string[];
    iqama: string[];
  }
> = {
  fajr: {
    adhan: ['fajr', 'fajr_adhan', 'fajr_azan', 'fajr_athan', 'fajr_start', 'fajr_starts', 'fajr_beginning', 'fajr_begins', 'fajr_time'],
    iqama: ['fajr_iqama', 'fajr_iqamah', 'fajr_jamaat', 'fajr_jamaah', 'fajr_jamat', 'fajr_jamah', 'fajr_congregation'],
  },
  dhuhr: {
    adhan: [
      'dhuhr',
      'zuhr',
      'dhuhr_adhan',
      'zuhr_adhan',
      'dhuhr_azan',
      'dhuhr_athan',
      'zuhr_azan',
      'dhuhr_starts',
      'zuhr_starts',
      'dhuhr_start',
      'zuhr_start',
      'dhuhr_beginning',
      'zuhr_beginning',
      'dhuhr_begins',
      'zuhr_begins',
      'dhuhr_time',
      'zuhr_time',
    ],
    iqama: [
      'dhuhr_iqama',
      'zuhr_iqama',
      'dhuhr_iqamah',
      'zuhr_iqamah',
      'dhuhr_jamaat',
      'zuhr_jamaat',
      'dhuhr_jamaah',
      'zuhr_jamaah',
      'dhuhr_jamat',
      'zuhr_jamat',
      'dhuhr_jamah',
      'zuhr_jamah',
      'dhuhr_congregation',
      'zuhr_congregation',
    ],
  },
  asr: {
    adhan: ['asr', 'asr_adhan', 'asr_azan', 'asr_athan', 'asr_start', 'asr_starts', 'asr_beginning', 'asr_begins', 'asr_time'],
    iqama: ['asr_iqama', 'asr_iqamah', 'asr_jamaat', 'asr_jamaah', 'asr_jamat', 'asr_jamah', 'asr_congregation'],
  },
  maghrib: {
    adhan: [
      'maghrib',
      'maghrib_adhan',
      'maghrib_azan',
      'maghrib_athan',
      'maghrib_starts',
      'maghrib_start',
      'maghrib_beginning',
      'maghrib_begins',
      'maghrib_time',
    ],
    iqama: ['maghrib_iqama', 'maghrib_iqamah', 'maghrib_jamaat', 'maghrib_jamaah', 'maghrib_jamat', 'maghrib_jamah', 'maghrib_congregation'],
  },
  isha: {
    adhan: ['isha', 'isha_adhan', 'isha_azan', 'isha_athan', 'isha_a', 'isha_start', 'isha_starts', 'isha_beginning', 'isha_begins', 'isha_time'],
    iqama: ['isha_iqama', 'isha_iqamah', 'isha_jamaat', 'isha_jamaah', 'isha_jamat', 'isha_jamah', 'isha_congregation'],
  },
};

const PRAYER_SYNONYMS: Record<PrayerKey, string[]> = {
  fajr: ['fajr', 'subh', 'sobh'],
  dhuhr: ['dhuhr', 'zuhr', 'zohar', 'zuhur'],
  asr: ['asr'],
  maghrib: ['maghrib', 'magrib'],
  isha: ['isha', 'ishaa', 'esha'],
};
const ADHAN_ROLE_TOKENS = ['adhan', 'azan', 'athan', 'start', 'starts', 'beginning', 'begin', 'begins', 'time'];
const IQAMA_ROLE_TOKENS = [
  'iqama',
  'iqamah',
  'jamat',
  'jamaat',
  'jamaah',
  'jama',
  'jamah',
  'jammah',
  'congregation',
];
const FULL_DATE_ALIASES = [
  'date',
  'prayer_date',
  'schedule_date',
  'calendar_date',
  'gregorian_date',
  'full_date',
  'service_date',
];
const DAY_OF_MONTH_ALIASES = ['day', 'day_of_month', 'calendar_day', 'gregorian_day', 'date_no'];
const MONTH_COLUMN_ALIASES = ['month', 'month_name', 'calendar_month', 'gregorian_month'];
const YEAR_COLUMN_ALIASES = ['year', 'calendar_year', 'gregorian_year'];
const OPTIONAL_NON_PUBLISHED_COLUMNS: { label: string; aliases: string[] }[] = [
  { label: 'sunrise', aliases: ['sunrise', 'shurooq', 'shuruq'] },
  { label: 'sunset', aliases: ['sunset', 'ghurub'] },
  { label: 'tahajjud', aliases: ['tahajjud', 'tahajud', 'qiyam', 'qiyam_ul_layl'] },
  {
    label: 'jummah',
    aliases: [
      'jummah',
      'jumuah',
      'jumuah_1',
      'jummah_1',
      'jummah_2',
      'jumuah_2',
      'khutbah',
      'jummah_khutbah',
      'jumuah_khutbah',
    ],
  },
];
const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

type HeaderDetection = {
  startRow: number;
  depth: number;
  headers: string[];
  rawHeaders: string[];
};

type MonthYearContext = {
  month: number;
  year: number;
  label: string;
};

type DateSource =
  | {
      kind: 'full_date';
      index: number;
      label: string;
    }
  | {
      kind: 'day_of_month';
      index: number;
      label: string;
      context: MonthYearContext | null;
      yearHint: number | null;
    }
  | {
      kind: 'partial_date';
      index: number;
      label: string;
      context: MonthYearContext | null;
      yearHint: number | null;
    }
  | {
      kind: 'month_day_columns';
      dayIndex: number;
      monthIndex: number;
      yearIndex: number | null;
      label: string;
      yearHint: number | null;
    };

export async function pickPrayerScheduleImportFile(
  options?: PrayerScheduleImportOptions
): Promise<PrayerSchedulePreview | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
    base64: false,
  });

  if (res.canceled || !res.assets?.length) return null;

  const asset = res.assets[0];
  const contents = await readPickedDocumentAsText(asset);
  return parsePrayerScheduleCsv(contents, asset.name ?? null, options);
}

export function parsePrayerScheduleCsv(
  csv: string,
  fileName?: string | null,
  options?: PrayerScheduleImportOptions
): PrayerSchedulePreview {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return buildPreview([], [
      { rowNumber: null, severity: 'error', message: 'The timetable file has no data rows.' },
    ], fileName);
  }

  const delimiter = detectDelimiter(lines);
  const parsedRows = lines.map((line) => splitCsvLine(line, delimiter.value));
  const headerDetection = detectHeaderRows(parsedRows);
  const headers = headerDetection.headers;
  const dataSampleRows = parsedRows
    .slice(headerDetection.startRow + headerDetection.depth, headerDetection.startRow + headerDetection.depth + 40)
    .filter((row) => !isIgnorableRow(row));
  const issues: PrayerScheduleImportIssue[] = [];
  const mode = options?.mode ?? 'smart_auto';
  const dateSource = findDateSource(headers, parsedRows, headerDetection, fileName, options);

  if (!dateSource) {
    issues.push({
      rowNumber: null,
      severity: 'error',
      message:
        'The importer could not resolve dates from this timetable. Add a full date column or include the month and year in the file name.',
    });
  }

  const columnMap = PRAYER_KEYS.reduce<Record<PrayerKey, { adhan: number; iqama: number }>>(
    (acc, prayer) => {
      acc[prayer] = {
        adhan: findBestColumnIndex(headers, dataSampleRows, prayer, 'adhan'),
        iqama: findBestColumnIndex(headers, dataSampleRows, prayer, 'iqama'),
      };
      if (acc[prayer].adhan === -1) {
        issues.push({
          rowNumber: null,
          severity: 'error',
          message: `The importer could not find a ${prayer} adhan/start column.`,
        });
      }
      return acc;
    },
    {} as Record<PrayerKey, { adhan: number; iqama: number }>
  );

  PRAYER_KEYS.forEach((prayer) => {
    if (columnMap[prayer].iqama === -1 && mode === 'explicit_iqama') {
      issues.push({
        rowNumber: null,
        severity: 'warning',
        message: `No explicit ${prayer} iqama/jamaat column was found. Published rows will leave ${prayer} iqama blank.`,
      });
    }
  });

  OPTIONAL_NON_PUBLISHED_COLUMNS.forEach((column) => {
    const matched = findMatchedHeaders(headers, column.aliases);
    if (!matched.length) return;
    issues.push({
      rowNumber: null,
      severity: 'warning',
      message: `${column.label} columns were detected (${matched.join(', ')}), but the current importer does not publish them yet.`,
    });
  });

  const dateSourceContextLabel = getDateSourceContextLabel(dateSource);
  const yearHint = getDateSourceYearHint(dateSource);

  if (dateSourceContextLabel) {
    issues.push({
      rowNumber: null,
      severity: 'warning',
      message: `Dates were inferred using ${dateSourceContextLabel}.`,
    });
  }
  if (!dateSourceContextLabel && yearHint && dateSource?.kind !== 'full_date') {
    issues.push({
      rowNumber: null,
      severity: 'warning',
      message: `Dates were completed using the year ${yearHint}.`,
    });
  }

  const rows: PrayerSchedulePreviewRow[] = [];
  const validRows: PrayerSchedulePreviewRow[] = [];
  const seenByDate = new Map<string, number>();
  let rollingMonthContext: MonthYearContext | null = null;
  if (dateSource && (dateSource.kind === 'day_of_month' || dateSource.kind === 'partial_date')) {
    rollingMonthContext = dateSource.context;
  }

  for (
    let rowIndex = headerDetection.startRow + headerDetection.depth;
    rowIndex < parsedRows.length;
    rowIndex += 1
  ) {
    const rowNumber = rowIndex + 1;
    const cols = parsedRows[rowIndex];
    const rowMonthContext = detectMonthYearContextFromRow(cols, yearHint);
    const dateCellMonthContext =
      dateSource && (dateSource.kind === 'partial_date' || dateSource.kind === 'day_of_month')
        ? detectMonthYearContextFromDateCell(
            readCell(cols, dateSource.index),
            getDateSourceYearHint(dateSource)
          )
        : null;

    if (rowMonthContext && isMonthContextOnlyRow(cols)) {
      rollingMonthContext = rowMonthContext;
      continue;
    }

    if (isIgnorableRow(cols)) {
      continue;
    }

    const activeContext = rowMonthContext ?? rollingMonthContext;
    const date = dateSource ? resolveDateValue(cols, dateSource, activeContext) : null;
    let rowHasError = false;

    if (!date) {
      issues.push({
        rowNumber,
        severity: 'error',
        message: 'Row skipped because the date is missing or not recognized.',
      });
      continue;
    }

    const previewRow: PrayerSchedulePreviewRow = {
      date,
      fajr: { adhan: null, iqama: null },
      dhuhr: { adhan: null, iqama: null },
      asr: { adhan: null, iqama: null },
      maghrib: { adhan: null, iqama: null },
      isha: { adhan: null, iqama: null },
    };

    let rowHasSignal = false;

    PRAYER_KEYS.forEach((prayer) => {
      const adhanRaw = readCell(cols, columnMap[prayer].adhan);
      const iqamaRaw = readCell(cols, columnMap[prayer].iqama);
      const adhan = normalizeTimeInput(adhanRaw);
      const parsedIqama = normalizeTimeInput(iqamaRaw);
      const iqama = resolveIqamaValue({
        adhan,
        parsedIqama,
        mode,
        fixedIqamaOffsetMinutes: options?.fixedIqamaOffsetMinutes ?? null,
      });

      if (adhanRaw || iqamaRaw) {
        rowHasSignal = true;
      }

      if (!adhan) {
        rowHasError = true;
        issues.push({
          rowNumber,
          severity: 'error',
          message: `Row skipped because ${prayer} adhan is missing or invalid.`,
        });
      }

      if (iqamaRaw && !parsedIqama) {
        issues.push({
          rowNumber,
          severity: 'warning',
          message: `${prayer} iqama was ignored because the time could not be parsed.`,
        });
      }

      if (
        !iqamaRaw &&
        mode === 'adhan_plus_fixed_offset' &&
        adhan &&
        iqama &&
        options?.fixedIqamaOffsetMinutes
      ) {
        issues.push({
          rowNumber,
          severity: 'warning',
          message: `${prayer} iqama was derived from adhan using a ${options.fixedIqamaOffsetMinutes}-minute fixed offset.`,
        });
      }

      previewRow[prayer] = {
        adhan,
        iqama,
      };
    });

    if (!rowHasSignal) {
      continue;
    }

    validatePrayerOrder(previewRow, rowNumber, issues);
    validateIqamaOrder(previewRow, rowNumber, issues);
    if (rowMonthContext) {
      rollingMonthContext = rowMonthContext;
    } else if (dateCellMonthContext) {
      rollingMonthContext = dateCellMonthContext;
    }

    if (seenByDate.has(date)) {
      const previousIndex = seenByDate.get(date)!;
      rows[previousIndex] = previewRow;
      if (!rowHasError) {
        const validPreviousIndex = validRows.findIndex((row) => row.date === date);
        if (validPreviousIndex >= 0) {
          validRows[validPreviousIndex] = previewRow;
        } else {
          validRows.push(previewRow);
        }
      }
      issues.push({
        rowNumber,
        severity: 'warning',
        message: `${date} appeared more than once. The latest row replaced the earlier one.`,
      });
      continue;
    }

    seenByDate.set(date, rows.length);
    rows.push(previewRow);
    if (!rowHasError) validRows.push(previewRow);
  }

  return buildPreview(rows, issues, fileName, validRows, {
    delimiter: delimiter.key,
    headerRows: Array.from({ length: headerDetection.depth }, (_, index) => headerDetection.startRow + index + 1),
    dateSource: dateSource?.kind ?? null,
    dateSourceLabel: dateSource?.label ?? null,
    monthYearContext: dateSourceContextLabel,
  }, {
    dateColumn: dateSource?.label ?? null,
    prayers: PRAYER_KEYS.reduce<Record<PrayerKey, { adhan: string | null; iqama: string | null }>>(
      (acc, prayer) => {
        acc[prayer] = {
          adhan: headerDetection.rawHeaders[columnMap[prayer].adhan] ?? null,
          iqama: headerDetection.rawHeaders[columnMap[prayer].iqama] ?? null,
        };
        return acc;
      },
      {} as Record<PrayerKey, { adhan: string | null; iqama: string | null }>
    ),
  });
}

export async function publishPrayerSchedulePreview(params: {
  mosqueId: string;
  rows: PrayerSchedulePreviewRow[];
  summary: PrayerSchedulePreview['summary'];
  sourceLabel?: string | null;
  importMode?: PrayerScheduleImportMode | null;
  fixedIqamaOffsetMinutes?: number | null;
  metadata?: Record<string, unknown> | null;
  meta?: PrayerTimesWriteMeta;
}) {
  const payloads = params.rows.map((row) => ({
    date: row.date,
    data: mapPreviewRowToPrayerTimes(row),
  }));

  return publishPrayerScheduleImportAudit({
    mosqueId: params.mosqueId,
    rows: payloads,
    summary: params.summary,
    sourceLabel: params.sourceLabel ?? null,
    importMode: params.importMode ?? null,
    fixedIqamaOffsetMinutes: params.fixedIqamaOffsetMinutes ?? null,
    initiatedBy: params.meta?.updatedBy ?? params.meta?.createdBy ?? null,
    metadata: params.metadata ?? {},
    meta: {
      sourceType: 'upload',
      generatedMethod: 'csv_upload',
      overridesExist: true,
      ...params.meta,
    },
  });
}

function buildPreview(
  rows: PrayerSchedulePreviewRow[],
  issues: PrayerScheduleImportIssue[],
  fileName?: string | null,
  validRows?: PrayerSchedulePreviewRow[],
  detection?: PrayerSchedulePreview['detection'],
  columnMapping?: PrayerSchedulePreview['columnMapping']
): PrayerSchedulePreview {
  const publishedRows = validRows ?? rows;
  const sortedDates = publishedRows.map((row) => row.date).sort();
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    fileName: fileName ?? null,
    rows,
    validRows: publishedRows,
    issues,
    detection,
    columnMapping,
    summary: {
      totalRows: rows.length,
      validRows: publishedRows.length,
      invalidRows: Math.max(rows.length - publishedRows.length, 0),
      warningCount,
      errorCount,
      startDate: sortedDates[0] ?? null,
      endDate: sortedDates[sortedDates.length - 1] ?? null,
    },
  };
}

function resolveIqamaValue(args: {
  adhan: string | null;
  parsedIqama: string | null;
  mode: PrayerScheduleImportMode;
  fixedIqamaOffsetMinutes: number | null;
}) {
  if (args.mode === 'smart_auto') return args.parsedIqama;
  if (args.mode === 'explicit_iqama') return args.parsedIqama;
  if (args.mode === 'adhan_only') return null;
  if (!args.adhan || !args.fixedIqamaOffsetMinutes || args.fixedIqamaOffsetMinutes < 1) {
    return args.parsedIqama;
  }
  return addMinutes(args.adhan, args.fixedIqamaOffsetMinutes);
}

function mapPreviewRowToPrayerTimes(row: PrayerSchedulePreviewRow): Partial<PrayerTimesRow> {
  return {
    fajr_adhan_time: toIsoString(row.date, row.fajr.adhan),
    fajr_iqama_time: toIsoString(row.date, row.fajr.iqama),
    dhuhr_adhan_time: toIsoString(row.date, row.dhuhr.adhan),
    dhuhr_iqama_time: toIsoString(row.date, row.dhuhr.iqama),
    asr_adhan_time: toIsoString(row.date, row.asr.adhan),
    asr_iqama_time: toIsoString(row.date, row.asr.iqama),
    maghrib_adhan_time: toIsoString(row.date, row.maghrib.adhan),
    maghrib_iqama_time: toIsoString(row.date, row.maghrib.iqama),
    isha_adhan_time: toIsoString(row.date, row.isha.adhan),
    isha_iqama_time: toIsoString(row.date, row.isha.iqama),
  };
}

function detectDelimiter(lines: string[]) {
  let best = DELIMITER_CANDIDATES[0];
  let bestScore = -1;

  for (const candidate of DELIMITER_CANDIDATES) {
    const widths = lines.slice(0, 8).map((line) => splitCsvLine(line, candidate.value).length);
    const populated = widths.filter((width) => width > 1);
    if (!populated.length) continue;

    const baseline = populated[0];
    const consistency = populated.filter((width) => width === baseline).length;
    const score = consistency * 10 + baseline;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function detectHeaderRows(rows: string[][]): HeaderDetection {
  const maxStart = Math.min(rows.length - 1, 8);
  let best: HeaderDetection | null = null;
  let bestScore = -1;

  for (let startRow = 0; startRow <= maxStart; startRow += 1) {
    const firstRow = rows[startRow] ?? [];
    const secondRow = rows[startRow + 1] ?? [];
    const useSecondRow = looksLikeRoleHeaderRow(secondRow);
    const candidates: HeaderDetection[] = [
      {
        startRow,
        depth: 1,
        headers: buildCombinedHeaders(firstRow, []),
        rawHeaders: buildRawHeaders(firstRow, []),
      },
    ];

    if (useSecondRow) {
      candidates.push({
        startRow,
        depth: 2,
        headers: buildCombinedHeaders(firstRow, secondRow),
        rawHeaders: buildRawHeaders(firstRow, secondRow),
      });
      candidates.push({
        startRow,
        depth: 2,
        headers: buildSequentialRoleHeaders(firstRow, secondRow),
        rawHeaders: buildSequentialRawHeaders(firstRow, secondRow),
      });
    }

    candidates.forEach((candidate) => {
  const sampleRows = rows
    .slice(candidate.startRow + candidate.depth, candidate.startRow + candidate.depth + 8)
    .filter((row) => !isIgnorableRow(row));
  const score = scoreHeaderDetectionCandidate(
    candidate,
        firstRow,
        useSecondRow ? secondRow : [],
        sampleRows
      );

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    });
  }

  return (
    best ?? {
      startRow: 0,
      depth: 1,
      headers: buildCombinedHeaders(rows[0] ?? [], []),
      rawHeaders: buildRawHeaders(rows[0] ?? [], []),
    }
  );
}

function scoreHeaderDetectionCandidate(
  candidate: HeaderDetection,
  firstRow: string[],
  secondRow: string[],
  sampleRows: string[][]
) {
  const baseScore =
    scoreHeaderCells(firstRow) +
    (candidate.depth > 1 ? scoreHeaderCells(secondRow) : 0) -
    countTimeCells(firstRow) -
    (candidate.depth > 1 ? countTimeCells(secondRow) : 0);
  const prayerScore = PRAYER_KEYS.reduce((score, prayer) => {
    const adhanIndex = findBestColumnIndex(candidate.headers, sampleRows, prayer, 'adhan');
    const iqamaIndex = findBestColumnIndex(candidate.headers, sampleRows, prayer, 'iqama');
    const adhanSignal = adhanIndex !== -1 ? countRecognizedTimes(sampleRows, adhanIndex) : 0;
    const iqamaSignal = iqamaIndex !== -1 ? countRecognizedTimes(sampleRows, iqamaIndex) : 0;

    return (
      score +
      (adhanIndex !== -1 ? 18 : -12) +
      adhanSignal +
      (iqamaIndex !== -1 ? 6 : 0) +
      Math.min(iqamaSignal, 4)
    );
  }, 0);
  const orderPenalty = PRAYER_KEYS.reduce((penalty, prayer) => {
    const adhanIndex = findBestColumnIndex(candidate.headers, sampleRows, prayer, 'adhan');
    const iqamaIndex = findBestColumnIndex(candidate.headers, sampleRows, prayer, 'iqama');
    if (adhanIndex === -1 || iqamaIndex === -1) return penalty;
    return penalty + countIqamaBeforeAdhan(sampleRows, adhanIndex, iqamaIndex) * 5;
  }, 0);
  const dateScore =
    (candidate.headers.some((header) => FULL_DATE_ALIASES.includes(header)) ? 10 : 0) +
    (candidate.headers.some((header) => DAY_OF_MONTH_ALIASES.includes(header)) ? 8 : 0) +
    (candidate.depth > 1 ? 3 : 0);

  return baseScore + prayerScore + dateScore - orderPenalty;
}

function countRecognizedTimes(rows: string[][], index: number) {
  if (index < 0) return 0;
  return rows.filter((row) => normalizeTimeInput(readCell(row, index))).length;
}

function countIqamaBeforeAdhan(rows: string[][], adhanIndex: number, iqamaIndex: number) {
  if (adhanIndex < 0 || iqamaIndex < 0) return 0;

  return rows.reduce((count, row) => {
    const adhan = normalizeTimeInput(readCell(row, adhanIndex));
    const iqama = normalizeTimeInput(readCell(row, iqamaIndex));
    if (!adhan || !iqama) return count;
    return compareTimes(iqama, adhan) < 0 ? count + 1 : count;
  }, 0);
}

function headerHasExplicitRole(header: string) {
  return headerIncludesAnyToken(header, [...ADHAN_ROLE_TOKENS, ...IQAMA_ROLE_TOKENS]);
}

function shouldCombinePrayerHeader(top: string, bottom: string) {
  if (!top || !bottom) return false;
  if (!headerIncludesPrayerToken(top)) return false;
  if (!headerIncludesAnyToken(bottom, [...ADHAN_ROLE_TOKENS, ...IQAMA_ROLE_TOKENS])) return false;
  return !headerHasExplicitRole(top);
}

function buildCombinedHeaders(primary: string[], secondary: string[]) {
  const width = Math.max(primary.length, secondary.length);
  const filledPrimary = fillForwardPrayerHeaders(primary, secondary);
  const headers: string[] = [];

  for (let index = 0; index < width; index += 1) {
    const top = normalizeHeader(filledPrimary[index] ?? '');
    const bottom = normalizeHeader(secondary[index] ?? '');

    if (!bottom || bottom === top) {
      headers.push(top || bottom);
      continue;
    }

    if (shouldCombinePrayerHeader(top, bottom)) {
      headers.push(`${top}_${bottom}`);
      continue;
    }

    headers.push(top || bottom);
  }

  return headers;
}

function buildRawHeaders(primary: string[], secondary: string[]) {
  const width = Math.max(primary.length, secondary.length);
  const filledPrimary = fillForwardPrayerHeaders(primary, secondary);
  const headers: string[] = [];

  for (let index = 0; index < width; index += 1) {
    const top = filledPrimary[index]?.trim() ?? '';
    const bottom = secondary[index]?.trim() ?? '';
    if (!bottom || normalizeHeader(bottom) === normalizeHeader(top)) {
      headers.push(top || bottom || `Column ${index + 1}`);
      continue;
    }
    if (shouldCombinePrayerHeader(normalizeHeader(top), normalizeHeader(bottom))) {
      headers.push(`${top} / ${bottom}`);
      continue;
    }
    headers.push(top || bottom || `Column ${index + 1}`);
  }

  return headers;
}

function buildSequentialRoleHeaders(primary: string[], secondary: string[]) {
  const width = Math.max(primary.length, secondary.length);
  const prayerSequence = extractPrayerHeaderSequence(primary);
  const headers: string[] = [];
  let prayerIndex = 0;

  for (let index = 0; index < width; index += 1) {
    const bottom = normalizeHeader(secondary[index] ?? '');
    const top = normalizeHeader(primary[index] ?? '');

    if (
      !bottom ||
      FULL_DATE_ALIASES.includes(bottom) ||
      DAY_OF_MONTH_ALIASES.includes(bottom) ||
      MONTH_COLUMN_ALIASES.includes(bottom) ||
      YEAR_COLUMN_ALIASES.includes(bottom) ||
      OPTIONAL_NON_PUBLISHED_COLUMNS.some((column) => column.aliases.includes(bottom))
    ) {
      headers.push(bottom || top);
      continue;
    }

    const roleToken = resolveHeaderRoleToken(bottom);
    const prayerLabel = prayerSequence[prayerIndex] ?? null;
    if (roleToken && prayerLabel) {
      headers.push(`${prayerLabel}_${bottom}`);
      if (roleToken === 'iqama') {
        prayerIndex += 1;
      }
      continue;
    }

    headers.push(top || bottom);
  }

  return headers;
}

function buildSequentialRawHeaders(primary: string[], secondary: string[]) {
  const width = Math.max(primary.length, secondary.length);
  const prayerSequence = extractPrayerHeaderSequence(primary, false);
  const headers: string[] = [];
  let prayerIndex = 0;

  for (let index = 0; index < width; index += 1) {
    const bottomRaw = secondary[index]?.trim() ?? '';
    const bottom = normalizeHeader(bottomRaw);
    const topRaw = primary[index]?.trim() ?? '';

    if (
      !bottom ||
      FULL_DATE_ALIASES.includes(bottom) ||
      DAY_OF_MONTH_ALIASES.includes(bottom) ||
      MONTH_COLUMN_ALIASES.includes(bottom) ||
      YEAR_COLUMN_ALIASES.includes(bottom) ||
      OPTIONAL_NON_PUBLISHED_COLUMNS.some((column) => column.aliases.includes(bottom))
    ) {
      headers.push(bottomRaw || topRaw || `Column ${index + 1}`);
      continue;
    }

    const roleToken = resolveHeaderRoleToken(bottom);
    const prayerLabel = prayerSequence[prayerIndex] ?? null;
    if (roleToken && prayerLabel) {
      headers.push(`${prayerLabel} / ${bottomRaw || secondary[index] || 'Value'}`);
      if (roleToken === 'iqama') {
        prayerIndex += 1;
      }
      continue;
    }

    headers.push(topRaw || bottomRaw || `Column ${index + 1}`);
  }

  return headers;
}

function extractPrayerHeaderSequence(primary: string[], normalized = true) {
  return primary
    .map((cell) => (normalized ? normalizeHeader(cell) : cell.trim()))
    .filter((header) => headerIncludesPrayerToken(normalized ? header : normalizeHeader(header)));
}

function resolveHeaderRoleToken(header: string) {
  if (headerIncludesAnyToken(header, IQAMA_ROLE_TOKENS)) return 'iqama';
  if (headerIncludesAnyToken(header, ADHAN_ROLE_TOKENS)) return 'adhan';
  return null;
}

function fillForwardPrayerHeaders(primary: string[], secondary: string[]) {
  const filled = [...primary];
  let carry = '';

  for (let index = 0; index < filled.length; index += 1) {
    const current = normalizeHeader(filled[index] ?? '');
    const next = normalizeHeader(secondary[index] ?? '');

    if (headerIncludesPrayerToken(current)) {
      carry = filled[index];
      continue;
    }

    if (
      !current &&
      carry &&
      headerIncludesAnyToken(next, [...ADHAN_ROLE_TOKENS, ...IQAMA_ROLE_TOKENS])
    ) {
      filled[index] = carry;
    }
  }

  return filled;
}

function scoreHeaderCells(cells: string[]) {
  return cells.reduce((score, cell) => {
    const header = normalizeHeader(cell);
    if (!header) return score;
    if (FULL_DATE_ALIASES.includes(header)) return score + 6;
    if (DAY_OF_MONTH_ALIASES.includes(header)) return score + 5;
    if (MONTH_COLUMN_ALIASES.includes(header)) return score + 4;
    if (YEAR_COLUMN_ALIASES.includes(header)) return score + 3;
    if (headerIncludesPrayerToken(header)) return score + 5;
    if (headerIncludesAnyToken(header, [...ADHAN_ROLE_TOKENS, ...IQAMA_ROLE_TOKENS])) return score + 2;
    if (OPTIONAL_NON_PUBLISHED_COLUMNS.some((column) => column.aliases.includes(header))) return score + 1;
    return score;
  }, 0);
}

function looksLikeRoleHeaderRow(cells: string[]) {
  const roleMatches = cells.filter((cell) =>
    headerIncludesAnyToken(normalizeHeader(cell), [...ADHAN_ROLE_TOKENS, ...IQAMA_ROLE_TOKENS])
  ).length;
  const prayerMatches = cells.filter((cell) => headerIncludesPrayerToken(normalizeHeader(cell))).length;
  return roleMatches >= 2 && prayerMatches === 0 && countTimeCells(cells) === 0;
}

function countTimeCells(cells: string[]) {
  return cells.filter((cell) => normalizeTimeInput(cell)).length;
}

function findDateSource(
  headers: string[],
  rows: string[][],
  headerDetection: HeaderDetection,
  fileName?: string | null,
  options?: PrayerScheduleImportOptions
): DateSource | null {
  const sampleRows = rows
    .slice(headerDetection.startRow + headerDetection.depth, headerDetection.startRow + headerDetection.depth + 40)
    .filter((row) => !isIgnorableRow(row));
  const manualContext = buildMonthYearContext(options?.dateContext ?? null);
  const yearHint = resolveYearHint(fileName, rows, options);
  const monthYearContext =
    manualContext ??
    inferMonthYearFromFileName(fileName) ??
    inferMonthYearFromRows(rows, yearHint);

  const fullDateIndex = headers.findIndex((header) => FULL_DATE_ALIASES.includes(header));
  if (fullDateIndex !== -1) {
    const explicitMatchCount = sampleRows.filter((row) =>
      normalizeDateInput(readCell(row, fullDateIndex))
    ).length;
    if (explicitMatchCount > 0) {
      return {
        kind: 'full_date',
        index: fullDateIndex,
        label: headerDetection.rawHeaders[fullDateIndex] ?? 'Date',
      };
    }
  }

  const dayColumnIndex = headers.findIndex((header) => DAY_OF_MONTH_ALIASES.includes(header));
  const monthColumnIndex = headers.findIndex((header) => MONTH_COLUMN_ALIASES.includes(header));
  const yearColumnIndex = headers.findIndex((header) => YEAR_COLUMN_ALIASES.includes(header));
  const partialDateIndex = headers.findIndex((header) => FULL_DATE_ALIASES.includes(header));
  const dayMatchCount =
    monthYearContext && dayColumnIndex !== -1
      ? sampleRows.filter((row) =>
          parseDayOfMonthWithContext(readCell(row, dayColumnIndex), monthYearContext)
        ).length
      : 0;
  const partialContext =
    partialDateIndex !== -1
      ? inferDateColumnContext(
          rows,
          partialDateIndex,
          headerDetection.startRow + headerDetection.depth,
          yearHint,
          monthYearContext
        )
      : null;
  const partialMatchCount =
    partialDateIndex !== -1
      ? sampleRows.filter((row) =>
          parseFlexiblePartialDate(readCell(row, partialDateIndex), partialContext, yearHint)
        ).length
      : 0;

  if (dayColumnIndex !== -1 && monthColumnIndex !== -1) {
    const columnMatchCount = sampleRows.filter((row) =>
      parseMonthDayColumns(
        readCell(row, dayColumnIndex),
        readCell(row, monthColumnIndex),
        yearColumnIndex !== -1 ? readCell(row, yearColumnIndex) : '',
        yearHint
      )
    ).length;
    if (columnMatchCount > 0) {
      return {
        kind: 'month_day_columns',
        dayIndex: dayColumnIndex,
        monthIndex: monthColumnIndex,
        yearIndex: yearColumnIndex !== -1 ? yearColumnIndex : null,
        label: `${headerDetection.rawHeaders[monthColumnIndex] ?? 'Month'} + ${headerDetection.rawHeaders[dayColumnIndex] ?? 'Day'}`,
        yearHint,
      };
    }
  }

  if (
    partialDateIndex !== -1 &&
    partialMatchCount > 0 &&
    (dayMatchCount === 0 || partialMatchCount >= dayMatchCount || headers[partialDateIndex] === 'date')
  ) {
    return {
      kind: 'partial_date',
      index: partialDateIndex,
      label: headerDetection.rawHeaders[partialDateIndex] ?? 'Date',
      context: partialContext,
      yearHint,
    };
  }

  if (monthYearContext && dayColumnIndex !== -1 && dayMatchCount > 0) {
    return {
      kind: 'day_of_month',
      index: dayColumnIndex,
      label: headerDetection.rawHeaders[dayColumnIndex] ?? 'Day',
      context: monthYearContext,
      yearHint,
    };
  }

  if (dayColumnIndex !== -1 && yearHint) {
    const hasMonthSectionRows = sampleRows.some((row) =>
      detectMonthYearContextFromRow(row, yearHint)
    );
    if (hasMonthSectionRows) {
      return {
        kind: 'day_of_month',
        index: dayColumnIndex,
        label: headerDetection.rawHeaders[dayColumnIndex] ?? 'Day',
        context: null,
        yearHint,
      };
    }
  }

  return null;
}

function resolveDateValue(
  cols: string[],
  source: DateSource,
  overrideContext?: MonthYearContext | null
) {
  if (source.kind === 'full_date') {
    return normalizeDateInput(readCell(cols, source.index));
  }
  if (source.kind === 'month_day_columns') {
    return parseMonthDayColumns(
      readCell(cols, source.dayIndex),
      readCell(cols, source.monthIndex),
      source.yearIndex !== null ? readCell(cols, source.yearIndex) : '',
      source.yearHint
    );
  }
  const activeContext = overrideContext ?? source.context;
  if (source.kind === 'day_of_month') {
    return activeContext
      ? parseDayOfMonthWithContext(readCell(cols, source.index), activeContext)
      : null;
  }
  return parseFlexiblePartialDate(readCell(cols, source.index), activeContext, source.yearHint);
}

function getDateSourceContextLabel(source: DateSource | null) {
  if (!source || source.kind === 'full_date' || source.kind === 'month_day_columns') return null;
  return source.context?.label ?? null;
}

function getDateSourceYearHint(source: DateSource | null) {
  if (!source || source.kind === 'full_date') return null;
  if (source.kind === 'month_day_columns') return source.yearHint;
  return source.yearHint;
}

function inferMonthYearFromFileName(fileName?: string | null): MonthYearContext | null {
  if (!fileName) return null;

  const normalized = fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  const yearMatch = normalized.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  for (const [monthName, monthNumber] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    const monthWithYearMatch =
      normalized.match(new RegExp(`${monthName}\\s*(20\\d{2})`)) ??
      normalized.match(new RegExp(`(20\\d{2})\\s*${monthName}`));
    if (monthWithYearMatch) {
      const matchedYear = Number(monthWithYearMatch[1] ?? monthWithYearMatch[2]);
      return {
        month: monthNumber,
        year: matchedYear,
        label: `${monthName[0].toUpperCase()}${monthName.slice(1)} ${matchedYear}`,
      };
    }
    if (!normalized.includes(monthName) || !year) continue;
    return {
      month: monthNumber,
      year,
      label: `${monthName[0].toUpperCase()}${monthName.slice(1)} ${year}`,
    };
  }

  const numericMatch = normalized.match(/\b(0?[1-9]|1[0-2])\D{0,3}(20\d{2})\b|\b(20\d{2})\D{0,3}(0?[1-9]|1[0-2])\b/);
  if (!numericMatch) return null;

  const month = Number(numericMatch[1] ?? numericMatch[4]);
  const resolvedYear = Number(numericMatch[2] ?? numericMatch[3]);
  if (!month || !resolvedYear) return null;

  return {
    month,
    year: resolvedYear,
    label: `${resolvedYear}-${month.toString().padStart(2, '0')}`,
  };
}

function inferMonthYearFromRows(rows: string[][], fallbackYear: number | null) {
  const limit = Math.min(rows.length, 14);
  for (let index = 0; index < limit; index += 1) {
    const context = detectMonthYearContextFromRow(rows[index] ?? [], fallbackYear);
    if (context) return context;
  }
  return null;
}

function resolveYearHint(
  fileName: string | null | undefined,
  rows: string[][],
  options?: PrayerScheduleImportOptions
) {
  const manualYear = options?.dateContext?.year ?? null;
  if (manualYear && manualYear >= 2000 && manualYear <= 2100) return manualYear;

  const fileNameMatch = fileName?.match(/\b(20\d{2})\b/);
  if (fileNameMatch) return Number(fileNameMatch[1]);

  const limit = Math.min(rows.length, 14);
  for (let index = 0; index < limit; index += 1) {
    const combined = (rows[index] ?? []).join(' ');
    const yearMatch = combined.match(/\b(20\d{2})\b/);
    if (yearMatch) return Number(yearMatch[1]);
  }

  if (rowsContainMonthNameDayDates(rows)) {
    return new Date().getFullYear();
  }

  return null;
}

function buildMonthYearContext(
  value: PrayerScheduleImportOptions['dateContext']
): MonthYearContext | null {
  const month = value?.month ?? null;
  const year = value?.year ?? null;
  if (!month || !year) return null;
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return {
    month,
    year,
    label: value?.label?.trim() || `${year}-${month.toString().padStart(2, '0')}`,
  };
}

function parseDayOfMonthWithContext(raw: string, context: MonthYearContext) {
  const value = raw.trim();
  if (!/^\d{1,2}$/.test(value)) return null;
  return joinDateParts(context.year, context.month, Number(value));
}

function parsePartialDateWithContext(raw: string, context: MonthYearContext) {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  const direct = parseDayOfMonthWithContext(value, context);
  if (direct) return direct;

  const numericMatch = value.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);

    if (first > 12) return joinDateParts(context.year, second, first);
    if (second > 12) return joinDateParts(context.year, first, second);
    if (first === context.month) return joinDateParts(context.year, first, second);
    if (second === context.month) return joinDateParts(context.year, second, first);
    return joinDateParts(context.year, context.month, first);
  }

  return parseMonthNameDayWithYear(value, context.year);
}

function parsePartialDateWithYearHint(raw: string, yearHint: number) {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  const numericMatch = value.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    if (first > 12) return joinDateParts(yearHint, second, first);
    if (second > 12) return joinDateParts(yearHint, first, second);
    return joinDateParts(yearHint, second, first);
  }

  return parseMonthNameDayWithYear(value, yearHint);
}

function parseFlexiblePartialDate(
  raw: string,
  context: MonthYearContext | null,
  yearHint: number | null
) {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{1,2}$/.test(value)) {
    return context ? parseDayOfMonthWithContext(value, context) : null;
  }
  if (yearHint) {
    return parsePartialDateWithYearHint(value, yearHint);
  }
  return context ? parsePartialDateWithContext(value, context) : null;
}

function parseMonthValue(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (/^\d{1,2}$/.test(value)) {
    const month = Number(value);
    return month >= 1 && month <= 12 ? month : null;
  }
  return MONTH_NAME_TO_NUMBER[value] ?? null;
}

function parseMonthDayColumns(
  dayRaw: string,
  monthRaw: string,
  yearRaw: string,
  yearHint: number | null
) {
  const day = Number(dayRaw.trim());
  const month = parseMonthValue(monthRaw);
  const year = Number(yearRaw.trim()) || yearHint;
  if (!day || !month || !year) return null;
  return joinDateParts(year, month, day);
}

function inferDateColumnContext(
  rows: string[][],
  columnIndex: number,
  dataStartIndex: number,
  yearHint: number | null,
  fallback: MonthYearContext | null
) {
  for (let index = dataStartIndex; index < rows.length; index += 1) {
    const context = detectMonthYearContextFromDateCell(readCell(rows[index] ?? [], columnIndex), yearHint);
    if (context) return context;
  }
  return fallback;
}

function detectMonthYearContextFromDateCell(raw: string, yearHint: number | null) {
  const value = raw.trim().toLowerCase();
  if (!value || /^\d{1,2}$/.test(value)) return null;

  const parsed = yearHint ? parsePartialDateWithYearHint(value, yearHint) : null;
  if (!parsed) return null;

  const [yearText, monthText] = parsed.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return null;

  const monthLabel =
    Object.entries(MONTH_NAME_TO_NUMBER).find(([, monthNumber]) => monthNumber === month)?.[0] ??
    month.toString();
  const prettyMonthLabel = `${monthLabel[0].toUpperCase()}${monthLabel.slice(1)}`;

  return {
    month,
    year,
    label: `${prettyMonthLabel} ${year}`,
  };
}

function detectMonthYearContextFromRow(cols: string[], fallbackYear: number | null) {
  const combined = cols
    .map((cell) => cell.trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!combined) return null;

  const yearMatch = combined.match(/\b(20\d{2})\b/);
  const resolvedYear = Number(yearMatch?.[1] ?? fallbackYear ?? 0);
  if (!resolvedYear) return null;

  for (const [monthName, monthNumber] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    if (!combined.includes(monthName)) continue;
    return {
      month: monthNumber,
      year: resolvedYear,
      label: `${monthName[0].toUpperCase()}${monthName.slice(1)} ${resolvedYear}`,
    };
  }

  const numericMonthMatch = combined.match(/\b(0?[1-9]|1[0-2])\s*[\/-]\s*(20\d{2})\b|\b(20\d{2})\s*[\/-]\s*(0?[1-9]|1[0-2])\b/);
  if (!numericMonthMatch) return null;
  const month = Number(numericMonthMatch[1] ?? numericMonthMatch[4]);
  const year = Number(numericMonthMatch[2] ?? numericMonthMatch[3] ?? resolvedYear);
  if (!month || !year) return null;
  return {
    month,
    year,
    label: `${year}-${month.toString().padStart(2, '0')}`,
  };
}

function isMonthContextOnlyRow(cols: string[]) {
  const populated = cols.filter((cell) => cell.trim().length > 0);
  return countTimeCells(cols) === 0 && populated.length <= 4;
}

function findBestColumnIndex(
  headers: string[],
  rows: string[][],
  prayer: PrayerKey,
  role: 'adhan' | 'iqama'
) {
  let bestIndex = -1;
  let bestScore = -1;
  const explicitAlternativeExists = headers.some(
    (header) =>
      headerIncludesPrayer(header, prayer) &&
      headerHasDesiredRole(header, role)
  );

  headers.forEach((header, index) => {
    const score = scorePrayerHeader(header, rows, prayer, role, explicitAlternativeExists, index);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestScore > 0 ? bestIndex : -1;
}

function scorePrayerHeader(
  header: string,
  rows: string[][],
  prayer: PrayerKey,
  role: 'adhan' | 'iqama',
  explicitAlternativeExists: boolean,
  index: number
) {
  if (!headerIncludesPrayer(header, prayer)) return -1;

  const validTimeCount = countRecognizedTimes(rows, index);
  const populatedCellCount = countPopulatedCells(rows, index);
  const hasDesiredRole = headerHasDesiredRole(header, role);

  if (COLUMN_ALIASES[prayer][role].includes(header)) {
    const aliasScore = hasDesiredRole ? 20 : 10;
    return finalizePrayerHeaderScore(aliasScore, validTimeCount, populatedCellCount, explicitAlternativeExists && !hasDesiredRole);
  }

  const hasAdhanRole = headerIncludesAnyToken(header, ADHAN_ROLE_TOKENS);
  const hasIqamaRole = headerIncludesAnyToken(header, IQAMA_ROLE_TOKENS);

  if (role === 'adhan') {
    if (hasIqamaRole) return -1;
    return finalizePrayerHeaderScore(
      hasAdhanRole ? 12 : 8,
      validTimeCount,
      populatedCellCount,
      explicitAlternativeExists && !hasAdhanRole
    );
  }

  if (!hasIqamaRole) return -1;
  return finalizePrayerHeaderScore(
    12,
    validTimeCount,
    populatedCellCount,
    false
  );
}

function finalizePrayerHeaderScore(
  baseScore: number,
  validTimeCount: number,
  populatedCellCount: number,
  shouldPenalizeForAmbiguity: boolean
) {
  let score = baseScore;

  score += Math.min(validTimeCount, 12);
  if (populatedCellCount > 0 && validTimeCount === 0) {
    score -= 18;
  }
  if (populatedCellCount === 0) {
    score -= 8;
  }
  if (shouldPenalizeForAmbiguity) {
    score -= 6;
  }

  return score;
}

function countPopulatedCells(rows: string[][], index: number) {
  if (index < 0) return 0;
  return rows.filter((row) => readCell(row, index).length > 0).length;
}

function headerHasDesiredRole(header: string, role: 'adhan' | 'iqama') {
  return role === 'adhan'
    ? headerIncludesAnyToken(header, ADHAN_ROLE_TOKENS)
    : headerIncludesAnyToken(header, IQAMA_ROLE_TOKENS);
}

function headerIncludesPrayer(header: string, prayer: PrayerKey) {
  return PRAYER_SYNONYMS[prayer].some((token) => header.split('_').includes(token));
}

function headerIncludesPrayerToken(header: string) {
  return PRAYER_KEYS.some((prayer) => headerIncludesPrayer(header, prayer));
}

function headerIncludesAnyToken(header: string, tokens: string[]) {
  const headerTokens = header.split('_');
  return tokens.some((token) => headerTokens.includes(token));
}

function isIgnorableRow(cols: string[]) {
  if (!cols.some((cell) => cell.trim().length)) return true;
  const headerLikeCells = cols.filter((cell) => scoreHeaderCells([cell]) > 0).length;
  return headerLikeCells >= 2 && countTimeCells(cols) <= 1;
}

function splitCsvLine(line: string, delimiter = ',') {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function findMatchedHeaders(headers: string[], aliases: string[]) {
  return headers.filter((header) => aliases.includes(header));
}

function readCell(cols: string[], index: number) {
  if (index < 0 || index >= cols.length) return '';
  return cols[index]?.trim() ?? '';
}

function normalizeDateInput(raw: string) {
  const value = raw.trim();
  if (!value) return null;

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return joinDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const ukMatch = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (ukMatch) {
    return joinDateParts(Number(ukMatch[3]), Number(ukMatch[2]), Number(ukMatch[1]));
  }

  if (looksLikeMonthNameDayWithoutYear(value)) {
    return null;
  }

  if (!/[a-z]/i.test(value) && !/\d{4}/.test(value)) {
    return null;
  }

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return joinDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function looksLikeMonthNameDayWithoutYear(value: string) {
  return /^(?:[a-z]{3,9}[\/.\-\s]+\d{1,2}|\d{1,2}[\/.\-\s]+[a-z]{3,9})$/i.test(
    value.trim()
  );
}

function parseMonthNameDayWithYear(raw: string, year: number) {
  const value = raw.trim().toLowerCase();
  const monthNameMatch =
    value.match(/^(\d{1,2})[\/.\-\s]+([a-z]{3,9})$/) ??
    value.match(/^([a-z]{3,9})[\/.\-\s]+(\d{1,2})$/);
  if (!monthNameMatch) return null;

  const day = Number(monthNameMatch[1] && /^\d+$/.test(monthNameMatch[1]) ? monthNameMatch[1] : monthNameMatch[2]);
  const monthName = (
    monthNameMatch[1] && /^\d+$/.test(monthNameMatch[1])
      ? monthNameMatch[2]
      : monthNameMatch[1]
  ).toLowerCase();
  const month = MONTH_NAME_TO_NUMBER[monthName];
  return month ? joinDateParts(year, month, day) : null;
}

function rowsContainMonthNameDayDates(rows: string[][]) {
  const limit = Math.min(rows.length, 40);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const cols = rows[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < cols.length; colIndex += 1) {
      if (looksLikeMonthNameDayWithoutYear(readCell(cols, colIndex))) {
        return true;
      }
    }
  }
  return false;
}

function joinDateParts(year: number, month: number, day: number) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getFullYear() !== year ||
    probe.getMonth() + 1 !== month ||
    probe.getDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function normalizeTimeInput(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  const cleaned = value.replace(/\./g, ':').replace(/\s+/g, ' ');
  const compact = cleaned.match(/^(\d{3,4})\s*(am|pm)?$/i);
  if (compact) {
    const digits = compact[1];
    let hours = Number(digits.slice(0, digits.length - 2));
    const minutes = Number(digits.slice(-2));
    const meridiem = compact[2]?.toLowerCase() ?? null;

    if (minutes < 0 || minutes > 59) return null;

    if (meridiem) {
      if (hours < 1 || hours > 12) return null;
      if (meridiem === 'pm' && hours !== 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
    }

    if (hours < 0 || hours > 23) return null;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  const match = cleaned.match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const meridiem = match[3]?.toLowerCase() ?? null;

  if (minutes < 0 || minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  }

  if (hours < 0 || hours > 23) return null;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function compareTimes(left: string, right: string) {
  const [leftHours, leftMinutes] = left.split(':').map((part) => Number(part));
  const [rightHours, rightMinutes] = right.split(':').map((part) => Number(part));
  return leftHours * 60 + leftMinutes - (rightHours * 60 + rightMinutes);
}

function validatePrayerOrder(
  row: PrayerSchedulePreviewRow,
  rowNumber: number,
  issues: PrayerScheduleImportIssue[]
) {
  const values = PRAYER_KEYS.map((prayer) => ({
    prayer,
    minutes: toMinutes(row[prayer].adhan),
  }));

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (
      previous.minutes !== null &&
      current.minutes !== null &&
      current.minutes <= previous.minutes
    ) {
      issues.push({
        rowNumber,
        severity: 'warning',
        message: `${current.prayer} adhan is not later than ${previous.prayer} adhan. Review this row before publishing.`,
      });
      return;
    }
  }
}

function validateIqamaOrder(
  row: PrayerSchedulePreviewRow,
  rowNumber: number,
  issues: PrayerScheduleImportIssue[]
) {
  PRAYER_KEYS.forEach((prayer) => {
    const adhanMinutes = toMinutes(row[prayer].adhan);
    const iqamaMinutes = toMinutes(row[prayer].iqama);
    if (adhanMinutes !== null && iqamaMinutes !== null && iqamaMinutes < adhanMinutes) {
      issues.push({
        rowNumber,
        severity: 'warning',
        message: `${prayer} iqama is earlier than the adhan time.`,
      });
    }
  });
}

function toMinutes(value: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map((segment) => Number(segment));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function toIsoString(dateIso: string, time: string | null) {
  if (!time) return null;
  const [year, month, day] = dateIso.split('-').map((part) => Number(part));
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  const value = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function addMinutes(time: string, minutesToAdd: number) {
  const minutes = toMinutes(time);
  if (minutes === null) return null;
  const total = ((minutes + minutesToAdd) % (24 * 60) + 24 * 60) % (24 * 60);
  const hours = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const mins = (total % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

async function readPickedDocumentAsText(asset: DocumentPicker.DocumentPickerAsset) {
  if (asset.file && typeof asset.file.text === 'function') {
    return await asset.file.text();
  }

  if (/^(blob:|data:|https?:)/i.test(asset.uri)) {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error(`Unable to read the selected file (${response.status}).`);
    }
    return await response.text();
  }

  return await readNativeFileAsText(asset.uri);
}
