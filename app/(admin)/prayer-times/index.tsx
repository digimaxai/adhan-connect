import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AdminScreenShell } from '@/components/admin/AdminScreenShell';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { DateSelector } from '@/components/admin/DateSelector';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { tokens } from '@/theme/tokens';
import { useRoleFlags } from '@/lib/roles';
import { useAdminMosque } from '@/lib/hooks/useAdminMosque';
import {
  getPrayerTimesByDate,
  listPrayerTimesByDates,
  PrayerTimesRow,
  upsertPrayerTimes,
} from '@/lib/api/admin/prayerTimes';
import { getDailyPrayerTimes } from '@/lib/api/prayerTimesUnified';
import {
  parsePrayerScheduleCsv,
  pickPrayerScheduleImportFile,
  PrayerScheduleImportMode,
  PrayerSchedulePreview,
  PrayerSchedulePreviewRow,
  publishPrayerSchedulePreview,
} from '@/lib/prayerScheduleImport';
import {
  listPrayerScheduleImports,
  PrayerScheduleImportRecord,
  rollbackPrayerScheduleImport,
} from '@/lib/api/admin/prayerScheduleImports';
import { useAuth } from '@/lib/auth';

const prayers: { key: keyof PrayerTimeForm; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

type PrayerTimeForm = {
  fajr: TimePair;
  dhuhr: TimePair;
  asr: TimePair;
  maghrib: TimePair;
  isha: TimePair;
};

type TimePair = { adhan: string | null; iqama: string | null };

const emptyPair: TimePair = { adhan: null, iqama: null };

const FULL_TEMPLATE_CSV = `date,fajr,fajr_iqama,dhuhr,dhuhr_iqama,asr,asr_iqama,maghrib,maghrib_iqama,isha,isha_iqama
2026-03-01,05:12,05:35,12:13,13:00,15:48,16:15,17:42,17:47,19:03,19:45
2026-03-02,05:10,05:35,12:13,13:00,15:50,16:15,17:44,17:49,19:05,19:45
2026-03-03,05:07,05:35,12:13,13:00,15:51,16:15,17:45,17:50,19:07,19:45`;

const MINIMAL_TEMPLATE_CSV = `date,fajr,dhuhr,asr,maghrib,isha
2026-03-01,05:12,12:13,15:48,17:42,19:03
2026-03-02,05:10,12:13,15:50,17:44,19:05
2026-03-03,05:07,12:13,15:51,17:45,19:07`;

const IMPORT_SHAPES = [
  'Beginning + Jamat',
  'Adhan + Iqamah',
  'Adhan only',
  'Monthly sections with day numbers',
  'Separate month and day columns',
];
const REQUIRED_COLUMNS = ['date or day column', 'fajr', 'dhuhr/zuhr', 'asr', 'maghrib', 'isha'];
const OPTIONAL_COLUMNS = [
  'fajr_iqama',
  'dhuhr_iqama',
  'asr_iqama',
  'maghrib_iqama',
  'isha_iqama',
];
const NOT_PUBLISHED_YET = ['sunrise', 'sunset', 'tahajjud', 'jummah', 'khutbah'];
const IMPORT_MODES: {
  id: PrayerScheduleImportMode;
  label: string;
  description: string;
}[] = [
  {
    id: 'smart_auto',
    label: 'Smart auto-detect',
    description: 'Recommended. The importer keeps any iqamah columns it finds and leaves the rest blank.',
  },
  {
    id: 'explicit_iqama',
    label: 'Strict file iqamah',
    description: 'Use this only when the timetable definitely contains explicit jamaat or iqamah columns.',
  },
  {
    id: 'adhan_only',
    label: 'Adhan only',
    description: 'Use this when the file contains start or adhan times only.',
  },
  {
    id: 'adhan_plus_fixed_offset',
    label: 'Adhan + fixed iqamah offset',
    description: 'Use this when iqamah should be derived from adhan with one consistent offset.',
  },
];
const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

type PrayerTimesAdminScreenProps = {
  preferredMosqueId?: string | null;
  prayerTimesHrefOverride?: string | null;
  backHrefOverride?: string | null;
  backLabelOverride?: string;
  eyebrowOverride?: string;
  allowImplicitMosqueSelection?: boolean;
  onboardingMode?: boolean;
};

type CoverageIntent = 'single_month' | 'date_range' | 'full_year';

type ImportImpactSummary = {
  inserts: number;
  updates: number;
  existingDates: number;
};

type CoverageAnalysis = {
  recommendedIntent: CoverageIntent;
  label: string;
  detail: string;
  isSingleMonth: boolean;
  isCompleteMonth: boolean;
  isFullYear: boolean;
  monthLabel: string | null;
  yearLabel: string | null;
  daysCovered: number;
  expectedDayCount: number | null;
};

const COVERAGE_INTENT_OPTIONS: {
  id: CoverageIntent;
  label: string;
  description: string;
}[] = [
  {
    id: 'single_month',
    label: 'Single month',
    description: 'Use when the file is intended to publish one named month for one mosque.',
  },
  {
    id: 'date_range',
    label: 'Date-range patch',
    description: 'Use when the file covers several months or a partial range rather than the full year.',
  },
  {
    id: 'full_year',
    label: 'Full year',
    description: 'Use when the file is the canonical annual timetable for the whole calendar year.',
  },
];

export default function PrayerTimesAdminScreen({
  preferredMosqueId,
  prayerTimesHrefOverride,
  backHrefOverride,
  backLabelOverride,
  eyebrowOverride,
  allowImplicitMosqueSelection,
  onboardingMode,
}: PrayerTimesAdminScreenProps = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ mosqueId?: string; onboarding?: string }>();
  const { authUser } = useAuth();
  const { loading: roleLoading, isAdmin, isMainAdmin } = useRoleFlags();
  const userId = authUser?.id ?? '';
  const isWeb = Platform.OS === 'web';
  const isMainAdminWeb = isWeb && isMainAdmin;
  const queryMosqueId = Array.isArray(params.mosqueId) ? params.mosqueId[0] : params.mosqueId;
  const effectiveMosqueId = preferredMosqueId ?? queryMosqueId ?? null;
  const shouldAutoSelectMosque =
    typeof allowImplicitMosqueSelection === 'boolean'
      ? allowImplicitMosqueSelection
      : !isMainAdminWeb && !effectiveMosqueId;
  const { mosques, selectedMosque, loading: mosqueLoading } = useAdminMosque({
    preferredMosqueId: effectiveMosqueId,
    autoSelectFirst: shouldAutoSelectMosque,
  });
  const prayerTimesRoute =
    prayerTimesHrefOverride ??
    (isMainAdminWeb
      ? effectiveMosqueId
        ? `/admin/mosques/${effectiveMosqueId}/prayer-times`
        : '/admin/prayer-times'
      : '/(admin)/prayer-times');
  const staffRotaRoute = '/(admin)/staff-rota';
  const backRoute =
    backHrefOverride ??
    (isMainAdminWeb
      ? effectiveMosqueId
        ? `/admin/mosques/${effectiveMosqueId}`
        : '/admin/prayer-times'
      : '/(admin)');
  const backLabel =
    backLabelOverride ?? (isMainAdminWeb && effectiveMosqueId ? 'Back to Mosque' : 'Back to Console');
  const eyebrowLabel = eyebrowOverride ?? (isMainAdminWeb ? 'Main Admin' : 'Local Admin');
  const isOnboardingEntry =
    typeof onboardingMode === 'boolean'
      ? onboardingMode
      : (Array.isArray(params.onboarding) ? params.onboarding[0] : params.onboarding) === '1';

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<PrayerTimeForm>({
    fajr: emptyPair,
    dhuhr: emptyPair,
    asr: emptyPair,
    maghrib: emptyPair,
    isha: emptyPair,
  });
  const [pickerState, setPickerState] = useState<{
    prayer: keyof PrayerTimeForm;
    field: 'adhan' | 'iqama';
  } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState<Date | null>(null);
  const [currentRow, setCurrentRow] = useState<PrayerTimesRow | null>(null);
  const [scheduleSourceLabel, setScheduleSourceLabel] = useState(
    'No published schedule for this date.'
  );
  const [scheduleSourceMeta, setScheduleSourceMeta] = useState<string | null>(null);
  const [pastedCsv, setPastedCsv] = useState('');
  const [importMode, setImportMode] = useState<PrayerScheduleImportMode>('smart_auto');
  const [fixedIqamaOffsetMinutes, setFixedIqamaOffsetMinutes] = useState('10');
  const [useManualDateContext, setUseManualDateContext] = useState(false);
  const [manualContextMonth, setManualContextMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [manualContextYear, setManualContextYear] = useState(String(new Date().getFullYear()));
  const [importPreview, setImportPreview] = useState<PrayerSchedulePreview | null>(null);
  const [preparingImport, setPreparingImport] = useState(false);
  const [publishingImport, setPublishingImport] = useState(false);
  const [coverageIntent, setCoverageIntent] = useState<CoverageIntent | null>(null);
  const [importImpact, setImportImpact] = useState<ImportImpactSummary | null>(null);
  const [loadingImportImpact, setLoadingImportImpact] = useState(false);
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [showManualOverrideTools, setShowManualOverrideTools] = useState(false);
  const [showImportConfigurator, setShowImportConfigurator] = useState(false);
  const [importHistory, setImportHistory] = useState<PrayerScheduleImportRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollingBackImportId, setRollingBackImportId] = useState<string | null>(null);
  const isIOS = Platform.OS === 'ios';

  const dateIso = useMemo(() => formatLocalDate(selectedDate), [selectedDate]);
  const disableForNoMosque = !selectedMosque;
  const canManageImports = isWeb && isMainAdmin;
  const hasValidFixedIqamaOffset =
    importMode !== 'adhan_plus_fixed_offset' || isPositiveInteger(fixedIqamaOffsetMinutes);
  const manualDateContext = useMemo(
    () => buildManualDateContext(useManualDateContext, manualContextMonth, manualContextYear),
    [manualContextMonth, manualContextYear, useManualDateContext]
  );
  const hasValidManualDateContext = !useManualDateContext || !!manualDateContext;
  const coverageAnalysis = useMemo(
    () => analyzeCoverage(importPreview),
    [importPreview]
  );
  const coverageIntentValidation = useMemo(
    () => validateCoverageIntentSelection(coverageIntent, coverageAnalysis),
    [coverageAnalysis, coverageIntent]
  );
  const canPublishImport =
    !!selectedMosque &&
    canManageImports &&
    !!importPreview?.validRows.length &&
    !preparingImport &&
    !publishingImport &&
    !loadingImportImpact &&
    hasValidFixedIqamaOffset &&
    hasValidManualDateContext &&
    !!coverageIntent &&
    coverageIntentValidation.valid;
  const importModeReview = useMemo(
    () => getImportModeReview(importMode, fixedIqamaOffsetMinutes),
    [importMode, fixedIqamaOffsetMinutes]
  );
  const importRecoveryTips = useMemo(
    () => getImportRecoveryTips(importPreview),
    [importPreview]
  );

  useEffect(() => {
    setImportPreview(null);
    setCoverageIntent(null);
    setImportImpact(null);
    setShowPublishReview(false);
    setShowValidationDetails(false);
    setPastedCsv('');
    setShowPasteFallback(false);
    setImportMode('smart_auto');
    setFixedIqamaOffsetMinutes('10');
    setUseManualDateContext(false);
    setManualContextMonth(String(new Date().getMonth() + 1).padStart(2, '0'));
    setManualContextYear(String(new Date().getFullYear()));
    setShowImportHelp(false);
    setShowImportHistory(false);
    setShowManualOverrideTools(!canManageImports);
    setShowImportConfigurator(false);
    setImportHistory([]);
  }, [canManageImports, selectedMosque?.mosqueId]);

  useEffect(() => {
    setImportPreview(null);
    setCoverageIntent(null);
    setImportImpact(null);
    setShowPublishReview(false);
    setShowValidationDetails(false);
  }, [importMode, fixedIqamaOffsetMinutes, useManualDateContext, manualContextMonth, manualContextYear]);

  useEffect(() => {
    if (!canManageImports) {
      setShowManualOverrideTools(true);
    }
  }, [canManageImports]);

  useEffect(() => {
    if (!selectedMosque || !canManageImports || !importPreview?.validRows.length) {
      setImportImpact(null);
      setLoadingImportImpact(false);
      return;
    }

    let cancelled = false;
    const loadImpact = async () => {
      setLoadingImportImpact(true);
      try {
        const existingRows = await listPrayerTimesByDates(
          selectedMosque.mosqueId,
          importPreview.validRows.map((row) => row.date)
        );
        if (cancelled) return;
        const existingDates = new Set(existingRows.map((row) => normalizeDateKey(row.date)));
        setImportImpact({
          existingDates: existingDates.size,
          updates: existingDates.size,
          inserts: importPreview.validRows.filter((row) => !existingDates.has(row.date)).length,
        });
      } catch (e) {
        console.warn('load prayer-times import impact', e);
        if (!cancelled) {
          setImportImpact(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingImportImpact(false);
        }
      }
    };

    loadImpact();
    return () => {
      cancelled = true;
    };
  }, [canManageImports, importPreview, selectedMosque]);

  useEffect(() => {
    if (!importPreview || !coverageAnalysis || coverageIntent) return;
    setCoverageIntent(coverageAnalysis.recommendedIntent);
  }, [coverageAnalysis, coverageIntent, importPreview]);

  const loadPrayerTimes = useCallback(async () => {
    if (!selectedMosque) {
      setCurrentRow(null);
      setScheduleSourceLabel(
        mosques.length ? 'Select a mosque to load its schedule.' : 'No admin mosque found.'
      );
      setScheduleSourceMeta(null);
      setNotice(
        mosques.length ? 'Select a mosque to load and edit its prayer schedule.' : null
      );
      setForm({
        fajr: emptyPair,
        dhuhr: emptyPair,
        asr: emptyPair,
        maghrib: emptyPair,
        isha: emptyPair,
      });
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const row = await getPrayerTimesByDate(selectedMosque.mosqueId, dateIso);
      if (row) {
        setCurrentRow(row);
        setForm(mapRowToForm(row));
        setScheduleSourceLabel(formatScheduleSource(row));
        setScheduleSourceMeta(
          row.updated_at ? `Last updated ${formatDateTime(row.updated_at)}` : null
        );
      } else {
        const normalized = await getDailyPrayerTimes(selectedMosque.mosqueId, selectedDate);
        setCurrentRow(null);
        if (normalized) {
          setForm(mapNormalizedToForm(normalized));
          setScheduleSourceLabel('Legacy fallback schedule loaded');
          setScheduleSourceMeta(
            'Saving will publish a canonical prayer_times row for this date.'
          );
          setNotice(
            'Existing timings were loaded from the fallback source. Save to publish them into the canonical schedule.'
          );
        } else {
          setForm({
            fajr: emptyPair,
            dhuhr: emptyPair,
            asr: emptyPair,
            maghrib: emptyPair,
            isha: emptyPair,
          });
          setScheduleSourceLabel('No published schedule for this date.');
          setScheduleSourceMeta('Create times manually or publish a timetable import.');
          setNotice(
            'No prayer times exist for this date yet. Set the times below and save to create them.'
          );
        }
      }
    } catch (e: any) {
      console.warn('load prayer times', e?.message ?? e);
      setError('Unable to load prayer times.');
      setCurrentRow(null);
      setScheduleSourceLabel('Unable to inspect the current schedule.');
      setScheduleSourceMeta(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMosque, dateIso, mosques.length, selectedDate]);

  useEffect(() => {
    loadPrayerTimes();
  }, [loadPrayerTimes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPrayerTimes();
    } finally {
      setRefreshing(false);
    }
  }, [loadPrayerTimes]);

  const loadImportHistory = useCallback(async () => {
    if (!selectedMosque || !canManageImports) {
      setImportHistory([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const history = await listPrayerScheduleImports(selectedMosque.mosqueId, 6);
      setImportHistory(history);
    } catch (e: any) {
      console.warn('load prayer schedule imports', e?.message ?? e);
    } finally {
      setHistoryLoading(false);
    }
  }, [canManageImports, selectedMosque]);

  useEffect(() => {
    void loadImportHistory();
  }, [loadImportHistory]);

  const openTimePicker = (prayer: keyof PrayerTimeForm, field: 'adhan' | 'iqama') => {
    if (disableForNoMosque) return;
    setPickerState({ prayer, field });
    setTempValue(buildPickerValue(form[prayer][field], selectedDate));
    setShowPicker(true);
  };

  const handleSave = async () => {
    if (!selectedMosque) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = mapFormToRow(form, selectedDate);
      await upsertPrayerTimes(selectedMosque.mosqueId, dateIso, payload, {
        sourceType: 'manual',
        generatedMethod: 'quick_edit',
        updatedBy: userId || null,
        overridesExist: true,
      });
      setNotice('Prayer times saved successfully.');
      Alert.alert('Saved', 'Prayer times updated.');
      await loadPrayerTimes();
    } catch (e: any) {
      console.warn('save prayer times', e?.message ?? e);
      setError(
        e?.message
          ? `Could not save changes: ${e.message}`
          : 'Could not save changes. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePickTimetable = async () => {
    if (!selectedMosque) return;
    if (!canManageImports) {
      setNotice(null);
      setError('Only Main Admin can upload and publish timetable files.');
      return;
    }

    const importOptions = resolveImportOptionsOrError(
      importMode,
      fixedIqamaOffsetMinutes,
      useManualDateContext,
      manualContextMonth,
      manualContextYear
    );
    if (!importOptions) return;

    setPreparingImport(true);
    setError(null);
    setNotice(null);

    try {
      const preview = await pickPrayerScheduleImportFile(importOptions);
      if (!preview) return;
      setImportPreview(preview);
      setCoverageIntent(null);
      setImportImpact(null);
      setShowPublishReview(false);
      setShowValidationDetails(false);
      setPastedCsv('');
      setShowPasteFallback(false);
      setShowImportConfigurator(preview.summary.errorCount > 0 || preview.summary.validRows === 0);
      setNotice(
        `Preview ready from ${preview.fileName ?? 'the uploaded file'}: ${preview.summary.validRows} valid rows prepared for ${selectedMosque.name}. Review the preview below, then publish.`
      );
    } catch (e: any) {
      console.warn('pick timetable import', e?.message ?? e);
      setError(e?.message ?? 'Unable to read the timetable file.');
    } finally {
      setPreparingImport(false);
    }
  };

  const handlePreviewPastedCsv = () => {
    if (!selectedMosque) return;
    if (!canManageImports) {
      setNotice(null);
      setError('Only Main Admin can preview and publish timetable files.');
      return;
    }
    if (!pastedCsv.trim()) {
      setError('Paste a CSV timetable before previewing it.');
      return;
    }

    const importOptions = resolveImportOptionsOrError(
      importMode,
      fixedIqamaOffsetMinutes,
      useManualDateContext,
      manualContextMonth,
      manualContextYear
    );
    if (!importOptions) return;

    setError(null);
    setNotice(null);

    try {
      const preview = parsePrayerScheduleCsv(pastedCsv, 'Pasted CSV', importOptions);
      setImportPreview(preview);
      setCoverageIntent(null);
      setImportImpact(null);
      setShowPublishReview(false);
      setShowValidationDetails(false);
      setShowImportConfigurator(preview.summary.errorCount > 0 || preview.summary.validRows === 0);
      setNotice(
        `Preview ready from pasted CSV: ${preview.summary.validRows} valid rows prepared for ${selectedMosque.name}. Review the preview below, then publish.`
      );
    } catch (e: any) {
      console.warn('preview pasted csv', e?.message ?? e);
      setError(e?.message ?? 'Unable to parse the pasted timetable.');
    }
  };

  const handleInsertTemplate = (variant: 'full' | 'minimal') => {
    const template = variant === 'full' ? FULL_TEMPLATE_CSV : MINIMAL_TEMPLATE_CSV;
    setPastedCsv(template);
    setImportPreview(null);
    setCoverageIntent(null);
    setImportImpact(null);
    setShowPublishReview(false);
    setShowValidationDetails(false);
    setShowImportConfigurator(true);
    setNotice(
      variant === 'full'
        ? 'Loaded the full sample template. Replace the dates and times with your mosque timetable before previewing or publishing.'
        : 'Loaded the minimal adhan-only template. Replace the dates and times with your mosque timetable before previewing or publishing.'
    );
    setError(null);
  };

  const handlePublishImport = () => {
    if (!selectedMosque) {
      setNotice(null);
      setError('Select a mosque before publishing a timetable.');
      return;
    }
    if (!canManageImports) {
      setNotice(null);
      setError('Only Main Admin can publish timetable imports.');
      return;
    }
    if (!hasValidFixedIqamaOffset) {
      setNotice(null);
      setError('Enter a valid fixed iqamah offset, then preview the timetable again before publishing.');
      return;
    }
    if (!importPreview) {
      setNotice(null);
      setError('Preview the timetable first, then publish the valid rows.');
      return;
    }
    if (!importPreview.validRows.length) {
      setNotice(null);
      setError('This timetable preview has no valid rows to publish. Fix the highlighted issues and preview again.');
      return;
    }
    if (!coverageIntent) {
      setNotice(null);
      setError('Confirm whether this upload is a single month, a date-range patch, or a full year before publishing.');
      return;
    }
    if (!coverageIntentValidation.valid) {
      setNotice(null);
      setError(coverageIntentValidation.error ?? 'Review the timetable scope before publishing.');
      return;
    }
    if (loadingImportImpact) {
      setNotice(null);
      setError('Preparing the publish impact summary. Try again in a moment.');
      return;
    }

    setError(null);
    setNotice(
      `Review the publish scope for ${selectedMosque.name}, then confirm the timetable publish below.`
    );
    setShowPublishReview(true);
  };

  const handleConfirmPublishImport = async () => {
    if (!selectedMosque || !importPreview || !coverageIntent) return;

    setPublishingImport(true);
    setShowPublishReview(false);
    setError(null);
    setNotice(
      `Publishing ${importPreview.validRows.length} timetable rows for ${selectedMosque.name}. This may take a few seconds.`
    );

    try {
      const publishResult = await publishPrayerSchedulePreview({
        mosqueId: selectedMosque.mosqueId,
        rows: importPreview.validRows,
        summary: importPreview.summary,
        sourceLabel: importPreview.fileName ?? 'Pasted CSV',
        importMode,
        fixedIqamaOffsetMinutes:
          buildImportOptions(
            importMode,
            fixedIqamaOffsetMinutes,
            useManualDateContext,
            manualContextMonth,
            manualContextYear
          ).fixedIqamaOffsetMinutes,
        metadata: {
          parserDetection: importPreview.detection ?? null,
          parserColumnMapping: importPreview.columnMapping ?? null,
          dateContext: manualDateContext ?? null,
          coverageIntent,
          coverageIntentLabel: formatCoverageIntentLabel(coverageIntent),
          coverageAnalysis,
          impactSummary: importImpact,
          onboardingEntry: isOnboardingEntry,
        },
        meta: {
          sourceType: 'upload',
          generatedMethod: importPreview.fileName
            ? `csv_upload:${importMode}:${importPreview.fileName}`
            : `csv_upload:${importMode}`,
          updatedBy: userId || null,
          overridesExist: true,
        },
      });

      setNotice(
        `Published ${importPreview.validRows.length} timetable rows for ${selectedMosque.name}. Import ${publishResult.importRecord.id.slice(0, 8)} was added to history.`
      );
      setImportPreview(null);
      setCoverageIntent(null);
      setImportImpact(null);
      setShowPublishReview(false);
      setPastedCsv('');
      await loadPrayerTimes();
      await loadImportHistory();
    } catch (e: any) {
      console.warn('publish timetable import', e?.message ?? e);
      setError(e?.message ?? 'Unable to publish the timetable right now.');
      setNotice(null);
    } finally {
      setPublishingImport(false);
    }
  };

  const performRollbackImport = useCallback(
    async (record: PrayerScheduleImportRecord) => {
      if (!selectedMosque) return;
      if (!canManageImports) {
        setNotice(null);
        setError('Only Main Admin can roll back timetable imports.');
        return;
      }

      setRollingBackImportId(record.id);
      setError(null);
      setNotice(null);

      try {
        const result = await rollbackPrayerScheduleImport({
          importId: record.id,
          currentUserId: userId || null,
        });

        setNotice(
          `Rolled back ${record.source_label ?? 'the selected timetable import'} and created rollback record ${result.importRecord.id.slice(0, 8)}.`
        );
        await loadPrayerTimes();
        await loadImportHistory();
      } catch (e: any) {
        console.warn('rollback prayer schedule import', e?.message ?? e);
        setError(e?.message ?? 'Unable to roll back that timetable import right now.');
      } finally {
        setRollingBackImportId(null);
      }
    },
    [canManageImports, loadImportHistory, loadPrayerTimes, selectedMosque, userId]
  );

  const handleRollbackImport = useCallback(
    (record: PrayerScheduleImportRecord) => {
      Alert.alert(
        'Rollback timetable import',
        'This will restore the schedule state from before that publish and create a new rollback record in import history.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Rollback',
            style: 'destructive',
            onPress: () => {
              void performRollbackImport(record);
            },
          },
        ]
      );
    },
    [performRollbackImport]
  );

  const handleTimePicked = (event: any, selected?: Date) => {
    if (!pickerState) return;
    if (!isIOS) {
      if (event?.type === 'set' && selected) {
        commitPickerValue(selected);
      }
      closePicker(false);
      return;
    }
    if (selected) setTempValue(selected);
  };

  const commitPickerValue = (value: Date) => {
    if (!pickerState) return;
    const hh = value.getHours().toString().padStart(2, '0');
    const mm = value.getMinutes().toString().padStart(2, '0');
    setForm((prev) => ({
      ...prev,
      [pickerState.prayer]: {
        ...prev[pickerState.prayer],
        [pickerState.field]: `${hh}:${mm}`,
      },
    }));
  };

  const closePicker = (commit = false) => {
    if (commit) {
      const valueToCommit =
        tempValue && !isNaN(tempValue.getTime())
          ? tempValue
          : pickerState
            ? buildPickerValue(form[pickerState.prayer][pickerState.field], selectedDate)
            : null;
      if (valueToCommit) commitPickerValue(valueToCommit);
    }
    setShowPicker(false);
    setPickerState(null);
    setTempValue(null);
  };

  const pickerValue = (() => {
    const candidate =
      tempValue && !isNaN(tempValue.getTime())
        ? tempValue
        : pickerState
          ? buildPickerValue(form[pickerState.prayer][pickerState.field], selectedDate)
          : null;
    if (candidate && !isNaN(candidate.getTime())) return candidate;
    return new Date(selectedDate);
  })();

  if (roleLoading || mosqueLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <AppText variant="body" style={styles.feedbackText}>
          Loading...
        </AppText>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <AppText variant="body">You do not have admin access.</AppText>
      </View>
    );
  }

  return (
    <AdminScreenShell
      title="Prayer Times"
      eyebrow={eyebrowLabel}
      subtitle={
        isWeb
          ? canManageImports
            ? 'Upload and publish mosque timetables while keeping manual exception edits available.'
            : 'Review the active schedule and make day-level corrections. Bulk timetable uploads are handled by Main Admin.'
          : 'Edit the daily adhan and iqama schedule.'
      }
      backHref={backRoute}
      backLabel={backLabel}
      activeTab={isMainAdminWeb ? undefined : 'prayerTimes'}
      onGoPrayerTimes={isMainAdminWeb ? undefined : () => router.push(prayerTimesRoute as any)}
      onGoStaffRota={isMainAdminWeb ? undefined : () => router.push(staffRotaRoute as any)}
      mosqueName={selectedMosque?.name ?? null}
      mosqueMeta={
        selectedMosque
          ? [selectedMosque.city, selectedMosque.country].filter(Boolean).join(', ') ||
            'Prayer schedule editor'
          : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={tokens.color.status.info}
        />
      }
    >
      {showManualOverrideTools || !canManageImports ? (
        <View style={[styles.workspaceGrid, isWeb ? styles.workspaceGridWeb : null]}>
          <AppCard style={styles.utilityCard}>
            <View style={styles.utilityHeader}>
              <AppText variant="caption" color={tokens.color.text.secondary}>
                Selected date
              </AppText>
              <AppText variant="title">Schedule date</AppText>
            </View>
            <DateSelector date={selectedDate} onChange={setSelectedDate} />
          </AppCard>

          <AppCard style={styles.statusCard}>
            <View style={styles.utilityHeader}>
              <AppText variant="caption" color={tokens.color.text.secondary}>
                Published source
              </AppText>
              <AppText variant="title">Schedule status</AppText>
            </View>
            <AppText variant="body" style={styles.statusValue}>
              {scheduleSourceLabel}
            </AppText>
            {scheduleSourceMeta ? (
              <AppText variant="caption" color={tokens.color.text.secondary}>
                {scheduleSourceMeta}
              </AppText>
            ) : null}
            {currentRow?.source_type ? (
              <View style={styles.sourceBadge}>
                <AppText variant="caption" style={styles.sourceBadgeText}>
                  {currentRow.source_type}
                </AppText>
              </View>
            ) : null}
          </AppCard>
        </View>
      ) : (
        <AppCard subtle style={styles.compactManualCard}>
          <AppText variant="caption" color={tokens.color.text.secondary}>
            Manual override tools
          </AppText>
          <AppText variant="title" style={styles.mobileHintTitle}>
            Hide the day-level editor until you need it
          </AppText>
          <AppText variant="body" color={tokens.color.text.secondary}>
            Main Admin uploads can stay focused on file import. Open the manual workspace only when a single date needs a correction.
          </AppText>
          <AppButton
            title="Open day override tools"
            variant="ghost"
            onPress={() => setShowManualOverrideTools(true)}
          />
        </AppCard>
      )}

      {!selectedMosque && !mosques.length ? (
        <AdminBanner
          tone="warning"
          title={isMainAdmin ? 'No mosques found' : 'No mosque access'}
          message={
            isMainAdmin
              ? 'No mosques are currently available for the prayer-times workspace.'
              : 'You can only manage prayer times for mosques where your account has local admin access.'
          }
        />
      ) : null}
      {canManageImports && !selectedMosque && mosques.length ? (
        <AdminBanner
          tone="warning"
          title="Choose a mosque first"
          message="Main Admin timetable publishing is now mosque specific. Open a mosque workspace from the prayer-times hub or mosque directory before uploading a file."
        />
      ) : null}

      {isOnboardingEntry && selectedMosque ? (
        <AdminBanner
          tone="info"
          title="Schedule setup"
          message={
            canManageImports
              ? `You are setting up ${selectedMosque.name}. Upload the timetable, confirm whether it is a month patch or full-year publish, then review the overwrite summary before publishing.`
              : `You are setting up ${selectedMosque.name}. Manual day-level edits are available here, while Main Admin publishes month or full-year timetable files from the web portal.`
          }
        />
      ) : null}

      {notice ? (
        <AdminBanner
          tone={publishingImport ? 'info' : notice.startsWith('Published') ? 'success' : 'info'}
          title={publishingImport ? 'Publishing timetable' : 'Prayer schedule'}
          message={notice}
        />
      ) : null}
      {error ? <AdminBanner tone="danger" title="Unable to continue" message={error} /> : null}

      {canManageImports ? (
        <AppCard style={styles.importCard}>
          <View style={styles.importHeader}>
            <View style={styles.importCopy}>
              <AppText variant="caption" color={tokens.color.text.secondary}>
                Timetable import
              </AppText>
              <AppText variant="title">Upload, review, publish</AppText>
              <AppText
                variant="body"
                color={tokens.color.text.secondary}
                style={styles.importDescription}
              >
                Main Admin can upload CSV timetables directly into the canonical prayer schedule.
                Local Admin manual corrections still happen below as day-level exceptions.
              </AppText>
              {selectedMosque ? (
                <View style={styles.targetMosqueBadge}>
                  <AppText variant="caption" style={styles.targetMosqueBadgeText}>
                    Publishing for {selectedMosque.name}
                  </AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.importActionRow}>
              <AppButton
                title={
                  preparingImport
                    ? 'Preparing preview...'
                    : importPreview?.fileName
                      ? 'Replace File'
                      : 'Upload CSV and Preview'
                }
                variant="secondary"
                onPress={handlePickTimetable}
                disabled={
                  disableForNoMosque ||
                  preparingImport ||
                  publishingImport ||
                  !hasValidFixedIqamaOffset ||
                  !hasValidManualDateContext
                }
                style={styles.actionButton}
              />
              <AppButton
                title={
                  publishingImport
                    ? `Publishing ${importPreview?.summary.validRows ?? 0} rows...`
                    : showPublishReview
                      ? 'Review open below'
                      : importPreview?.summary.validRows
                        ? coverageIntent
                          ? `Review ${importPreview.summary.validRows} rows`
                          : 'Choose publish scope first'
                        : 'Upload a file first'
                }
                onPress={handlePublishImport}
                disabled={
                  !selectedMosque ||
                  !canManageImports ||
                  !importPreview?.validRows.length ||
                  preparingImport ||
                  publishingImport ||
                  !hasValidFixedIqamaOffset ||
                  loadingImportImpact
                }
                style={styles.actionButton}
              />
            </View>
          </View>

          <AppText variant="caption" color={tokens.color.text.secondary}>
            Uploading a file creates the preview automatically. Publishing now requires an explicit mosque scope review before the final confirm step.
          </AppText>

          <View style={styles.workflowStrip}>
            <WorkflowStep
              step="1"
              title="Upload"
              active={!importPreview}
              description="Choose the mosque file and let the importer interpret it."
            />
            <WorkflowStep
              step="2"
              title="Review"
              active={!!importPreview && !showPublishReview}
              description="Check the detected dates, columns, warnings, and coverage."
            />
            <WorkflowStep
              step="3"
              title="Publish"
              active={showPublishReview}
              description="Confirm what will be written before the timetable goes live."
            />
          </View>

          <AppCard subtle style={styles.importOptionsShell}>
            <View style={styles.importOptionsHeader}>
              <View style={styles.importCopy}>
                <AppText variant="caption" color={tokens.color.text.secondary}>
                  Import options
                </AppText>
                <AppText variant="title" style={styles.guideTitle}>
                  Keep this closed unless the preview needs help
                </AppText>
                <AppText variant="body" color={tokens.color.text.secondary}>
                  Smart auto-detect stays on by default. Open these controls only when the preview dates or columns do not look right.
                </AppText>
              </View>
              <AppButton
                title={showImportConfigurator ? 'Hide options' : 'Adjust import options'}
                variant="ghost"
                onPress={() => setShowImportConfigurator((prev) => !prev)}
                disabled={publishingImport}
              />
            </View>
            {showImportConfigurator ? (
              <View style={styles.importOptionsContent}>
                <AppCard subtle style={styles.modeCard}>
                  <View style={styles.importCopy}>
                    <AppText variant="caption" color={tokens.color.text.secondary}>
                      Interpretation mode
                    </AppText>
                    <AppText variant="title" style={styles.guideTitle}>
                      Start with smart auto-detect, then add date help only if needed
                    </AppText>
                    <AppText variant="body" color={tokens.color.text.secondary}>
                      Most mosque CSV files can stay on the recommended mode. Only change the mode or add month and year context when the preview does not match the timetable.
                    </AppText>
                  </View>
                  <View style={styles.modeList}>
                    {IMPORT_MODES.map((mode) => {
                      const active = importMode === mode.id;
                      return (
                        <Pressable
                          key={mode.id}
                          onPress={() => setImportMode(mode.id)}
                          style={({ pressed }) => [
                            styles.modeOption,
                            active && styles.modeOptionActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.modeHeader}>
                            <AppText variant="body" style={styles.modeLabel}>
                              {mode.label}
                            </AppText>
                            <View style={[styles.modeIndicator, active && styles.modeIndicatorActive]} />
                          </View>
                          <AppText variant="caption" color={tokens.color.text.secondary}>
                            {mode.description}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  {importMode === 'adhan_plus_fixed_offset' ? (
                    <View style={styles.offsetRow}>
                      <View style={styles.importCopy}>
                        <AppText variant="caption" color={tokens.color.text.secondary}>
                          Fixed iqamah offset
                        </AppText>
                        <AppText variant="body" color={tokens.color.text.secondary}>
                          Every iqamah time will be derived from adhan plus this many minutes.
                        </AppText>
                      </View>
                      <TextInput
                        style={styles.offsetInput}
                        value={fixedIqamaOffsetMinutes}
                        onChangeText={setFixedIqamaOffsetMinutes}
                        keyboardType="number-pad"
                        editable={!publishingImport}
                      />
                    </View>
                  ) : null}
                  {importMode === 'adhan_plus_fixed_offset' && !hasValidFixedIqamaOffset ? (
                    <AppText variant="caption" color={tokens.color.status.danger} style={styles.importDescription}>
                      Enter a positive minute offset before previewing or importing.
                    </AppText>
                  ) : null}
                  <View style={styles.contextAssistCard}>
                    <View style={styles.contextAssistHeader}>
                      <View style={styles.importCopy}>
                        <AppText variant="caption" color={tokens.color.text.secondary}>
                          Date help
                        </AppText>
                        <AppText variant="body" color={tokens.color.text.secondary}>
                          Use this only when the file contains day numbers, partial dates, or monthly sections without a clear month and year.
                        </AppText>
                      </View>
                      <AppButton
                        title={useManualDateContext ? 'Hide month/year help' : 'This file needs month/year help'}
                        variant="ghost"
                        onPress={() => setUseManualDateContext((prev) => !prev)}
                      />
                    </View>
                    {useManualDateContext ? (
                      <View style={styles.contextAssistInputs}>
                        <View style={styles.contextField}>
                          <AppText variant="caption" color={tokens.color.text.secondary}>
                            Month
                          </AppText>
                          <TextInput
                            style={styles.contextInput}
                            value={manualContextMonth}
                            onChangeText={setManualContextMonth}
                            placeholder="03"
                            keyboardType="number-pad"
                            editable={!publishingImport}
                          />
                        </View>
                        <View style={styles.contextField}>
                          <AppText variant="caption" color={tokens.color.text.secondary}>
                            Year
                          </AppText>
                          <TextInput
                            style={styles.contextInput}
                            value={manualContextYear}
                            onChangeText={setManualContextYear}
                            placeholder="2026"
                            keyboardType="number-pad"
                            editable={!publishingImport}
                          />
                        </View>
                      </View>
                    ) : null}
                    {useManualDateContext && !hasValidManualDateContext ? (
                      <AppText variant="caption" color={tokens.color.status.danger}>
                        Enter a valid month and four-digit year before previewing.
                      </AppText>
                    ) : manualDateContext ? (
                      <AppText variant="caption" color={tokens.color.text.secondary}>
                        The importer will use {manualDateContext.label} whenever the file does not provide enough date context on its own.
                      </AppText>
                    ) : null}
                  </View>
                </AppCard>

                <AppCard subtle style={styles.guideCard}>
                  <View style={styles.guideHeader}>
                    <View style={styles.importCopy}>
                      <AppText variant="caption" color={tokens.color.text.secondary}>
                        Optional help
                      </AppText>
                      <AppText variant="title" style={styles.guideTitle}>
                        Templates and supported shapes
                      </AppText>
                      <AppText variant="body" color={tokens.color.text.secondary}>
                        Open this only if the preview is not matching what you expect or if you need a starter template.
                      </AppText>
                    </View>
                    <View style={styles.templateActions}>
                      <AppButton
                        title={showImportHelp ? 'Hide help' : 'Show help'}
                        variant="ghost"
                        onPress={() => setShowImportHelp((prev) => !prev)}
                        disabled={publishingImport}
                      />
                    </View>
                  </View>
                  {showImportHelp ? (
                    <>
                      <View style={styles.guideGrid}>
                        <GuideBlock
                          title="Supported shapes"
                          description="The importer can normalize these timetable styles."
                          items={IMPORT_SHAPES}
                          tone="info"
                        />
                        <GuideBlock
                          title="Core columns"
                          description="The importer needs a date plus the five core prayers."
                          items={REQUIRED_COLUMNS}
                          tone="success"
                        />
                        <GuideBlock
                          title="Optional iqamah columns"
                          description="If missing, rows still import and iqamah stays blank."
                          items={OPTIONAL_COLUMNS}
                          tone="warning"
                        />
                        <GuideBlock
                          title="Recognized but not published yet"
                          description="These columns are safely ignored for now."
                          items={NOT_PUBLISHED_YET}
                          tone="muted"
                        />
                      </View>

                      <View style={styles.templateActions}>
                        <AppButton
                          title="Insert full template"
                          variant="ghost"
                          onPress={() => handleInsertTemplate('full')}
                          disabled={disableForNoMosque || publishingImport}
                        />
                        <AppButton
                          title="Insert minimal template"
                          variant="ghost"
                          onPress={() => handleInsertTemplate('minimal')}
                          disabled={disableForNoMosque || publishingImport}
                        />
                      </View>

                      <View style={styles.sampleSection}>
                        <AppText variant="caption" color={tokens.color.text.secondary}>
                          Sample header
                        </AppText>
                        <AppText variant="body" style={styles.codeLine}>
                          date,fajr,fajr_iqama,dhuhr,dhuhr_iqama,asr,asr_iqama,maghrib,maghrib_iqama,isha,isha_iqama
                        </AppText>
                        <AppText variant="caption" color={tokens.color.text.secondary}>
                          Minimal adhan-only header
                        </AppText>
                        <AppText variant="body" style={styles.codeLine}>
                          date,fajr,dhuhr,asr,maghrib,isha
                        </AppText>
                      </View>
                    </>
                  ) : null}
                </AppCard>

                <AppCard subtle style={styles.pasteFallbackCard}>
                  <View style={styles.pasteFallbackHeader}>
                    <View style={styles.importCopy}>
                      <AppText variant="caption" color={tokens.color.text.secondary}>
                        Alternative input
                      </AppText>
                      <AppText variant="title" style={styles.guideTitle}>
                        Paste raw CSV only if you do not have a file
                      </AppText>
                      <AppText variant="body" color={tokens.color.text.secondary}>
                        File upload is the normal path and now previews automatically. Use paste only as a fallback.
                      </AppText>
                    </View>
                    <AppButton
                      title={showPasteFallback ? 'Hide pasted CSV' : 'Paste CSV instead'}
                      variant="ghost"
                      onPress={() => setShowPasteFallback((prev) => !prev)}
                      disabled={publishingImport}
                    />
                  </View>

                  {showPasteFallback ? (
                    <>
                      <TextInput
                        style={styles.csvInput}
                        placeholder="Paste CSV here as a fallback. Supported shapes: Beginning + Jamat, Adhan + Iqamah, or Adhan only. Required columns: date, fajr, dhuhr/zuhr, asr, maghrib, isha."
                        placeholderTextColor={tokens.color.text.muted}
                        value={pastedCsv}
                        onChangeText={setPastedCsv}
                        multiline
                        textAlignVertical="top"
                        editable={!disableForNoMosque && !publishingImport}
                      />

                      <View style={styles.pasteActions}>
                        <AppButton
                          title="Preview pasted CSV"
                          variant="ghost"
                          onPress={handlePreviewPastedCsv}
                          disabled={
                            disableForNoMosque ||
                            publishingImport ||
                            !pastedCsv.trim() ||
                            !hasValidFixedIqamaOffset ||
                            !hasValidManualDateContext
                          }
                        />
                        <AppText variant="caption" color={tokens.color.text.secondary}>
                          Bulk import is web-first. Mobile stays focused on quick corrections.
                        </AppText>
                      </View>
                    </>
                  ) : null}
                </AppCard>
              </View>
            ) : (
              <AppText variant="caption" color={tokens.color.text.secondary}>
                Smart auto-detect is active. Open import options only if the preview needs date help, a different import mode, or the paste fallback.
              </AppText>
            )}
          </AppCard>

          {importPreview ? (
            <View style={styles.previewSection}>
              <View style={styles.previewSummaryGrid}>
                <SummaryMetric
                  label="Valid rows"
                  value={String(importPreview.summary.validRows)}
                />
                <SummaryMetric
                  label="Invalid rows"
                  value={String(importPreview.summary.invalidRows)}
                />
                <SummaryMetric
                  label="Warnings"
                  value={String(importPreview.summary.warningCount)}
                />
                <SummaryMetric
                  label="Coverage"
                  value={formatCoverage(
                    importPreview.summary.startDate,
                    importPreview.summary.endDate
                  )}
                />
              </View>

              {importRecoveryTips.length ? (
                <AppCard subtle style={styles.recoveryCard}>
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    Smart guidance
                  </AppText>
                  <AppText variant="title" style={styles.previewTitle}>
                    The importer found the prayer columns. The next fix is interpretation.
                  </AppText>
                  <View style={styles.recoveryList}>
                    {importRecoveryTips.map((tip) => (
                      <View key={tip} style={styles.recoveryRow}>
                        <View style={styles.recoveryBullet} />
                        <AppText variant="caption" color={tokens.color.text.secondary} style={styles.recoveryText}>
                          {tip}
                        </AppText>
                      </View>
                    ))}
                  </View>
                  {!showImportConfigurator ? (
                    <AppButton
                      title="Open import options"
                      variant="ghost"
                      onPress={() => setShowImportConfigurator(true)}
                    />
                  ) : null}
                </AppCard>
              ) : null}

              <AppCard subtle style={styles.scopeCard}>
                <View style={styles.scopeHeader}>
                  <View style={styles.importCopy}>
                    <AppText variant="caption" color={tokens.color.text.secondary}>
                      Publish scope
                    </AppText>
                    <AppText variant="title" style={styles.previewTitle}>
                      Confirm whether this file is a month patch or a full year
                    </AppText>
                    <AppText variant="body" color={tokens.color.text.secondary}>
                      {coverageAnalysis?.detail ??
                        'Choose the timetable scope before publishing so the import history clearly records operator intent.'}
                    </AppText>
                  </View>
                  <View style={styles.scopeHintBadge}>
                    <AppText variant="caption" style={styles.scopeHintBadgeText}>
                      Recommended: {formatCoverageIntentLabel(coverageAnalysis?.recommendedIntent ?? 'date_range')}
                    </AppText>
                  </View>
                </View>
                <View style={styles.scopeOptionList}>
                  {COVERAGE_INTENT_OPTIONS.map((option) => {
                    const active = coverageIntent === option.id;
                    const recommended = coverageAnalysis?.recommendedIntent === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => {
                          setCoverageIntent(option.id);
                          setShowPublishReview(false);
                          setError(null);
                        }}
                        style={({ pressed }) => [
                          styles.scopeOption,
                          active && styles.scopeOptionActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.modeHeader}>
                          <AppText variant="body" style={styles.modeLabel}>
                            {option.label}
                          </AppText>
                          <View style={[styles.modeIndicator, active && styles.modeIndicatorActive]} />
                        </View>
                        <AppText variant="caption" color={tokens.color.text.secondary}>
                          {option.description}
                        </AppText>
                        {recommended ? (
                          <AppText variant="caption" style={styles.recommendedScopeText}>
                            Best fit for this preview
                          </AppText>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.scopeMetrics}>
                  <SummaryMetric
                    label="Rows to insert"
                    value={
                      loadingImportImpact
                        ? '...'
                        : String(importImpact?.inserts ?? importPreview.summary.validRows)
                    }
                  />
                  <SummaryMetric
                    label="Rows to overwrite"
                    value={loadingImportImpact ? '...' : String(importImpact?.updates ?? 0)}
                  />
                </View>
                {coverageIntentValidation.error ? (
                  <AppText variant="caption" color={tokens.color.status.danger}>
                    {coverageIntentValidation.error}
                  </AppText>
                ) : coverageIntentValidation.warning ? (
                  <AppText variant="caption" color={tokens.color.status.warning}>
                    {coverageIntentValidation.warning}
                  </AppText>
                ) : null}
                {!coverageIntent ? (
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    Publishing stays in review mode until you confirm the intended coverage for this mosque.
                  </AppText>
                ) : null}
              </AppCard>

              <AppCard subtle style={styles.previewModeCard}>
                <AppText variant="caption" color={tokens.color.text.secondary}>
                  Preview interpretation
                </AppText>
                <AppText variant="title" style={styles.previewTitle}>
                  {importModeReview.title}
                </AppText>
                <AppText variant="body" color={tokens.color.text.secondary}>
                  {importModeReview.description}
                </AppText>
                {importPreview.detection ? (
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    Auto-detected: {formatImportDetection(importPreview)}
                  </AppText>
                ) : null}
              </AppCard>

              <View style={[styles.workspaceGrid, isWeb ? styles.workspaceGridWeb : null]}>
                <AppCard subtle style={styles.previewCard}>
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    Preview source
                  </AppText>
                  <AppText variant="title" style={styles.previewTitle}>
                    {importPreview.fileName ?? 'Imported timetable'}
                  </AppText>
                  <AppText variant="body" color={tokens.color.text.secondary}>
                    {importModeReview.rowHint} Publishing writes only the valid rows into the
                    canonical prayer_times table.
                  </AppText>
                  {importPreview.columnMapping ? (
                    <AppText variant="caption" color={tokens.color.text.secondary}>
                      {formatImportColumnMapping(importPreview)}
                    </AppText>
                  ) : null}
                  <View style={styles.previewRows}>
                    {importPreview.validRows.slice(0, 4).map((row) => (
                      <PreviewRow key={row.date} row={row} />
                    ))}
                    {!importPreview.validRows.length ? (
                      <AppText variant="body" color={tokens.color.text.secondary}>
                        No valid rows are ready to publish yet.
                      </AppText>
                    ) : null}
                  </View>
                </AppCard>

                <AppCard subtle style={styles.previewCard}>
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    Validation
                  </AppText>
                  <AppText variant="title" style={styles.previewTitle}>
                    Validation summary
                  </AppText>
                  <AppText variant="body" color={tokens.color.text.secondary}>
                    {importPreview.summary.errorCount
                      ? `${importPreview.summary.errorCount} blocking issue${importPreview.summary.errorCount === 1 ? '' : 's'} must be fixed before publish.`
                      : importPreview.summary.warningCount
                        ? `${importPreview.summary.warningCount} warning${importPreview.summary.warningCount === 1 ? '' : 's'} detected. You can still publish after review.`
                        : 'No validation issues were detected.'}
                  </AppText>
                  {importPreview.issues.length ? (
                    <AppButton
                      title={showValidationDetails ? 'Hide issue details' : 'Show issue details'}
                      variant="ghost"
                      onPress={() => setShowValidationDetails((prev) => !prev)}
                    />
                  ) : null}
                  {showValidationDetails ? (
                    <View style={styles.issueList}>
                      {importPreview.issues.slice(0, 10).map((issue, index) => (
                        <View
                          key={`${issue.rowNumber ?? 'global'}-${index}`}
                          style={styles.issueRow}
                        >
                          <View
                            style={[
                              styles.issueDot,
                              issue.severity === 'warning'
                                ? styles.issueDotWarning
                                : styles.issueDotError,
                            ]}
                          />
                          <AppText
                            variant="caption"
                            color={tokens.color.text.secondary}
                            style={styles.issueText}
                          >
                            {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ''}
                            {issue.message}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </AppCard>
              </View>

              {showPublishReview ? (
                <AppCard subtle style={styles.publishReviewCard}>
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    Final confirmation
                  </AppText>
                  <AppText variant="title" style={styles.previewTitle}>
                    Confirm publish for {selectedMosque?.name ?? 'this mosque'}
                  </AppText>
                  <View style={styles.reviewList}>
                    <ReviewLine
                      label="File"
                      value={importPreview.fileName ?? 'Pasted CSV'}
                    />
                    <ReviewLine
                      label="Scope"
                      value={formatCoverageIntentLabel(coverageIntent ?? 'date_range')}
                    />
                    <ReviewLine
                      label="Coverage"
                      value={coverageAnalysis?.label ?? formatCoverage(importPreview.summary.startDate, importPreview.summary.endDate)}
                    />
                    <ReviewLine
                      label="Rows to write"
                      value={`${importPreview.summary.validRows} valid`}
                    />
                    <ReviewLine
                      label="Rows to overwrite"
                      value={String(importImpact?.updates ?? 0)}
                    />
                  </View>
                  <AppText variant="caption" color={tokens.color.text.secondary}>
                    Confirming publish writes the valid rows into the canonical prayer_times table and records this intent in import history.
                  </AppText>
                  <View style={styles.importActionRow}>
                    <AppButton
                      title="Cancel review"
                      variant="ghost"
                      onPress={() => setShowPublishReview(false)}
                      disabled={publishingImport}
                      style={styles.actionButton}
                    />
                    <AppButton
                      title={
                        publishingImport
                          ? `Publishing ${importPreview.summary.validRows} rows...`
                          : `Confirm publish for ${selectedMosque?.name ?? 'mosque'}`
                      }
                      onPress={handleConfirmPublishImport}
                      disabled={!canPublishImport}
                      style={styles.actionButton}
                    />
                  </View>
                </AppCard>
              ) : null}
            </View>
          ) : null}

          <AppCard subtle style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={styles.importCopy}>
                <AppText variant="caption" color={tokens.color.text.secondary}>
                  Import history
                </AppText>
                <AppText variant="title" style={styles.guideTitle}>
                  Recent published timetable changes
                </AppText>
                <AppText variant="body" color={tokens.color.text.secondary}>
                  Every publish now stores before and after snapshots so you can inspect
                  recent changes and roll back a mistaken upload safely.
                </AppText>
              </View>
              <AppButton
                title={showImportHistory ? 'Hide history' : 'Show history'}
                variant="ghost"
                onPress={() => setShowImportHistory((prev) => !prev)}
                disabled={historyLoading}
              />
            </View>

            {showImportHistory ? (
              historyLoading ? (
                <AppText variant="body" color={tokens.color.text.secondary}>
                  Loading recent imports...
                </AppText>
              ) : importHistory.length ? (
                <View style={styles.historyList}>
                  {importHistory.map((record) => (
                    <ImportHistoryRow
                      key={record.id}
                      record={record}
                      onRollback={handleRollbackImport}
                      rollingBack={rollingBackImportId === record.id}
                    />
                  ))}
                </View>
              ) : (
                <AppText variant="body" color={tokens.color.text.secondary}>
                  No published timetable imports have been recorded for this mosque yet.
                </AppText>
              )
            ) : (
              <AppText variant="caption" color={tokens.color.text.secondary}>
                Keep history collapsed until you need to inspect a previous publish or roll back a mistake.
              </AppText>
            )}
          </AppCard>
        </AppCard>
      ) : isWeb ? (
        <AppCard subtle style={styles.mobileHintCard}>
          <AppText variant="caption" color={tokens.color.text.secondary}>
            Timetable publishing
          </AppText>
          <AppText variant="title" style={styles.mobileHintTitle}>
            Main Admin owns timetable uploads
          </AppText>
          <AppText variant="body" color={tokens.color.text.secondary}>
            Use this screen for local day-level corrections only. Bulk CSV imports, review, publish,
            and rollback are now restricted to Main Admin so each mosque timetable is normalized
            through one controlled pipeline.
          </AppText>
        </AppCard>
      ) : (
        <AppCard subtle style={styles.mobileHintCard}>
          <AppText variant="caption" color={tokens.color.text.secondary}>
            Bulk import
          </AppText>
          <AppText variant="title" style={styles.mobileHintTitle}>
            Use the web portal for annual timetable uploads
          </AppText>
          <AppText variant="body" color={tokens.color.text.secondary}>
            This mobile screen stays optimized for quick day edits and corrections.
            Use the web workspace to import, validate, and publish full timetables.
          </AppText>
        </AppCard>
      )}

      <AppCard subtle style={styles.manualSectionShell}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeader}>
            <AppText variant="caption" color={tokens.color.text.secondary}>
              Quick edit
            </AppText>
            <AppText variant="title" style={styles.sectionTitle}>
              Manual daily override
            </AppText>
          </View>
          {canManageImports ? (
            <AppButton
              title={showManualOverrideTools ? 'Hide day editor' : 'Open day editor'}
              variant="ghost"
              onPress={() => setShowManualOverrideTools((prev) => !prev)}
            />
          ) : null}
        </View>
        {showManualOverrideTools || !canManageImports ? (
          <>
            {loading ? (
              <View style={styles.loader}>
                <ActivityIndicator />
                <AppText variant="body" style={styles.feedbackText}>
                  Loading prayer times...
                </AppText>
              </View>
            ) : (
              prayers.map((p) => (
                <AppCard key={p.key} style={[styles.card, disableForNoMosque && styles.cardDisabled]}>
                  <View style={styles.cardHeader}>
                    <AppText variant="title">{p.label}</AppText>
                    <AppText variant="caption" color={tokens.color.text.secondary}>
                      Adjust one day at a time when the imported schedule needs a correction.
                    </AppText>
                  </View>
                  <View style={styles.row}>
                    <AppText variant="body" color={tokens.color.text.secondary} style={styles.label}>
                      Adhan
                    </AppText>
                    <TimeButton
                      label={form[p.key].adhan}
                      onPress={() => openTimePicker(p.key, 'adhan')}
                      disabled={disableForNoMosque}
                    />
                  </View>
                  <View style={styles.row}>
                    <AppText variant="body" color={tokens.color.text.secondary} style={styles.label}>
                      Iqama
                    </AppText>
                    <TimeButton
                      label={form[p.key].iqama}
                      onPress={() => openTimePicker(p.key, 'iqama')}
                      disabled={disableForNoMosque}
                    />
                  </View>
                </AppCard>
              ))
            )}

            <View style={styles.actionRow}>
              <AppButton
                title={saving ? 'Saving...' : 'Save Day Override'}
                onPress={handleSave}
                disabled={saving || disableForNoMosque}
              />
            </View>
          </>
        ) : (
          <AppText variant="body" color={tokens.color.text.secondary}>
            Keep this collapsed during bulk uploads. Open it only when a specific live date needs a manual correction.
          </AppText>
        )}
      </AppCard>

      {pickerState && pickerValue && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          onChange={handleTimePicked}
          display="default"
        />
      ) : null}

      {pickerState && pickerValue && Platform.OS === 'ios' ? (
        <Modal
          transparent
          visible={showPicker}
          animationType="fade"
          onRequestClose={() => closePicker(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => closePicker(false)} />
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={pickerValue}
              mode="time"
              onChange={handleTimePicked}
              display="spinner"
              textColor="#0F172A"
              themeVariant="light"
              accentColor="#0EA5E9"
              style={styles.iosPicker}
            />
            <View style={styles.pickerActions}>
              <Pressable
                onPress={() => closePicker(false)}
                style={({ pressed }) => [styles.pickerBtn, pressed && styles.pressed]}
              >
                <AppText variant="body" style={styles.pickerBtnText}>
                  Cancel
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => closePicker(true)}
                style={({ pressed }) => [styles.pickerBtnPrimary, pressed && styles.pressed]}
              >
                <AppText
                  variant="body"
                  color={tokens.color.text.inverse}
                  style={styles.pickerBtnText}
                >
                  Done
                </AppText>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </AdminScreenShell>
  );
}

function buildImportOptions(
  mode: PrayerScheduleImportMode,
  fixedIqamaOffsetMinutes: string,
  useManualDateContext: boolean,
  manualContextMonth: string,
  manualContextYear: string
) {
  const parsedOffset = parseInt(fixedIqamaOffsetMinutes, 10);
  return {
    mode,
    fixedIqamaOffsetMinutes:
      mode === 'adhan_plus_fixed_offset' && Number.isFinite(parsedOffset) && parsedOffset > 0
        ? parsedOffset
        : null,
    dateContext: buildManualDateContext(useManualDateContext, manualContextMonth, manualContextYear),
  };
}

function resolveImportOptionsOrError(
  mode: PrayerScheduleImportMode,
  fixedIqamaOffsetMinutes: string,
  useManualDateContext: boolean,
  manualContextMonth: string,
  manualContextYear: string
) {
  if (mode !== 'adhan_plus_fixed_offset') {
    const options = buildImportOptions(
      mode,
      fixedIqamaOffsetMinutes,
      useManualDateContext,
      manualContextMonth,
      manualContextYear
    );
    if (useManualDateContext && !options.dateContext) {
      Alert.alert('Month and year required', 'Enter a valid month and year to help the importer resolve dates.');
      return null;
    }
    return options;
  }

  if (!isPositiveInteger(fixedIqamaOffsetMinutes)) {
    Alert.alert('Offset required', 'Enter a valid positive iqamah offset in minutes.');
    return null;
  }

  const options = buildImportOptions(
    mode,
    fixedIqamaOffsetMinutes,
    useManualDateContext,
    manualContextMonth,
    manualContextYear
  );
  if (useManualDateContext && !options.dateContext) {
    Alert.alert('Month and year required', 'Enter a valid month and year to help the importer resolve dates.');
    return null;
  }
  return options;
}

function isPositiveInteger(value: string) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0;
}

function getImportModeReview(
  mode: PrayerScheduleImportMode,
  fixedIqamaOffsetMinutes: string
) {
  const parsedOffset = parseInt(fixedIqamaOffsetMinutes, 10);
  const offsetLabel = Number.isFinite(parsedOffset) && parsedOffset > 0 ? `${parsedOffset}` : '--';

  switch (mode) {
    case 'smart_auto':
      return {
        title: 'The importer will keep any iqamah columns it finds',
        description:
          'Use this for most mosque files. If the timetable contains jamaat columns they will be published. If it only contains adhan or beginning times, iqamah stays blank rather than failing the upload.',
        rowHint:
          'Rows below reflect the times the importer could confidently recognize. Missing iqamah values are acceptable in this mode.',
      };
    case 'adhan_only':
      return {
        title: 'Only adhan times will be published',
        description:
          'Blank iqamah values in the preview are expected in this mode. They will stay empty until they are filled later through a quick edit or another import.',
        rowHint:
          'Rows below should show adhan times only. Empty iqamah slots are intentional in this review.',
      };
    case 'adhan_plus_fixed_offset':
      return {
        title: `Iqamah will be generated at +${offsetLabel} minutes from adhan`,
        description:
          'The preview already includes the derived iqamah values. Review a few rows carefully to confirm the generated offset matches how this mosque actually operates.',
        rowHint:
          'Rows below show the generated iqamah values next to each adhan time so you can confirm the offset before publish.',
      };
    case 'explicit_iqama':
    default:
      return {
        title: 'Iqamah will be read directly from the timetable',
        description:
          'Use this when the file includes jamaat or iqamah columns. The preview should mirror the adhan and iqamah pairs supplied by the mosque timetable.',
        rowHint:
          'Rows below should match the timetable columns directly, including any explicit iqamah values.',
      };
  }
}

function formatImportMode(record: PrayerScheduleImportRecord) {
  if (record.source_type === 'rollback') {
    return 'Rollback record';
  }

  const metadata =
    record.metadata && typeof record.metadata === 'object'
      ? (record.metadata as Record<string, unknown>)
      : null;
  const effectiveImportMode =
    record.import_mode ??
    (typeof metadata?.import_mode_requested === 'string'
      ? (metadata.import_mode_requested as PrayerScheduleImportMode)
      : null);

  if (effectiveImportMode === 'smart_auto') {
    return 'Smart auto-detect import';
  }

  if (effectiveImportMode === 'adhan_only') {
    return 'Adhan only import';
  }

  if (effectiveImportMode === 'adhan_plus_fixed_offset') {
    return `Adhan + fixed iqamah offset (${record.fixed_iqama_offset_minutes ?? '--'} min)`;
  }

  return 'Explicit iqamah import';
}

function formatImportScope(record: PrayerScheduleImportRecord) {
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== 'object') return null;

  const label = metadata.coverageIntentLabel;
  const analysis = metadata.coverageAnalysis;
  if (typeof label === 'string' && analysis && typeof analysis === 'object' && typeof (analysis as Record<string, unknown>).label === 'string') {
    return `Scope: ${label} • ${(analysis as Record<string, string>).label}`;
  }
  if (typeof label === 'string') {
    return `Scope: ${label}`;
  }
  return null;
}

function formatImportCoverage(record: PrayerScheduleImportRecord) {
  if (record.coverage_start_date && record.coverage_end_date) {
    return `Coverage: ${record.coverage_start_date} to ${record.coverage_end_date}`;
  }

  if (record.coverage_start_date) {
    return `Coverage starts ${record.coverage_start_date}`;
  }

  return `${record.valid_rows} valid rows published`;
}

function formatImportTimestamp(record: PrayerScheduleImportRecord) {
  const stamp = record.published_at ?? record.created_at ?? null;
  if (!stamp) return `Rows: ${record.valid_rows} valid, ${record.invalid_rows} invalid`;

  return `${formatDateTime(stamp)} · ${record.valid_rows} valid · ${record.warning_count} warnings`;
}

function formatImportStatus(status: PrayerScheduleImportRecord['status']) {
  switch (status) {
    case 'published':
      return 'Published';
    case 'rolled_back':
      return 'Rolled back';
    case 'failed':
      return 'Failed';
    case 'pending':
    default:
      return 'Pending';
  }
}

function getImportStatusTone(status: PrayerScheduleImportRecord['status']) {
  switch (status) {
    case 'published':
      return {
        container: styles.historyStatusPublished,
        text: styles.historyStatusPublishedText,
      };
    case 'rolled_back':
      return {
        container: styles.historyStatusRolledBack,
        text: styles.historyStatusRolledBackText,
      };
    case 'failed':
      return {
        container: styles.historyStatusFailed,
        text: styles.historyStatusFailedText,
      };
    case 'pending':
    default:
      return {
        container: styles.historyStatusPending,
        text: styles.historyStatusPendingText,
      };
  }
}

function mapRowToForm(row: PrayerTimesRow): PrayerTimeForm {
  return {
    fajr: { adhan: toHm(row.fajr_adhan_time), iqama: toHm(row.fajr_iqama_time) },
    dhuhr: { adhan: toHm(row.dhuhr_adhan_time), iqama: toHm(row.dhuhr_iqama_time) },
    asr: { adhan: toHm(row.asr_adhan_time), iqama: toHm(row.asr_iqama_time) },
    maghrib: { adhan: toHm(row.maghrib_adhan_time), iqama: toHm(row.maghrib_iqama_time) },
    isha: { adhan: toHm(row.isha_adhan_time), iqama: toHm(row.isha_iqama_time) },
  };
}

function mapNormalizedToForm(
  normalized: Awaited<ReturnType<typeof getDailyPrayerTimes>>
): PrayerTimeForm {
  const toHmDate = (value?: Date | null) => {
    if (!value) return null;
    const hh = value.getHours().toString().padStart(2, '0');
    const mm = value.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  return {
    fajr: {
      adhan: toHmDate(normalized?.fajr?.adhan ?? null),
      iqama: toHmDate(normalized?.fajr?.iqama ?? null),
    },
    dhuhr: {
      adhan: toHmDate(normalized?.dhuhr?.adhan ?? null),
      iqama: toHmDate(normalized?.dhuhr?.iqama ?? null),
    },
    asr: {
      adhan: toHmDate(normalized?.asr?.adhan ?? null),
      iqama: toHmDate(normalized?.asr?.iqama ?? null),
    },
    maghrib: {
      adhan: toHmDate(normalized?.maghrib?.adhan ?? null),
      iqama: toHmDate(normalized?.maghrib?.iqama ?? null),
    },
    isha: {
      adhan: toHmDate(normalized?.isha?.adhan ?? null),
      iqama: toHmDate(normalized?.isha?.iqama ?? null),
    },
  };
}

function mapFormToRow(form: PrayerTimeForm, date: Date): Partial<PrayerTimesRow> {
  return {
    fajr_adhan_time: combine(date, form.fajr.adhan),
    fajr_iqama_time: combine(date, form.fajr.iqama),
    dhuhr_adhan_time: combine(date, form.dhuhr.adhan),
    dhuhr_iqama_time: combine(date, form.dhuhr.iqama),
    asr_adhan_time: combine(date, form.asr.adhan),
    asr_iqama_time: combine(date, form.asr.iqama),
    maghrib_adhan_time: combine(date, form.maghrib.adhan),
    maghrib_iqama_time: combine(date, form.maghrib.iqama),
    isha_adhan_time: combine(date, form.isha.adhan),
    isha_iqama_time: combine(date, form.isha.iqama),
  };
}

function toHm(val?: string | null) {
  if (!val) return null;
  const d = new Date(val);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function combine(day: Date, hm: string | null) {
  if (!hm) return null;
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function buildPickerValue(hm: string | null, baseDate: Date) {
  const d = new Date(baseDate);
  if (hm) {
    const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
    d.setHours(h, m, 0, 0);
  }
  return d;
}

function formatScheduleSource(row: PrayerTimesRow) {
  if (row.generated_method?.startsWith('csv_upload')) {
    return 'Uploaded timetable published';
  }
  if (row.source_type === 'manual') return 'Manual override published';
  if (row.source_type === 'upload') return 'Uploaded timetable published';
  if (row.source_type === 'auto') return 'Auto-generated schedule published';
  return 'Published schedule loaded';
}

function formatCoverage(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return 'No range';
  if (startDate === endDate) return startDate;
  return `${startDate} to ${endDate}`;
}

function getImportRecoveryTips(preview: PrayerSchedulePreview | null) {
  if (!preview) return [] as string[];

  const tips: string[] = [];
  const mappedPrayerCount = prayers.filter(
    (prayer) => preview.columnMapping?.prayers[prayer.key]?.adhan
  ).length;

  if (!preview.summary.validRows && !preview.detection?.dateSource) {
    tips.push(
      'This file already looks like a valid prayer-time table. The blocker is calendar context, so keep Smart auto-detect and either leave the month and year in the file name or turn on Date help and set them manually.'
    );
  }

  if (!preview.summary.validRows && !preview.detection?.dateSourceLabel) {
    tips.push(
      'Files that only contain a day column are supported. A file name like March2026 or prayer_times_March2026 gives the importer the month and year it needs.'
    );
  }

  if (mappedPrayerCount >= 5) {
    tips.push(
      'The core prayer columns have already been recognized, so you should not need to rename headers like fajr_start, fajr_jamaah, dhuhr_start, or isha_jamaah.'
    );
  }

  if ((preview.detection?.headerRows.length ?? 0) > 1) {
    tips.push(
      'Helper rows such as Start and Jama\'ah can stay in the file. The importer now favors the first explicit header row and only uses the second row when it adds missing meaning.'
    );
  }

  return Array.from(new Set(tips)).slice(0, 3);
}

function normalizeDateKey(value: string | null | undefined) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

function formatCoverageIntentLabel(intent: CoverageIntent) {
  switch (intent) {
    case 'single_month':
      return 'Single month';
    case 'full_year':
      return 'Full year';
    case 'date_range':
    default:
      return 'Date-range patch';
  }
}

function analyzeCoverage(preview: PrayerSchedulePreview | null): CoverageAnalysis | null {
  if (!preview?.validRows.length || !preview.summary.startDate || !preview.summary.endDate) {
    return null;
  }

  const start = new Date(`${preview.summary.startDate}T00:00:00`);
  const end = new Date(`${preview.summary.endDate}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return null;
  }

  const uniqueDates = Array.from(new Set(preview.validRows.map((row) => row.date))).sort();
  const daysCovered = uniqueDates.length;
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const expectedMonthDays = sameMonth ? daysInMonth(start.getFullYear(), start.getMonth()) : null;
  const isCompleteMonth =
    sameMonth &&
    start.getDate() === 1 &&
    end.getDate() === (expectedMonthDays ?? end.getDate()) &&
    daysCovered >= (expectedMonthDays ?? daysCovered);
  const expectedYearDays = daysInYear(start.getFullYear());
  const isFullYear =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === 0 &&
    start.getDate() === 1 &&
    end.getMonth() === 11 &&
    end.getDate() === 31 &&
    daysCovered >= expectedYearDays;
  const monthLabel = sameMonth ? formatMonthYear(start) : null;
  const yearLabel = start.getFullYear() === end.getFullYear() ? String(start.getFullYear()) : null;

  if (isFullYear) {
    return {
      recommendedIntent: 'full_year',
      label: `Full year ${yearLabel ?? start.getFullYear()}`,
      detail: `This preview looks like a full-year timetable for ${yearLabel ?? start.getFullYear()} and covers ${daysCovered} dates.`,
      isSingleMonth: false,
      isCompleteMonth: false,
      isFullYear: true,
      monthLabel: null,
      yearLabel,
      daysCovered,
      expectedDayCount: expectedYearDays,
    };
  }

  if (sameMonth) {
    return {
      recommendedIntent: 'single_month',
      label: monthLabel ?? 'Single month',
      detail: isCompleteMonth
        ? `This preview looks like a complete monthly timetable for ${monthLabel} and covers ${daysCovered} dates.`
        : `This preview stays within ${monthLabel} but covers ${daysCovered} of ${expectedMonthDays ?? '--'} dates.`,
      isSingleMonth: true,
      isCompleteMonth,
      isFullYear: false,
      monthLabel,
      yearLabel,
      daysCovered,
      expectedDayCount: expectedMonthDays,
    };
  }

  return {
    recommendedIntent: 'date_range',
    label: formatCoverage(preview.summary.startDate, preview.summary.endDate),
    detail: `This preview spans ${preview.summary.startDate} to ${preview.summary.endDate} across ${daysCovered} dates, so it should be treated as a date-range patch unless you upload a full year.`,
    isSingleMonth: false,
    isCompleteMonth: false,
    isFullYear: false,
    monthLabel: null,
    yearLabel,
    daysCovered,
    expectedDayCount: null,
  };
}

function validateCoverageIntentSelection(
  intent: CoverageIntent | null,
  analysis: CoverageAnalysis | null
) {
  if (!intent) {
    return { valid: false, error: null as string | null, warning: null as string | null };
  }

  if (!analysis) {
    return { valid: true, error: null as string | null, warning: null as string | null };
  }

  if (intent === 'full_year' && !analysis.isFullYear) {
    return {
      valid: false,
      error: `This file does not cover a full calendar year. It currently looks like ${analysis.label}. Choose Date-range patch or upload the missing months.`,
      warning: null as string | null,
    };
  }

  if (intent === 'single_month' && !analysis.isSingleMonth) {
    return {
      valid: false,
      error: 'Single month can only be used when the preview stays within one calendar month. Choose Date-range patch for multi-month files.',
      warning: null as string | null,
    };
  }

  if (intent === 'single_month' && analysis.isSingleMonth && !analysis.isCompleteMonth) {
    return {
      valid: true,
      error: null as string | null,
      warning: `This file stays inside ${analysis.monthLabel ?? 'one month'} but does not cover every date in that month. Use Date-range patch instead if this is only a partial replacement.`,
    };
  }

  if (intent === 'date_range' && analysis.isFullYear) {
    return {
      valid: true,
      error: null as string | null,
      warning: 'This preview already looks like a full year. Choose Full year instead if this should become the mosque’s canonical annual timetable.',
    };
  }

  return { valid: true, error: null as string | null, warning: null as string | null };
}

function formatImportDetection(preview: PrayerSchedulePreview) {
  const detection = preview.detection;
  if (!detection) return 'Standard CSV layout';

  const parts = [
    `${formatDelimiterLabel(detection.delimiter)} delimiter`,
    detection.headerRows.length
      ? `header row${detection.headerRows.length > 1 ? 's' : ''} ${detection.headerRows.join(', ')}`
      : null,
    detection.dateSourceLabel ? `date source ${detection.dateSourceLabel}` : null,
    detection.monthYearContext ? `context ${detection.monthYearContext}` : null,
  ].filter(Boolean);

  return parts.join(' | ');
}

function formatImportColumnMapping(preview: PrayerSchedulePreview) {
  const mapping = preview.columnMapping;
  if (!mapping) return 'Prayer columns were auto-mapped.';

  const mappedPrayers = prayers
    .map((prayer) => {
      const prayerMapping = mapping.prayers[prayer.key];
      if (!prayerMapping?.adhan) return null;
      return prayerMapping.iqama
        ? `${prayer.label}: ${prayerMapping.adhan} / ${prayerMapping.iqama}`
        : `${prayer.label}: ${prayerMapping.adhan}`;
    })
    .filter(Boolean);

  if (!mappedPrayers.length) return 'Prayer columns were auto-mapped.';
  return `Mapped columns: ${mappedPrayers.join(' | ')}`;
}

function formatDelimiterLabel(delimiter: NonNullable<PrayerSchedulePreview['detection']>['delimiter']) {
  switch (delimiter) {
    case 'semicolon':
      return 'Semicolon';
    case 'tab':
      return 'Tab';
    case 'pipe':
      return 'Pipe';
    case 'comma':
    default:
      return 'Comma';
  }
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildManualDateContext(
  enabled: boolean,
  month: string,
  year: string
) {
  if (!enabled) return null;
  const parsedMonth = parseInt(month, 10);
  const parsedYear = parseInt(year, 10);
  if (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return null;
  if (!Number.isFinite(parsedYear) || parsedYear < 2000 || parsedYear > 2100) return null;
  const monthLabel = MONTH_OPTIONS.find((option) => option.value === parsedMonth.toString().padStart(2, '0'))?.label;
  return {
    month: parsedMonth,
    year: parsedYear,
    label: monthLabel ? `${monthLabel} ${parsedYear}` : `${parsedYear}-${parsedMonth.toString().padStart(2, '0')}`,
  };
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function daysInYear(year: number) {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMetric}>
      <AppText variant="caption" color={tokens.color.text.secondary}>
        {label}
      </AppText>
      <AppText variant="title" style={styles.summaryMetricValue}>
        {value}
      </AppText>
    </View>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewLine}>
      <AppText variant="caption" color={tokens.color.text.secondary}>
        {label}
      </AppText>
      <AppText variant="body" style={styles.reviewLineValue}>
        {value}
      </AppText>
    </View>
  );
}

function WorkflowStep({
  step,
  title,
  description,
  active,
}: {
  step: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <View style={[styles.workflowStep, active ? styles.workflowStepActive : null]}>
      <View style={[styles.workflowBadge, active ? styles.workflowBadgeActive : null]}>
        <AppText variant="caption" style={[styles.workflowBadgeText, active ? styles.workflowBadgeTextActive : null]}>
          {step}
        </AppText>
      </View>
      <View style={styles.workflowCopy}>
        <AppText variant="body" style={styles.modeLabel}>
          {title}
        </AppText>
        <AppText variant="caption" color={tokens.color.text.secondary}>
          {description}
        </AppText>
      </View>
    </View>
  );
}

function GuideBlock({
  title,
  description,
  items,
  tone,
}: {
  title: string;
  description: string;
  items: string[];
  tone: 'info' | 'success' | 'warning' | 'muted';
}) {
  return (
    <View
      style={[
        styles.guideBlock,
        tone === 'info'
          ? styles.guideBlockInfo
          : tone === 'success'
            ? styles.guideBlockSuccess
            : tone === 'warning'
              ? styles.guideBlockWarning
              : styles.guideBlockMuted,
      ]}
    >
      <View style={styles.importCopy}>
        <AppText variant="title" style={styles.guideTitle}>
          {title}
        </AppText>
        <AppText variant="caption" color={tokens.color.text.secondary}>
          {description}
        </AppText>
      </View>
      <View style={styles.guideItems}>
        {items.map((item) => (
          <View key={item} style={styles.guideChip}>
            <AppText variant="caption" style={styles.guideChipText}>
              {item}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function PreviewRow({ row }: { row: PrayerSchedulePreviewRow }) {
  return (
    <View style={styles.previewRow}>
      <AppText variant="body" style={styles.previewRowDate}>
        {row.date}
      </AppText>
      <AppText variant="caption" color={tokens.color.text.secondary}>
        Fajr {formatSlot(row.fajr)} | Dhuhr {formatSlot(row.dhuhr)} | Asr {formatSlot(row.asr)}
      </AppText>
      <AppText variant="caption" color={tokens.color.text.secondary}>
        Maghrib {formatSlot(row.maghrib)} | Isha {formatSlot(row.isha)}
      </AppText>
    </View>
  );
}

function ImportHistoryRow({
  record,
  onRollback,
  rollingBack,
}: {
  record: PrayerScheduleImportRecord;
  onRollback: (record: PrayerScheduleImportRecord) => void;
  rollingBack: boolean;
}) {
  const canRollback = record.status === 'published' && record.source_type !== 'rollback';
  const statusTone = getImportStatusTone(record.status);

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyMeta}>
        <View style={styles.historyTopRow}>
          <AppText variant="body" style={styles.historyTitle}>
            {record.source_label ?? 'Published timetable'}
          </AppText>
          <View style={[styles.historyStatus, statusTone.container]}>
            <AppText variant="caption" style={[styles.historyStatusText, statusTone.text]}>
              {formatImportStatus(record.status)}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" color={tokens.color.text.secondary}>
          {formatImportMode(record)}
        </AppText>
        {formatImportScope(record) ? (
          <AppText variant="caption" color={tokens.color.text.secondary}>
            {formatImportScope(record)}
          </AppText>
        ) : null}
        <AppText variant="caption" color={tokens.color.text.secondary}>
          {formatImportCoverage(record)}
        </AppText>
        <AppText variant="caption" color={tokens.color.text.secondary}>
          {formatImportTimestamp(record)}
        </AppText>
      </View>
      {canRollback ? (
        <AppButton
          title={rollingBack ? 'Rolling back...' : 'Rollback'}
          variant="ghost"
          onPress={() => onRollback(record)}
          disabled={rollingBack}
        />
      ) : null}
    </View>
  );
}

function formatSlot(slot: { adhan: string | null; iqama: string | null }) {
  if (!slot.adhan && !slot.iqama) return '--';
  if (slot.adhan && slot.iqama) return `${slot.adhan} / ${slot.iqama}`;
  return slot.adhan ?? slot.iqama ?? '--';
}

function TimeButton({
  label,
  onPress,
  disabled,
}: {
  label: string | null;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.timeBtn,
        pressed && !disabled && styles.pressed,
        disabled && styles.cardDisabled,
      ]}
    >
      <AppText variant="body" style={styles.timeText}>
        {label ?? '--:--'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  pressed: { opacity: 0.9 },
  feedbackText: { marginTop: 8 },
  workspaceGrid: { gap: tokens.spacing.sm },
  workspaceGridWeb: { flexDirection: 'row', alignItems: 'stretch' },
  utilityCard: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: 16,
    flex: 1,
  },
  statusCard: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: 16,
    flex: 1,
  },
  compactManualCard: { gap: 8, borderRadius: 18 },
  utilityHeader: { gap: 2 },
  statusValue: { fontWeight: tokens.typography.weight.extrabold },
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#E6F6FF',
  },
  sourceBadgeText: { color: '#0369A1', fontWeight: tokens.typography.weight.bold },
  importCard: { gap: tokens.spacing.sm, padding: tokens.spacing.sm, borderRadius: 18 },
  importOptionsShell: { gap: tokens.spacing.sm, borderRadius: 16 },
  importOptionsHeader: {
    gap: 10,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
  },
  importOptionsContent: { gap: tokens.spacing.sm },
  workflowStrip: {
    gap: 10,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  workflowStep: {
    flex: 1,
    minWidth: 180,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FCFDFE',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  workflowStepActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#EAF7FF',
  },
  workflowBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workflowBadgeActive: {
    backgroundColor: '#0EA5E9',
  },
  workflowBadgeText: {
    color: '#475569',
    fontWeight: tokens.typography.weight.extrabold,
  },
  workflowBadgeTextActive: {
    color: '#FFFFFF',
  },
  workflowCopy: {
    flex: 1,
    gap: 4,
  },
  modeCard: { gap: tokens.spacing.sm, borderRadius: 16 },
  modeList: {
    gap: 10,
  },
  modeOption: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E1EC',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  modeOptionActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#EAF7FF',
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modeLabel: {
    fontWeight: tokens.typography.weight.extrabold,
  },
  modeIndicator: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },
  modeIndicatorActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#0EA5E9',
  },
  offsetRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    justifyContent: 'space-between',
    gap: 12,
  },
  offsetInput: {
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E1EC',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    textAlign: 'center',
    fontWeight: tokens.typography.weight.bold,
  },
  contextAssistCard: {
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FBFD',
  },
  contextAssistHeader: {
    gap: 10,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
  },
  contextAssistInputs: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 10,
  },
  contextField: {
    flex: 1,
    gap: 6,
  },
  contextInput: {
    borderWidth: 1,
    borderColor: '#D8E1EC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  guideCard: { gap: tokens.spacing.sm, borderRadius: 16 },
  guideHeader: { gap: tokens.spacing.sm },
  guideTitle: { fontSize: 18, lineHeight: 22 },
  templateActions: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 10,
    flexWrap: 'wrap',
  },
  guideGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  guideBlock: {
    minWidth: 220,
    flexGrow: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  guideBlockInfo: {
    backgroundColor: '#F5FAFF',
    borderColor: '#D9ECFF',
  },
  guideBlockSuccess: {
    backgroundColor: '#F3FBF6',
    borderColor: '#D5F1DF',
  },
  guideBlockWarning: {
    backgroundColor: '#FFF9ED',
    borderColor: '#FBE3B0',
  },
  guideBlockMuted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  guideItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guideChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E1EC',
  },
  guideChipText: {
    fontWeight: tokens.typography.weight.bold,
    color: '#0F172A',
  },
  sampleSection: {
    gap: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#0F172A',
  },
  codeLine: {
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 13,
    lineHeight: 18,
  },
  importHeader: { gap: tokens.spacing.sm },
  importCopy: { gap: 4 },
  importDescription: { lineHeight: 20 },
  targetMosqueBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#EAF7FF',
    borderWidth: 1,
    borderColor: '#CFEAFF',
  },
  targetMosqueBadgeText: {
    color: '#075985',
    fontWeight: tokens.typography.weight.bold,
  },
  importActionRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    minWidth: Platform.OS === 'web' ? 180 : undefined,
  },
  csvInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#D8E1EC',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FCFDFE',
    color: '#0F172A',
  },
  pasteActions: {
    gap: 10,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
  },
  pasteFallbackCard: {
    gap: tokens.spacing.sm,
    borderRadius: 16,
  },
  pasteFallbackHeader: {
    gap: 10,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
  },
  previewSection: { gap: tokens.spacing.sm },
  previewSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryMetric: {
    minWidth: 140,
    flexGrow: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: '#E4EEF5',
    gap: 4,
  },
  summaryMetricValue: { fontSize: 18, lineHeight: 22 },
  scopeCard: { gap: 10, borderRadius: 16 },
  scopeHeader: {
    gap: 10,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'flex-start' : 'stretch',
  },
  scopeHintBadge: {
    alignSelf: Platform.OS === 'web' ? 'flex-start' : 'stretch',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#F3FBF6',
    borderWidth: 1,
    borderColor: '#D5F1DF',
  },
  scopeHintBadgeText: {
    color: '#166534',
    fontWeight: tokens.typography.weight.bold,
  },
  scopeOptionList: { gap: 10 },
  scopeOption: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E1EC',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  scopeOptionActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#EAF7FF',
  },
  recommendedScopeText: {
    color: '#166534',
    fontWeight: tokens.typography.weight.bold,
  },
  scopeMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewModeCard: { gap: 6, borderRadius: 16 },
  previewCard: { gap: 8, flex: 1, borderRadius: 16 },
  previewTitle: { fontSize: 18, lineHeight: 22 },
  recoveryCard: {
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#F6FBFF',
    borderWidth: 1,
    borderColor: '#D9ECFF',
  },
  recoveryList: { gap: 8 },
  recoveryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  recoveryBullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 4,
    backgroundColor: '#0EA5E9',
  },
  recoveryText: { flex: 1, lineHeight: 18 },
  previewRows: { gap: 8 },
  previewRow: {
    gap: 4,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EEF7',
  },
  previewRowDate: { fontWeight: tokens.typography.weight.extrabold },
  issueList: { gap: 8 },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  issueDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 4,
  },
  issueDotError: { backgroundColor: '#DC2626' },
  issueDotWarning: { backgroundColor: '#D97706' },
  issueText: { flex: 1, lineHeight: 18 },
  publishReviewCard: { gap: 10, borderRadius: 16 },
  reviewList: { gap: 8 },
  reviewLine: {
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EEF7',
  },
  reviewLineValue: {
    fontWeight: tokens.typography.weight.extrabold,
  },
  historyCard: { gap: tokens.spacing.sm, borderRadius: 16 },
  historyHeader: { gap: 6 },
  historyList: { gap: 10 },
  historyRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EEF7',
    backgroundColor: '#FFFFFF',
    gap: 10,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
  },
  historyMeta: { gap: 4, flex: 1 },
  historyTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyTitle: { fontWeight: tokens.typography.weight.extrabold, flexShrink: 1 },
  historyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
  },
  historyStatusText: { fontWeight: tokens.typography.weight.bold },
  historyStatusPublished: { backgroundColor: '#ECFDF3', borderColor: '#CDEFD8' },
  historyStatusPublishedText: { color: '#047857' },
  historyStatusRolledBack: { backgroundColor: '#EFF6FF', borderColor: '#D7E7FF' },
  historyStatusRolledBackText: { color: '#1D4ED8' },
  historyStatusFailed: { backgroundColor: '#FEF2F2', borderColor: '#FBCACA' },
  historyStatusFailedText: { color: '#B91C1C' },
  historyStatusPending: { backgroundColor: '#FFF7ED', borderColor: '#FDD7AA' },
  historyStatusPendingText: { color: '#C2410C' },
  mobileHintCard: { gap: 6, borderRadius: 18 },
  mobileHintTitle: { fontSize: 18, lineHeight: 22 },
  manualSectionShell: { gap: tokens.spacing.sm, borderRadius: 18 },
  sectionHeaderRow: {
    gap: 10,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
  },
  sectionHeader: { gap: 2, marginTop: 2 },
  sectionTitle: { fontSize: 17, lineHeight: 22 },
  actionRow: { marginTop: tokens.spacing.xs },
  loader: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  card: { gap: tokens.spacing.xs, padding: tokens.spacing.sm, borderRadius: 16 },
  cardDisabled: { opacity: 0.6 },
  cardHeader: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontWeight: tokens.typography.weight.bold },
  timeBtn: {
    minWidth: 88,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.md,
    backgroundColor: '#F5F9FC',
    borderWidth: 1,
    borderColor: '#E0E7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: { fontWeight: tokens.typography.weight.extrabold, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  pickerWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '30%',
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  iosPicker: {
    height: 216,
    alignSelf: 'stretch',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  pickerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  pickerBtnPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0EA5E9',
  },
  pickerBtnText: { fontWeight: tokens.typography.weight.bold },
});
