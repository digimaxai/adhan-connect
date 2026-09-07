const assert = require('node:assert/strict');

const baseUrl = (process.env.QURAN_API_BASE_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function main() {
  const recitersResult = await getJson('/api/quran/reciters');
  assert.equal(recitersResult.response.status, 200);
  assert.match(recitersResult.response.headers.get('cache-control') || '', /max-age=604800/);
  assert.ok(Array.isArray(recitersResult.body?.reciters));
  assert.ok(recitersResult.body.reciters.length > 0);
  assert.equal(recitersResult.body.count, recitersResult.body.reciters.length);

  for (const reciter of recitersResult.body.reciters) {
    assert.ok(Number.isInteger(reciter.id) && reciter.id > 0);
    assert.equal(typeof reciter.reciter_name, 'string');
    assert.equal(typeof reciter.display_name, 'string');
    assert.ok(reciter.display_name.length > 0);
    assert.ok(reciter.style === null || typeof reciter.style === 'string');
  }

  const chaptersResult = await getJson('/api/quran/chapters');
  assert.equal(chaptersResult.response.status, 200);
  assert.match(chaptersResult.response.headers.get('cache-control') || '', /max-age=604800/);
  assert.equal(chaptersResult.body?.count, 114);
  assert.equal(chaptersResult.body.chapters[0].name_simple, 'Al-Fatihah');
  assert.equal(chaptersResult.body.chapters[113].id, 114);

  const shortChapterResult = await getJson('/api/quran/chapter?chapterId=1');
  assert.equal(shortChapterResult.response.status, 200);
  assert.equal(shortChapterResult.body?.chapter?.id, 1);
  assert.equal(shortChapterResult.body?.count, 7);
  assert.equal(shortChapterResult.body?.translation?.name, 'Saheeh International');
  assert.equal(shortChapterResult.body?.verses?.[0]?.verse_key, '1:1');
  assert.ok(shortChapterResult.body.verses[0].text_uthmani.length > 0);
  assert.ok(shortChapterResult.body.verses[0].translation.length > 0);
  assert.doesNotMatch(shortChapterResult.body.verses[0].translation, /<[^>]+>/);

  // Al-Baqarah spans six upstream pages. This guards the all-ayah browser flow.
  const longChapterResult = await getJson('/api/quran/chapter?chapterId=2');
  assert.equal(longChapterResult.response.status, 200);
  assert.equal(longChapterResult.body?.count, 286);
  assert.equal(longChapterResult.body?.verses?.[285]?.verse_key, '2:286');

  const invalidChapterResult = await getJson('/api/quran/chapter?chapterId=115');
  assert.equal(invalidChapterResult.response.status, 400);

  const audioResult = await getJson(
    '/api/quran/verse-audio?verseKey=1%3A1&reciterId=2'
  );
  assert.equal(audioResult.response.status, 200);
  assert.match(audioResult.response.headers.get('cache-control') || '', /max-age=86400/);
  assert.equal(audioResult.body?.audio?.verse_key, '1:1');
  assert.equal(audioResult.body.audio.chapter_number, 1);
  assert.equal(audioResult.body.audio.verse_number, 1);
  assert.ok(audioResult.body.audio.duration > 0);
  assert.match(
    audioResult.body.audio.audio_url,
    /^https:\/\/verses\.quran\.(foundation|com)\//
  );

  const audioResponse = await fetch(audioResult.body.audio.audio_url, {
    headers: { Range: 'bytes=0-1023' },
  });
  assert.ok(audioResponse.status === 200 || audioResponse.status === 206);
  assert.match(audioResponse.headers.get('content-type') || '', /^audio\//);
  const audioBytes = await audioResponse.arrayBuffer();
  assert.ok(audioBytes.byteLength > 0);

  const shortSurahAudioResult = await getJson(
    '/api/quran/surah-audio?chapterId=1&reciterId=2'
  );
  assert.equal(shortSurahAudioResult.response.status, 200);
  assert.match(
    shortSurahAudioResult.response.headers.get('cache-control') || '',
    /max-age=86400/
  );
  assert.equal(shortSurahAudioResult.body?.audio?.chapter_number, 1);
  assert.equal(shortSurahAudioResult.body?.audio?.reciter_id, 2);
  assert.equal(shortSurahAudioResult.body?.audio?.playback_mode, 'continuous');
  assert.match(
    shortSurahAudioResult.body.audio.continuous_audio_url,
    /^https:\/\/download\.quranicaudio\.com\//
  );
  assert.ok(shortSurahAudioResult.body.audio.duration > 0);
  assert.equal(shortSurahAudioResult.body.audio.timestamps.length, 7);
  assert.equal(shortSurahAudioResult.body.audio.timestamps[0].verse_key, '1:1');
  assert.equal(shortSurahAudioResult.body.audio.timestamps[6].verse_key, '1:7');
  assert.ok(
    shortSurahAudioResult.body.audio.timestamps.every(
      (timestamp) => timestamp.timestamp_to > timestamp.timestamp_from
    )
  );
  assert.equal(shortSurahAudioResult.body?.audio?.tracks?.length, 7);
  assert.equal(shortSurahAudioResult.body.audio.tracks[0].verse_key, '1:1');
  assert.equal(shortSurahAudioResult.body.audio.tracks[6].verse_key, '1:7');
  assert.ok(shortSurahAudioResult.body.audio.tracks.every((track) => track.audio_url));

  const continuousAudioResponse = await fetch(
    shortSurahAudioResult.body.audio.continuous_audio_url,
    { headers: { Range: 'bytes=0-1023' } }
  );
  assert.ok(continuousAudioResponse.status === 200 || continuousAudioResponse.status === 206);
  assert.match(continuousAudioResponse.headers.get('content-type') || '', /^audio\//);
  const continuousAudioBytes = await continuousAudioResponse.arrayBuffer();
  assert.ok(continuousAudioBytes.byteLength > 0);

  // Full-surah playback must not stop after the API's common 50-item page size.
  const longSurahAudioResult = await getJson(
    '/api/quran/surah-audio?chapterId=2&reciterId=2'
  );
  assert.equal(longSurahAudioResult.response.status, 200);
  assert.equal(longSurahAudioResult.body?.audio?.playback_mode, 'continuous');
  assert.equal(longSurahAudioResult.body?.audio?.timestamps?.length, 286);
  assert.equal(longSurahAudioResult.body?.audio?.tracks?.length, 286);
  assert.equal(longSurahAudioResult.body.audio.tracks[285].verse_key, '2:286');

  // The live chapter catalogue currently maps ID 11 to a different reciter.
  // Preserve the selected voice by using the verified per-ayah queue instead.
  const fallbackSurahAudioResult = await getJson(
    '/api/quran/surah-audio?chapterId=1&reciterId=11'
  );
  assert.equal(fallbackSurahAudioResult.response.status, 200);
  assert.equal(fallbackSurahAudioResult.body?.audio?.playback_mode, 'verse_queue');
  assert.equal(fallbackSurahAudioResult.body?.audio?.continuous_audio_url, null);
  assert.deepEqual(fallbackSurahAudioResult.body?.audio?.timestamps, []);
  assert.equal(fallbackSurahAudioResult.body?.audio?.tracks?.length, 7);

  const invalidVerseResult = await getJson(
    '/api/quran/verse-audio?verseKey=0%3A1&reciterId=2'
  );
  assert.equal(invalidVerseResult.response.status, 400);

  const invalidReciterResult = await getJson(
    '/api/quran/verse-audio?verseKey=1%3A1&reciterId=0'
  );
  assert.equal(invalidReciterResult.response.status, 400);

  const unavailableAudioResult = await getJson(
    '/api/quran/verse-audio?verseKey=1%3A99&reciterId=2'
  );
  assert.equal(unavailableAudioResult.response.status, 404);

  const invalidSurahResult = await getJson(
    '/api/quran/surah-audio?chapterId=115&reciterId=2'
  );
  assert.equal(invalidSurahResult.response.status, 400);

  const invalidSurahReciterResult = await getJson(
    '/api/quran/surah-audio?chapterId=1&reciterId=0'
  );
  assert.equal(invalidSurahReciterResult.response.status, 400);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        reciters: recitersResult.body.reciters.length,
        chapters: chaptersResult.body.count,
        shortChapterVerses: shortChapterResult.body.count,
        longChapterVerses: longChapterResult.body.count,
        shortSurahTracks: shortSurahAudioResult.body.audio.tracks.length,
        longSurahTracks: longSurahAudioResult.body.audio.tracks.length,
        shortSurahMode: shortSurahAudioResult.body.audio.playback_mode,
        fallbackSurahMode: fallbackSurahAudioResult.body.audio.playback_mode,
        verse: audioResult.body.audio.verse_key,
        reciterId: 2,
        audioHost: new URL(audioResult.body.audio.audio_url).hostname,
        continuousAudioHost: new URL(
          shortSurahAudioResult.body.audio.continuous_audio_url
        ).hostname,
        audioBytesChecked: audioBytes.byteLength,
        continuousAudioBytesChecked: continuousAudioBytes.byteLength,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Quran API integration test failed:', error);
  process.exitCode = 1;
});
