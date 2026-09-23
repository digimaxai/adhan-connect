import { load } from '@expo/env';
import { createClient } from '@supabase/supabase-js';

load(process.cwd(), { silent: true });

const EXPECTED_STAGING_REF = 'zhrucqghrqkjyzmupdyy';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) throw new Error('Missing staging Supabase environment variables.');
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
if (projectRef !== EXPECTED_STAGING_REF) {
  throw new Error(`Refusing notification audit for non-staging project ${projectRef}.`);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
const now = Date.now();

function group(rows, key) {
  return rows.reduce((counts, row) => {
    const value = String(row[key] ?? 'unknown');
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

async function rows(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

const [devices, preferences, regions, events, deliveries, config] = await Promise.all([
  rows(
    supabase
      .from('push_devices')
      .select('platform, app_variant, permission_status, is_active, last_seen_at, disabled_at')
      .eq('app_variant', 'staging')
      .limit(2000),
    'push devices'
  ),
  rows(
    supabase
      .from('notification_preferences')
      .select('listener_upcoming_enabled, listener_live_enabled, listener_mosque_scope, listener_primary_mosque_id, listener_prayers, muezzin_assignment_updates_enabled, muezzin_duty_reminders_enabled, muezzin_live_enabled, muezzin_lead_minutes, travel_live_enabled, travel_radius_km')
      .limit(2000),
    'notification preferences'
  ),
  rows(
    supabase
      .from('travel_notification_regions')
      .select('radius_km, expires_at')
      .limit(2000),
    'travel regions'
  ),
  rows(
    supabase
      .from('notification_events')
      .select('kind, scheduled_for, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000),
    'notification events'
  ),
  rows(
    supabase
      .from('notification_deliveries')
      .select('status, attempt_count, last_error, created_at, updated_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000),
    'notification deliveries'
  ),
  rows(
    supabase
      .from('notification_dispatch_config')
      .select('app_variant, function_url, updated_at')
      .limit(1),
    'dispatch config'
  ),
]);

const allowedMuezzinLeads = new Set([3, 5, 10, 30]);
const allowedTravelRadii = new Set([5, 15, 30]);
const invalidMuezzinLeadRows = preferences.filter((row) => {
  const leads = Array.isArray(row.muezzin_lead_minutes) ? row.muezzin_lead_minutes : [];
  return !leads.length || leads.some((lead) => !allowedMuezzinLeads.has(Number(lead)));
}).length;
const emptyListenerPrayerRows = preferences.filter(
  (row) => !Array.isArray(row.listener_prayers) || !row.listener_prayers.length
).length;
const missingListenerPrimaryRows = preferences.filter(
  (row) => row.listener_upcoming_enabled && row.listener_mosque_scope === 'primary' && !row.listener_primary_mosque_id
).length;
const invalidTravelRadiusRows = preferences.filter(
  (row) => !allowedTravelRadii.has(Number(row.travel_radius_km))
).length;
const activeRegions = regions.filter((row) => new Date(row.expires_at).getTime() > now).length;
const expiredRegions = regions.length - activeRegions;
const oldPendingDeliveries = deliveries.filter((row) => {
  if (!['pending', 'processing', 'retry'].includes(row.status)) return false;
  return now - new Date(row.updated_at || row.created_at).getTime() > 10 * 60 * 1000;
}).length;
const deliveryErrors = deliveries
  .filter((row) => row.last_error)
  .reduce((counts, row) => {
    const raw = String(row.last_error);
    const category = raw.includes('DeviceNotRegistered')
      ? 'DeviceNotRegistered'
      : raw.includes('HTTP')
        ? 'Expo HTTP'
        : raw.includes('timeout') || raw.includes('aborted')
          ? 'Timeout'
          : 'Other';
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});

console.log(JSON.stringify({
  ok: true,
  projectRef,
  windowHours: 48,
  devices: {
    total: devices.length,
    active: devices.filter((row) => row.is_active).length,
    byPlatform: group(devices, 'platform'),
    byPermission: group(devices, 'permission_status'),
  },
  preferences: {
    total: preferences.length,
    invalidMuezzinLeadRows,
    emptyListenerPrayerRows,
    missingListenerPrimaryRows,
    invalidTravelRadiusRows,
    enabled: {
      listenerUpcoming: preferences.filter((row) => row.listener_upcoming_enabled).length,
      listenerLive: preferences.filter((row) => row.listener_live_enabled).length,
      muezzinAssignments: preferences.filter((row) => row.muezzin_assignment_updates_enabled).length,
      muezzinDuty: preferences.filter((row) => row.muezzin_duty_reminders_enabled).length,
      muezzinLive: preferences.filter((row) => row.muezzin_live_enabled).length,
      travelLive: preferences.filter((row) => row.travel_live_enabled).length,
    },
  },
  travelRegions: { total: regions.length, active: activeRegions, expired: expiredRegions },
  events: { total: events.length, byKind: group(events, 'kind') },
  deliveries: {
    total: deliveries.length,
    byStatus: group(deliveries, 'status'),
    oldPending: oldPendingDeliveries,
    errorCategories: deliveryErrors,
  },
  dispatcher: config[0] ?? null,
}, null, 2));
