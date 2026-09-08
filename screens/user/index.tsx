// screens/user/index.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import {
  AdhanBroadcast,
  canStartBroadcast,
  fetchUpcomingBroadcasts,
  formatTimeWithTz,
  labelForPrayer,
  PrayerName,
  statusBadge,
} from '../../lib/adhans';
import type { JumuahSlot } from '../../lib/jumuah';
import { supabase } from '../../lib/supabase';
import { AppLogo } from '../../components/AppLogo';
import { AppButton } from '../../components/ui/app-button';
import { AppCard } from '../../components/ui/app-card';
import { ScreenContainer } from '../../components/ui/screen-container';
import { AppText } from '../../components/ui/app-text';
import {
  getDefaultMosqueId,
  setDefaultMosqueId as persistDefaultMosqueId,
} from '../../lib/mosquePreferences';
import { useLiveStreamForMosque } from '../shared/hooks/useLiveStreamForMosque';
import { usePrayerTimesRealtime } from '../shared/hooks/usePrayerTimesRealtime';
import { getDailyPrayerTimes, type NormalizedPrayerTimes } from '../../lib/api/prayerTimesUnified';
import { computeNextPrayerSummaryAcrossDays } from '../../lib/prayerTimesDisplay';
import { isFreshLiveStream } from '../../lib/liveStreamFreshness';
import { tokens } from '../../theme/tokens';
import { NearYouNowCard } from '../../components/NearYouNowCard';
import { NearbyHomeSummary } from '../../components/NearbyHomeSummary';
import { HomeJumuahStrip } from '../../components/HomeJumuahStrip';
import { useMosquesNearby, type NearbyMosque } from '../../lib/hooks/useMosquesNearby';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mosque = {
  id: string; name: string; city?: string | null; country?: string | null;
  status?: string | null; lat?: number | null; lng?: number | null; prayers_not_offered?: string[] | null; prayers_not_offered_reasons?: Record<string, string> | null;
};
type UserLocation = { latitude: number; longitude: number };
type Subscription = { mosque_id: string };
type RawAnnouncement = {
  id: string; mosque_id: string; title: string; summary?: string | null;
  created_at: string; is_urgent: boolean; is_pinned: boolean;
};
type RawEvent = {
  id: string; mosque_id: string; title: string; start_at: string; location?: string | null;
};
type RawCampaign = {
  id: string; mosque_id: string; title: string; end_at?: string | null;
  raised_cents?: number | null; goal_cents?: number | null;
};
type StreamRow = {
  id?: string; mosque_id: string; type?: string | null; is_live: boolean;
  status?: string | null; started_at?: string | null; current_prayer?: string | null;
};
type DailyQuote = {
  id: string; text_en: string; text_ar?: string | null; source?: string | null;
};
type CrossMosqueAlert = { announcement: RawAnnouncement; mosque: Mosque };

const LIVE_REFRESH_MS = 15000;
const HOME_REFRESH_TIMEOUT_MS = 7000;

function formatHomeCountdown(target: Date, nowMs: number) {
  const minutes = Math.max(0, Math.ceil((target.getTime() - nowMs) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function buildLiveStreamMap(rows: StreamRow[] | null | undefined) {
  const map: Record<string, StreamRow> = {};
  (rows ?? []).forEach((stream) => {
    if (isFreshLiveStream(stream) && !map[stream.mosque_id]) map[stream.mosque_id] = stream;
  });
  return map;
}

function normalizeSubscriptions(rows: Subscription[] | null | undefined) {
  const seen = new Set<string>();
  return (rows ?? []).reduce<Subscription[]>((acc, row) => {
    if (!row.mosque_id || seen.has(row.mosque_id)) return acc;
    seen.add(row.mosque_id);
    acc.push({ mosque_id: row.mosque_id });
    return acc;
  }, []);
}

function mergeMosqueRows(baseRows: Mosque[], extraRows: Mosque[]) {
  const byId = new Map<string, Mosque>();
  [...baseRows, ...extraRows].forEach((mosque) => {
    if (!mosque?.id) return;
    const existing = byId.get(mosque.id);
    byId.set(mosque.id, existing ? { ...existing, ...mosque } : mosque);
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfTodayIso(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatEventDateParts(iso?: string | null) {
  if (!iso) return { month: '--', day: '--', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { month: '--', day: '--', time: '' };
  return {
    month: d.toLocaleDateString([], { month: 'short' }).toUpperCase(),
    day: d.toLocaleDateString([], { day: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

function formatCurrencyGBP(cents?: number | null) {
  if (cents == null) return null;
  return `£${(cents / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}


const toRad = (deg: number) => deg * (Math.PI / 180);
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Sub-components ────────────────────────────────────────────────────────────
// Defined at module scope so React never sees a new type on re-render.

// ─── MuezzinHero — UNTOUCHED ──────────────────────────────────────────────────
type MuezzinHeroProps = {
  loading: boolean;
  broadcast: AdhanBroadcast | null;
  error: string | null;
  router: ReturnType<typeof useRouter>;
};

const MuezzinHero = React.memo(function MuezzinHero({ loading, broadcast, error, router }: MuezzinHeroProps) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const startable = broadcast ? canStartBroadcast(broadcast, now) : false;
  const badge = broadcast ? statusBadge(broadcast, now) : null;
  const remaining = (() => {
    if (!broadcast) return null;
    const target = new Date(broadcast.scheduled_for);
    const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    return { text: `In ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`, diffSec };
  })();
  const urgency = (() => {
    if (!remaining) return { color: '#22C55E', label: 'Ready' };
    if (remaining.diffSec < 120) return { color: '#EF4444', label: 'Critical' };
    if (remaining.diffSec < 600) return { color: '#F59E0B', label: 'Soon' };
    return { color: '#22C55E', label: 'Ready' };
  })();

  return (
    <View style={[styles.heroCard, styles.shadow]}>
      <Text style={styles.heroEyebrow}>Muezzin</Text>
      <Text style={styles.heroTitle}>Your next Adhan</Text>
      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <ActivityIndicator color="#0EA5E9" />
          <Text style={styles.heroSubtitle}>Loading</Text>
        </View>
      )}
      {!loading && broadcast && (
        <>
          <Text style={styles.heroSubtitle}>{formatTimeWithTz(broadcast)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
            <View style={[styles.livePill, { backgroundColor: broadcast.status === 'live' ? '#FEE2E2' : '#E2E8F0' }]}>
              <View style={[styles.liveDot, { backgroundColor: broadcast.status === 'live' ? '#DC2626' : '#94A3B8' }]} />
              <Text style={[styles.livePillText, { color: broadcast.status === 'live' ? '#B91C1C' : '#0F172A' }]}>
                {broadcast.status === 'live' ? 'LIVE' : 'Ready'}
              </Text>
            </View>
            {badge && <Text style={styles.heroBadge}>{badge}</Text>}
          </View>
          {remaining && <Text style={[styles.heroCountdown, { color: urgency.color }]}>{remaining.text}</Text>}
          <Text style={[styles.heroUrgency, { color: urgency.color }]}>{urgency.label}</Text>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
            <Pressable
              onPress={() => router.push('/(muezzin)/live-broadcast')}
              style={({ pressed }) => [
                styles.heroButton,
                { backgroundColor: startable ? '#EF4444' : '#0EA5E9', opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.heroButtonText}>{startable ? 'Go live' : 'View details'}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(muezzin)/muezzin-home')}
              style={({ pressed }) => [styles.heroButton, { backgroundColor: '#E0F2FE', opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.heroButtonText, { color: '#0369A1' }]}>Schedule</Text>
            </Pressable>
          </View>
        </>
      )}
      {!loading && !broadcast && (
        <Text style={styles.heroSubtitle}>{error || 'No upcoming adhans.'}</Text>
      )}
    </View>
  );
});

// ─── MosquePickerSheet ────────────────────────────────────────────────────────
type MosquePickerSheetProps = {
  visible: boolean;
  mosques: Mosque[];
  selectedId: string | null;
  onSelect: (mosque: Mosque) => void;
  onClose: () => void;
  onManage: () => void;
};

const MosquePickerSheet = React.memo(function MosquePickerSheet({
  visible, mosques, selectedId, onSelect, onClose, onManage,
}: MosquePickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose} />
      <View style={styles.pickerSheet}>
        <View style={styles.pickerHandle} />
        <AppText variant="sectionTitle" style={styles.pickerTitle}>Choose your mosque</AppText>
        <AppText variant="caption" style={styles.pickerSub}>
          Prayer times and updates will be based on this mosque.
        </AppText>
        <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
          {mosques.map((m) => {
            const selected = m.id === selectedId;
            const loc = [m.city, m.country].filter(Boolean).join(', ');
            return (
              <Pressable
                key={m.id}
                onPress={() => onSelect(m)}
                style={({ pressed }) => [
                  styles.pickerRow,
                  selected && styles.pickerRowSelected,
                  pressed && styles.pickerRowPressed,
                ]}
              >
                <View style={[styles.pickerAvatar, selected && styles.pickerAvatarSelected]}>
                  <AppText style={[styles.pickerAvatarText, selected && styles.pickerAvatarTextSelected]}>
                    {initials(m.name)}
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText
                    style={[styles.pickerMosqueName, selected && styles.pickerMosqueNameSelected]}
                    numberOfLines={1}
                  >
                    {m.name}
                  </AppText>
                  {loc ? (
                    <AppText variant="caption" style={styles.pickerMosqueCity} numberOfLines={1}>
                      {loc}
                    </AppText>
                  ) : null}
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color="#0EA5E9" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.pickerFooter}>
          <Pressable
            onPress={onManage}
            style={({ pressed }) => [styles.pickerManage, pressed && { opacity: 0.75 }]}
          >
            <AppText style={styles.pickerManageText}>Manage</AppText>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.pickerCancel, pressed && { opacity: 0.75 }]}
          >
            <AppText style={styles.pickerCancelText}>Cancel</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

// ─── MosqueIdentityBar ────────────────────────────────────────────────────────
type MosqueIdentityBarProps = {
  mosque: Mosque | null;
  canSwitch: boolean;
  onSwitch: () => void;
  onDiscover: () => void;
  hasSubscriptions: boolean;
  otherMosqueLive: boolean;
};

const MosqueIdentityBar = React.memo(function MosqueIdentityBar({
  mosque, canSwitch, onSwitch, onDiscover, hasSubscriptions, otherMosqueLive,
}: MosqueIdentityBarProps) {
  if (!mosque && !hasSubscriptions) {
    return (
      <Pressable
        onPress={onDiscover}
        style={({ pressed }) => [styles.identityBarEmpty, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.identityAvatarEmpty}>
          <Ionicons name="add" size={18} color="#0369A1" />
        </View>
        <AppText style={styles.identityEmptyText}>Set your mosque to see prayer times</AppText>
        <Ionicons name="chevron-forward" size={15} color="#0369A1" />
      </Pressable>
    );
  }
  if (!mosque) return null;

  const loc = [mosque.city, mosque.country].filter(Boolean).join(', ');
  return (
    <Pressable
      onPress={canSwitch ? onSwitch : undefined}
      style={({ pressed }) => [
        styles.identityBar,
        canSwitch && pressed && styles.identityBarPressed,
      ]}
    >
      <View style={styles.identityAvatar}>
        <AppText style={styles.identityAvatarText}>{initials(mosque.name)}</AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={styles.identityName} numberOfLines={1}>{mosque.name}</AppText>
        {loc ? (
          <AppText variant="caption" style={styles.identityCity} numberOfLines={1}>{loc}</AppText>
        ) : null}
      </View>
      {canSwitch ? (
        <View style={styles.identitySwitchPill}>
          {otherMosqueLive ? <View style={styles.identityLiveDot} /> : null}
          <AppText style={styles.identitySwitchText}>Switch</AppText>
          <Ionicons name="chevron-down" size={12} color="#0369A1" />
        </View>
      ) : null}
    </Pressable>
  );
});

// ─── PrimaryMosqueContent ("What's On") ──────────────────────────────────────
type PrimaryMosqueContentProps = {
  mosqueId: string;
  announcements: RawAnnouncement[];
  events: RawEvent[];
  campaigns: RawCampaign[];
  router: ReturnType<typeof useRouter>;
};

const PrimaryMosqueContent = React.memo(function PrimaryMosqueContent({
  mosqueId, announcements, events, campaigns, router,
}: PrimaryMosqueContentProps) {
  const urgentNotices = announcements.filter((a) => a.is_urgent).slice(0, 2);
  const pinned = announcements.find((a) => a.is_pinned && !a.is_urgent) ?? null;
  const recent = announcements.find((a) => !a.is_urgent && !a.is_pinned) ?? null;
  const notice = pinned ?? recent;
  const visibleEvents = events.slice(0, 3);
  const visibleCampaigns = campaigns.slice(0, 2);

  const hasContent =
    urgentNotices.length > 0 ||
    notice ||
    visibleEvents.length > 0 ||
    visibleCampaigns.length > 0;
  if (!hasContent) return null;

  const getRaisedPct = (campaign: RawCampaign) =>
    campaign.goal_cents && campaign.goal_cents > 0
      ? Math.min(100, Math.round(((campaign.raised_cents ?? 0) / campaign.goal_cents) * 100))
      : null;


  const navigateTo = (focus: string) => {
    router.push({
      pathname: '/(user)/mosque/[id]',
      params: { id: mosqueId, focus },
    } as any);
  };

  const navigateToMosque = () => {
    router.push({
      pathname: '/(user)/mosque/[id]',
      params: { id: mosqueId },
    } as any);
  };

  return (
    <AppCard style={styles.cardContainer}>
      <View style={styles.sectionHeader}>
        <AppText variant="sectionTitle">{"What's On"}</AppText>
      </View>

      <View style={styles.contentList}>
        {urgentNotices.map((urgent) => (
          <Pressable
            key={urgent.id}
            onPress={() => navigateTo('urgent')}
            style={({ pressed }) => [styles.contentRow, styles.contentRowUrgent, pressed && styles.contentRowPressed]}
          >
            <View style={[styles.contentIcon, styles.contentIconUrgent]}>
              <Ionicons name="alert-circle" size={16} color="#B91C1C" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[styles.contentTitle, { color: '#991B1B' }]} numberOfLines={1}>
                {urgent.title}
              </AppText>
              {urgent.summary ? (
                <AppText variant="caption" style={[styles.contentSub, { color: '#B91C1C' }]} numberOfLines={1}>
                  {urgent.summary}
                </AppText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={14} color="#B91C1C" />
          </Pressable>
        ))}

        {visibleEvents.map((event) => {
          const eventDate = formatEventDateParts(event.start_at);
          return (
            <Pressable
              key={event.id}
              onPress={() => router.push({ pathname: '/(user)/event/[id]', params: { id: event.id } } as any)}
              style={({ pressed }) => [styles.contentRow, pressed && styles.contentRowPressed]}
            >
              <View style={styles.eventDateChip}>
                <AppText style={styles.eventDateMonth}>{eventDate.month}</AppText>
                <AppText style={styles.eventDateDay}>{eventDate.day}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText
                  style={styles.contentTitle}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {event.title}
                </AppText>
                <AppText variant="caption" style={styles.contentSub} numberOfLines={1}>
                  {eventDate.time}
                  {event.location ? ` - ${event.location}` : ''}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
            </Pressable>
          );
        })}

        {visibleCampaigns.map((campaign) => {
          const raisedPct = getRaisedPct(campaign);
          return (
            <Pressable
              key={campaign.id}
              onPress={() => router.push({ pathname: '/(user)/campaign/[id]', params: { id: campaign.id } } as any)}
              style={({ pressed }) => [styles.contentRow, pressed && styles.contentRowPressed]}
            >
              <View style={[styles.contentIcon, styles.contentIconCampaign]}>
                <Ionicons name="heart-outline" size={16} color="#0369A1" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <AppText
                  style={styles.contentTitle}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {campaign.title}
                </AppText>
                {raisedPct !== null ? (
                  <View style={{ gap: 3 }}>
                    <View style={styles.campaignTrack}>
                      <View style={[styles.campaignFill, { width: `${raisedPct}%` as any }]} />
                    </View>
                    <AppText variant="caption" style={styles.contentSub}>
                      {formatCurrencyGBP(campaign.raised_cents) ?? '£0'} raised
                      {campaign.goal_cents ? ` · ${raisedPct}% of ${formatCurrencyGBP(campaign.goal_cents)}` : ''}
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="caption" style={styles.contentSub}>Active campaign</AppText>
                )}
              </View>
              <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
            </Pressable>
          );
        })}

        {notice ? (
          <Pressable
            onPress={() => navigateTo('announcements')}
            style={({ pressed }) => [styles.contentRow, pressed && styles.contentRowPressed]}
          >
            <View style={[styles.contentIcon, notice.is_pinned ? styles.contentIconPinned : styles.contentIconAnnouncement]}>
              <Ionicons
                name={notice.is_pinned ? 'pin' : 'megaphone-outline'}
                size={16}
                color="#0369A1"
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText
                style={styles.contentTitle}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {notice.title}
              </AppText>
              {notice.summary ? (
                <AppText variant="caption" style={styles.contentSub} numberOfLines={1}>{notice.summary}</AppText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={navigateToMosque}
        style={({ pressed }) => [styles.contentFooter, pressed && styles.contentRowPressed]}
      >
        <AppText style={styles.contentFooterText}>Open mosque page</AppText>
        <Ionicons name="chevron-forward" size={14} color="#0369A1" />
      </Pressable>
    </AppCard>
  );
});

// ─── RemainingPrayersStrip ────────────────────────────────────────────────────
type RemainingPrayersStripProps = {
  prayerTimes: NormalizedPrayerTimes | null;
  nextDayPrayerTimes: NormalizedPrayerTimes | null;
  nextPrayerName: PrayerName | null;
  notOffered: readonly string[];
  reasons: Record<string, string>;
  clockMs: number;
  loading: boolean;
};

const PRAYER_DISPLAY_NAMES: Record<PrayerName, string> = {
  fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
};
const ALL_PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const RemainingPrayersStrip = React.memo(function RemainingPrayersStrip({
  prayerTimes, nextDayPrayerTimes, nextPrayerName, clockMs, loading, notOffered, reasons,
}: RemainingPrayersStripProps) {
  const [expandedPrayer, setExpandedPrayer] = useState<PrayerName | null>(null);
  const now = new Date(clockMs);

  const { items, tomorrowFajrLabel } = useMemo(() => {
    if (!prayerTimes && !notOffered.length) return { items: [], tomorrowFajrLabel: null };

    const allItems = ALL_PRAYERS.map((p) => {
      const excluded = notOffered.includes(p);
      // The calculated time is still informative even when the mosque
      // doesn't hold this prayer in congregation, so it's always computed.
      const adhan = prayerTimes?.[p]?.adhan;
      const passed = adhan ? adhan.getTime() < now.getTime() : true;
      const isNext = !excluded && p === nextPrayerName && !passed;
      const timeLabel = adhan
        ? adhan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : null;
      const iqama = excluded ? null : prayerTimes?.[p]?.iqama;
      const iqamaLabel = iqama ? iqama.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
      return { name: p, passed: !excluded && passed, isNext, timeLabel, iqamaLabel, excluded };
    });

    const allDone = allItems.every((i) => i.passed || i.excluded);
    let tomorrowFajr: string | null = null;
    if (allDone && nextDayPrayerTimes && !notOffered.includes('fajr')) {
      const fajrAdhan = nextDayPrayerTimes.fajr?.adhan;
      if (fajrAdhan) {
        tomorrowFajr = fajrAdhan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
    }

    return { items: allItems, tomorrowFajrLabel: tomorrowFajr };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerTimes, nextDayPrayerTimes, nextPrayerName, clockMs, notOffered]);

  if (!loading && !items.length) return null;

  return (
    <View style={styles.remainingWrap}>
      <View style={styles.remainingHeader}>
        <Text style={styles.remainingLabel}>Today</Text>
        {!loading && tomorrowFajrLabel ? (
          <View style={styles.tomorrowFajrChip}>
            <Text style={styles.tomorrowFajrChipText} numberOfLines={1}>
              Tomorrow · Fajr {tomorrowFajrLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.remainingScroll}>
        {loading
          ? [1, 2, 3, 4, 5].map((i) => <View key={i} style={styles.prayerPillSkeleton} />)
          : items.map(({ name, passed, isNext, timeLabel, excluded }) => (
              <Pressable key={name}
                disabled={!excluded}
                accessible={excluded}
                accessibilityRole={excluded ? 'button' : undefined}
                accessibilityLabel={`${PRAYER_DISPLAY_NAMES[name]}: ${timeLabel ?? 'Time unavailable'}${excluded ? '. Not offered in congregation here. Tap for more information.' : ''}`}
                accessibilityState={excluded ? { expanded: expandedPrayer === name } : undefined}
                onPress={() => setExpandedPrayer(current => current === name ? null : name)}
                style={[
                styles.prayerPill,
                passed && styles.prayerPillPassed,
                excluded && styles.prayerPillExcluded,
                isNext && styles.prayerPillNext,
              ]}>
                <Text
                  style={[
                    styles.prayerPillName,
                    passed && styles.prayerPillNamePassed,
                    isNext && styles.prayerPillNameNext,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {PRAYER_DISPLAY_NAMES[name]}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.prayerPillTime,
                    passed && styles.prayerPillTimePassed,
                    excluded && styles.prayerPillTimeExcluded,
                    isNext && styles.prayerPillTimeNext,
                  ]}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {timeLabel ?? '--:--'}
                </Text>
                {excluded ? (
                  <View style={styles.notOfferedBadge}>
                    <Ionicons name="information" size={9} color="#FFFFFF" />
                  </View>
                ) : isNext ? <View style={styles.prayerPillDot} /> : null}
              </Pressable>
            ))}
      </View>
      {!loading && items.some(item => item.iqamaLabel) ? <>
        <Text style={styles.iqamaHeading}>Iqamah</Text>
        <View style={styles.remainingScroll}>
          {items.map(item => <View key={item.name} style={[styles.iqamaPill, item.excluded && styles.prayerPillExcluded, item.isNext && styles.prayerPillNext]}>
            <Text style={styles.iqamaTime} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
              accessibilityLabel={`${PRAYER_DISPLAY_NAMES[item.name]} Iqamah: ${item.excluded ? 'Not offered' : item.iqamaLabel ?? 'Not set'}`}>
              {item.iqamaLabel ?? '—'}
            </Text>
          </View>)}
        </View>
      </> : null}
      {expandedPrayer && notOffered.includes(expandedPrayer) ? (
        <View style={styles.prayerAvailabilityInfo} accessibilityLiveRegion="polite">
          <View style={styles.prayerAvailabilityHeader}>
            <View style={styles.prayerAvailabilityHeaderLeft}>
              <View style={styles.prayerAvailabilityIcon}>
                <Ionicons name="information" size={11} color="#FFFFFF" />
              </View>
              <Text style={styles.prayerAvailabilityTitle}>{PRAYER_DISPLAY_NAMES[expandedPrayer]}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close prayer information"
              onPress={() => setExpandedPrayer(null)} style={styles.prayerInfoClose}>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </Pressable>
          </View>
          <Text style={styles.prayerAvailabilityStatus}>Not held in congregation here</Text>
          <Text style={styles.prayerAvailabilityBody}>
            {reasons[expandedPrayer]?.trim() || `A specific reason hasn’t been provided. Please contact the mosque for details.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

// ─── QuoteOfTheDayCard ────────────────────────────────────────────────────────
type QuoteOfTheDayCardProps = { quote: DailyQuote };

const QuoteOfTheDayCard = React.memo(function QuoteOfTheDayCard({ quote }: QuoteOfTheDayCardProps) {
  return (
    <View style={styles.quoteCard}>
      <View style={styles.quoteAccentBar} />
      <View style={styles.quoteBody}>
        <Text style={styles.quoteLabel}>Daily Reflection</Text>
        {quote.text_ar ? (
          <Text style={styles.quoteArabic}>{quote.text_ar}</Text>
        ) : null}
        <Text style={styles.quoteText}>{`“${quote.text_en}”`}</Text>
        {quote.source ? (
          <Text style={styles.quoteSource}>— {quote.source}</Text>
        ) : null}
      </View>
    </View>
  );
});

// ─── Contextual helpers — UNTOUCHED ───────────────────────────────────────────

type LocationChipProps = { status: 'idle' | 'loading' | 'denied'; onPress: () => void };
const LocationChip = React.memo(function LocationChip({ status, onPress }: LocationChipProps) {
  if (status === 'denied') return null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.locationChip, { opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name="location-outline" size={13} color={tokens.color.text.accent} />
      <Text style={styles.locationChipText}>
        {status === 'loading' ? 'Getting location…' : 'Enable nearby features'}
      </Text>
    </Pressable>
  );
});

type TravelBannerProps = { mosqueName: string; distanceKm: number; onDiscover: () => void };
const TravelBanner = React.memo(function TravelBanner({ mosqueName, distanceKm, onDiscover }: TravelBannerProps) {
  return (
    <Pressable onPress={onDiscover} style={({ pressed }) => [styles.travelBanner, { opacity: pressed ? 0.9 : 1 }]}>
      <Ionicons name="location-outline" size={15} color="#92400E" />
      <Text style={styles.travelBannerText} numberOfLines={2}>
        You&apos;re {Math.round(distanceKm)} km from {mosqueName}. Find a mosque near you.
      </Text>
      <Ionicons name="chevron-forward" size={14} color="#92400E" />
    </Pressable>
  );
});

type MyMosquesStripProps = {
  mosques: Mosque[];
  primaryMosqueId: string | null;
  liveMosqueIds: Set<string>;
  router: ReturnType<typeof useRouter>;
};

const MyMosquesStrip = React.memo(function MyMosquesStrip({
  mosques, primaryMosqueId, liveMosqueIds, router,
}: MyMosquesStripProps) {
  const orderedMosques = useMemo(() => {
    return [...mosques].sort((a, b) => {
      if (a.id === primaryMosqueId) return -1;
      if (b.id === primaryMosqueId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [mosques, primaryMosqueId]);

  if (!orderedMosques.length) return null;

  return (
    <AppCard style={styles.cardContainer}>
      <View style={styles.sectionHeader}>
        <AppText variant="sectionTitle">My Mosques</AppText>
        <Pressable onPress={() => router.push('/(user)/manage-mosques')} hitSlop={6}>
          <AppText variant="body" color={tokens.color.text.accent} style={styles.manageLink}>
            Manage
          </AppText>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mosqueStripContent}
      >
        {orderedMosques.map((mosque) => {
          const isPrimary = mosque.id === primaryMosqueId;
          const isLive = liveMosqueIds.has(mosque.id);
          return (
            <Pressable
              key={mosque.id}
              onPress={() =>
                router.push({
                  pathname: '/(user)/mosque/[id]',
                  params: {
                    id: mosque.id,
                    name: mosque.name,
                    city: mosque.city ?? '',
                    country: mosque.country ?? '',
                  },
                } as any)
              }
              style={({ pressed }) => [styles.mosqueStripChip, pressed && { opacity: 0.82 }]}
            >
              <View style={[styles.stripAvatar, isPrimary && styles.stripAvatarPrimary, isLive && styles.stripAvatarLive]}>
                <AppText style={[styles.stripAvatarText, isLive && styles.stripAvatarTextLive]}>
                  {initials(mosque.name)}
                </AppText>
                {isLive ? <View style={styles.stripLiveDot} /> : null}
              </View>
              <AppText style={styles.stripName} numberOfLines={1}>{mosque.name}</AppText>
              {isLive ? (
                <View style={styles.stripLivePill}>
                  <AppText style={styles.stripLivePillText}>LIVE</AppText>
                </View>
              ) : isPrimary ? (
                <AppText style={styles.stripMetaText} numberOfLines={1}>Selected</AppText>
              ) : mosque.city ? (
                <AppText style={styles.stripMetaText} numberOfLines={1}>{mosque.city}</AppText>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </AppCard>
  );
});

// ─── CrossMosqueAlertBanner ──────────────────────────────────────────────────
type CrossMosqueAlertBannerProps = {
  alerts: CrossMosqueAlert[];
  router: ReturnType<typeof useRouter>;
};

const CrossMosqueAlertBanner = React.memo(function CrossMosqueAlertBanner({
  alerts, router,
}: CrossMosqueAlertBannerProps) {
  if (!alerts.length) return null;
  return (
    <View style={styles.crossAlertWrap}>
      {alerts.map(({ announcement, mosque }) => (
        <Pressable
          key={announcement.id}
          onPress={() =>
            router.push({
              pathname: '/(user)/mosque/[id]',
              params: { id: mosque.id, focus: 'urgent' },
            } as any)
          }
          style={({ pressed }) => [styles.crossAlertRow, pressed && styles.crossAlertRowPressed]}
        >
          <View style={styles.crossAlertLeftBar} />
          <View style={styles.crossAlertIcon}>
            <Ionicons name="alert-circle" size={14} color="#B91C1C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.crossAlertMosque} numberOfLines={1}>{mosque.name}</Text>
            <Text style={styles.crossAlertTitle} numberOfLines={1}>{announcement.title}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#B91C1C" />
        </Pressable>
      ))}
    </View>
  );
});

type ListenerFirstRunProps = {
  onDiscover: () => void;
  onUseLocation: () => void;
  onRequestMosque: () => void;
  locationStatus: 'idle' | 'loading' | 'enabled' | 'denied';
};

const ListenerFirstRun = React.memo(function ListenerFirstRun({
  onDiscover,
  onUseLocation,
  onRequestMosque,
  locationStatus,
}: ListenerFirstRunProps) {
  const benefits: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
  }> = [
    {
      icon: 'time-outline',
      title: 'Prayer times you can trust',
      description: 'See the schedule published by your mosque.',
    },
    {
      icon: 'radio-outline',
      title: 'Live Adhan',
      description: 'Listen whenever your mosque starts a broadcast.',
    },
    {
      icon: 'megaphone-outline',
      title: 'Local updates',
      description: 'Keep up with Jumu’ah, events and announcements.',
    },
  ];

  return (
    <View style={styles.firstRunWrap}>
      <View style={styles.firstRunHero}>
        <View style={styles.firstRunIcon}>
          <Ionicons name="business" size={26} color="#FFFFFF" />
        </View>
        <AppText style={styles.firstRunEyebrow}>WELCOME</AppText>
        <AppText style={styles.firstRunTitle}>Let’s find your mosque</AppText>
        <AppText style={styles.firstRunBody}>
          Follow the mosque you pray with to make this home screen yours.
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find my mosque"
          accessibilityHint="Search by name, city, or your current location"
          onPress={onDiscover}
          style={({ pressed }) => [
            styles.firstRunPrimary,
            pressed && styles.firstRunPressed,
          ]}
        >
          <Ionicons name="search" size={20} color="#FFFFFF" />
          <AppText style={styles.firstRunPrimaryText}>Find my mosque</AppText>
          <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
        </Pressable>
        {locationStatus !== 'enabled' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find mosques near me"
            onPress={onUseLocation}
            disabled={locationStatus === 'loading' || locationStatus === 'denied'}
            style={({ pressed }) => [
              styles.firstRunLocation,
              pressed && styles.firstRunPressed,
              (locationStatus === 'loading' || locationStatus === 'denied') && { opacity: 0.65 },
            ]}
          >
            {locationStatus === 'loading' ? (
              <ActivityIndicator size="small" color="#0369A1" />
            ) : (
              <Ionicons name="navigate-outline" size={19} color="#0369A1" />
            )}
            <AppText style={styles.firstRunLocationText}>
              {locationStatus === 'denied' ? 'Location is off — search instead' : 'Show mosques near me'}
            </AppText>
          </Pressable>
        ) : null}
        <View style={styles.firstRunPrivacyRow}>
          <Ionicons name="location-outline" size={14} color="#47637B" />
          <AppText style={styles.firstRunPrivacyText}>
            Search by name or choose Near me—location is always optional.
          </AppText>
        </View>
      </View>

      <View style={styles.firstRunBenefits}>
        <AppText style={styles.firstRunBenefitsTitle}>Following a mosque unlocks</AppText>
        {benefits.map((benefit) => (
          <View key={benefit.title} style={styles.firstRunBenefitRow}>
            <View style={styles.firstRunBenefitIcon}>
              <Ionicons name={benefit.icon} size={18} color="#0284C7" />
            </View>
            <View style={styles.firstRunBenefitCopy}>
              <AppText style={styles.firstRunBenefitTitle}>{benefit.title}</AppText>
              <AppText style={styles.firstRunBenefitBody}>{benefit.description}</AppText>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onRequestMosque}
        style={({ pressed }) => [
          styles.firstRunMissing,
          pressed && styles.firstRunPressed,
        ]}
      >
        <View style={styles.firstRunMissingIcon}>
          <Ionicons name="add" size={18} color="#4F765B" />
        </View>
        <View style={styles.firstRunBenefitCopy}>
          <AppText style={styles.firstRunMissingTitle}>Can’t find your mosque?</AppText>
          <AppText style={styles.firstRunMissingBody}>Ask us to add it</AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#4F765B" />
      </Pressable>
    </View>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const accessToken = session?.access_token ?? null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [rawAnnouncements, setRawAnnouncements] = useState<RawAnnouncement[]>([]);
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [rawCampaigns, setRawCampaigns] = useState<RawCampaign[]>([]);
  const [primaryJumuah, setPrimaryJumuah] = useState<{ mosqueId: string; slots: JumuahSlot[] } | null>(null);
  const [liveStreams, setLiveStreams] = useState<Record<string, StreamRow>>({});
  const [prayerTimes, setPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  const [nextDayPrayerTimes, setNextDayPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  const [prayerLoading, setPrayerLoading] = useState(false);
  const [prayerError, setPrayerError] = useState<string | null>(null);
  const [defaultMosqueId, setDefaultMosqueId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'enabled' | 'denied'>('idle');
  const [showMosquePicker, setShowMosquePicker] = useState(false);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const [todayQuote, setTodayQuote] = useState<DailyQuote | null>(null);
  const [crossMosqueAlerts, setCrossMosqueAlerts] = useState<CrossMosqueAlert[]>([]);
  const [homeLoaded, setHomeLoaded] = useState(false);

  const prayerRequestIdRef = useRef(0);
  const prayerLoadedMosqueRef = useRef<string | null>(null);
  const lastMosqueIdsRef = useRef('');
  const lastSubIdsRef = useRef('');
  const refreshIdRef = useRef(0);
  // This route is the Listener workspace for every authenticated person,
  // including people who also hold admin or muezzin permissions.
  const nearby = useMosquesNearby(15, userLocation, true);
  const currentAreaLocation = nearby.coordinates ?? userLocation;

  // ── Derived ────────────────────────────────────────────────────────────────

  const subscribedIds = useMemo(() => new Set(subs.map((s) => s.mosque_id)), [subs]);

  // Shared Map used by primaryMosque, render loops, and cross-mosque alerts.
  const mosqueById = useMemo(() => new Map(mosques.map((m) => [m.id, m])), [mosques]);

  const primaryMosque = useMemo(() => {
    const validDefaultId = defaultMosqueId && subscribedIds.has(defaultMosqueId) ? defaultMosqueId : null;
    const preferredIds = [validDefaultId, subs[0]?.mosque_id].filter(Boolean) as string[];

    for (const id of preferredIds) {
      const mosque = mosqueById.get(id);
      if (mosque) return mosque;
    }

    return null;
  }, [subs, mosqueById, defaultMosqueId, subscribedIds]);

  const followedMosques = useMemo(() => {
    return mosques.filter((m) => subscribedIds.has(m.id));
  }, [mosques, subscribedIds]);

  const primaryMosqueAnnouncements = useMemo(
    () => rawAnnouncements.filter((a) => a.mosque_id === primaryMosque?.id),
    [rawAnnouncements, primaryMosque?.id]
  );
  const primaryMosqueEvents = useMemo(
    () => rawEvents.filter((e) => e.mosque_id === primaryMosque?.id),
    [rawEvents, primaryMosque?.id]
  );
  const primaryMosqueCampaigns = useMemo(
    () => rawCampaigns.filter((c) => c.mosque_id === primaryMosque?.id),
    [rawCampaigns, primaryMosque?.id]
  );

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadDefault = React.useCallback(async () => {
    try {
      const stored = await getDefaultMosqueId(userId);
      setDefaultMosqueId(stored ?? null);
      return stored ?? null;
    } catch {
      setDefaultMosqueId(null);
      return null;
    }
  }, [userId]);

  const loadHomeData = React.useCallback(async () => {
    const [mosqueRes, subsRes, streamsRes] = await Promise.all([
      supabase
        .from('mosques')
        .select('id, name, city, country, status, lat, lng, prayers_not_offered, prayers_not_offered_reasons')
        .order('name', { ascending: true })
        .limit(200),
      userId
        ? supabase.from('subscriptions').select('mosque_id').eq('user_id', userId)
        : Promise.resolve({ data: [] as Subscription[], error: null }),
      supabase
        .from('streams')
        .select('id, mosque_id, type, is_live, status, started_at, current_prayer')
        .eq('is_live', true)
        .order('started_at', { ascending: false, nullsFirst: false }),
    ]);

    let mosqueRows = !mosqueRes.error && mosqueRes.data ? (mosqueRes.data as Mosque[]) : [];
    const subscriptionRows =
      !subsRes.error && subsRes.data ? normalizeSubscriptions(subsRes.data as Subscription[]) : [];

    const loadedMosqueIds = new Set(mosqueRows.map((m) => m.id));
    const missingIds = subscriptionRows
      .map((s) => s.mosque_id)
      .filter((id) => !loadedMosqueIds.has(id));

    if (missingIds.length) {
      const { data: extra, error: extraErr } = await supabase
        .from('mosques')
        .select('id, name, city, country, status, prayers_not_offered, prayers_not_offered_reasons')
        .in('id', missingIds);
      if (!extraErr && extra) mosqueRows = mergeMosqueRows(mosqueRows, extra as Mosque[]);
    }

    if (!mosqueRes.error || mosqueRows.length) {
      const ids = mosqueRows.map((m) => m.id).sort().join(',');
      if (ids !== lastMosqueIdsRef.current) {
        lastMosqueIdsRef.current = ids;
        setMosques(mosqueRows);
      }
    }
    if (!subsRes.error) {
      const ids = subscriptionRows.map((s) => s.mosque_id).sort().join(',');
      if (ids !== lastSubIdsRef.current) {
        lastSubIdsRef.current = ids;
        setSubs(subscriptionRows);
      }
    }
    if (!streamsRes.error && streamsRes.data) {
      setLiveStreams(buildLiveStreamMap(streamsRes.data as StreamRow[]));
    } else {
      setLiveStreams({});
    }

    setHomeLoaded(true);

    return { mosques: mosqueRows, subs: subscriptionRows };
  }, [userId]);

  const loadPrayerTimes = React.useCallback(async (mosqueId?: string | null) => {
    const requestId = ++prayerRequestIdRef.current;
    if (!mosqueId) {
      if (requestId === prayerRequestIdRef.current) {
        prayerLoadedMosqueRef.current = null;
        setPrayerTimes(null);
        setNextDayPrayerTimes(null);
        setPrayerError(null);
        setPrayerLoading(false);
      }
      return;
    }
    const isFirstLoad = prayerLoadedMosqueRef.current !== mosqueId;
    if (isFirstLoad) setPrayerLoading(true);
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const [normalized, normalizedTomorrow] = await Promise.all([
        getDailyPrayerTimes(mosqueId, today),
        getDailyPrayerTimes(mosqueId, tomorrow),
      ]);
      if (requestId !== prayerRequestIdRef.current) return;
      prayerLoadedMosqueRef.current = mosqueId;
      setPrayerError(null);
      setPrayerTimes(normalized);
      setNextDayPrayerTimes(normalizedTomorrow);
    } catch {
      if (requestId !== prayerRequestIdRef.current) return;
      if (isFirstLoad) {
        setPrayerError('Could not load prayer times.');
        setPrayerTimes(null);
        setNextDayPrayerTimes(null);
      }
    } finally {
      if (requestId === prayerRequestIdRef.current && isFirstLoad) setPrayerLoading(false);
    }
  }, []);

  const requestUserLocation = useCallback(async () => {
    if (locationStatus === 'loading') return;
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationStatus('denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setLocationStatus('enabled');
    } catch {
      setLocationStatus('idle');
    }
  }, [locationStatus]);

  const handleSwitchMosque = useCallback(
    async (mosque: Mosque) => {
      setShowMosquePicker(false);
      setDefaultMosqueId(mosque.id);
      try {
        await persistDefaultMosqueId(userId, mosque.id, accessToken);
      } catch { /* best-effort persistence */ }
    },
    [accessToken, userId]
  );

  const onRefresh = React.useCallback(async () => {
    const refreshId = ++refreshIdRef.current;
    const visibleMosqueId = primaryMosque?.id ?? defaultMosqueId ?? subs[0]?.mosque_id ?? null;
    setRefreshing(true);
    try {
      await withTimeout(
        (async () => {
          const visiblePrayerRefresh = visibleMosqueId
            ? loadPrayerTimes(visibleMosqueId)
            : Promise.resolve();

          const [defaultResult, homeResult] = await Promise.allSettled([
            loadDefault(),
            loadHomeData(),
            visiblePrayerRefresh,
          ]);

          const storedDefaultId = defaultResult.status === 'fulfilled' ? defaultResult.value : null;
          const latestSubs = homeResult.status === 'fulfilled' ? homeResult.value.subs : subs;
          const latestSubIds = new Set(latestSubs.map((s) => s.mosque_id));
          const validDefaultId = storedDefaultId && latestSubIds.has(storedDefaultId) ? storedDefaultId : null;
          const preferredId = validDefaultId ?? latestSubs[0]?.mosque_id ?? visibleMosqueId;

          await Promise.allSettled([
            preferredId && preferredId !== visibleMosqueId ? loadPrayerTimes(preferredId) : Promise.resolve(),
            userLocation ? nearby.refetch() : Promise.resolve(),
          ]);
          setContentRefreshKey((key) => key + 1);
        })(),
        HOME_REFRESH_TIMEOUT_MS,
        'Home refresh'
      );
    } catch (error: any) {
      console.warn('[listener.home] refresh ended early', error?.message ?? error);
    } finally {
      if (refreshId === refreshIdRef.current) setRefreshing(false);
    }
  }, [
    defaultMosqueId,
    loadDefault,
    loadHomeData,
    loadPrayerTimes,
    primaryMosque?.id,
    subs,
    nearby.refetch,
    userLocation,
  ]);

  // ── Stable UI callbacks (prevent React.memo thrashing on memoised children) ──

  const openMosquePicker = useCallback(() => setShowMosquePicker(true), []);
  const closeMosquePicker = useCallback(() => setShowMosquePicker(false), []);
  const openDiscover = useCallback(() => router.push('/(user)/discover'), [router]);
  const openNearbyMosques = useCallback(
    () => router.push({ pathname: '/(user)/discover', params: { view: 'nearby' } }),
    [router]
  );
  const requestMissingMosque = useCallback(
    () => router.push('/(user)/request-mosque'),
    [router]
  );
  const manageMosques = useCallback(() => {
    setShowMosquePicker(false);
    router.push('/(user)/manage-mosques');
  }, [router]);
  const handleListenLive = useCallback(
    (mosqueId: string) =>
      router.push({
        pathname: '/(user)/now',
        params: { mosqueId },
      }),
    [router]
  );
  const handleOpenNearbyMosque = useCallback(
    (mosque: NearbyMosque) => router.push({
      pathname: '/(user)/mosque/[id]',
      params: {
        id: mosque.id,
        name: mosque.name,
        city: mosque.city,
        country: mosque.country,
      },
    }),
    [router]
  );
  const handleNearbyDirections = useCallback((mosque: NearbyMosque) => {
    const label = encodeURIComponent(mosque.name);
    const destination = `${mosque.latitude},${mosque.longitude}`;
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destination}&q=${label}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
    void Linking.openURL(url);
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useFocusEffect(
    React.useCallback(() => {
      void loadHomeData();
      void loadDefault();
      void loadPrayerTimes(primaryMosque?.id);
      setContentRefreshKey((key) => key + 1);
    }, [loadDefault, loadHomeData, loadPrayerTimes, primaryMosque?.id])
  );

  // Live stream realtime + polling for the Listener workspace.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { if (!cancelled) void loadHomeData(); };
    const channel = supabase.channel(`listener-home-live-${userId ?? 'guest'}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, refresh);
    if (userId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
        refresh
      );
    }
    channel.subscribe();
    const pollId = setInterval(refresh, LIVE_REFRESH_MS);
    return () => { cancelled = true; clearInterval(pollId); supabase.removeChannel(channel); };
  }, [loadHomeData, userId]);

  // 30-second clock tick — remaining display is HH:MM so minute granularity is sufficient.
  useEffect(() => {
    const id = setInterval(() => setClockMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Lazy-load mosque that is stored as default but not in the main list
  useEffect(() => {
    if (!defaultMosqueId || !subscribedIds.has(defaultMosqueId)) return;
    if (mosques.find((m) => m.id === defaultMosqueId)) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('mosques')
        .select('id, name, city, country, status, prayers_not_offered, prayers_not_offered_reasons')
        .eq('id', defaultMosqueId)
        .maybeSingle();
      if (!cancelled && data && !error) setMosques((prev) => [...prev, data]);
    })();
    return () => { cancelled = true; };
  }, [defaultMosqueId, mosques, subscribedIds]);

  useEffect(() => { loadPrayerTimes(primaryMosque?.id); }, [loadPrayerTimes, primaryMosque?.id]);
  usePrayerTimesRealtime(
    primaryMosque?.id,
    () => {
      void loadPrayerTimes(primaryMosque?.id);
    },
    { channelName: 'listener-home-prayer-times' }
  );

  // Load "What's On" content for the actual primary mosque only.
  useEffect(() => {
    if (!primaryMosque?.id) {
      setRawAnnouncements([]);
      setRawEvents([]);
      setRawCampaigns([]);
      setPrimaryJumuah(null);
      setTodayQuote(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const now = new Date();
      const todayStartIso = startOfTodayIso(now);
      const todayDateIso = formatLocalDate(now);

      const [announcementRes, eventRes, campaignRes, jumuahRes, quoteRes] = await Promise.all([
        supabase
          .from('announcements')
          .select('id,mosque_id,title,summary,created_at,is_urgent,is_pinned')
          .eq('mosque_id', primaryMosque.id)
          .eq('status', 'published')
          .order('is_urgent', { ascending: false })
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('events')
          .select('id,mosque_id,title,start_at,location')
          .eq('mosque_id', primaryMosque.id)
          .eq('status', 'published')
          .eq('is_public', true)
          .gte('start_at', todayStartIso)
          .order('start_at', { ascending: true })
          .limit(10),
        supabase
          .from('campaigns')
          .select('id,mosque_id,title,end_at,raised_cents,goal_cents')
          .eq('mosque_id', primaryMosque.id)
          .eq('status', 'active')
          .or(`end_at.is.null,end_at.gte.${todayDateIso}`)
          .order('end_at', { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from('mosque_jumuah_slots')
          .select('id,label,khutbah_at,salah_at,venue')
          .eq('mosque_id', primaryMosque.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('salah_at', { ascending: true }),
        supabase
          .from('mosque_daily_quotes')
          .select('id,text_en,text_ar,source')
          .eq('mosque_id', primaryMosque.id)
          .eq('quote_date', todayDateIso)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setRawAnnouncements(announcementRes.error ? [] : (announcementRes.data ?? []) as RawAnnouncement[]);
      setRawEvents(eventRes.error ? [] : (eventRes.data ?? []) as RawEvent[]);
      setRawCampaigns(campaignRes.error ? [] : (campaignRes.data ?? []) as RawCampaign[]);
      setPrimaryJumuah({ mosqueId: primaryMosque.id, slots: jumuahRes.error ? [] : (jumuahRes.data ?? []) as JumuahSlot[] });
      setTodayQuote(!quoteRes.error && quoteRes.data ? (quoteRes.data as DailyQuote) : null);
    })();

    return () => { cancelled = true; };
  }, [primaryMosque?.id, contentRefreshKey]);

  // Load urgent announcements from ALL followed mosques (cross-mosque urgent alerts).
  // Excludes the primary mosque — its urgents are shown inside the "What's On" card.
  useEffect(() => {
    const secondarySubIds = subs
      .map((s) => s.mosque_id)
      .filter((mosqueId) => mosqueId && mosqueId !== primaryMosque?.id);
    if (!secondarySubIds.length) { setCrossMosqueAlerts([]); return; }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id,mosque_id,title,summary,created_at,is_urgent,is_pinned')
        .in('mosque_id', secondarySubIds)
        .eq('is_urgent', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(3);

      if (cancelled) return;
      if (error || !data) {
        setCrossMosqueAlerts([]);
        return;
      }
      const alerts: CrossMosqueAlert[] = (data as RawAnnouncement[])
        .reduce<CrossMosqueAlert[]>((acc, ann) => {
          const mosque = mosqueById.get(ann.mosque_id);
          if (mosque) acc.push({ announcement: ann, mosque });
          return acc;
        }, [])
        .slice(0, 3);
      setCrossMosqueAlerts(alerts);
    })();

    return () => { cancelled = true; };
  }, [subs, mosqueById, primaryMosque?.id, contentRefreshKey]);

  // Silently activate location if permission was already granted in a prior session
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocationStatus('enabled');
      } catch { /* unavailable */ }
    })();
  }, []);

  // ── Memos ──────────────────────────────────────────────────────────────────

  const distanceFromHomeMosque = useMemo(() => {
    if (!currentAreaLocation || primaryMosque?.lat == null || primaryMosque?.lng == null) return null;
    return haversineKm(
      currentAreaLocation.latitude, currentAreaLocation.longitude,
      Number(primaryMosque.lat), Number(primaryMosque.lng)
    );
  }, [currentAreaLocation, primaryMosque]);

  const isTravelling = distanceFromHomeMosque !== null && distanceFromHomeMosque > 30;

  const nextPrayer = useMemo(
    () => {
      const filterOffered = (times: NormalizedPrayerTimes | null) => times ? Object.fromEntries(
        ALL_PRAYERS.map((name) => [name, primaryMosque?.prayers_not_offered?.includes(name)
          ? { adhan: null, iqama: null } : times[name]])
      ) as NormalizedPrayerTimes : null;
      return computeNextPrayerSummaryAcrossDays(filterOffered(prayerTimes), filterOffered(nextDayPrayerTimes), new Date(clockMs));
    },
    [clockMs, prayerTimes, nextDayPrayerTimes, primaryMosque?.prayers_not_offered]
  );

  // Freshness uses Date.now() at evaluation time; 15 s polling catches any
  // stream that crosses the 20-min window between evaluations.
  const freshLiveStreams = useMemo(() => {
    const next: Record<string, StreamRow> = {};
    for (const [mosqueId, stream] of Object.entries(liveStreams)) {
      if (isFreshLiveStream(stream)) next[mosqueId] = stream;
    }
    return next;
  }, [liveStreams]);
  const liveMosqueIds = useMemo(() => new Set(Object.keys(freshLiveStreams)), [freshLiveStreams]);

  // ── Live broadcast state for primary mosque (UNTOUCHED logic) ─────────────

  const liveInfo = useLiveStreamForMosque(primaryMosque?.id);
  const primaryLiveStream = primaryMosque ? freshLiveStreams[primaryMosque.id] ?? null : null;
  const primaryIsLive = !!primaryLiveStream || liveInfo.isLive;

  const primaryLivePrayerLabel = useMemo(() => {
    const rawPrayer = liveInfo.currentAdhan?.prayer ?? primaryLiveStream?.current_prayer ?? null;
    if (!rawPrayer) return 'Adhan';
    const normalized = rawPrayer.toString().trim().toLowerCase();
    if (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(normalized)) {
      return labelForPrayer(normalized as PrayerName);
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [liveInfo.currentAdhan?.prayer, primaryLiveStream?.current_prayer]);

  const primaryLiveStartedLabel = useMemo(() => {
    const startedAt = primaryLiveStream?.started_at ?? liveInfo.currentAdhan?.started_at ?? null;
    if (!startedAt) return 'Broadcasting now';
    return `Started ${new Date(startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }, [liveInfo.currentAdhan?.started_at, primaryLiveStream?.started_at]);

  const otherMosqueLive = useMemo(
    () => Object.keys(freshLiveStreams).some((id) => id !== primaryMosque?.id && subscribedIds.has(id)),
    [freshLiveStreams, primaryMosque?.id, subscribedIds]
  );

  const topPad = Platform.OS === 'android' ? 8 : 0;

  // ── Listener workspace ─────────────────────────────────────────────────────

  const otherLive = Object.entries(freshLiveStreams).filter(
    ([mosqueId]) => mosqueId !== primaryMosque?.id && subscribedIds.has(mosqueId)
  );

  if (userId && homeLoaded && !primaryMosque && subs.length === 0) {
    return (
      <ScreenContainer
        contentStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.color.text.accent}
          />
        }
      >
        <View style={styles.headerRow}>
          <AppLogo size={30} />
          <AppText variant="title" style={styles.appTitle}>Adhan Connect</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/(user)/settings')}
            hitSlop={12}
          >
            <Ionicons name="settings-outline" size={22} color="#0F172A" />
          </Pressable>
        </View>
        <ListenerFirstRun
          onDiscover={openDiscover}
          onUseLocation={requestUserLocation}
          onRequestMosque={requestMissingMosque}
          locationStatus={locationStatus}
        />
        {currentAreaLocation ? (
          <NearYouNowCard
            mosques={nearby.mosques}
            loading={nearby.loading}
            error={nearby.error}
            freshAsOf={nearby.freshAsOf}
            onRefresh={() => void nearby.refetch()}
            onViewMosque={handleOpenNearbyMosque}
            onListen={(mosque) => handleListenLive(mosque.id)}
            onDirections={handleNearbyDirections}
            limit={3}
          />
        ) : null}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      contentStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.color.text.accent} />
      }
    >
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <AppLogo size={30} />
        <AppText variant="title" style={styles.appTitle}>Adhan Connect</AppText>
        <Pressable onPress={() => router.push('/(user)/settings')} hitSlop={12}>
          <Ionicons name="settings-outline" size={22} color="#0F172A" />
        </Pressable>
      </View>

      {!userId ? (
        <AppCard subtle style={styles.discoveryCard}>
          <AppText variant="sectionTitle">Browsing as a guest</AppText>
          <AppText variant="body" style={styles.discoverySubtitle}>
            Explore public mosque information. Sign in to follow mosques, save
            attendance plans, use account preferences or listen to live audio.
          </AppText>
          <AppButton
            title="Sign in or create account"
            onPress={() =>
              router.push({
                pathname: '/sign-in',
                params: { reason: 'required' },
              } as any)
            }
            style={styles.discoveryBtn}
          />
        </AppCard>
      ) : null}

      {/* ── Mosque identity bar ── */}
      <MosqueIdentityBar
        mosque={primaryMosque}
        canSwitch={followedMosques.length > 1}
        onSwitch={openMosquePicker}
        onDiscover={openDiscover}
        hasSubscriptions={subs.length > 0}
        otherMosqueLive={otherMosqueLive}
      />

      {/* ── Mosque picker modal ── */}
      <MosquePickerSheet
        visible={showMosquePicker}
        mosques={followedMosques}
        selectedId={primaryMosque?.id ?? null}
        onSelect={handleSwitchMosque}
        onClose={closeMosquePicker}
        onManage={manageMosques}
      />

      {/* ── Discover CTA for new users with no mosque ── */}
      {subs.length === 0 && (
        <AppCard subtle style={styles.discoveryCard}>
          <AppText variant="sectionTitle">Find Your Mosque</AppText>
          <AppText variant="body" style={styles.discoverySubtitle}>
            Follow a mosque to see prayer times and live adhans.
          </AppText>
          <AppButton
            title="Discover Mosques"
            onPress={() => router.push('/(user)/discover')}
            style={styles.discoveryBtn}
          />
        </AppCard>
      )}

      {/* ── Contextual: location chip / travel banner ── */}
      {locationStatus === 'idle' && (
        <LocationChip status="idle" onPress={requestUserLocation} />
      )}
      {isTravelling && primaryMosque && distanceFromHomeMosque !== null && (
        <TravelBanner
          mosqueName={primaryMosque.name}
          distanceKm={distanceFromHomeMosque}
          onDiscover={openDiscover}
        />
      )}

      {/* ── Next Prayer / Live hero card — UNTOUCHED ── */}
      <Pressable
        disabled={!primaryMosque}
        onPress={() => {
          if (primaryMosque) {
            if (primaryIsLive) {
              router.push({ pathname: '/(user)/now', params: { mosqueId: primaryMosque.id } });
              return;
            }
            router.push({
              pathname: '/(user)/mosque/[id]',
              params: {
                id: primaryMosque.id,
                name: primaryMosque.name,
                city: primaryMosque.city ?? '',
                country: primaryMosque.country ?? '',
              },
            });
          }
        }}
        style={({ pressed }) => [
          styles.nextCard,
          { opacity: primaryMosque ? (pressed ? 0.92 : 1) : 0.7 },
        ]}
      >
        <AppText variant="label" style={styles.eyebrow}>
          {primaryIsLive ? 'Live Broadcast' : 'Next Prayer'}
        </AppText>
        <View style={{ gap: 6, marginTop: 10 }}>
          <AppText variant="hero" style={styles.nextTime}>
            {primaryIsLive ? 'LIVE' : prayerLoading ? 'Loading...' : nextPrayer?.label ?? '--:--'}
          </AppText>
          <AppText style={styles.nextName}>
            {primaryIsLive
              ? primaryLivePrayerLabel
              : prayerLoading
              ? 'Loading prayer times'
              : nextPrayer?.name
              ? labelForPrayer(nextPrayer.name)
              : 'Prayer times unavailable'}
          </AppText>
          <AppText style={styles.nextEta}>
            {primaryIsLive
              ? primaryLiveStartedLabel
              : prayerLoading
              ? "Checking today's schedule..."
              : nextPrayer?.remaining
              ? `${formatHomeCountdown(nextPrayer.scheduledAt, clockMs)} remaining`
              : prayerError ?? 'Pull to refresh'}
          </AppText>
        </View>
        <View style={{ marginTop: 12 }}>
          {primaryIsLive ? (
            <View style={styles.heroLiveRow}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
              <Ionicons name="radio-outline" size={20} color="#E2E8F0" />
              <Pressable
                onPress={() =>
                  primaryMosque
                    ? router.push({ pathname: '/(user)/now', params: { mosqueId: primaryMosque.id } })
                    : null
                }
                style={({ pressed }) => [styles.listenBtn, { opacity: pressed ? 0.9 : 1 }]}
              >
                <AppText variant="caption" color={tokens.color.text.inverse} style={styles.listenText}>
                  Listen Live
                </AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Pressable>

      {primaryMosque && primaryJumuah?.mosqueId === primaryMosque.id ? (
        <HomeJumuahStrip
          mosqueName={primaryMosque.name}
          slots={primaryJumuah.slots}
          onPress={() => router.push({ pathname: '/(user)/jumuah/[id]', params: { id: primaryMosque.id } })}
        />
      ) : null}

      {/* ── Remaining prayers today (compact strip replacing full table) ── */}
      <RemainingPrayersStrip
        key={primaryMosque?.id ?? 'no-mosque'}
        prayerTimes={prayerTimes}
        nextDayPrayerTimes={nextDayPrayerTimes}
        nextPrayerName={nextPrayer?.name ?? null}
        notOffered={primaryMosque?.prayers_not_offered ?? []}
        reasons={primaryMosque?.prayers_not_offered_reasons ?? {}}
        clockMs={clockMs}
        loading={prayerLoading}
      />

      {/* ── Cross-mosque urgent alerts (from all followed mosques except primary) ── */}
      <CrossMosqueAlertBanner alerts={crossMosqueAlerts} router={router} />

      {primaryMosque ? (
        <PrimaryMosqueContent
          mosqueId={primaryMosque.id}
          announcements={primaryMosqueAnnouncements}
          events={primaryMosqueEvents}
          campaigns={primaryMosqueCampaigns}
          router={router}
        />
      ) : null}

      {/* ── Daily spiritual reflection ── */}
      {todayQuote ? <QuoteOfTheDayCard quote={todayQuote} /> : null}

      {/* My mosques */}
      <MyMosquesStrip
        mosques={followedMosques}
        primaryMosqueId={primaryMosque?.id ?? null}
        liveMosqueIds={liveMosqueIds}
        router={router}
      />

      {/* ── Other live broadcasts from followed mosques ── */}
      {otherLive.length > 0 && (
        <AppCard style={[styles.cardContainer, { gap: 10 }]}>
          <AppText variant="sectionTitle">Other Live Broadcasts</AppText>
          {otherLive.map(([mosqueId]) => {
            const m = mosqueById.get(mosqueId);
            if (!m) return null;
            const city = [m.city, m.country].filter(Boolean).join(', ');
            return (
              <View key={mosqueId} style={styles.otherLiveRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="radio-outline" size={18} color="#0F172A" />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.otherLiveName} numberOfLines={1}>{m.name}</AppText>
                    <AppText variant="caption" style={styles.otherLiveSub} numberOfLines={1}>
                      {city || 'Live broadcast'}
                    </AppText>
                  </View>
                  <View style={styles.liveBadge}>
                    <AppText variant="caption" color={tokens.color.text.inverse} style={styles.liveBadgeText}>
                      LIVE
                    </AppText>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push({ pathname: '/(user)/now', params: { mosqueId } })}
                  hitSlop={6}
                >
                  <AppText variant="body" color={tokens.color.text.accent} style={styles.listenLink}>
                    Listen
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </AppCard>
      )}

      {/* Nearby context stays compact so the primary mosque and prayer remain first. */}
      {currentAreaLocation ? (
        <NearbyHomeSummary
          mosques={nearby.mosques}
          loading={nearby.loading}
          error={nearby.error}
          onOpenNearby={openNearbyMosques}
          onListen={(mosque) => handleListenLive(mosque.id)}
          onRefresh={() => void nearby.refetch()}
        />
      ) : null}

    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollBody: { paddingHorizontal: 20, paddingBottom: 36, gap: 16 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 58, paddingHorizontal: 0,
  },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', letterSpacing: 0.2, color: '#0F172A' },

  // ── First listener visit ──
  firstRunWrap: { gap: 14 },
  firstRunHero: {
    backgroundColor: '#EFF7FF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 20,
  },
  firstRunIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#0284C7',
    marginBottom: 18,
    shadowColor: '#0284C7',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  firstRunEyebrow: {
    color: '#0369A1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  firstRunTitle: {
    color: '#0F172A',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  firstRunBody: {
    color: '#52677C',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  firstRunPrimary: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 17,
    backgroundColor: '#0284C7',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  firstRunPrimaryText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  firstRunLocation: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 10,
    paddingHorizontal: 14,
  },
  firstRunLocationText: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '800',
  },
  firstRunPrivacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
  },
  firstRunPrivacyText: {
    flex: 1,
    color: '#47637B',
    fontSize: 11,
    lineHeight: 16,
  },
  firstRunBenefits: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 4,
  },
  firstRunBenefitsTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  firstRunBenefitRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  firstRunBenefitIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#E0F2FE',
  },
  firstRunBenefitCopy: { flex: 1 },
  firstRunBenefitTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  firstRunBenefitBody: { color: '#64748B', fontSize: 12, lineHeight: 17, marginTop: 2 },
  firstRunMissing: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F1F6EF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE8D8',
    paddingHorizontal: 14,
  },
  firstRunMissingIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#E3EEE0',
  },
  firstRunMissingTitle: { color: '#203126', fontSize: 14, fontWeight: '800' },
  firstRunMissingBody: { color: '#4F765B', fontSize: 12, marginTop: 2 },
  firstRunPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },

  // ── Mosque identity bar ──
  identityBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderRadius: tokens.radius.lg,
    borderWidth: 1, borderColor: tokens.color.border.subtle,
    ...tokens.shadow.card,
  },
  identityBarPressed: { opacity: 0.88 },
  identityBarEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#EFF6FF', borderRadius: tokens.radius.lg,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  identityAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: tokens.color.bg.tintSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  identityAvatarText: { fontWeight: '800', color: '#0369A1', fontSize: 13 },
  identityAvatarEmpty: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center',
  },
  identityEmptyText: { flex: 1, color: '#1D4ED8', fontWeight: '700', fontSize: 13 },
  identityName: { color: tokens.color.text.primary, fontWeight: '800', fontSize: 14 },
  identityCity: { color: tokens.color.text.secondary, marginTop: 1 },
  identitySwitchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#EFF6FF', borderRadius: tokens.radius.pill,
  },
  identitySwitchText: { color: '#0369A1', fontWeight: '800', fontSize: 12 },
  identityLiveDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#F53B57',
  },

  // ── Mosque picker ──
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 36, paddingHorizontal: 20,
    maxHeight: '75%',
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1',
    alignSelf: 'center', marginBottom: 16,
  },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  pickerSub: { color: tokens.color.text.secondary, marginBottom: 16 },
  pickerList: { maxHeight: 320 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: tokens.radius.md, marginBottom: 4,
  },
  pickerRowSelected: { backgroundColor: '#EFF6FF' },
  pickerRowPressed: { opacity: 0.82 },
  pickerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },
  pickerAvatarSelected: { backgroundColor: '#DBEAFE' },
  pickerAvatarText: { fontWeight: '800', color: '#475569', fontSize: 14 },
  pickerAvatarTextSelected: { color: '#1D4ED8' },
  pickerMosqueName: { fontWeight: '700', fontSize: 15, color: '#0F172A' },
  pickerMosqueNameSelected: { color: '#1D4ED8' },
  pickerMosqueCity: { color: tokens.color.text.secondary, marginTop: 2 },
  pickerFooter: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pickerManage: {
    flex: 1, paddingVertical: 14,
    backgroundColor: '#EFF6FF', borderRadius: tokens.radius.lg,
    alignItems: 'center',
  },
  pickerManageText: { fontWeight: '800', color: '#0369A1', fontSize: 15 },
  pickerCancel: {
    flex: 1, paddingVertical: 14,
    backgroundColor: '#F1F5F9', borderRadius: tokens.radius.lg,
    alignItems: 'center',
  },
  pickerCancelText: { fontWeight: '800', color: '#475569', fontSize: 15 },

  // ── Hero card — dark (UNTOUCHED) ──
  eyebrow: { color: '#0EA5E9', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  nextCard: {
    backgroundColor: '#0D1529', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#E6E8EB',
    shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  nextTime: { color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  nextName: { color: '#B4E0FF', fontSize: 18, fontWeight: '800' },
  nextEta: { color: '#7EE0A3', fontSize: 13, fontWeight: '700' },
  heroSource: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  heroLiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 12 },
  liveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F53B57' },
  liveBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  listenBtn: {
    backgroundColor: '#0097F7', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, alignItems: 'center', justifyContent: 'center',
  },
  listenText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  // ── Cards ──
  cardContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: '#E6E8EB',
    shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardSubtitle: { color: '#7A8290', fontSize: 12, marginTop: 2 },
  manageLink: { color: '#0EA5E9', fontWeight: '700', fontSize: 13 },
  titleDivider: { height: 1, backgroundColor: '#E6E8EB', marginVertical: 12 },

  // ── Prayer table (UNTOUCHED) ──
  prayerTable: { marginTop: 8, gap: 8 },
  prayerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 10, minHeight: 44,
  },
  prayerName: { fontWeight: '700', color: '#0F172A', letterSpacing: 0.1 },
  prayerTimeText: { color: '#0F172A', fontWeight: '700' },
  errorText: { color: '#F97316', marginTop: 6, fontSize: 12 },

  // ── What's On content list ──
  contentList: { gap: 6, marginTop: 12 },
  contentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 11,
    borderRadius: 14, backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E6E8EB',
  },
  contentRowUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  contentRowPressed: { opacity: 0.86 },
  contentIcon: {
    width: 34, height: 34, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  contentIconUrgent: { backgroundColor: '#FEE2E2' },
  contentIconCampaign: { backgroundColor: '#FCE7F3' },
  contentIconPinned: { backgroundColor: '#FEF3C7' },
  contentIconAnnouncement: { backgroundColor: '#E0F2FE' },
  contentTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  contentSub: { color: '#64748B', fontSize: 12, marginTop: 1 },
  contentFooter: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 10,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  contentFooterText: { color: '#0369A1', fontSize: 13, fontWeight: '800' },

  // ── Event date chips in What's On ──
  eventDateChip: {
    width: 42,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDateMonth: { color: '#047857', fontSize: 9, fontWeight: '900' },
  eventDateDay: { color: '#065F46', fontSize: 16, fontWeight: '900', marginTop: -1 },

  // ── Campaign progress ──
  campaignTrack: { height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  campaignFill: { height: '100%', borderRadius: 999, backgroundColor: '#10B981' },

  // ── Horizontal mosque strip ──
  mosqueStripContent: { paddingTop: 12, paddingHorizontal: 2, paddingBottom: 4, gap: 12 },
  mosqueStripChip: { alignItems: 'center', width: 76, gap: 5 },
  stripAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center',
  },
  stripAvatarPrimary: { borderWidth: 2, borderColor: '#38BDF8' },
  stripAvatarLive: { backgroundColor: '#FEE2E2', borderWidth: 2, borderColor: '#F53B57' },
  stripAvatarText: { fontWeight: '800', color: '#0369A1', fontSize: 14 },
  stripAvatarTextLive: { color: '#B91C1C' },
  stripLiveDot: {
    position: 'absolute', top: 2, right: 2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#F53B57', borderWidth: 2, borderColor: '#FFFFFF',
  },
  stripName: { fontWeight: '700', fontSize: 12, color: '#0F172A', textAlign: 'center' },
  stripMetaText: { color: '#64748B', fontWeight: '700', fontSize: 10, textAlign: 'center' },
  stripLivePill: {
    backgroundColor: '#F53B57', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  stripLivePillText: { color: '#FFFFFF', fontWeight: '800', fontSize: 10 },

  // ── Nearby / other live ──
  otherLiveRow: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
    shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
    borderWidth: 1, borderColor: '#E6E8EB',
  },
  otherLiveName: { color: '#0F172A', fontWeight: '700' },
  otherLiveSub: { color: '#64748B', fontSize: 12 },
  listenLink: { color: '#0EA5E9', fontWeight: '700', fontSize: 13 },

  // ── Travel / location ──
  locationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', backgroundColor: '#E0F2FE',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  locationChipText: { color: '#0369A1', fontWeight: '700', fontSize: 12 },
  travelBanner: {
    backgroundColor: '#FFF7ED', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  travelBannerText: { flex: 1, color: '#92400E', fontWeight: '600', fontSize: 13 },

  // ── Remaining prayers strip ──
  remainingWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E6E8EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  remainingHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  remainingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  remainingScroll: { flexDirection: 'row', gap: 4 },
  prayerPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 66,
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E6E8EB',
    gap: 2,
    position: 'relative',
  },
  prayerPillNext: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0EA5E9',
  },
  prayerPillExcluded: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  prayerAvailabilityInfo: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#EDF1F5', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, marginTop: 10, gap: 4 },
  prayerAvailabilityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  prayerAvailabilityHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  prayerAvailabilityIcon: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#94A3B8', alignItems: 'center', justifyContent: 'center' },
  prayerAvailabilityTitle: { flex: 1, color: '#0F172A', fontSize: 14, fontWeight: '800' },
  prayerInfoClose: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  prayerAvailabilityStatus: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 0.1 },
  prayerAvailabilityBody: { color: '#475569', fontSize: 13, lineHeight: 20, marginTop: 2 },
  prayerPillPassed: { backgroundColor: '#F8FAFC', borderColor: '#F1F5F9' },
  prayerPillName: { width: '100%', textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#64748B' },
  prayerPillNamePassed: { color: '#CBD5E1' },
  prayerPillNameNext: { color: '#0369A1', fontWeight: '800' },
  prayerPillTime: { width: '100%', textAlign: 'center', fontVariant: ['tabular-nums'], fontSize: 13, fontWeight: '900', color: '#0F172A' },
  prayerPillTimePassed: { color: '#CBD5E1' },
  prayerPillTimeExcluded: { color: '#94A3B8' },
  notOfferedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iqamaHeading: { color: '#64748B', fontSize: 10, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  iqamaPill: { flex: 1, minWidth: 0, minHeight: 27, justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 4, backgroundColor: '#F8FAFC', borderColor: '#E6E8EB', borderWidth: 1, borderRadius: 8 },
  iqamaTime: { color: '#475569', textAlign: 'center', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  prayerPillTimeNext: { color: '#0C4A6E', fontSize: 13, fontWeight: '900' },
  prayerPillDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#0EA5E9', marginTop: 2,
  },
  prayerPillSkeleton: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: '#F1F5F9', opacity: 0.6,
  },
  tomorrowFajrChip: {
    maxWidth: '72%',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  tomorrowFajrChipText: { fontSize: 11, fontWeight: '800', color: '#15803D' },

  // ── Daily reflection / Quote of the Day ──
  quoteCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBF2',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  quoteAccentBar: { width: 4, backgroundColor: '#F59E0B' },
  quoteBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  quoteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  quoteArabic: {
    fontSize: 17,
    color: '#92400E',
    textAlign: 'right',
    lineHeight: 28,
    fontWeight: '500',
    marginBottom: 2,
  },
  quoteText: {
    fontSize: 14,
    color: '#1C1917',
    lineHeight: 22,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  quoteSource: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '700',
    marginTop: 2,
  },

  // ── Discover CTA ──
  discoveryCard: {
    backgroundColor: '#F9FAFB', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 16,
    marginTop: 8, marginBottom: 36,
    borderWidth: 1, borderColor: '#E6E8EB',
    shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  discoveryBtn: {
    backgroundColor: '#0097F7', paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    width: '100%', height: 48, marginTop: 12,
  },
  discoverySubtitle: { color: '#64748B', fontSize: 13, marginTop: 6 },

  // ── Cross-mosque urgent alerts ──
  crossAlertWrap: { gap: 8 },
  crossAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 0,
    paddingRight: 14,
    paddingVertical: 11,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    overflow: 'hidden',
  },
  crossAlertRowPressed: { opacity: 0.85 },
  crossAlertLeftBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#DC2626',
  },
  crossAlertIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  crossAlertMosque: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  crossAlertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
    marginTop: 2,
  },

  // ── Muezzin hero (UNTOUCHED) ──
  heroCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginTop: 12 },
  heroEyebrow: { color: '#67E8F9', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  heroTitle: { color: '#E2E8F0', fontWeight: '800', fontSize: 19, marginTop: 2 },
  heroSubtitle: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  heroBadge: { marginTop: 2, color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  heroCountdown: { marginTop: 6, fontSize: 16, fontWeight: '800' },
  heroUrgency: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  heroButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroButtonText: { color: '#F8FAFC', fontWeight: '800', fontSize: 14 },
  livePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  livePillText: { fontWeight: '800', fontSize: 12, marginLeft: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 999 },
  shadow: {
    shadowColor: '#000000', shadowOpacity: 0.06,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
});
