const assert = require('node:assert/strict');

const baseUrl = (process.env.DEVOTIONAL_API_BASE_URL || 'http://127.0.0.1:8081').replace(
  /\/+$/,
  ''
);

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function main() {
  const dailyDua = await getJson('/api/duas/daily');
  assert.equal(dailyDua.response.status, 200);
  assert.equal(typeof dailyDua.body?.dua?.dua_arabic, 'string');
  assert.equal(typeof dailyDua.body?.dua?.dua_english, 'string');

  for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
    const result = await getJson(`/api/duas/daily?prayer=${prayer}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body?.dua?.prayer, prayer);
  }

  const invalidPrayer = await getJson('/api/duas/daily?prayer=Unknown');
  assert.equal(invalidPrayer.response.status, 400);

  const firstReflection = await getJson('/api/tips/daily?offset=0');
  const nextReflection = await getJson('/api/tips/daily?offset=1');
  assert.equal(firstReflection.response.status, 200);
  assert.equal(nextReflection.response.status, 200);
  assert.notEqual(firstReflection.body?.tip?.title, nextReflection.body?.tip?.title);
  assert.ok(Array.isArray(firstReflection.body?.categories));
  assert.equal(firstReflection.body.categories.length, 8);

  const themedReflection = await getJson('/api/tips/daily?category=Patience');
  assert.equal(themedReflection.response.status, 200);
  assert.equal(themedReflection.body?.tip?.category, 'Patience');
  assert.equal(Array.isArray(themedReflection.body?.tip), false);

  const invalidTheme = await getJson('/api/tips/daily?category=Unknown');
  assert.equal(invalidTheme.response.status, 400);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        prayersChecked: 5,
        reflectionCategories: firstReflection.body.categories.length,
        nextReflectionChanges: true,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Duas and reminders API integration test failed:', error);
  process.exitCode = 1;
});
