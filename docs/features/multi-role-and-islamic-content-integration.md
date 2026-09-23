# Multi-Role Functionality & Islamic Content Integration

**Date**: 2026-08-29  
**Goal**: Keep the app meaningful with Islamic content (Quran, Duas, Tafsir) + refine multi-role UX.

---

## Part 1: Existing Multi-Role Functionality (Production)

### Current Behavior

**Multi-role assignment happens via Admin:**
- Main Admin assigns a user as "Local Admin" for a mosque
- Main Admin assigns a user as "Muezzin" for a mosque
- User can have BOTH roles (locally admin + muezzin) for same or different mosques

**Role Resolution** (`lib/roles.ts`):
```typescript
// Queries:
1. users.role → global role ('user' or 'main_admin')
2. mosque_admins → local admin assignments
3. muezzins → muezzin assignments (is_active = true)

// Result:
- hasDualStaffAccess: true if both admin + muezzin (non-main-admin)
- adminMosques: list of mosques where user is local admin
- muezzinMosques: list of mosques where user is muezzin
```

**Current Role Entry Screen** (`app/role-entry.tsx`):
- Shows only when `hasDualStaffAccess = true`
- Two cards: "Enter Admin" + "Enter Muezzin"
- Remembers user's preference (sticky)
- Routes to `/(admin)` or `/(muezzin)` workspace

### What Works Well ✅

1. **Clear workspace separation** — admin and muezzin are distinct experiences
2. **Remembers preference** — doesn't show modal every time
3. **Shows context** — tells user which mosque
4. **Non-intrusive** — only shows if user actually has both roles
5. **Fallback navigation** — if single role, skips modal entirely

### Limitations ⚠️

1. **No Listener option** — once in admin/muezzin, hard to get back to listener view
2. **Modal UX** — separate screen, breaks flow
3. **No role tabs** — can't switch quickly mid-session
4. **Mosque context implicit** — user must remember which mosque for each role
5. **No guidance** — doesn't explain differences between roles

---

## Part 2: Improving Multi-Role UX (Recommendations)

### Option A: Keep Current Modal (Simplest)
```
✅ Pros:
- Already working in production
- Minimal code changes
- Clear separation of concerns
- No risk to existing users

❌ Cons:
- Extra screen (interrupts flow)
- Can't return to Listener from admin/muezzin
- No quick role switching
```

### Option B: Tab Switcher at Home (Better UX) ⭐ RECOMMENDED

**For users with single role (admin only or muezzin only):**
```
/(admin)/index.tsx or /(muezzin)/muezzin-home.tsx
→ No changes, works as is
```

**For users with BOTH roles (Listener + Admin + Muezzin):**
```
Home header with role tabs:

┌─────────────────────────────────────┐
│ Adhan Connect                  ⚙️   │
├─────────────────────────────────────┤
│ [👤 Listener] [🏢 Admin] [🎙️ Muezzin]│  ← Tabs
├─────────────────────────────────────┤
│ 📍 London, UK                       │
│ 🕐 Next Prayer: Dhuhr in 45 mins    │
│ [Your Mosques] [Discover]           │
└─────────────────────────────────────┘
```

**When clicking Admin tab:**
```
┌─────────────────────────────────────┐
│ Adhan Connect                  ⚙️   │
├─────────────────────────────────────┤
│ [👤 Listener] [🏢 Admin] [🎙️ Muezzin]│
├─────────────────────────────────────┤
│ 🏢 Admin Dashboard                  │
│ Mosque: East London Central         │
│ (Tap to change mosque)              │
│                                     │
│ [Prayer Times] [Staff] [Live]       │
│ [Settings] [Muezzins]               │
└─────────────────────────────────────┘
```

**Advantages:**
- ✅ No modal (stays in context)
- ✅ Quick switching (swipe or tap)
- ✅ Shows role + context (current mosque)
- ✅ Can return to Listener anytime
- ✅ Modern UX (like Slack, Discord)
- ✅ Scales if more roles added later

### Decision Point
**Recommend**: Implement **Option B (Tabs)** for better UX.  
**If time-constrained**: Stick with **Option A (Current Modal)** — already works.

---

## Part 3: Islamic Content Integration (Never Blank)

### The Challenge

User opens app and sees:
- Empty listener home (if no mosques subscribed)
- Blank prayer times (if no mosques added to DB)
- No reason to stay in app

**Solution**: Populate with meaningful Islamic content:
1. Quranic verses (daily verse of the day)
2. Duas (motivational duas for different times)
3. Hadith (authentic sayings)
4. Tafsir (verse explanation)
5. Islamic tips (learning content)

### Quran.com API (Free & Open)

**API Base**: `https://api.qurancdn.com/api/v4`

**Available Endpoints:**

#### 1. **Get Random Verse** (Daily Motivation)
```
GET /quran/verses/random
GET /quran/chapters/{chapterId}?fields=name,name_arabic,verses_count
GET /quran/verses/{verseKey}?fields=text_madina,surah_name

Example: /verses/1:1
Response:
{
  "verse": {
    "id": 1,
    "verse_key": "1:1",
    "text_madina": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    "surah_name": "Al-Fatihah",
    "surah_name_arabic": "الفاتحة"
  }
}
```

#### 2. **Get Verse with Translation**
```
GET /quran/verses/{verseKey}?fields=text_uthmani,translations
  &language=en

Example: /verses/1:1?fields=text_uthmani,translations&language=en
Response:
{
  "verse": {
    "verse_key": "1:1",
    "text_uthmani": "بسم الله الرحمن الرحيم",
    "translations": [
      {
        "text": "In the name of Allah, the Most Gracious, the Most Merciful",
        "resource_name": "Sahih International"
      }
    ]
  }
}
```

#### 3. **Get Tafsir (Explanation)**
```
GET /quran/tafsirs?fields=id,name,language_name
GET /quran/tafsirs/{tafsirsId}/verses/{verseKey}

Available Tafsirs:
- 1: ar_tafsir_al_tabari
- 2: ar_tafsir_ibn_kathir
- 3: ar_tafsir_al_qortobi
- 4: en_tafsir_ibn_kathir (English)
- 5: en_sahih_international (English)

Example: /tafsirs/4/verses/1:1
Response:
{
  "tafsir": {
    "verse_key": "1:1",
    "text": "The Opening Chapter of the Qur'an. It contains seven verses..."
  }
}
```

#### 4. **Search Verses**
```
GET /quran/search?q=mercy&language=en&size=5

Response:
{
  "search": {
    "matches": [
      {
        "verse_key": "1:1",
        "text": "In the name of Allah, the Most Gracious, the Most Merciful",
        "surah_name": "Al-Fatihah"
      }
    ]
  }
}
```

#### 5. **Get All Chapters/Surahs**
```
GET /quran/chapters?language=en

Response:
{
  "chapters": [
    {
      "id": 1,
      "name": "Al-Fatihah",
      "name_arabic": "الفاتحة",
      "verses_count": 7,
      "revelation_type": "Meccan"
    }
  ]
}
```

### Islamic Content Implementation Plan

#### **Homepage Content Blocks** (Never Blank)

**Block 1: Verse of the Day**
```
┌─────────────────────────────────────┐
│ 📖 Verse of the Day                 │
├─────────────────────────────────────┤
│                                     │
│ الفاتحة (Al-Fatihah) - 1:1          │
│                                     │
│ "بسم الله الرحمن الرحيم"             │
│                                     │
│ In the name of Allah, the Most      │
│ Gracious, the Most Merciful         │
│                                     │
│ [Tafsir] [Share] [Save]            │
│                                     │
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
// lib/api/quran.ts
export async function getVerseOfTheDay() {
  // Deterministic: same verse for all users on same day
  const seed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const verseNumber = ((seed * 1234) % 6236) + 1; // Total Quranic verses
  
  const response = await fetch(
    `https://api.qurancdn.com/api/v4/quran/verses/${verseNumber}?fields=text_uthmani,translations&language=en`
  );
  return response.json();
}

// app/(user)/listener-home.tsx
const [verseOfDay, setVerseOfDay] = useState(null);

useEffect(() => {
  getVerseOfTheDay().then(setVerseOfDay);
}, []);
```

**Block 2: Daily Dua**
```
┌─────────────────────────────────────┐
│ 🤲 Dua for This Time                │
├─────────────────────────────────────┤
│                                     │
│ Morning Dua (5:30 AM)               │
│                                     │
│ "اللهم بك أصبحنا وبك أمسينا وبك    │
│ نحيا وبك نموت وإليك النشور"         │
│                                     │
│ "O Allah, by You we have reached   │
│ the morning. By You we reach the   │
│ evening, by You we live, by You   │
│ we die, and to You is our return"  │
│                                     │
│ [Learn more] [Share]               │
│                                     │
└─────────────────────────────────────┘
```

**Implementation** (hardcoded duas + times):
```typescript
// lib/duas.ts
export const DUAS_BY_TIME = {
  'fajr': {
    title: 'Fajr Dua',
    arabic: 'اللهم بك أصبحنا...',
    english: 'O Allah, by You we have reached the morning...'
  },
  'dhuhr': {
    title: 'Midday Dua',
    arabic: 'اللهم أنت السلام...',
    english: 'O Allah, You are As-Salam...'
  },
  // etc.
};

// app/(user)/listener-home.tsx
const currentPrayer = getCurrentPrayerOrNext();
const dua = DUAS_BY_TIME[currentPrayer.toLowerCase()];
```

**Block 3: Islamic Tip / Learning**
```
┌─────────────────────────────────────┐
│ 💡 Did You Know?                    │
├─────────────────────────────────────┤
│                                     │
│ The word "Adhan" (أذان) means      │
│ "announcement" in Arabic.           │
│                                     │
│ The Adhan was established by the    │
│ Prophet Muhammad ﷺ as the call     │
│ to prayer, heard 5 times daily.     │
│                                     │
│ [Learn More]                        │
│                                     │
└─────────────────────────────────────┘
```

**Block 4: Trending/Popular Verses**
```
┌─────────────────────────────────────┐
│ 🔥 Popular Verses This Week         │
├─────────────────────────────────────┤
│                                     │
│ 🥇 Ayat Al-Kursi (2:255)           │
│    The Throne Verse - 42K shares   │
│                                     │
│ 🥈 Surah Al-Fatiha (1:1-7)         │
│    The Opening - 38K shares        │
│                                     │
│ 🥉 Ya Sin (36:1-3)                 │
│    The Heart of the Quran - 31K    │
│                                     │
└─────────────────────────────────────┘
```

**Implementation** (hardcoded for now):
```typescript
// lib/popularVerses.ts
export const POPULAR_VERSES = [
  { verseKey: '2:255', name: 'Ayat Al-Kursi', description: 'The Throne Verse' },
  { verseKey: '1:1-7', name: 'Surah Al-Fatiha', description: 'The Opening' },
  // etc.
];
```

**Block 5: Community Activity**
```
┌─────────────────────────────────────┐
│ 🌍 Community Right Now              │
├─────────────────────────────────────┤
│ 👥 12,340 people listening          │
│ 🔴 8 live adhans happening          │
│ 🎙️ 45 people broadcasting           │
│                                     │
│ [Browse Live Adhans]                │
│                                     │
└─────────────────────────────────────┘
```

---

## Part 4: Content Feed Architecture

### Homepage Layout (Never Blank)

```
┌────────────────────────────────────┐
│ Adhan Connect           [👤 Listener]│
├────────────────────────────────────┤
│ 📍 London, UK                      │
│ 🕐 Next Prayer: Dhuhr in 45 mins   │
├────────────────────────────────────┤
│ 📖 VERSE OF THE DAY                │
│ (Quran.com API)                    │
├────────────────────────────────────┤
│ 🤲 DUA FOR THIS TIME               │
│ (Hardcoded, time-aware)            │
├────────────────────────────────────┤
│ 💡 DID YOU KNOW?                   │
│ (Rotating tips)                    │
├────────────────────────────────────┤
│ 🕌 YOUR FOLLOWED MOSQUES (if any)  │
│ (Dynamic, user data)               │
├────────────────────────────────────┤
│ 🔥 POPULAR VERSES                  │
│ (Hardcoded or trending)            │
├────────────────────────────────────┤
│ 🌍 COMMUNITY ACTIVITY              │
│ (Real-time stats)                  │
├────────────────────────────────────┤
│ [Discover] [Settings]              │
└────────────────────────────────────┘
```

### API Integration Strategy

#### **Quran Content (Cached)**
- Fetch verse of day on app startup
- Cache for 24 hours (deterministic daily)
- Fallback: hardcoded verse if API fails

#### **Duas (Hardcoded + Smart)**
- Time-aware routing (fajr dua at fajr time)
- Rotate daily (5 duas, one per prayer)
- No API call needed

#### **Tips (Rotating Hardcoded)**
- 20 tips (Islamic education)
- Deterministic rotation (same tip for all users on same day)
- Change daily based on date seed

#### **Popular Verses (Hardcoded + API Optional)**
- Start with hardcoded top 10 (most-shared Ayats)
- Later: sync with Quran.com trending if available

#### **Community Stats (Real-time)**
- Fetch from Adhan DB (users listening now)
- Count `streams.is_live = true`
- Cache for 30 seconds

---

## Part 5: Implementation Phases

### Phase 1: API & Client Library (1 week)
- [ ] Create `lib/api/quran.ts` (Quran.com API wrapper)
- [ ] Create `lib/duas.ts` (hardcoded duas + scheduling)
- [ ] Create `lib/islamicTips.ts` (rotating tips)
- [ ] Error handling & fallbacks

### Phase 2: Content Blocks (1 week)
- [ ] `components/VerseOfTheDayCard.tsx`
- [ ] `components/DuaCard.tsx`
- [ ] `components/IslamicTipCard.tsx`
- [ ] `components/PopularVersesCard.tsx`
- [ ] `components/CommunityActivityCard.tsx`

### Phase 3: Homepage Redesign (1 week)
- [ ] Update `screens/user/index.tsx` with content blocks
- [ ] Layout & spacing
- [ ] Empty state handling
- [ ] Loading states (skeleton loaders)

### Phase 4: Polish & Optimization (3 days)
- [ ] Cache management
- [ ] API error handling
- [ ] Accessibility
- [ ] Performance (lazy load blocks)

### Phase 5: Testing (3 days)
- [ ] Different device sizes
- [ ] Different data scenarios (0 mosques, 10 mosques)
- [ ] API failure scenarios
- [ ] Caching behavior

---

## Part 6: Smart Content Scheduling

### Time-Aware Content

**Fajr (Early Morning)**
- Show Fajr dua
- Show morning motivation verse
- "Start your day with prayer"

**Dhuhr (Midday)**
- Show Dhuhr dua
- Show work/productivity verse
- "Take a moment for prayer"

**Asr (Afternoon)**
- Show Asr dua
- Show patience/perseverance verse
- "Afternoon prayer time"

**Maghrib (Evening)**
- Show Maghrib dua
- Show gratitude/reflection verse
- "Evening prayers begin"

**Isha (Night)**
- Show Isha dua
- Show night/mercy verse
- "End your day in prayer"

### Example Implementation
```typescript
function getCurrentDua(): Dua {
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 5 && hour < 12) return duas.fajr;
  if (hour >= 12 && hour < 16) return duas.dhuhr;
  if (hour >= 16 && hour < 18) return duas.asr;
  if (hour >= 18 && hour < 20) return duas.maghrib;
  return duas.isha;
}
```

---

## Part 7: Error Handling & Fallbacks

### What if Quran.com API fails?
```typescript
try {
  const verse = await getVerseOfTheDay();
  setVerse(verse);
} catch (error) {
  // Fallback to hardcoded verse of the day
  setVerse(FALLBACK_VERSES[Math.floor(Date.now() / 86400000) % FALLBACK_VERSES.length]);
}
```

### What if user has no mosques?
```typescript
if (userMosques.length === 0) {
  return (
    <ScrollView>
      <VerseOfTheDayCard />
      <DuaCard />
      <IslamicTipCard />
      <PopularVersesCard />
      <CommunityActivityCard />
      <DiscoverMosquesCard />
    </ScrollView>
  );
}
```

### What if user has 10+ mosques?
```typescript
return (
  <ScrollView>
    <PrayerCountdown />
    <FollowedMosquesCarousel /> {/* Show first 3 */}
    <VerseOfTheDayCard />
    <DuaCard />
    {/* Less cluttered */}
    <DiscoverMoreButton />
  </ScrollView>
);
```

---

## Part 8: Performance Considerations

### Data Fetching Strategy
```
App Launch:
├─ Fetch verse of day (cache 24h)
├─ Fetch community stats (cache 30s)
├─ Hardcode duas + tips (no fetch)
└─ Load user mosques from DB

Refresh:
├─ Pull-to-refresh updates community stats + verse
├─ Background sync every 60s
└─ No aggressive API calls
```

### Bundle Size Impact
```
Additions:
- lib/quran.ts: ~5KB
- lib/duas.ts: ~8KB (30 duas)
- lib/islamicTips.ts: ~15KB (20 tips)
- Components: ~20KB (5 cards)

Total: ~50KB (negligible, <5% of bundle)
```

### API Rate Limiting
```
Quran.com API:
- No rate limiting documented (public API)
- Cache verse of day (1 call/24h per user)
- Cache community stats (1 call/30s per user)
- Total: 2,880 calls/24h for 1K users (safe)
```

---

## Summary & Recommendations

### Multi-Role UX
**Decision**: Implement **Option B (Tab Switcher)**
- Better UX than current modal
- Faster switching
- Can return to listener anytime
- Scales for future roles

### Islamic Content
**Decision**: Implement all 5 content blocks
- Never blank homepage
- Meaningful engagement
- No guest browsing needed
- Builds user habit loop

### Implementation Order
1. **Week 1**: Phase 1-2 (Quran API + Content Blocks)
2. **Week 2**: Phase 3-4 (Homepage redesign + Polish)
3. **Week 3**: Phase 5 (Testing + Deployment)

### Expected Outcomes
- ✅ Homepage never blank
- ✅ 25-30% increase in time-on-app
- ✅ Multi-role UX improved
- ✅ User feels welcomed with Islamic content
- ✅ Ready for when mosques are sparse
