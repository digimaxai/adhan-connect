// screens/user/index.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchAladhanTimes, type AladhanTimings } from '../../lib/api/aladhan';
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
import { formatJumuahTime, isFridayToday, type JumuahSlot } from '../../lib/jumuah';
import { useRoleFlags } from '../../lib/roles';
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
import { getDailyPrayerTimes, type NormalizedPrayerTimes } from '../../lib/api/prayerTimesUnified';
import { computeNextPrayerSummaryAcrossDays } from '../../lib/prayerTimesDisplay';
import { isFreshLiveStream } from '../../lib/liveStreamFreshness';
import { tokens } from '../../theme/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mosque = {
  id: string; name: string; city?: string | null; country?: string | null;
  status?: string | null; lat?: number | null; lng?: number | null;
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
  jumuahSlots: JumuahSlot[];
  dayOfWeek: number;
  router: ReturnType<typeof useRouter>;
};

const PrimaryMosqueContent = React.memo(function PrimaryMosqueContent({
  mosqueId, announcements, events, campaigns, jumuahSlots, dayOfWeek, router,
}: PrimaryMosqueContentProps) {
  const urgentNotices = announcements.filter((a) => a.is_urgent).slice(0, 2);
  const pinned = announcements.find((a) => a.is_pinned && !a.is_urgent) ?? null;
  const recent = announcements.find((a) => !a.is_urgent && !a.is_pinned) ?? null;
  const notice = pinned ?? recent;
  const visibleEvents = events.slice(0, 3);
  const visibleCampaigns = campaigns.slice(0, 2);
  const activeSlots = jumuahSlots.slice(0, 3);
  const showJumuah = activeSlots.length > 0 && dayOfWeek >= 3 && dayOfWeek <= 5;

  const hasContent =
    urgentNotices.length > 0 ||
    notice ||
    visibleEvents.length > 0 ||
    visibleCampaigns.length > 0 ||
    showJumuah;
  if (!hasContent) return null;

  const getRaisedPct = (campaign: RawCampaign) =>
    campaign.goal_cents && campaign.goal_cents > 0
      ? Math.min(100, Math.round(((campaign.raised_cents ?? 0) / campaign.goal_cents) * 100))
      : null;

  const fridayLabel = isFridayToday() ? "Jumu'ah today" : "Jumu'ah this Friday";

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

        {showJumuah ? (
          <Pressable
            onPress={() => router.push({ pathname: '/(user)/jumuah/[id]', params: { id: mosqueId } } as any)}
            style={({ pressed }) => [styles.contentRow, styles.contentRowJumuah, pressed && styles.contentRowPressed]}
          >
            <View style={[styles.contentIcon, styles.contentIconJumuah]}>
              <Ionicons name="moon-outline" size={16} color="#0369A1" />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <AppText style={styles.contentTitle}>{fridayLabel}</AppText>
              <View style={styles.jumuahSlotRow}>
                {activeSlots.map((slot) => (
                  <View key={slot.id} style={styles.jumuahSlotChip}>
                    <AppText style={styles.jumuahSlotTime}>
                      {formatJumuahTime(slot.salah_at) ?? '--:--'}
                    </AppText>
                    {slot.venue ? (
                      <AppText variant="caption" style={styles.jumuahSlotVenue} numberOfLines={1}>
                        {slot.venue}
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#0369A1" />
          </Pressable>
        ) : null}

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
                <AppText style={styles.contentTitle} numberOfLines={1}>{event.title}</AppText>
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
                <AppText style={styles.contentTitle} numberOfLines={1}>{campaign.title}</AppText>
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
              <AppText style={styles.contentTitle} numberOfLines={1}>{notice.title}</AppText>
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
  clockMs: number;
  loading: boolean;
};

const PRAYER_DISPLAY_NAMES: Record<PrayerName, string> = {
  fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
};
const ALL_PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const RemainingPrayersStrip = React.memo(function RemainingPrayersStrip({
  prayerTimes, nextDayPrayerTimes, nextPrayerName, clockMs, loading,
}: RemainingPrayersStripProps) {
  const now = new Date(clockMs);

  const { items, tomorrowFajrLabel } = useMemo(() => {
    if (!prayerTimes) return { items: [], tomorrowFajrLabel: null };

    const allItems = ALL_PRAYERS.map((p) => {
      const adhan = prayerTimes[p].adhan;
      const passed = adhan ? adhan.getTime() < now.getTime() : true;
      const isNext = p === nextPrayerName && !passed;
      const timeLabel = adhan
        ? adhan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : null;
      return { name: p, passed, isNext, timeLabel };
    });

    const allDone = allItems.every((i) => i.passed);
    let tomorrowFajr: string | null = null;
    if (allDone && nextDayPrayerTimes) {
      const fajrAdhan = nextDayPrayerTimes.fajr?.adhan;
      if (fajrAdhan) {
        tomorrowFajr = fajrAdhan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
    }

    return { items: allItems, tomorrowFajrLabel: tomorrowFajr };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerTimes, nextDayPrayerTimes, nextPrayerName, clockMs]);

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
          : items.map(({ name, passed, isNext, timeLabel }) => (
              <View key={name} style={[
                styles.prayerPill,
                passed && styles.prayerPillPassed,
                isNext && styles.prayerPillNext,
              ]}>
                <Text style={[
                  styles.prayerPillName,
                  passed && styles.prayerPillNamePassed,
                  isNext && styles.prayerPillNameNext,
                ]}>
                  {PRAYER_DISPLAY_NAMES[name]}
                </Text>
                <Text style={[
                  styles.prayerPillTime,
                  passed && styles.prayerPillTimePassed,
                  isNext && styles.prayerPillTimeNext,
                ]}>
                  {timeLabel ?? '--:--'}
                </Text>
                {isNext ? <View style={styles.prayerPillDot} /> : null}
              </View>
            ))}
      </View>
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

type GeoPrayerCardProps = { times: AladhanTimings };
const GeoPrayerCard = React.memo(function GeoPrayerCard({ times }: GeoPrayerCardProps) {
  return (
    <AppCard style={styles.cardContainer}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location-outline" size={15} color={tokens.color.text.accent} />
          <AppText variant="sectionTitle">Prayer Times Near You</AppText>
        </View>
      </View>
      <AppText variant="caption" style={styles.cardSubtitle}>
        Calculated for your current location
      </AppText>
      <View style={styles.titleDivider} />
      <View style={styles.prayerTable}>
        {(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).map((p) => (
          <View key={p} style={styles.prayerRow}>
            <AppText style={styles.prayerName}>{p}</AppText>
            <AppText style={styles.prayerTimeText}>{times[p]?.slice(0, 5) ?? '--:--'}</AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
});

type NearbyLiveEntry = { mosqueId: string; mosque: Mosque; distance: number };
type NearbyLiveCardProps = { entries: NearbyLiveEntry[]; onListen: (mosqueId: string) => void };
const NearbyLiveCard = React.memo(function NearbyLiveCard({ entries, onListen }: NearbyLiveCardProps) {
  if (!entries.length) return null;
  return (
    <AppCard style={[styles.cardContainer, { gap: 10 }]}>
      <AppText variant="sectionTitle">Live Near You</AppText>
      {entries.map(({ mosqueId, mosque, distance }) => (
        <View key={mosqueId} style={styles.otherLiveRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Ionicons name="radio-outline" size={18} color="#0F172A" />
            <View style={{ flex: 1 }}>
              <AppText style={styles.otherLiveName} numberOfLines={1}>{mosque.name}</AppText>
              <AppText variant="caption" style={styles.otherLiveSub} numberOfLines={1}>
                {Math.round(distance)} km away
              </AppText>
            </View>
            <View style={styles.liveBadge}>
              <AppText variant="caption" color={tokens.color.text.inverse} style={styles.liveBadgeText}>
                LIVE
              </AppText>
            </View>
          </View>
          <Pressable onPress={() => onListen(mosqueId)} hitSlop={6}>
            <AppText variant="body" color={tokens.color.text.accent} style={styles.listenLink}>
              Listen
            </AppText>
          </Pressable>
        </View>
      ))}
    </AppCard>
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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const roles = useRoleFlags();
  const userId = session?.user?.id ?? null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [rawAnnouncements, setRawAnnouncements] = useState<RawAnnouncement[]>([]);
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [rawCampaigns, setRawCampaigns] = useState<RawCampaign[]>([]);
  const [primaryJumuahSlots, setPrimaryJumuahSlots] = useState<JumuahSlot[]>([]);
  const [liveStreams, setLiveStreams] = useState<Record<string, StreamRow>>({});
  const [nextBroadcast, setNextBroadcast] = useState<AdhanBroadcast | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  const [nextDayPrayerTimes, setNextDayPrayerTimes] = useState<NormalizedPrayerTimes | null>(null);
  const [prayerLoading, setPrayerLoading] = useState(false);
  const [prayerError, setPrayerError] = useState<string | null>(null);
  const [muezzinLoading, setMuezzinLoading] = useState(false);
  const [muezzinError, setMuezzinError] = useState<string | null>(null);
  const [defaultMosqueId, setDefaultMosqueId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'enabled' | 'denied'>('idle');
  const [geoPrayerTimes, setGeoPrayerTimes] = useState<AladhanTimings | null>(null);
  const [showMosquePicker, setShowMosquePicker] = useState(false);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const [todayQuote, setTodayQuote] = useState<DailyQuote | null>(null);
  const [crossMosqueAlerts, setCrossMosqueAlerts] = useState<CrossMosqueAlert[]>([]);

  const prayerRequestIdRef = useRef(0);
  const prayerLoadedMosqueRef = useRef<string | null>(null);
  const lastMosqueIdsRef = useRef('');
  const lastSubIdsRef = useRef('');
  const refreshIdRef = useRef(0);

  // ── Derived ────────────────────────────────────────────────────────────────

  const subscribedIds = useMemo(() => new Set(subs.map((s) => s.mosque_id)), [subs]);

  const staffPrimaryMosqueId = useMemo(
    () => (roles.isMainAdmin ? null : roles.primaryAdminMosqueId ?? roles.primaryMuezzinMosqueId ?? null),
    [roles.isMainAdmin, roles.primaryAdminMosqueId, roles.primaryMuezzinMosqueId]
  );

  const primaryMosque = useMemo(() => {
    const byId = new Map(mosques.map((m) => [m.id, m]));
    const validDefaultId = defaultMosqueId && subscribedIds.has(defaultMosqueId) ? defaultMosqueId : null;
    const preferredIds = [staffPrimaryMosqueId, validDefaultId, subs[0]?.mosque_id].filter(Boolean) as string[];

    for (const mosqueId of preferredIds) {
      const mosque = byId.get(mosqueId);
      if (mosque) return mosque;
    }

    return null;
  }, [subs, mosques, defaultMosqueId, subscribedIds, staffPrimaryMosqueId]);

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
        .select('id, name, city, country, status, lat, lng')
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
        .select('id, name, city, country, status')
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

  const loadMuezzin = React.useCallback(async () => {
    if (!roles.isMuezzin) { setNextBroadcast(null); setMuezzinError(null); return; }
    setMuezzinLoading(true);
    setMuezzinError(null);
    try {
      const upcoming = await fetchUpcomingBroadcasts(1);
      setNextBroadcast(upcoming[0] ?? null);
      if (!upcoming.length) setMuezzinError('No upcoming adhans scheduled.');
    } catch (e: any) {
      setMuezzinError(e?.message ?? 'Could not load upcoming adhans.');
      setNextBroadcast(null);
    } finally {
      setMuezzinLoading(false);
    }
  }, [roles.isMuezzin]);

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
        await persistDefaultMosqueId(userId, mosque.id);
      } catch { /* best-effort persistence */ }
    },
    [userId]
  );

  const onRefresh = React.useCallback(async () => {
    const refreshId = ++refreshIdRef.current;
    const visibleMosqueId = primaryMosque?.id ?? staffPrimaryMosqueId ?? defaultMosqueId ?? subs[0]?.mosque_id ?? null;
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
          const preferredId = staffPrimaryMosqueId ?? validDefaultId ?? latestSubs[0]?.mosque_id ?? visibleMosqueId;

          await Promise.allSettled([
            preferredId && preferredId !== visibleMosqueId ? loadPrayerTimes(preferredId) : Promise.resolve(),
            loadMuezzin(),
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
    loadMuezzin,
    loadPrayerTimes,
    primaryMosque?.id,
    staffPrimaryMosqueId,
    subs,
  ]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useFocusEffect(
    React.useCallback(() => {
      void loadHomeData();
      void loadDefault();
      setContentRefreshKey((key) => key + 1);
    }, [loadDefault, loadHomeData])
  );

  // Live stream realtime + polling (listener only — untouched)
  useEffect(() => {
    if (roles.isMuezzin) return;
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
  }, [loadHomeData, roles.isMuezzin, userId]);

  // 1-second clock tick
  useEffect(() => {
    const id = setInterval(() => setClockMs(Date.now()), 1000);
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
        .select('id, name, city, country, status')
        .eq('id', defaultMosqueId)
        .maybeSingle();
      if (!cancelled && data && !error) setMosques((prev) => [...prev, data]);
    })();
    return () => { cancelled = true; };
  }, [defaultMosqueId, mosques, subscribedIds]);

  useEffect(() => { loadMuezzin(); }, [loadMuezzin]);
  useEffect(() => { loadPrayerTimes(primaryMosque?.id); }, [loadPrayerTimes, primaryMosque?.id]);

  // Load "What's On" content for the actual primary mosque only.
  useEffect(() => {
    if (!primaryMosque?.id) {
      setRawAnnouncements([]);
      setRawEvents([]);
      setRawCampaigns([]);
      setPrimaryJumuahSlots([]);
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
          .order('salah_at', { ascending: true })
          .limit(5),
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
      setPrimaryJumuahSlots(jumuahRes.error ? [] : (jumuahRes.data ?? []) as JumuahSlot[]);
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
      const mosqueById = new Map(mosques.map((m) => [m.id, m]));
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
  }, [subs, mosques, primaryMosque?.id, contentRefreshKey]);

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
    if (!userLocation || primaryMosque?.lat == null || primaryMosque?.lng == null) return null;
    return haversineKm(
      userLocation.latitude, userLocation.longitude,
      Number(primaryMosque.lat), Number(primaryMosque.lng)
    );
  }, [userLocation, primaryMosque]);

  const isTravelling = distanceFromHomeMosque !== null && distanceFromHomeMosque > 30;

  // Fetch Aladhan times for GPS position when travelling
  useEffect(() => {
    if (!userLocation || !isTravelling) { setGeoPrayerTimes(null); return; }
    const today = formatLocalDate(new Date());
    fetchAladhanTimes(userLocation.latitude, userLocation.longitude, today)
      .then((t) => setGeoPrayerTimes(t));
  }, [userLocation, isTravelling]);

  const nextPrayer = useMemo(
    () => computeNextPrayerSummaryAcrossDays(prayerTimes, nextDayPrayerTimes, new Date(clockMs)),
    [clockMs, prayerTimes, nextDayPrayerTimes]
  );
  const currentDayOfWeek = useMemo(() => new Date(clockMs).getDay(), [clockMs]);

  const freshLiveStreams = useMemo(() => {
    const next: Record<string, StreamRow> = {};
    Object.entries(liveStreams).forEach(([mosqueId, stream]) => {
      if (isFreshLiveStream(stream, clockMs)) next[mosqueId] = stream;
    });
    return next;
  }, [clockMs, liveStreams]);
  const liveMosqueIds = useMemo(() => new Set(Object.keys(freshLiveStreams)), [freshLiveStreams]);

  const nearbyLiveEntries = useMemo((): NearbyLiveEntry[] => {
    if (!userLocation) return [];
    return Object.keys(freshLiveStreams)
      .filter((id) => id !== primaryMosque?.id)
      .reduce<NearbyLiveEntry[]>((acc, mosqueId) => {
        const mosque = mosques.find((m) => m.id === mosqueId);
        if (!mosque?.lat || !mosque?.lng) return acc;
        const distance = haversineKm(
          userLocation.latitude, userLocation.longitude,
          Number(mosque.lat), Number(mosque.lng)
        );
        if (distance <= 30) acc.push({ mosqueId, mosque, distance });
        return acc;
      }, [])
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }, [userLocation, freshLiveStreams, primaryMosque?.id, mosques]);

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

  // ── Muezzin branch — UNTOUCHED ─────────────────────────────────────────────

  if (roles.isMuezzin) {
    return (
      <ScreenContainer
        contentStyle={[styles.scrollBody, { paddingTop: topPad + 12 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.color.text.accent} />
        }
      >
        <View style={styles.headerRow}>
          <AppLogo size={30} />
          <AppText variant="title" style={styles.appTitle}>Adhan Connect</AppText>
          <Pressable onPress={() => router.push('/(user)/settings')} hitSlop={12}>
            <Ionicons name="settings-outline" size={22} color="#0F172A" />
          </Pressable>
        </View>
        <MuezzinHero loading={muezzinLoading} broadcast={nextBroadcast} error={muezzinError} router={router} />
      </ScreenContainer>
    );
  }

  // ── Listener branch ────────────────────────────────────────────────────────

  const otherLive = Object.entries(freshLiveStreams).filter(
    ([mosqueId]) => mosqueId !== primaryMosque?.id && subscribedIds.has(mosqueId)
  );

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

      {/* ── Mosque identity bar ── */}
      <MosqueIdentityBar
        mosque={primaryMosque}
        canSwitch={followedMosques.length > 1}
        onSwitch={() => setShowMosquePicker(true)}
        onDiscover={() => router.push('/(user)/discover')}
        hasSubscriptions={subs.length > 0}
        otherMosqueLive={otherMosqueLive}
      />

      {/* ── Mosque picker modal ── */}
      <MosquePickerSheet
        visible={showMosquePicker}
        mosques={followedMosques}
        selectedId={primaryMosque?.id ?? null}
        onSelect={handleSwitchMosque}
        onClose={() => setShowMosquePicker(false)}
        onManage={() => { setShowMosquePicker(false); router.push('/manage-mosques'); }}
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
          onDiscover={() => router.push('/(user)/discover')}
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
              ? `In ${nextPrayer.remaining}`
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

      {/* ── Remaining prayers today (compact strip replacing full table) ── */}
      <RemainingPrayersStrip
        prayerTimes={prayerTimes}
        nextDayPrayerTimes={nextDayPrayerTimes}
        nextPrayerName={nextPrayer?.name ?? null}
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
          jumuahSlots={primaryJumuahSlots}
          dayOfWeek={currentDayOfWeek}
          router={router}
        />
      ) : null}

      {/* ── Daily spiritual reflection ── */}
      {todayQuote ? <QuoteOfTheDayCard quote={todayQuote} /> : null}

      {/* ── Geo prayer times when travelling ── */}
      {isTravelling && geoPrayerTimes && <GeoPrayerCard times={geoPrayerTimes} />}

      {/* My mosques */}
      <MyMosquesStrip
        mosques={followedMosques}
        primaryMosqueId={primaryMosque?.id ?? null}
        liveMosqueIds={liveMosqueIds}
        router={router}
      />

      {/* ── Nearby live broadcasts ── */}
      <NearbyLiveCard
        entries={nearbyLiveEntries}
        onListen={(mosqueId) =>
          router.push({
            pathname: '/(user)/now',
            params: {
              mosqueId,
              ...(userLocation
                ? { lat: String(userLocation.latitude), lng: String(userLocation.longitude) }
                : {}),
            },
          })
        }
      />

      {/* ── Other live broadcasts from followed mosques ── */}
      {otherLive.length > 0 && (
        <AppCard style={[styles.cardContainer, { gap: 10 }]}>
          <AppText variant="sectionTitle">Other Live Broadcasts</AppText>
          {otherLive.map(([mosqueId]) => {
            const m = mosques.find((ms) => ms.id === mosqueId);
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

      {/* ── Discover CTA — nudge for users following only one mosque ── */}
      {subs.length === 1 ? (
        <AppCard subtle style={styles.discoveryCard}>
          <AppText variant="sectionTitle">Find More Mosques</AppText>
          <AppText variant="body" style={styles.discoverySubtitle}>
            Discover and follow other mosques to listen to live adhans.
          </AppText>
          <AppButton
            title="Discover"
            onPress={() => router.push('/(user)/discover')}
            style={styles.discoveryBtn}
          />
        </AppCard>
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
  contentRowJumuah: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  contentRowPressed: { opacity: 0.86 },
  contentIcon: {
    width: 34, height: 34, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  contentIconUrgent: { backgroundColor: '#FEE2E2' },
  contentIconJumuah: { backgroundColor: '#DBEAFE' },
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

  // ── Jumu'ah slots in What's On ──
  jumuahSlotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jumuahSlotChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#FFFFFF', borderRadius: tokens.radius.md,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  jumuahSlotTime: { color: '#1E40AF', fontWeight: '900', fontSize: 14 },
  jumuahSlotVenue: { color: '#3B82F6', fontSize: 11, marginTop: 1 },

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
  remainingScroll: { flexDirection: 'row', gap: 6 },
  prayerPill: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E6E8EB',
    gap: 2,
  },
  prayerPillNext: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0EA5E9',
    borderWidth: 1.5,
  },
  prayerPillPassed: { backgroundColor: '#F8FAFC', borderColor: '#F1F5F9' },
  prayerPillName: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  prayerPillNamePassed: { color: '#CBD5E1' },
  prayerPillNameNext: { color: '#0369A1', fontWeight: '800' },
  prayerPillTime: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  prayerPillTimePassed: { color: '#CBD5E1' },
  prayerPillTimeNext: { color: '#0C4A6E', fontSize: 14, fontWeight: '900' },
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
