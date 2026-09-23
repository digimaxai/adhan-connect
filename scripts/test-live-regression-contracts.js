const assert = require('node:assert/strict');

const baseUrl = (process.env.LIVE_REGRESSION_BASE_URL || 'http://127.0.0.1:8081')
  .replace(/\/+$/, '');
const testId = '00000000-0000-4000-8000-000000000001';

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text();
  return { response, body };
}

async function assertPage(path) {
  const result = await request(path, {
    headers: { Accept: 'text/html' },
    redirect: 'manual',
  });
  assert.ok(
    result.response.status === 200 ||
      (result.response.status >= 300 && result.response.status < 400),
    `${path} did not serve or redirect successfully (HTTP ${result.response.status}).`
  );
  return result.response.status;
}

async function assertAuthGuard(path, init) {
  const result = await request(path, init);
  assert.equal(
    result.response.status,
    401,
    `${path} must reject a missing bearer token before protected work (received HTTP ${result.response.status}).`
  );
  assert.equal(typeof result.body?.error, 'string');
  return result.response.status;
}

async function main() {
  const pageStatuses = {};
  for (const path of [
    '/listener-home',
    '/now',
    '/muezzin/live-broadcast',
    '/muezzins',
    '/staff-rota',
  ]) {
    pageStatuses[path] = await assertPage(path);
  }

  const jsonHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const guardedStatuses = {};

  guardedStatuses.broadcastState = await assertAuthGuard(
    `/api/muezzin/live-broadcast?mosqueId=${testId}`,
    { headers: { Accept: 'application/json' } }
  );
  guardedStatuses.broadcastStart = await assertAuthGuard(
    '/api/muezzin/live-broadcast',
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        action: 'start',
        mosqueId: testId,
        prayer: 'fajr',
        scheduledAt: '2026-09-02T04:00:00.000Z',
      }),
    }
  );
  guardedStatuses.publisherToken = await assertAuthGuard(
    '/api/muezzin/livekit-token',
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ mosqueId: testId, prayer: 'fajr' }),
    }
  );
  guardedStatuses.listenerToken = await assertAuthGuard(
    '/api/listener/livekit-token',
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ mosqueId: testId }),
    }
  );
  guardedStatuses.listenerAccess = await assertAuthGuard(
    '/api/live-stream-access',
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ mosqueId: testId, streamId: null, location: null }),
    }
  );
  guardedStatuses.muezzinAssignment = await assertAuthGuard(
    '/api/admin/muezzin-assignment',
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ userId: testId, mosqueId: testId }),
    }
  );
  guardedStatuses.rotaWorkspace = await assertAuthGuard(
    `/api/admin/staff-rota-workspace?mosqueId=${testId}&date=2026-09-02`,
    { headers: { Accept: 'application/json' } }
  );
  guardedStatuses.rotaSave = await assertAuthGuard(
    '/api/admin/staff-rota-save',
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        mosqueId: testId,
        date: '2026-09-02',
        assignments: {
          fajr: { muezzinUserId: testId, assignmentSource: 'manual' },
        },
      }),
    }
  );
  guardedStatuses.muezzinRota = await assertAuthGuard(
    '/api/muezzin/rota-workspace?start=2026-09-02&end=2026-09-08',
    { headers: { Accept: 'application/json' } }
  );

  const unsignedPlayback = await request('/api/live-stream-playback', {
    headers: { Accept: 'application/json' },
  });
  assert.equal(unsignedPlayback.response.status, 400);

  const invalidNearbyLive = await request(
    '/api/live-adhans/location?lat=999&lon=0&radius=15',
    { headers: { Accept: 'application/json' } }
  );
  assert.equal(invalidNearbyLive.response.status, 400);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        productionDataMutations: 0,
        pageStatuses,
        guardedStatuses,
        unsignedPlaybackStatus: unsignedPlayback.response.status,
        invalidNearbyLiveStatus: invalidNearbyLive.response.status,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Critical live regression contract test failed:', error);
  process.exitCode = 1;
});
