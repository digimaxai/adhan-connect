const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const protectedFiles = {
  'app/api/muezzin/live-broadcast+api.ts': 'f5906a97585ebe9a48c295f2cff803368d24b2033c8894587e4cf5423d31c8ca',
  'supabase/migrations/20260721120000_transactional_live_broadcast_start.sql': 'ab54c6fd268e1b9b30c8947aab66d1ceef3c0c8a0e5f39e6b9ad7d8d4720f94c',
  'supabase/migrations/20260721213000_transactional_live_broadcast_end.sql': 'b191094a36c985cff68d3ecd73c0adb157a8f3a1cafe4869477c3a0eaf546488',
  'lib/hooks/useLiveBroadcastEngine.ts': '9c2755064d8c627d1af65c1b4bff991bce58481312af344a35c734ff82ecfea4',
  'lib/hooks/useLiveKitBroadcast.ts': '7d999291ce5689eedf0ae79260fc034dcdd334df6f63c6ed685e638996250fe0',
  'lib/hooks/useLiveKitSubscribe.ts': '712a7469ea3f812bcb8950f10a7fe67c003daef3e4d480cebb17667ddceda551',
  'app/api/admin/muezzin-assignment+api.ts': 'b6d134eb921ae151e3e8f5798f7e02ab590900b656f67adf442f9a6b8934f1a5',
  'app/api/admin/staff-rota-save+api.ts': 'e503fed68486f8c20483a7dceb77fe09a655e7163a56f3b47fb7c0e1957ef7d4',
  'app/api/admin/staff-rota-workspace+api.ts': 'f4b3822054f0ba1a5f676039925f97ecc6752b89cb0af8e6114a8ba93fc59e6b',
  'app/api/listener/livekit-token+api.ts': 'b54aba982f58468086b32856277d7b5f3f6e7567be0daf2e36e3933e3b66bf12',
  'app/api/live-stream-access+api.ts': 'bc725a7b3de143677bc396354af947009fb104ae762775d4f680a3a2393b51ad',
  'app/api/muezzin/livekit-token+api.ts': '288c4189fd390048b69409424fada196f55779c75b41a81bd21c205cb87e7707',
  'app/api/muezzin/rota-workspace+api.ts': 'f0b348014a4b7290980329a2c8f20a2a4ce0c81020cbf1c3328a5f69d31ffe49',
  'screens/admin/staff-rota.tsx': '79abd2d97493c8b1a07da3efbee02ed10231d928c68b8353847530696d093c4d',
  'screens/muezzin/live-broadcast.tsx': '1874881a527e89c049232ee6d778221f521e4fe73c763711dedd7632dec82a54',
  'screens/muezzin/my-rota.tsx': 'cebf0b39fc8b4ed386b017d0ff71279be1299abdb944f05e26d61e7c26e620f1',
  'screens/user/now.tsx': 'e1177bdd42a4c6120b9920519191f18563e715ed0238204e3ee5f6f723b53823',
  'screens/shared/hooks/useLiveStreamForMosque.ts': '29a015c4861dd9578c5193942330f0eb3a172929e7863f04d21545ff631c508a',
};

for (const [relativePath, expectedHash] of Object.entries(protectedFiles)) {
  const body = fs.readFileSync(path.join(root, relativePath));
  const actualHash = crypto.createHash('sha256').update(body).digest('hex');
  assert.equal(actualHash, expectedHash, `${relativePath} changed during notification work.`);
}

const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260903120000_push_notifications_travel_nearby.sql'),
  'utf8'
);
const liveTriggerBody = migration.match(
  /create or replace function public\.enqueue_live_adhan_notification_v1\(\)[\s\S]*?\n\$\$;/i
)?.[0] ?? '';
assert.ok(liveTriggerBody.includes('exception when others'), 'LIVE enqueue trigger must fail open.');
assert.ok(liveTriggerBody.includes('notification_events'), 'LIVE trigger must only enqueue a durable event.');
assert.ok(!/http|net\.|edge function/i.test(liveTriggerBody), 'LIVE trigger must not perform network delivery.');

const nearbyFunctionBody = migration.match(
  /create or replace function public\.nearby_mosque_context_v1[\s\S]*?\n\$\$;/i
)?.[0] ?? '';
assert.ok(!/insert\s+into\s+public\.subscriptions|update\s+public\.subscriptions|delete\s+from\s+public\.subscriptions/i.test(nearbyFunctionBody));

const schedulerMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260903143000_notification_dispatch_schedule.sql'),
  'utf8'
);
const wakeTriggerBody = schedulerMigration.match(
  /create or replace function public\.wake_live_notification_dispatch_v1\(\)[\s\S]*?\n\$\$;/i
)?.[0] ?? '';
assert.ok(wakeTriggerBody.includes('exception when others'), 'LIVE dispatcher wake-up must fail open.');
assert.ok(wakeTriggerBody.includes('net.http_post'), 'LIVE dispatcher wake-up must remain asynchronous.');
assert.ok(!/start_live_broadcast|end_live_broadcast|update\s+public\.streams|update\s+public\.adhans/i.test(wakeTriggerBody));

const assignmentFallbackMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260904123000_muezzin_duty_reminder_assignment_fallback.sql'),
  'utf8'
);
assert.ok(
  assignmentFallbackMigration.includes("request.status in ('provisional_cover', 'approved')"),
  'Muezzin reminders must respect active cover assignments.'
);
assert.ok(
  assignmentFallbackMigration.includes('coalesce(rota.muezzin_user_id, rota.staff_user_id)'),
  'Muezzin reminders must support current and legacy explicit rota assignees.'
);
assert.ok(
  assignmentFallbackMigration.includes('trim(rota.prayer_name::text)') &&
    assignmentFallbackMigration.includes('trim(rota.prayer::text)'),
  'Enum-backed rota prayer fields must be normalized safely as text.'
);
assert.ok(
  assignmentFallbackMigration.includes('mosque.default_muezzin_user_id'),
  'Muezzin reminders must fall back to the active default muezzin.'
);
assert.ok(
  assignmentFallbackMigration.includes("when cover.volunteer_user_id is not null then 'cover'") &&
    assignmentFallbackMigration.indexOf("when cover.volunteer_user_id is not null then 'cover'") <
      assignmentFallbackMigration.indexOf("when slot.rota_id is not null then 'rota'"),
  'Cover assignment must take precedence over an explicit rota assignment.'
);
assert.ok(
  !/(?:insert\s+into|update|delete\s+from)\s+public\.(?:adhans|streams|staff_rota|muezzins|mosques|prayer_times|subscriptions)\b/i.test(
    assignmentFallbackMigration
  ),
  'Reminder fallback migration must not mutate LIVE, assignment, timetable, or subscription state.'
);

const home = fs.readFileSync(path.join(root, 'screens/user/index.tsx'), 'utf8');
assert.ok(
  home.includes('const primaryIsLive = !!primaryLiveStream || liveInfo.isLive;'),
  'Listener-home LIVE source of truth changed.'
);
assert.ok(
  home.includes("router.push({ pathname: '/(user)/now', params: { mosqueId: primaryMosque.id } });"),
  'Listener-home LIVE navigation changed.'
);
assert.ok(
  !home.includes('if (roles.isMuezzin)') &&
    !home.includes('staffPrimaryMosqueId') &&
    home.includes('useMosquesNearby(15, userLocation, true)'),
  'Listener workspace must remain a full Listener experience for users who also hold staff permissions.'
);

const notificationSettings = fs.readFileSync(
  path.join(root, 'screens/user/settings/notifications.tsx'),
  'utf8'
);
assert.ok(
  notificationSettings.includes('preferencesRef') && notificationSettings.includes('saveQueuesRef'),
  'Notification preference updates must use current state and ordered per-field saves.'
);
assert.ok(
  notificationSettings.includes('3 min opens LIVE. Earlier reminders open My Rota.'),
  'Muezzin reminder times must explain their multi-select behavior.'
);
assert.ok(
  notificationSettings.includes("requireRoleEntrySelection(userId)") &&
    notificationSettings.includes("router.replace('/role-entry' as any)"),
  'Notifications must open the workspace chooser through explicit workspace state.'
);
assert.ok(
  !notificationSettings.includes("from '../../../lib/supabase'") &&
    notificationSettings.includes('getNotificationPreferences(userId, accessToken)') &&
    notificationSettings.includes('saveNotificationPreferencePatch(userId, patch, accessToken)'),
  'Notification preferences must use the bounded session-scoped client, not the shared auth client.'
);
assert.ok(
  !notificationSettings.includes('loading || !preferences') &&
    notificationSettings.includes('Preferences are temporarily unavailable'),
  'Preference loading must settle into a recoverable state rather than an infinite spinner.'
);
assert.ok(
  notificationSettings.includes('deviceRegistered') &&
    notificationSettings.includes("'Setup needs attention'") &&
    notificationSettings.includes('loading && !preferences'),
  'OS permission, backend device registration, and preference loading must be independent states.'
);
assert.ok(
  notificationSettings.includes('toggleMuezzinLead') &&
    notificationSettings.includes('toggleListenerPrayer') &&
    notificationSettings.includes('preferencesRef.current'),
  'Rapid multi-select changes must derive from current optimistic state.'
);

const sharedSettings = fs.readFileSync(path.join(root, 'screens/user/settings/index.tsx'), 'utf8');
assert.ok(
  sharedSettings.includes('requireRoleEntrySelection(user.id)') &&
    sharedSettings.includes("router.replace('/role-entry' as any)"),
  'Shared settings must replace the nested route with an explicit workspace choice.'
);
assert.ok(
  sharedSettings.includes('!isMuezzinWorkspace ? (') &&
    sharedSettings.includes('Your Listener workspace remains available for personal listening preferences.'),
  'Muezzin settings must separate operational controls while preserving universal Listener access.'
);

const notificationClient = fs.readFileSync(path.join(root, 'lib/notifications/client.ts'), 'utf8');
assert.ok(
  notificationClient.includes('accessToken: async () => accessToken') &&
    notificationClient.includes('AbortController') &&
    notificationClient.includes('Promise.race'),
  'Notification traffic must bypass auth.getSession locks and have an absolute deadline.'
);

const notificationDevice = fs.readFileSync(path.join(root, 'lib/notifications/device.ts'), 'utf8');
assert.ok(
  notificationDevice.includes('registrationFlight') &&
    notificationDevice.includes('recentRegistration') &&
    notificationDevice.includes('withNotificationDeadline'),
  'Native device registration must be bounded and single-flight.'
);
assert.ok(
  notificationDevice.includes("'Waiting for notification permission'") &&
    notificationSettings.includes("'Waiting for location permission'"),
  'Native permission prompts must settle through explicit deadlines.'
);

const notificationRuntime = fs.readFileSync(path.join(root, 'components/NotificationRuntime.tsx'), 'utf8');
assert.ok(
  notificationRuntime.includes('setPreferredStaffEntry(userId, workspace)') &&
    notificationRuntime.includes('router.replace'),
  'Notification taps must synchronize and replace the active workspace route.'
);
assert.ok(
  notificationRuntime.includes('session?.access_token') &&
    notificationRuntime.includes('syncPushDeviceIfGranted(accessToken)'),
  'Background device sync must reuse the mounted session token.'
);

const mosquePreferences = fs.readFileSync(path.join(root, 'lib/mosquePreferences.ts'), 'utf8');
assert.ok(
  !mosquePreferences.includes("from './supabase'") &&
    mosquePreferences.includes('notificationClient(accessToken)') &&
    mosquePreferences.includes(".upsert({") &&
    mosquePreferences.includes('listener_primary_mosque_id: mosqueId'),
  'A first-time primary mosque selection must use bounded session transport to create or update its notification preference.'
);
assert.ok(
  mosquePreferences.includes('admin_default_mosque_id') &&
    mosquePreferences.includes('setAdminDefaultMosqueId'),
  'Admin console mosque context must not overwrite the Listener primary mosque.'
);

const roleEntry = fs.readFileSync(path.join(root, 'app/role-entry.tsx'), 'utf8');
const muezzinLayout = fs.readFileSync(path.join(root, 'app/(muezzin)/_layout.tsx'), 'utf8');
const muezzinHome = fs.readFileSync(path.join(root, 'screens/muezzin/user-home.tsx'), 'utf8');
const persistentStorage = fs.readFileSync(path.join(root, 'lib/persistentStorage.ts'), 'utf8');
const sessionAccessClient = fs.readFileSync(path.join(root, 'lib/sessionAccess.ts'), 'utf8');
const sessionAccessRoute = fs.readFileSync(path.join(root, 'app/api/session-access+api.ts'), 'utf8');
assert.ok(
  roleEntry.includes('useRoleFlags({ reuseResolvedSessionAccess: true })') &&
    muezzinLayout.includes('useRoleFlags({ reuseResolvedSessionAccess: true })') &&
    muezzinHome.includes('useRoleFlags({ reuseResolvedSessionAccess: true })'),
  'Workspace transitions must reuse the root access decision instead of racing independent role requests.'
);
assert.ok(
  persistentStorage.includes('fileStoreMutationQueue') &&
    persistentStorage.includes('fileStoreMutationQueue = operation.catch(() => undefined)'),
  'Concurrent workspace preference writes must be serialized without poisoning later storage mutations.'
);
assert.ok(
  sessionAccessClient.includes('SESSION_ACCESS_TIMEOUT_MS = 10_000') &&
    sessionAccessClient.includes('}, SESSION_ACCESS_TIMEOUT_MS)'),
  'The authenticated workspace-access check needs a realistic but bounded portal deadline.'
);
assert.ok(
  !sessionAccessRoute.includes('fetchAllMosqueRows') &&
    sessionAccessRoute.includes('const adminMosques = membershipAdminMosques'),
  'Main-admin login must not serialise the complete mosque directory into the route-guard payload.'
);

const reliabilityMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260904231500_notification_preferences_reliability.sql'),
  'utf8'
);
assert.ok(
  reliabilityMigration.includes('cardinality(muezzin_lead_minutes) > 0') &&
    reliabilityMigration.includes('array[5, 10, 30]::integer[]'),
  'The notification reliability baseline must keep Muezzin choices non-empty.'
);

const liveWindowMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260905103000_muezzin_three_minute_live_window.sql'),
  'utf8'
);
assert.ok(
  liveWindowMigration.includes('array[3, 5, 10, 30]::integer[]'),
  'Muezzin reminder preferences must accept the 3-minute LIVE-window choice.'
);
assert.ok(
  liveWindowMigration.includes("when v_lead_minutes <= 3 then 'muezzin_broadcast'") &&
    liveWindowMigration.includes("else 'muezzin_rota'"),
  'Only the 3-minute duty reminder may open the LIVE broadcast workspace.'
);
assert.ok(
  !/(?:insert\s+into|update|delete\s+from)\s+public\.(?:adhans|streams|staff_rota|muezzins|mosques|prayer_times|subscriptions)\b/i.test(
    liveWindowMigration.replace(/--.*$/gm, '')
  ),
  'The 3-minute reminder migration must not mutate LIVE, rota, mosque, timetable, or subscription state.'
);
assert.ok(
  /insert into public\.notification_preferences[\s\S]*travel_live_enabled[\s\S]*on conflict \(user_id\)/i.test(
    reliabilityMigration
  ),
  'Travel region RPCs must atomically create/update notification preferences.'
);
assert.ok(
  reliabilityMigration.includes('Notification expired before dispatch.') &&
    reliabilityMigration.includes("event.kind = 'live_adhan'") &&
    reliabilityMigration.includes("event.kind in ('listener_upcoming', 'muezzin_duty')"),
  'Stale real-world notification events must expire before delivery.'
);
assert.ok(
  !/(?:insert\s+into|update|delete\s+from)\s+public\.(?:adhans|streams|staff_rota|muezzins|mosques|prayer_times|subscriptions)\b/i.test(
    reliabilityMigration.replace(/--.*$/gm, '')
  ),
  'Notification reliability migration must not mutate LIVE, rota, mosque, timetable, or subscription state.'
);

const pushDispatcher = fs.readFileSync(path.join(root, 'supabase/functions/push-dispatch/index.ts'), 'utf8');
assert.ok(
  pushDispatcher.includes('EXPO_REQUEST_TIMEOUT_MS') &&
    pushDispatcher.includes('fetchWithTimeout(EXPO_SEND_URL') &&
    pushDispatcher.includes('fetchWithTimeout(EXPO_RECEIPTS_URL'),
  'Expo send and receipt requests must have explicit deadlines.'
);

const adminSettings = fs.readFileSync(path.join(root, 'app/(admin)/admin-settings.tsx'), 'utf8');
assert.ok(
  !adminSettings.includes('Cover request alerts') &&
    adminSettings.includes('No inactive push controls are shown') &&
    adminSettings.includes('>Listener</AppText>'),
  'Admin settings must not expose local-only toggles as real push delivery controls.'
);

const adminDashboard = fs.readFileSync(path.join(root, 'app/(admin)/admin-home.tsx'), 'utf8');
const adminLayout = fs.readFileSync(path.join(root, 'app/(admin)/_layout.tsx'), 'utf8');
const adminMosqueHook = fs.readFileSync(path.join(root, 'lib/hooks/useAdminMosque.ts'), 'utf8');
const adminMosqueApi = fs.readFileSync(path.join(root, 'lib/api/admin/adminMosques.ts'), 'utf8');
assert.ok(
  adminDashboard.includes('knownMosques: roleMatchesSession && isAdmin ? adminMosques : undefined'),
  'Admin entry must reuse the mosque list from the verified session-access result.'
);
assert.ok(
  adminLayout.includes('reuseResolvedSessionAccess: true'),
  'The protected admin layout must reuse the root role decision during workspace entry.'
);
assert.ok(
  !adminDashboard.includes('isMuezzin && !isAdmin) return <Redirect'),
  'Admin entry must not redirect from an independent transient muezzin-only role result.'
);
assert.ok(
  adminMosqueApi.includes('DEFAULT_ADMIN_MOSQUE_TIMEOUT_MS') &&
    adminMosqueApi.includes('Promise.race') &&
    adminMosqueHook.includes('getAdminMosquesForCurrentUser({ session })'),
  'The fallback admin-mosque loader must be bounded and reuse the mounted auth session.'
);

console.log(JSON.stringify({
  ok: true,
  protectedLiveFiles: Object.keys(protectedFiles).length,
  liveNotificationDelivery: 'asynchronous-outbox',
  muezzinDutyAssignmentPrecedence: ['cover', 'explicit_rota', 'active_default'],
  muezzinLeadSelection: 'ordered-multi-select',
  preferenceTransport: 'session-scoped-bounded',
  deviceRegistration: 'independent-single-flight',
  notificationWorkspaceRouting: 'synchronized-replace',
  workspacePersistence: 'serialized-mutations',
  sessionAccessPayload: 'bounded-role-context-only',
  listenerAccess: 'universal-additive-workspace',
  staffListenerPreferenceIsolation: true,
  staleNotificationDelivery: 'expired-before-dispatch',
  adminWorkspaceEntry: 'cached-authority-bounded-fallback',
  nearbySubscriptionMutations: 0,
}, null, 2));
