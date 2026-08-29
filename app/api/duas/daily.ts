// GET /api/duas/daily
// Cost-optimized: Hardcoded array, 24h cache
// Query count: 0 (no DB query)
// Cache: 24 hours

import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface DailyDua {
  prayer: string;
  dua_arabic: string;
  dua_english: string;
  attribution: string;
  transliteration?: string;
}

const duas: DailyDua[] = [
  {
    prayer: 'Fajr',
    dua_arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا طَيِّبًا وَعَمَلًا مُتَقَبَّلًا',
    dua_english: 'O Allah, I ask you for beneficial knowledge, good sustenance, and accepted deeds.',
    transliteration: 'Allahumma inni asaluka ilman nafi\'an wa rizqan tayyiban wa \'amalan mutaqabbalan',
    attribution: 'Traditional Dua',
  },
  {
    prayer: 'Dhuhr',
    dua_arabic: 'رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ وَلِمَن دَخَلَ بَيْتِيَ مُؤْمِنًا',
    dua_english: 'O my Lord, forgive me and my parents and all who enter my house as believers.',
    transliteration: 'Rabbi ighfir li wa li-waliday-ya wa liman dakhala bayti mu\'minan',
    attribution: 'Quran 71:28',
  },
  {
    prayer: 'Asr',
    dua_arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّار',
    dua_english: 'Our Lord, give us goodness in this world and goodness in the hereafter, and protect us from the punishment of the Fire.',
    transliteration: 'Rabbana atina fi al-dunya hasanah wa fi al-akhirah hasanah wa qina adhab al-nar',
    attribution: 'Quran 2:201',
  },
  {
    prayer: 'Maghrib',
    dua_arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيم',
    dua_english: 'In the name of Allah with whose name nothing in the earth or the sky is harmed, and He is the All-Hearing, All-Knowing.',
    transliteration: 'Bismillahilladhi la yadurru ma\'a ismihi shay\'un fi al-ardi wa la fi al-sama\'i wa huwa al-Sami\'u al-\'Alim',
    attribution: 'Hadith - Tirmidhi',
  },
  {
    prayer: 'Isha',
    dua_arabic: 'اللَّهُمَّ إِنِّي أُعُوذُ بِرِضَاكَ مِنْ سَخَطِكَ وَبِمُعَافَاتِكَ مِنْ عُقُوبَتِكَ',
    dua_english: 'O Allah, I seek refuge in Your pleasure from Your anger, and in Your pardoning from Your punishment.',
    transliteration: 'Allahumma inni a\'udhu bi-ridaka min sakhatika wa bi-mu\'afatika min \'uqubatika',
    attribution: 'Hadith - Ibn Majah',
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prayer = (searchParams.get('prayer') || '').toLowerCase();

    let result: DailyDua | DailyDua[];

    if (prayer) {
      // Get dua for specific prayer
      result = duas.find((d) => d.prayer.toLowerCase() === prayer) || duas[0];
    } else {
      // Get verse of day (deterministic based on day of year)
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - startOfYear.getTime();
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);
      result = duas[dayOfYear % duas.length];
    }

    // Metrics logging
    console.log('[METRIC] GET /api/duas/daily | Queries: 0 | Source: Hardcoded');

    return NextResponse.json(
      { dua: result },
      { headers: { 'Cache-Control': 'public, max-age=86400' } } // 24 hours
    );
  } catch (error) {
    console.error('[API] GET /api/duas/daily exception:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dua', dua: duas[0] },
      { status: 500 }
    );
  }
}
