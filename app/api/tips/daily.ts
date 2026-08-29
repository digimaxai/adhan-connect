// GET /api/tips/daily
// Cost-optimized: Hardcoded array, 24h cache
// Query count: 0 (no DB query)
// Cache: 24 hours

import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface IslamicTip {
  category: string;
  title: string;
  description: string;
  reference?: string;
  icon?: string;
}

const tips: IslamicTip[] = [
  {
    category: 'Adab',
    title: 'Show respect to your parents',
    description: 'Allah says in the Quran: "And be kind to parents. If one or both of them attain old age in your life, say not a word of disrespect to them" (17:23)',
    reference: 'Quran 17:23',
    icon: '👨‍👩‍👧',
  },
  {
    category: 'Charity',
    title: 'Charity shields from calamity',
    description: 'The Prophet Muhammad (peace be upon him) said: "Charity does not decrease wealth" - Encourage giving, even if it is a small amount.',
    reference: 'Hadith - Muslim',
    icon: '🤝',
  },
  {
    category: 'Knowledge',
    title: 'Seek knowledge throughout your life',
    description: 'The Prophet Muhammad (peace be upon him) said: "Whoever follows a path seeking knowledge, Allah will make easy for him a path to Paradise"',
    reference: 'Hadith - Tirmidhi',
    icon: '📚',
  },
  {
    category: 'Gratitude',
    title: 'Thank Allah for His blessings',
    description: 'Allah says: "If you are grateful, I will surely increase you [in favor]" (14:7) - Start your day by listing things you are grateful for.',
    reference: 'Quran 14:7',
    icon: '🙏',
  },
  {
    category: 'Ihsan',
    title: 'Do good deeds with sincerity',
    description: 'The Prophet Muhammad (peace be upon him) defined Ihsan as: "to worship Allah as if you see Him, and if you cannot see Him, surely He sees you"',
    reference: 'Hadith - Muslim',
    icon: '✨',
  },
  {
    category: 'Community',
    title: 'Be kind to your neighbors',
    description: 'The Prophet Muhammad (peace be upon him) said: "The best of you are those who are best to their families, and I am the best among you to my family"',
    reference: 'Hadith - Tirmidhi',
    icon: '👥',
  },
  {
    category: 'Health',
    title: 'Taking care of your body is worship',
    description: 'The Prophet Muhammad (peace be upon him) encouraged exercise and physical fitness. A healthy body helps you worship Allah better.',
    reference: 'Islamic Teaching',
    icon: '💪',
  },
  {
    category: 'Patience',
    title: 'Practice patience (Sabr)',
    description: 'Allah says: "Indeed, the patient will be given their reward without measure" (39:10) - Patience is key to spiritual growth.',
    reference: 'Quran 39:10',
    icon: '⏳',
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get('category') || '').toLowerCase();

    let result: IslamicTip | IslamicTip[];

    if (category) {
      // Get tips for specific category
      result = tips.filter((t) => t.category.toLowerCase() === category);
      if (result.length === 0) result = tips[0];
    } else {
      // Get tip of day (deterministic based on day of year)
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - startOfYear.getTime();
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);
      result = tips[dayOfYear % tips.length];
    }

    // Metrics logging
    console.log('[METRIC] GET /api/tips/daily | Queries: 0 | Source: Hardcoded');

    return NextResponse.json(
      { tip: result },
      { headers: { 'Cache-Control': 'public, max-age=86400' } } // 24 hours
    );
  } catch (error) {
    console.error('[API] GET /api/tips/daily exception:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tip', tip: tips[0] },
      { status: 500 }
    );
  }
}
