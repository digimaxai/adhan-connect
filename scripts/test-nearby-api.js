const assert = require('node:assert/strict');

const baseUrl = (process.env.NEARBY_API_BASE_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function main() {
  const invalid = await get('/api/mosques/nearby?lat=999&lon=0');
  assert.equal(invalid.response.status, 400);

  const result = await get('/api/mosques/nearby?lat=51.58&lon=-0.34&radius=15&limit=10');
  assert.equal(result.response.status, 200);
  assert.match(result.response.headers.get('cache-control') || '', /private/);
  assert.match(result.response.headers.get('cache-control') || '', /no-store/);
  assert.ok(Array.isArray(result.body?.mosques));
  assert.ok(result.body.mosques.length > 0 && result.body.mosques.length <= 10);

  let foundNonLive = false;
  const lastDistanceByGroup = { live: -1, scheduled: -1 };
  for (const mosque of result.body.mosques) {
    assert.equal(typeof mosque.id, 'string');
    assert.equal(typeof mosque.name, 'string');
    assert.ok(Number.isFinite(mosque.distance_km) && mosque.distance_km >= 0);
    assert.ok(['mosque', 'calculated', 'unavailable'].includes(mosque.schedule_source));
    assert.equal(typeof mosque.is_live, 'boolean');

    if (mosque.is_live) {
      assert.equal(foundNonLive, false, 'LIVE mosques must sort ahead of non-LIVE mosques.');
    } else {
      foundNonLive = true;
    }
    const group = mosque.is_live ? 'live' : 'scheduled';
    assert.ok(mosque.distance_km >= lastDistanceByGroup[group]);
    lastDistanceByGroup[group] = mosque.distance_km;

    if (mosque.next_adhan_at !== null) {
      assert.ok(Number.isFinite(new Date(mosque.next_adhan_at).getTime()));
      assert.ok(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(mosque.next_prayer));
      assert.ok(Number.isInteger(mosque.minutes_until) && mosque.minutes_until >= 0);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    mosques: result.body.mosques.length,
    liveFirst: true,
    privateLocationCache: true,
  }, null, 2));
}

main().catch((error) => {
  console.error('Nearby API test failed:', error);
  process.exitCode = 1;
});
