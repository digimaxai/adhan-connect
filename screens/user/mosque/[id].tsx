// app/mosque/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { labelForPrayer, PrayerName } from '../../lib/adhans';
import { supabase } from '../../lib/supabase';
import { useLiveStreamForMosque } from '../../shared/hooks/useLiveStreamForMosque';
import { usePrayerTimesRealtime } from '../../shared/hooks/usePrayerTimesRealtime';
import { getDailyPrayerTimes } from '../../../lib/api/prayerTimesUnified';
import {
  crowdState,
  formatJumuahTime,
  isFridayToday,
  JumuahSlot,
  JumuahSummary,
  nextFridayDate,
  summaryFromRows,
} from '../../../lib/jumuah';

type Mosque = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  slug?: string | null;
};

type PrayerTimes = Partial<Record<PrayerName, string | null>>;
type BroadcastRow = { id: string; prayer: PrayerName; scheduled_for: string; started_at?: string | null; ended_at?: string | null };
type EventRow = {
  id: string;
  title?: string | null;
  start_at?: string | null;
  description?: string | null;
  location?: string | null;
};
type CampaignRow = {
  id: string;
  title?: string | null;
  raised_cents?: number | null;
  goal_cents?: number | null;
  end_at?: string | null;
};
type AnnouncementRow = {
  id: string;
  title?: string | null;
  summary?: string | null;
  created_at?: string | null;
  is_urgent?: boolean | null;
  is_pinned?: boolean | null;
};
const FOLLOW_LIMIT = 10;

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function formatCurrency(cents?: number | null) {
  return `£${((cents ?? 0) / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

function dateChip(startAt: string | null): { label: string; color: string; bg: string } | null {
  if (!startAt) return null;
  const ev = new Date(startAt);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const evStart = new Date(ev.getFullYear(), ev.getMonth(), ev.getDate());
  const diffDays = Math.round((evStart.getTime() - todayStart.getTime()) / 86400000);
  if (diffDays < 0) return null;
  if (diffDays === 0) return { label: 'TODAY', color: '#fff', bg: '#DC2626' };
  if (diffDays === 1) return { label: 'TOMORROW', color: '#fff', bg: '#D97706' };
  if (diffDays <= 7) return { label: ev.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), color: '#fff', bg: '#0369A1' };
  return { label: ev.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), color: '#475569', bg: '#F1F5F9' };
}

const toHm = (d: Date | null) =>
  d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null;

const mapNormalizedPrayerTimes = (normalized: Awaited<ReturnType<typeof getDailyPrayerTimes>>): PrayerTimes | null => {
  if (!normalized) return null;
  const mapped: PrayerTimes = {};
  (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).forEach((name) => {
    mapped[name] = toHm(normalized?.[name]?.adhan ?? null);
  });
  return mapped;
};

const mapNormalizedIqamaTimes = (normalized: Awaited<ReturnType<typeof getDailyPrayerTimes>>): PrayerTimes | null => {
  if (!normalized) return null;
  const mapped: PrayerTimes = {};
  (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).forEach((name) => {
    mapped[name] = toHm(normalized?.[name]?.iqama ?? null);
  });
  return mapped;
};

async function fetchDisplayedPrayerTimes(mosqueId: string) {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const normalizedToday = await getDailyPrayerTimes(mosqueId, today);
  if (normalizedToday) return normalizedToday;

  const { data: nextPt } = await supabase
    .from('prayer_times')
    .select('date')
    .eq('mosque_id', mosqueId)
    .gte('date', todayIso)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextPt?.date) {
    const d = new Date(nextPt.date as string);
    const normalized = await getDailyPrayerTimes(mosqueId, d);
    if (normalized) return normalized;
  }

  const { data: prevPt } = await supabase
    .from('prayer_times')
    .select('date')
    .eq('mosque_id', mosqueId)
    .lte('date', todayIso)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevPt?.date) {
    const d = new Date(prevPt.date as string);
    const normalized = await getDailyPrayerTimes(mosqueId, d);
    if (normalized) return normalized;
  }

  return null;
}

export default function MosquePage() {
  const { id, name: nameParam, city: cityParam, country: countryParam, focus } = useLocalSearchParams<{
    id: string;
    name?: string;
    city?: string;
    country?: string;
    focus?: string;
  }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const liveInfo = useLiveStreamForMosque(id ?? null);

  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [prayers, setPrayers] = useState<PrayerTimes | null>(null);
  const [iqamaTimes, setIqamaTimes] = useState<PrayerTimes | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [recordings, setRecordings] = useState<BroadcastRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [jumuahSlots, setJumuahSlots] = useState<JumuahSlot[]>([]);
  const [jumuahSummary, setJumuahSummary] = useState<Record<string, JumuahSummary>>({});
  const [following, setFollowing] = useState<boolean>(false);
  const [subCount, setSubCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [expandedNoticeIds, setExpandedNoticeIds] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsetsRef = useRef<Record<string, number>>({});

  const isUuid = (v?: string) => !!v && /^[0-9a-fA-F-]{36}$/.test(v);
  const fallbackMosqueName = useMemo(() => {
    const candidate = Array.isArray(nameParam) ? nameParam[0] : nameParam;
    if (candidate && !isUuid(candidate)) return candidate;
    const idCandidate = Array.isArray(id) ? id[0] : id;
    return idCandidate && !isUuid(idCandidate) ? idCandidate : 'Mosque';
  }, [id, nameParam]);

  const rememberSection = useCallback((key: string) => (event: LayoutChangeEvent) => {
    sectionOffsetsRef.current[key] = event.nativeEvent.layout.y;
  }, []);

  const refreshPrayerTimes = useCallback(async () => {
    if (!resolvedId) return;
    const normalizedPrayer = await fetchDisplayedPrayerTimes(resolvedId);
    setPrayers(mapNormalizedPrayerTimes(normalizedPrayer));
    setIqamaTimes(mapNormalizedIqamaTimes(normalizedPrayer));
  }, [resolvedId]);

  usePrayerTimesRealtime(resolvedId, refreshPrayerTimes, {
    channelName: 'mosque-detail-prayer-times',
  });

  useEffect(() => {
    const load = async () => {
      if (!id && !nameParam) return;
      setLoading(true);
      try {
        let base = null as any;
        const selectCols = 'id,name,city,country,slug';

        if (id && isUuid(id)) {
          const { data } = await supabase.from('mosques').select(selectCols).eq('id', id).maybeSingle();
          base = data ?? null;
        }
        if (!base && id) {
          const { data } = await supabase
            .from('mosques')
            .select(selectCols)
            .or(`slug.eq.${id},name.ilike.%${id}%`)
            .limit(1)
            .maybeSingle();
          base = data ?? null;
        }
        if (!base && nameParam) {
          const { data } = await supabase
            .from('mosques')
            .select(selectCols)
            .or(`slug.eq.${nameParam},name.ilike.%${nameParam}%`)
            .limit(1)
            .maybeSingle();
          base = data ?? null;
        }

        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);
        const actualId = base?.id || (id && isUuid(id) ? id : null);

        if (!actualId) {
          setMosque(
            base ?? {
              id: '',
              name: fallbackMosqueName,
              city: cityParam ?? '',
              country: countryParam ?? '',
            }
          );
          setResolvedId('');
          setPrayers(null);
          setIqamaTimes(null);
          setRecordings([]);
          setEvents([]);
          setCampaigns([]);
          setAnnouncements([]);
          setJumuahSlots([]);
          setJumuahSummary({});
          setFollowing(false);
          return;
        }

        setMosque(
          base ?? {
            id: actualId,
            name: base?.name ?? fallbackMosqueName,
            city: base?.city ?? cityParam ?? '',
            country: base?.country ?? countryParam ?? '',
            slug: base?.slug ?? null,
          }
        );
        setResolvedId(actualId);

        const [
          { data: recordingData },
          { data: subData },
          announcementsRes,
          jumuahSlotsRes,
          subCountRes,
        ] = await Promise.all([
          supabase
            .from('adhan_broadcasts')
            .select('id,prayer,scheduled_for,started_at,ended_at')
            .eq('mosque_id', actualId)
            .in('status', ['completed', 'live', 'scheduled'])
            .order('scheduled_for', { ascending: false })
            .limit(5),
          userId
            ? supabase.from('subscriptions').select('id').eq('user_id', userId).eq('mosque_id', actualId).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from('announcements')
            .select('id,title,summary,created_at,is_urgent,is_pinned')
            .eq('mosque_id', actualId)
            .eq('status', 'published')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('mosque_jumuah_slots')
            .select('id,label,khutbah_at,salah_at,venue,language,imam,capacity,notes')
            .eq('mosque_id', actualId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('salah_at', { ascending: true }),
          userId
            ? supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
            : Promise.resolve({ count: 0 }),
        ]);

        let eventsArr: EventRow[] = [];
        let campaignsArr: CampaignRow[] = [];
        const upcomingFrom = startOfTodayIso();

        try {
          const { data: ev, error: evErr } = await supabase
            .from('events')
            .select('id,title,start_at,description,location')
            .eq('mosque_id', actualId)
            .eq('status', 'published')
            .eq('is_public', true)
            .gte('start_at', upcomingFrom)
            .order('start_at', { ascending: true, nullsFirst: false })
            .limit(20);
          if (evErr) {
            console.warn('events fetch error', evErr.message);
          }
          eventsArr = Array.isArray(ev) ? (ev as any[]) : [];
        } catch (e: any) {
          console.warn('events fetch exception', e?.message);
          eventsArr = [];
        }

        try {
          const { data: cs, error: csErr } = await supabase
            .from('campaigns')
            .select('id,title,raised_cents,goal_cents,end_at')
            .eq('mosque_id', actualId)
            .eq('status', 'active')
            .or(`end_at.is.null,end_at.gte.${todayIso}`)
            .order('end_at', { ascending: true, nullsFirst: false })
            .limit(10);
          if (csErr) {
            console.warn('campaigns fetch error', csErr.message);
          }
          campaignsArr = Array.isArray(cs) ? (cs as any[]) : [];
        } catch (e: any) {
          console.warn('campaigns fetch exception', e?.message);
          campaignsArr = [];
        }
        const slotsArr = Array.isArray(jumuahSlotsRes.data) ? (jumuahSlotsRes.data as JumuahSlot[]) : [];
        let summaryMap: Record<string, JumuahSummary> = {};
        if (slotsArr.length) {
          const slotIds = slotsArr.map((slot) => slot.id);
          const fridayDate = nextFridayDate();
          const summaryRes = await supabase
            .from('jumuah_slot_attendance_summary')
            .select('slot_id,attendee_count,household_count')
            .eq('friday_date', fridayDate)
            .in('slot_id', slotIds);
          summaryMap = summaryFromRows(summaryRes.data as JumuahSummary[]);
        }

        const normalizedPrayer = await fetchDisplayedPrayerTimes(actualId);
        setPrayers(mapNormalizedPrayerTimes(normalizedPrayer));
        setIqamaTimes(mapNormalizedIqamaTimes(normalizedPrayer));
        setRecordings((recordingData as BroadcastRow[]) ?? []);
        setFollowing(!!subData);
        setEvents(eventsArr);
        setCampaigns(campaignsArr);
        setAnnouncements(Array.isArray(announcementsRes.data) ? announcementsRes.data : []);
        setJumuahSlots(slotsArr);
        setJumuahSummary(summaryMap);
        setSubCount(subCountRes.count ?? 0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [cityParam, countryParam, fallbackMosqueName, id, nameParam, userId]);

  const toggleFollow = async () => {
    const targetMosqueId = resolvedId || (id && isUuid(id) ? id : null);
    if (!targetMosqueId || !userId || actionLoading) return;
    if (!following && subCount >= FOLLOW_LIMIT) {
      alert(`Maximum Reached\n\nYou can follow up to ${FOLLOW_LIMIT} mosques. Unfollow a mosque to add a new one.\n\nChoose "Manage My Mosques" in Settings.`);
      return;
    }
    setActionLoading(true);
    try {
      if (following) {
        await supabase.from('subscriptions').delete().eq('user_id', userId).eq('mosque_id', targetMosqueId);
        setFollowing(false);
        setSubCount((c) => Math.max(0, c - 1));
      } else {
        await supabase.from('subscriptions').insert({ user_id: userId, mosque_id: targetMosqueId });
        setFollowing(true);
        setSubCount((c) => c + 1);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const shareMosque = useCallback(async () => {
    const targetMosqueId = resolvedId || (id && isUuid(id) ? id : mosque?.id);
    const mosqueName = mosque?.name ?? fallbackMosqueName;
    const mosqueLocation = [mosque?.city, mosque?.country].filter(Boolean).join(', ');
    const locationLine = mosqueLocation ? `\n${mosqueLocation}` : '';
    const linkLine = targetMosqueId ? `\n/mosque/${targetMosqueId}` : '';
    try {
      await Share.share({
        title: mosqueName,
        message: `${mosqueName}${locationLine}${linkLine}`,
      });
    } catch {
      // Sharing can be cancelled or unavailable on some platforms.
    }
  }, [fallbackMosqueName, id, mosque?.city, mosque?.country, mosque?.id, mosque?.name, resolvedId]);

  const displayTimes = useMemo(() => {
    const t = prayers || {};
    const iq = iqamaTimes || {};
    const fmt = (val?: string | null) => {
      if (!val) return null;
      const parts = val.split(':');
      if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      return val;
    };
    return (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).map((p) => ({
      key: p as PrayerName,
      name: labelForPrayer(p),
      adhan: fmt(t[p]) ?? '--:--',
      iqama: fmt(iq[p]),
    }));
  }, [prayers, iqamaTimes]);

  const hasIqamaTimes = useMemo(
    () => iqamaTimes != null && Object.values(iqamaTimes).some((v) => v != null),
    [iqamaTimes]
  );

  const nextPrayerName = useMemo<PrayerName | null>(() => {
    if (!prayers) return null;
    const now = new Date(clockMs);
    const msForHhmm = (hhmm: string | null | undefined): number | null => {
      if (!hhmm) return null;
      const parts = hhmm.split(':');
      if (parts.length < 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return null;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0).getTime();
    };
    for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]) {
      const ms = msForHhmm(prayers[p]);
      if (ms !== null && ms > now.getTime()) return p;
    }
    return null;
  }, [prayers, clockMs]);

  const recent = useMemo(() => recordings.slice(0, 1), [recordings]);
  const city = useMemo(() => [mosque?.city, mosque?.country].filter(Boolean).join(', '), [mosque]);
  const displayJumuahSlots = useMemo(
    () => jumuahSlots,
    [jumuahSlots]
  );
  const previewJumuahSlots = useMemo(() => displayJumuahSlots.slice(0, 3), [displayJumuahSlots]);
  const hiddenJumuahCount = Math.max(0, displayJumuahSlots.length - previewJumuahSlots.length);
  useEffect(() => {
    const id = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const showJumuahSection = displayJumuahSlots.length > 0;
  const openJumuahPage = () => {
    const mosqueId = resolvedId || (id && isUuid(id) ? id : mosque?.id);
    if (!mosqueId) return;
    router.push({
      pathname: '/(user)/jumuah/[id]',
      params: { id: mosqueId, name: mosque?.name ?? nameParam ?? 'Mosque' },
    } as any);
  };
  const urgentAnnouncements = useMemo(() => announcements.filter((announcement) => announcement.is_urgent), [announcements]);
  const nonUrgentAnnouncements = useMemo(
    () => announcements.filter((announcement) => !announcement.is_urgent),
    [announcements]
  );
  const toggleNotice = useCallback((noticeId: string) => {
    setExpandedNoticeIds((prev) => {
      const next = new Set(prev);
      if (next.has(noticeId)) next.delete(noticeId);
      else next.add(noticeId);
      return next;
    });
  }, []);

  const visibleEventsForSection = events;
  const visibleCampaignsForSection = campaigns;

  useEffect(() => {
    if (loading || !focus) return;
    const target = Array.isArray(focus) ? focus[0] : focus;
    const sectionKey =
      target === 'urgent'
        ? 'urgent'
        : target === 'campaign' || target === 'campaigns'
        ? 'campaigns'
        : target === 'event' || target === 'events'
        ? 'events'
        : target === 'announcement' || target === 'announcements'
        ? 'announcements'
        : target === 'jumuah'
        ? 'jumuah'
        : target;

    const timer = setTimeout(() => {
      const y = sectionOffsetsRef.current[sectionKey];
      if (typeof y === 'number') {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [announcements.length, campaigns.length, events.length, focus, loading, showJumuahSection, urgentAnnouncements.length]);

  if (!id) return null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{mosque?.name ?? 'Mosque'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={shareMosque} hitSlop={10}>
              <Ionicons name="share-outline" size={18} color="#0F172A" />
            </Pressable>
          </View>
        </View>

        {/* ── Identity card + inline Follow pill ── */}
        <View style={[styles.identityCard, styles.shadow]}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityInitials}>{mosque?.name?.slice(0, 2).toUpperCase() ?? 'MS'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName} numberOfLines={1}>{mosque?.name ?? 'Mosque'}</Text>
            <Text style={styles.identityCity} numberOfLines={1}>{city || 'City, Country'}</Text>
          </View>
          <Pressable
            onPress={toggleFollow}
            disabled={actionLoading}
            style={({ pressed }) => [
              styles.followPill,
              following && styles.followPillActive,
              (pressed || actionLoading) && { opacity: 0.8 },
            ]}
          >
            <Ionicons name={following ? 'checkmark' : 'add'} size={14} color={following ? '#0369A1' : '#64748B'} />
            <Text style={[styles.followPillText, following && styles.followPillTextActive]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        </View>
        {!following && subCount >= FOLLOW_LIMIT && (
          <Text style={styles.limitNote}>{`You are following ${FOLLOW_LIMIT} mosques (maximum).`}</Text>
        )}

        {/* ── Live broadcast ── */}
        {liveInfo.isLive && (
          <View style={[styles.liveCard, styles.shadow]}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={styles.liveIconWrap}>
                <Ionicons name="radio-outline" size={22} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>
                  <Text style={styles.liveSmall}>{city || 'Broadcasting Adhan'}</Text>
                </View>
                <Text style={styles.liveTitle} numberOfLines={1}>{mosque?.name ?? 'Mosque'}</Text>
                <Text style={styles.liveSubtitle}>Broadcasting Adhan</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/(user)/now', params: { mosqueId: resolvedId ?? id } })}
              style={({ pressed }) => [styles.livePrimary, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.livePrimaryText}>Listen Live</Text>
            </Pressable>
          </View>
        )}

        {/* ── Urgent notices ── */}
        {urgentAnnouncements.length > 0 && (
          <View onLayout={rememberSection('urgent')} style={[styles.urgentCard, styles.shadow]}>
            <View style={styles.urgentHeader}>
              <Ionicons name="alert-circle" size={18} color="#B91C1C" />
              <Text style={styles.urgentHeaderText}>Important notices</Text>
            </View>
            {urgentAnnouncements.slice(0, 3).map((notice) => {
              const expanded = expandedNoticeIds.has(notice.id);
              return (
                <Pressable
                  key={notice.id}
                  onPress={() => toggleNotice(notice.id)}
                  style={({ pressed }) => [styles.urgentRow, pressed && styles.pressed]}
                >
                  <View style={styles.urgentTitleRow}>
                    <Text style={styles.urgentTitle} numberOfLines={expanded ? undefined : 1}>
                      {notice.title ?? 'Urgent notice'}
                    </Text>
                    {notice.summary
                      ? <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#991B1B" />
                      : null}
                  </View>
                  {notice.summary
                    ? <Text style={styles.urgentSummary} numberOfLines={expanded ? undefined : 2}>{notice.summary}</Text>
                    : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Prayer Times */}
        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Prayer Times</Text>
          </View>
          <View style={styles.divider} />
          {hasIqamaTimes && (
            <View style={styles.prayerTableHeader}>
              <Text style={[styles.prayerColLabel, { flex: 1 }]}>Prayer</Text>
              <Text style={styles.prayerColLabel}>Adhan</Text>
              <Text style={styles.prayerColLabel}>Iqamah</Text>
            </View>
          )}
          <View style={styles.timesTable}>
            {displayTimes.map((row) => {
              const isNext = row.key === nextPrayerName;
              return (
                <View key={row.key} style={[styles.timeRow, isNext && styles.timeRowNext]}>
                  <Text style={[styles.timeName, isNext && styles.timeNameNext]}>{row.name}</Text>
                  <Text style={[styles.timeValue, isNext && styles.timeValueNext]}>{row.adhan}</Text>
                  {hasIqamaTimes && (
                    <Text style={[styles.timeIqama, isNext && styles.timeValueNext]}>
                      {row.iqama ?? '-'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {visibleEventsForSection.length > 0 && (
          <View onLayout={rememberSection('events')} style={[styles.card, styles.shadow]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Events</Text>
            </View>
            <View style={styles.divider} />
            {(showAllEvents ? visibleEventsForSection : visibleEventsForSection.slice(0, 5)).map((ev) => {
              const chip = dateChip(ev.start_at ?? null);
              const timeStr = ev.start_at
                ? new Date(ev.start_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : null;
              return (
                <Pressable
                  key={ev.id}
                  onPress={() => router.push({ pathname: '/(user)/event/[id]', params: { id: ev.id } } as any)}
                  style={({ pressed }) => [styles.eventRow, { opacity: pressed ? 0.88 : 1 }]}
                >
                  {chip && (
                    <View style={[styles.eventDateChip, { backgroundColor: chip.bg }]}>
                      <Text style={[styles.eventDateChipText, { color: chip.color }]}>{chip.label}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{ev.title ?? 'Event'}</Text>
                    {timeStr ? <Text style={styles.eventMeta}>{timeStr}</Text> : null}
                    {ev.location ? <Text style={styles.eventMeta} numberOfLines={1}>{ev.location}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </Pressable>
              );
            })}
            {!showAllEvents && visibleEventsForSection.length > 5 && (
              <Pressable
                onPress={() => setShowAllEvents(true)}
                style={({ pressed }) => [styles.viewAllBtn, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={styles.viewAllText}>Show all {visibleEventsForSection.length} events</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Campaigns & Donations ── */}
        {visibleCampaignsForSection.length > 0 && (
          <View onLayout={rememberSection('campaigns')} style={[styles.card, styles.shadow]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Campaigns & Donations</Text>
            </View>
            <View style={styles.divider} />
            {(showAllCampaigns ? visibleCampaignsForSection : visibleCampaignsForSection.slice(0, 3)).map((c) => {
              const raised = (c.raised_cents ?? 0) / 100;
              const goalRaw = c.goal_cents ?? 0;
              const goal = goalRaw > 0 ? goalRaw / 100 : 1;
              const pct = Math.min(100, Math.round((raised / goal) * 100));
              return (
                <View key={c.id} style={styles.campaignRow}>
                  <Text style={styles.campaignTitle} numberOfLines={1}>{c.title ?? 'Campaign'}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.campaignMeta}>
                    {`${formatCurrency(c.raised_cents)} raised of ${formatCurrency(c.goal_cents)} goal`}
                  </Text>
                  <Pressable
                    onPress={() => router.push({ pathname: '/(user)/campaign/[id]', params: { id: c.id } } as any)}
                    style={({ pressed }) => [styles.donateBtn, { opacity: pressed ? 0.9 : 1 }]}
                  >
                    <Text style={styles.donateBtnText}>Donate</Text>
                  </Pressable>
                </View>
              );
            })}
            {!showAllCampaigns && visibleCampaignsForSection.length > 3 && (
              <Pressable
                onPress={() => setShowAllCampaigns(true)}
                style={({ pressed }) => [styles.viewAllBtn, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={styles.viewAllText}>Show all {visibleCampaignsForSection.length} campaigns</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Announcements (non-urgent) ── */}
        {nonUrgentAnnouncements.length > 0 && (
          <View onLayout={rememberSection('announcements')} style={[styles.card, styles.shadow]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Announcements</Text>
            </View>
            <View style={styles.divider} />
            {nonUrgentAnnouncements.slice(0, 5).map((notice) => (
              <View
                key={notice.id}
                style={[styles.noticeRow, notice.is_pinned && !notice.is_urgent && styles.noticeRowPinned]}
              >
                <View style={styles.noticeIcon}>
                  <Ionicons
                    name={notice.is_pinned ? 'pin' : 'megaphone-outline'}
                    size={16}
                    color={notice.is_pinned ? '#92400E' : '#0369A1'}
                  />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.noticeTitle} numberOfLines={1}>{notice.title ?? 'Announcement'}</Text>
                  {notice.summary
                    ? <Text style={styles.noticeSummary} numberOfLines={2}>{notice.summary}</Text>
                    : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Jumu'ah */}
        {showJumuahSection && (
          <View onLayout={rememberSection('jumuah')} style={[styles.card, styles.shadow]}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>{isFridayToday() ? "Jumu'ah Today" : "Jumu'ah This Friday"}</Text>
                <Text style={styles.cardSubtitle}>Friday prayer times and congregation guidance.</Text>
              </View>
            </View>
            <View style={styles.divider} />
            {previewJumuahSlots.map((slot) => {
              const count = jumuahSummary[slot.id]?.attendee_count ?? 0;
              const crowd = crowdState(count, slot.capacity);
              const isLegacy = slot.id.startsWith('legacy-');
              return (
                <View key={slot.id} style={styles.jumuahRow}>
                  <View style={styles.jumuahTimeBox}>
                    <Text style={styles.jumuahTime}>{formatJumuahTime(slot.salah_at) ?? '--:--'}</Text>
                    {slot.khutbah_at
                      ? <Text style={styles.jumuahKhutbah}>Khutbah {formatJumuahTime(slot.khutbah_at)}</Text>
                      : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.jumuahTitle} numberOfLines={1}>{slot.label ?? "Jumu'ah"}</Text>
                    {[slot.venue, slot.language].filter(Boolean).length
                      ? <Text style={styles.jumuahMeta} numberOfLines={1}>{[slot.venue, slot.language].filter(Boolean).join(' / ')}</Text>
                      : null}
                    {!isLegacy && (
                      <View style={styles.crowdWrap}>
                        <View style={[
                          styles.crowdPill,
                          crowd.tone === 'danger' ? styles.crowdDanger
                            : crowd.tone === 'warning' ? styles.crowdWarning
                            : crowd.tone === 'busy' ? styles.crowdBusy
                            : crowd.tone === 'calm' ? styles.crowdCalm
                            : styles.crowdNeutral,
                        ]}>
                          <Text style={styles.crowdText}>{crowd.label}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            <Pressable onPress={openJumuahPage} style={({ pressed }) => [styles.jumuahCta, pressed && styles.pressed]}>
              <View>
                <Text style={styles.jumuahCtaText}>{"See all Jumu'ah times"}</Text>
                {hiddenJumuahCount > 0
                  ? <Text style={styles.jumuahMoreText}>+{hiddenJumuahCount} more time{hiddenJumuahCount === 1 ? '' : 's'} available</Text>
                  : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#0369A1" />
            </Pressable>
          </View>
        )}

        {/* ── About (only renders when location data available) ── */}
        {city ? (
          <View style={[styles.card, styles.shadow]}>
            <Text style={styles.cardTitle}>About This Mosque</Text>
            <View style={styles.aboutRow}>
              <Ionicons name="location-outline" size={15} color="#64748B" />
              <Text style={styles.aboutText}>{city}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Last Adhan Broadcast (informational) ── */}
        {recent.length > 0 && (
          <View style={[styles.card, styles.shadow]}>
            <Text style={styles.cardTitle}>Last Adhan Broadcast</Text>
            {(() => {
              const b = recent[0];
              const when = new Date(b.scheduled_for);
              const durationSec = b.started_at && b.ended_at
                ? Math.max(1, Math.floor((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000))
                : null;
              return (
                <View style={styles.recordRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>{labelForPrayer(b.prayer)}</Text>
                    <Text style={styles.recordMeta}>
                      {`${when.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${durationSec ? ` · ${durationSec}s` : ''}`}
                    </Text>
                  </View>
                  <Ionicons name="radio-outline" size={20} color="#94A3B8" />
                </View>
              );
            })()}
          </View>
        )}

        {loading && (
          <View style={{ marginTop: 12 }}>
            <ActivityIndicator color="#0EA5E9" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F8F9' },
  body: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  pressed: { opacity: 0.85 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: '#0F172A', paddingHorizontal: 12 },

  identityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12 },
  identityAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  identityInitials: { fontWeight: '800', color: '#0369A1', fontSize: 16 },
  identityName: { fontWeight: '800', color: '#0F172A', fontSize: 16 },
  identityCity: { color: '#475569', marginTop: 2, fontSize: 13 },

  liveCard: { backgroundColor: '#FFF4F4', borderRadius: 16, padding: 16, gap: 12 },
  liveIconWrap: { padding: 6, borderRadius: 12, backgroundColor: '#FFECEC' },
  liveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FEE2E2' },
  liveBadgeText: { color: '#B91C1C', fontWeight: '800', fontSize: 12 },
  liveSmall: { color: '#475569', fontSize: 12 },
  liveTitle: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
  liveSubtitle: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  livePrimary: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardSubtitle: { color: '#64748B', fontSize: 12, marginTop: 3 },

  urgentCard: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: '#FECACA' },
  urgentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  urgentHeaderText: { color: '#991B1B', fontSize: 14, fontWeight: '800' },
  urgentRow: { paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: '#DC2626', gap: 3 },
  urgentTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  urgentTitle: { flex: 1, color: '#7F1D1D', fontSize: 14, fontWeight: '800' },
  urgentSummary: { color: '#991B1B', fontSize: 12, lineHeight: 17 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 8 },
  timesTable: { gap: 10 },
  prayerTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 2,
  },
  prayerColLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    minWidth: 72,
    textAlign: 'right',
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  timeRowNext: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  timeName: { flex: 1, fontWeight: '700', color: '#0F172A', fontSize: 14 },
  timeNameNext: { color: '#0369A1', fontWeight: '800' },
  timeValue: { minWidth: 72, textAlign: 'right', fontWeight: '800', color: '#0F172A', fontSize: 14 },
  timeValueNext: { color: '#0369A1' },
  timeIqama: { minWidth: 72, textAlign: 'right', fontWeight: '700', color: '#475569', fontSize: 14 },

  jumuahRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  jumuahTimeBox: { width: 78, alignItems: 'flex-start', gap: 3 },
  jumuahTime: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  jumuahKhutbah: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  jumuahTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  jumuahMeta: { color: '#64748B', fontSize: 12 },
  crowdWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  crowdPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  crowdText: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  crowdNeutral: { backgroundColor: '#F1F5F9' },
  crowdCalm: { backgroundColor: '#DCFCE7' },
  crowdBusy: { backgroundColor: '#FEF3C7' },
  crowdWarning: { backgroundColor: '#FED7AA' },
  crowdDanger: { backgroundColor: '#FECACA' },
  jumuahCta: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  jumuahCtaText: { color: '#0369A1', fontSize: 13, fontWeight: '900' },
  jumuahMoreText: { color: '#64748B', fontSize: 11, marginTop: 2 },

  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  eventDateChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 64, alignItems: 'center' },
  eventDateChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  eventTitle: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  eventMeta: { color: '#475569', fontSize: 12 },
  viewAllBtn: { marginTop: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#E0F2FE' },
  viewAllText: { color: '#0369A1', fontWeight: '800', fontSize: 13 },

  campaignRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 8 },
  campaignTitle: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  campaignMeta: { color: '#475569', fontSize: 12 },
  donateBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donateBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  progressTrack: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1E7BF6' },

  noticeRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: '#E2E8F0' },
  noticeRowUrgent: { borderLeftColor: '#DC2626', backgroundColor: '#FEF2F2' },
  noticeRowPinned: { borderLeftColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  noticeIcon: { width: 24, alignItems: 'center', paddingTop: 1 },
  noticeTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  noticeSummary: { color: '#475569', fontSize: 12, lineHeight: 17 },

  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  aboutText: { color: '#475569', fontSize: 13, flex: 1 },
  recordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  recordTitle: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  recordMeta: { color: '#475569', fontSize: 12, marginTop: 2 },

  followPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  followPillActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  followPillText: { fontWeight: '800', fontSize: 13, color: '#64748B' },
  followPillTextActive: { color: '#0369A1' },
  followBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    marginBottom: 14,
  },
  followBtnUnfollow: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  followText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  followTextUnfollow: { color: '#B91C1C' },
  limitNote: { color: '#B91C1C', textAlign: 'center', marginBottom: 12, fontSize: 12, fontWeight: '600' },
  empty: { color: '#94A3B8', fontSize: 13, marginTop: 4 },

  shadow: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
});
