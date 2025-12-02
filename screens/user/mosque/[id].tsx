// app/mosque/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { labelForPrayer, PrayerName } from '../../lib/adhans';
import { supabase } from '../../lib/supabase';
import { useLiveStreamForMosque } from '../../shared/hooks/useLiveStreamForMosque';

type Mosque = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  jumuah1_time?: string | null;
  jumuah2_time?: string | null;
  slug?: string | null;
};

type PrayerTimes = Partial<Record<PrayerName, string | null>>;
type StreamRow = { is_live: boolean; status?: string | null };
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
type AnnouncementRow = { id: string; title?: string | null; summary?: string | null; created_at?: string | null };

const fallbackTimes: Record<PrayerName, string> = {
  fajr: '05:18',
  dhuhr: '12:58',
  asr: '15:27',
  maghrib: '17:42',
  isha: '19:05',
};

export default function MosquePage() {
  const { id, name: nameParam, city: cityParam, country: countryParam } = useLocalSearchParams<{
    id: string;
    name?: string;
    city?: string;
    country?: string;
  }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const liveInfo = useLiveStreamForMosque(id ?? null);

  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [prayers, setPrayers] = useState<PrayerTimes | null>(null);
  const [recordings, setRecordings] = useState<BroadcastRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [following, setFollowing] = useState<boolean>(false);
  const [subCount, setSubCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  const isUuid = (v?: string) => !!v && /^[0-9a-fA-F-]{36}$/.test(v);

  useEffect(() => {
    const load = async () => {
      if (!id && !nameParam) return;
      setLoading(true);
      try {
        let base = null as any;
        const selectCols = 'id,name,city,country,address,website,phone,jumuah1_time,jumuah2_time,slug';

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

        const today = new Date().toISOString().slice(0, 10);
        const actualId = base?.id || (id && isUuid(id) ? id : null);

        if (!actualId) {
          setMosque(
            base ?? {
              id: '',
              name: nameParam ?? id ?? 'Mosque',
              city: cityParam ?? '',
              country: countryParam ?? '',
            }
          );
          setResolvedId('');
          setLive(false);
          setPrayers(null);
          setRecordings([]);
          setEvents([]);
          setCampaigns([]);
          setAnnouncements([]);
          setFollowing(false);
          return;
        }

        setMosque(
          base ?? {
            id: actualId,
            name: base?.name ?? nameParam ?? id ?? 'Mosque',
            city: base?.city ?? cityParam ?? '',
            country: base?.country ?? countryParam ?? '',
            address: base?.address ?? null,
            website: base?.website ?? null,
            phone: base?.phone ?? null,
            jumuah1_time: base?.jumuah1_time ?? null,
            jumuah2_time: base?.jumuah2_time ?? null,
            slug: base?.slug ?? null,
          }
        );
        setResolvedId(actualId);

        const [{ data: streamData }, { data: prayerData }, { data: recordingData }, { data: subData }, announcementsRes, subCountRes] = await Promise.all([
          supabase.from('streams').select('is_live,status').eq('mosque_id', actualId).maybeSingle(),
          supabase
            .from('mosque_prayer_times')
            .select('prayer_date,fajr,dhuhr,asr,maghrib,isha')
            .eq('mosque_id', actualId)
            .eq('prayer_date', today)
            .maybeSingle(),
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
          supabase.from('announcements').select('id,title,summary,created_at').eq('mosque_id', actualId).order('created_at', { ascending: false }).limit(5),
          userId
            ? supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
            : Promise.resolve({ count: 0 }),
        ]);

        let eventsArr: EventRow[] = [];
        let campaignsArr: CampaignRow[] = [];

        try {
          const { data: ev, error: evErr } = await supabase
            .from('events')
            .select('*')
            .eq('mosque_id', actualId)
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
        if (eventsArr.length === 0 && base?.slug) {
          try {
            const { data: ev2, error: evErr2 } = await supabase
              .from('events')
              .select('*')
              .eq('slug', base.slug)
              .order('start_at', { ascending: true, nullsFirst: false })
              .limit(20);
            if (evErr2) console.warn('events slug fetch error', evErr2.message);
            eventsArr = Array.isArray(ev2) ? (ev2 as any[]) : eventsArr;
          } catch (e: any) {
            console.warn('events slug fetch exception', e?.message);
          }
        }

        try {
          const { data: cs, error: csErr } = await supabase
            .from('campaigns')
            .select('*')
            .eq('mosque_id', actualId)
            .limit(10);
          if (csErr) {
            console.warn('campaigns fetch error', csErr.message);
          }
          campaignsArr = Array.isArray(cs) ? (cs as any[]) : [];
        } catch (e: any) {
          console.warn('campaigns fetch exception', e?.message);
          campaignsArr = [];
        }
        if (campaignsArr.length === 0 && base?.slug) {
          try {
            const { data: cs2, error: csErr2 } = await supabase
              .from('campaigns')
              .select('*')
              .eq('slug', base.slug)
              .limit(10);
            if (csErr2) console.warn('campaigns slug fetch error', csErr2.message);
            campaignsArr = Array.isArray(cs2) ? (cs2 as any[]) : campaignsArr;
          } catch (e: any) {
            console.warn('campaigns slug fetch exception', e?.message);
          }
        }

        let usePrayer = prayerData ?? null;
        if (!usePrayer) {
          const { data: nextPrayer } = await supabase
            .from('mosque_prayer_times')
            .select('prayer_date,fajr,dhuhr,asr,maghrib,isha')
            .eq('mosque_id', actualId)
            .gte('prayer_date', today)
            .order('prayer_date', { ascending: true })
            .limit(1)
            .maybeSingle();
          usePrayer = nextPrayer ?? null;
        }
        if (!usePrayer) {
          const { data: prevPrayer } = await supabase
            .from('mosque_prayer_times')
            .select('prayer_date,fajr,dhuhr,asr,maghrib,isha')
            .eq('mosque_id', actualId)
            .lte('prayer_date', today)
            .order('prayer_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          usePrayer = prevPrayer ?? null;
        }
        setPrayers(usePrayer);
        setRecordings((recordingData as BroadcastRow[]) ?? []);
        setFollowing(!!subData);
        setEvents(eventsArr);
        setCampaigns(campaignsArr);
        setAnnouncements(Array.isArray(announcementsRes.data) ? announcementsRes.data : []);
        setSubCount(subCountRes.count ?? 0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, nameParam, userId]);

  const toggleFollow = async () => {
    if (!id || !userId || actionLoading) return;
    if (!following && subCount >= 3) {
      alert('Maximum Reached\n\nYou can follow up to 3 mosques. Unfollow a mosque to add a new one.\n\nChoose "Manage My Mosques" in Settings.');
      return;
    }
    setActionLoading(true);
    try {
      if (following) {
        await supabase.from('subscriptions').delete().eq('user_id', userId).eq('mosque_id', id);
        setFollowing(false);
        setSubCount((c) => Math.max(0, c - 1));
      } else {
        await supabase.from('subscriptions').insert({ user_id: userId, mosque_id: id });
        setFollowing(true);
        setSubCount((c) => c + 1);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const displayTimes = useMemo(() => {
    const t = prayers || {};
    const fmt = (val?: string | null) => {
      if (!val) return '--:--';
      const parts = val.split(':');
      if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      return val;
    };
    return (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).map((p) => ({
      name: labelForPrayer(p),
      time: fmt(t[p]),
    }));
  }, [prayers]);

  const recent = useMemo(() => recordings.slice(0, 1), [recordings]);
  const city = useMemo(() => [mosque?.city, mosque?.country].filter(Boolean).join(', '), [mosque]);
  const jumuahTimes = useMemo(
    () => [mosque?.jumuah1_time, mosque?.jumuah2_time].filter(Boolean) as string[],
    [mosque?.jumuah1_time, mosque?.jumuah2_time]
  );

  const highlight = useMemo(() => {
    if (campaigns.length) return { type: 'campaign' as const, item: campaigns[0] };
    if (events.length) return { type: 'event' as const, item: events[0] };
    if (announcements.length) return { type: 'announcement' as const, item: announcements[0] };
    return null;
  }, [campaigns, events, announcements]);

  if (!id) return null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {mosque?.name ?? 'Mosque'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable hitSlop={10}>
              <Ionicons name="share-outline" size={18} color="#0F172A" />
            </Pressable>
            <Pressable onPress={toggleFollow} hitSlop={10}>
              <Ionicons name="star" size={20} color={following ? '#FBBF24' : '#CBD5E1'} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.identityCard, styles.shadow]}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityInitials}>{mosque?.name?.slice(0, 2).toUpperCase() ?? 'MS'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName} numberOfLines={1}>
              {mosque?.name ?? 'Mosque'}
            </Text>
            <Text style={styles.identityCity} numberOfLines={1}>
              {city || 'City, Country'}
            </Text>
          </View>
        </View>

        {liveInfo.isLive && (
          <View style={[styles.liveCard, styles.shadow]}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={styles.liveIconWrap}>
                <Ionicons name="radio-outline" size={22} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>
                  <Text style={styles.liveSmall}>{city || 'Broadcasting Adhan'}</Text>
                </View>
                <Text style={styles.liveTitle} numberOfLines={1}>
                  {mosque?.name ?? 'Mosque'}
                </Text>
                <Text style={styles.liveSubtitle}>Broadcasting Adhan</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push('/(user)/now')} style={({ pressed }) => [styles.livePrimary, { opacity: pressed ? 0.9 : 1 }]}>
              <Text style={styles.livePrimaryText}>Listen Live</Text>
            </Pressable>
          </View>
        )}

        {highlight && (
          <Pressable
            onPress={() => {
              if (highlight.type === 'event') router.push({ pathname: '/event/[id]', params: { id: highlight.item.id } });
              if (highlight.type === 'campaign') router.push({ pathname: '/campaign/[id]', params: { id: highlight.item.id } });
            }}
            style={({ pressed }) => [
              styles.banner,
              styles.shadow,
              {
                backgroundColor:
                  highlight.type === 'campaign' ? '#F0FFF4' : highlight.type === 'event' ? '#F3F8FF' : '#FFFDF3',
                opacity: pressed ? 0.94 : 1,
              },
            ]}
          >
            <View style={styles.bannerTag}>
              <Text style={styles.bannerTagText}>
                {highlight.type === 'campaign' ? 'Campaign' : highlight.type === 'event' ? 'Upcoming' : 'Announcement'}
              </Text>
            </View>
            <Text style={styles.bannerTitle} numberOfLines={2}>
              {highlight.type === 'campaign'
                ? (highlight.item as CampaignRow).title ?? 'Campaign'
                : highlight.type === 'event'
                ? (highlight.item as EventRow).title ?? 'Event'
                : (highlight.item as AnnouncementRow).title ?? 'Announcement'}
            </Text>
            <Text style={styles.bannerSubtitle} numberOfLines={2}>
              {highlight.type === 'campaign'
                ? `£${((highlight.item as CampaignRow).raised_cents ?? 0) / 100} raised`
                : highlight.type === 'event'
                ? new Date((highlight.item as EventRow).start_at ?? '').toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : (highlight.item as AnnouncementRow).summary ?? ''}
            </Text>
            {highlight.type === 'campaign' && (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round(
                          (((highlight.item as CampaignRow).raised_cents ?? 0) / 100) /
                            Math.max(1, ((highlight.item as CampaignRow).goal_cents ?? 1) / 100) *
                            100
                        )
                      )}%`,
                    },
                  ]}
                />
              </View>
            )}
            <Pressable style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>{highlight.type === 'campaign' ? 'Donate Now' : 'View Details'}</Text>
            </Pressable>
          </Pressable>
        )}

        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Prayer Times</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.timesTable}>
            {displayTimes.map((row) => (
              <View key={row.name} style={styles.timeRow}>
                <Text style={styles.timeName}>{row.name}</Text>
                <Text style={styles.timeValue}>{row.time}</Text>
              </View>
            ))}
            {jumuahTimes.map((t, idx) => (
              <View key={`${t}-${idx}`} style={styles.timeRow}>
              <Text style={styles.timeName}>{`Jumu'ah ${idx + 1}`}</Text>
                <Text style={styles.timeValue}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Events</Text>
          </View>
          <View style={styles.divider} />
          {events.length === 0 && <Text style={styles.empty}>No upcoming events at this time.</Text>}
          {events.slice(0, 3).map((ev) => {
            const when = ev.start_at
              ? new Date(ev.start_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <View key={ev.id} style={styles.eventRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {ev.title ?? 'Event'}
                  </Text>
                  {when ? (
                    <Text style={styles.eventMeta} numberOfLines={1}>
                      {when}
                    </Text>
                  ) : null}
                  {ev.description ? (
                    <Text style={styles.eventSummary} numberOfLines={2}>
                      {ev.description}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: ev.id } })} style={({ pressed }) => [styles.eventButton, { opacity: pressed ? 0.9 : 1 }]}>
                  <Text style={styles.eventButtonText}>Details</Text>
                </Pressable>
              </View>
            );
          })}
          {events.length > 3 && (
            <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: events[0].id } })} style={({ pressed }) => [styles.viewAllBtn, { opacity: pressed ? 0.9 : 1 }]}>
              <Text style={styles.viewAllText}>View All Events</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Campaigns & Donations</Text>
          </View>
          <View style={styles.divider} />
          {campaigns.length === 0 && <Text style={styles.empty}>No active campaigns. Check back soon.</Text>}
          {campaigns.slice(0, 3).map((c) => {
            const raised = (c.raised_cents ?? 0) / 100;
            const goalRaw = c.goal_cents ?? 0;
            const goal = goalRaw > 0 ? goalRaw / 100 : 1;
            const pct = Math.min(100, Math.round((raised / goal) * 100));
            return (
              <View key={c.id} style={styles.campaignRow}>
                <Text style={styles.campaignTitle} numberOfLines={1}>
                  {c.title ?? 'Campaign'}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.campaignMeta}>{`£${raised.toLocaleString()} raised of £${goal.toLocaleString()} goal`}</Text>
                <Pressable onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: c.id } })} style={({ pressed }) => [styles.eventButton, { opacity: pressed ? 0.9 : 1 }]}>
                  <Text style={styles.eventButtonText}>Donate</Text>
                </Pressable>
              </View>
            );
          })}
          {campaigns.length > 3 && (
            <Pressable onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: campaigns[0].id } })} style={({ pressed }) => [styles.viewAllBtn, { opacity: pressed ? 0.9 : 1 }]}>
              <Text style={styles.viewAllText}>View All Campaigns</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, styles.shadow]}>
          <Text style={styles.cardTitle}>About This Mosque</Text>
          <Text style={styles.aboutText}>Basic information about this mosque will appear here soon.</Text>
        </View>

        {recent.length > 0 && (
          <View style={[styles.card, styles.shadow]}>
            <Text style={styles.cardTitle}>Last Adhan</Text>
            {(() => {
              const b = recent[0];
              const when = new Date(b.scheduled_for);
              const durationSec =
                b.started_at && b.ended_at ? Math.max(1, Math.floor((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000)) : null;
              return (
                <View style={styles.recordRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>{labelForPrayer(b.prayer)}</Text>
                    <Text style={styles.recordMeta}>
                      {`${when.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${
                        durationSec ? ` (${durationSec}s)` : ''
                      }`}
                    </Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={22} color="#0F172A" />
                </View>
              );
            })()}
          </View>
        )}

        <Pressable onPress={toggleFollow} disabled={actionLoading} style={({ pressed }) => [styles.followBtn, { opacity: pressed || actionLoading ? 0.85 : 1 }]}>
          <Text style={styles.followText}>{following ? 'Unfollow Mosque' : 'Follow Mosque'}</Text>
        </Pressable>
        {!following && subCount >= 3 && <Text style={styles.limitNote}>You are following 3 mosques (maximum).</Text>}

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

  banner: { borderRadius: 16, padding: 18, gap: 8 },
  bannerTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.08)' },
  bannerTagText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  bannerSubtitle: { color: '#475569', fontSize: 13 },
  bannerButton: {
    marginTop: 6,
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 8 },
  timesTable: { gap: 10 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeName: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  timeValue: { fontWeight: '800', color: '#0F172A', fontSize: 14 },

  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  eventTitle: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  eventMeta: { color: '#475569', fontSize: 12 },
  eventSummary: { color: '#475569', fontSize: 12 },
  eventButton: { backgroundColor: '#E2E8F0', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  eventButtonText: { fontWeight: '800', color: '#0F172A', fontSize: 12 },
  viewAllBtn: { marginTop: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#E0F2FE' },
  viewAllText: { color: '#0369A1', fontWeight: '800', fontSize: 13 },

  campaignRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 8 },
  campaignTitle: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  campaignMeta: { color: '#475569', fontSize: 12 },
  progressTrack: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1E7BF6' },

  aboutText: { color: '#475569', fontSize: 13 },
  recordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  recordTitle: { fontWeight: '700', color: '#0F172A', fontSize: 14 },
  recordMeta: { color: '#475569', fontSize: 12, marginTop: 2 },

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
  followText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  limitNote: { color: '#B91C1C', textAlign: 'center', marginBottom: 12, fontSize: 12, fontWeight: '600' },
  empty: { color: '#94A3B8', fontSize: 13, marginTop: 4 },

  shadow: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
});
