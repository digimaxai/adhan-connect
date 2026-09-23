# Quran Listening Integration - Complete Design

**Date**: 2026-08-29  
**Goal**: Add beautiful, seamless Quran recitation experience using Quran.com audio API (50+ reciters, multiple styles).

---

## Part 1: Quran.com Audio API Capabilities

### Available Reciters (50+)
**Top 5 Most Popular:**
1. **Abdul Basit Abdul Samad** — Classical, meditative, most-downloaded globally
2. **Mishari Rashid al-Efasy** — Contemporary, emotional, popular in Arab countries
3. **Muhammad Jibreel** — Smooth, melodic, great for beginners
4. **Ahmed Al-Ajmi** — Modern, clear pronunciation, popular in UK/US
5. **Ibrahim Walk** — Western-trained, clear, popular with international audiences

**Total**: 50+ reciters available via API

### Audio Formats Available
- **MP3** (primary, most compatible)
- **OGG** (alternative)
- **AAC** (fallback)

### API Endpoints

#### 1. List All Reciters
```
GET /resources/recitations?language=en
Response: { recitations: [ { id, reciter_name, reciter_name_arabic, style } ] }
```

#### 2. Get Verse Audio
```
GET /quran/verses/{verseKey}/audio?recitation={recitationId}
Response: { verse: { verse_key, audio: { url, duration }, surah_name } }
Example: /verses/1:1/audio?recitation=1
Returns: 8.5 second audio file for Surah Al-Fatihah verse 1
```

#### 3. Get Full Chapter Audio
```
GET /quran/chapters/{chapterId}/recitations/{recitationId}
Response: { chapter: { id, name, audio_url } }
Example: /chapters/1/recitations/1
Returns: Full Surah Al-Fatihah (27 minutes) by Abdul Basit
```

#### 4. Get Chapter with Verses
```
GET /quran/chapters/{chapterId}/verses?fields=text_uthmani&audio={recitationId}
Response: Full chapter with verse-level audio URLs
Useful for: Verse-by-verse recitation with text
```

---

## Part 2: Listening Experience Design

### Feature 1: "Listen to Verse of Day" Card

**Current design:**
```
┌─────────────────────────────────────┐
│ 📖 Verse of the Day                 │
├─────────────────────────────────────┤
│ الفاتحة (Al-Fatihah) - 1:1          │
│ "بسم الله الرحمن الرحيم"             │
│ In the name of Allah, the Most      │
│ Gracious, the Most Merciful         │
│ [Tafsir] [Share] [Save]            │
└─────────────────────────────────────┘
```

**Enhanced with Audio:**
```
┌─────────────────────────────────────┐
│ 📖 Verse of the Day                 │
├─────────────────────────────────────┤
│ الفاتحة (Al-Fatihah) - 1:1          │
│ "بسم الله الرحمن الرحيم"             │
│ In the name of Allah, the Most      │
│ Gracious, the Most Merciful         │
│                                     │
│ ┌─────────────────────────────┐     │
│ │ 🎙️ Abdul Basit Al-Samad      │     │
│ │ [▶️] ░░░░░░░░░░░░░░░░░ 8.5s │     │
│ │ [🔊] Reciter: [Change ▼]    │     │
│ └─────────────────────────────┘     │
│                                     │
│ [Tafsir] [Share] [Save] [Full Ch.]  │
└─────────────────────────────────────┘
```

**Key Features:**
- ✅ Show current reciter (with easy change)
- ✅ Play button (tap to listen)
- ✅ Progress bar (skip/replay)
- ✅ Volume control
- ✅ "Full Chapter" CTA (discover more)
- ✅ Auto-pause when message arrives

---

### Feature 2: "Quran Library" Tab

**New bottom tab navigation:**
```
┌────────────────────────────────────┐
│ [👤 Listener] [📖 Quran] [🤲 Dua]   │  ← New tabs
├────────────────────────────────────┤
```

**Quran tab shows:**
```
┌────────────────────────────────────┐
│ Adhan Connect               ⚙️      │
├────────────────────────────────────┤
│ [👤 Listener] [📖 Quran] [🤲 Dua]   │
├────────────────────────────────────┤
│ 🎙️ Select Your Reciter             │
│ [Abdul Basit ▼] (default)           │
│ [Change Reciter]                    │
├────────────────────────────────────┤
│ 📚 Browse Surahs                    │
│                                    │
│ ┌──────────────────────────┐        │
│ │ 1. Al-Fatihah            │        │
│ │ ⏱️  7 verses • 5 mins    │        │
│ │ [▶️ Listen]              │        │
│ └──────────────────────────┘        │
│                                    │
│ ┌──────────────────────────┐        │
│ │ 2. Al-Baqarah           │        │
│ │ ⏱️  286 verses • 3h 23m  │        │
│ │ [▶️ Listen]              │        │
│ └──────────────────────────┘        │
│                                    │
│ ┌──────────────────────────┐        │
│ │ 3. Ali Imran            │        │
│ │ ⏱️  200 verses • 2h 17m  │        │
│ │ [▶️ Listen]              │        │
│ └──────────────────────────┘        │
│                                    │
│ [Search Surah]                     │
│                                    │
├────────────────────────────────────┤
│ 🎵 Recently Listened                │
│ • Al-Fatihah (completed)            │
│ • Surah Yasin (verse 5 of 83)      │
│ • Al-Baqarah (verse 23 of 286)     │
└────────────────────────────────────┘
```

---

### Feature 3: Chapter Listening Screen

**Full chapter player:**
```
┌────────────────────────────────────┐
│ < Surah Al-Fatihah           ⋮      │
├────────────────────────────────────┤
│                                    │
│      🎙️  Abdul Basit Al-Samad      │
│         (Classical Recitation)      │
│                                    │
│  ┌────────────────────────────┐    │
│  │   7 verses • 5 minutes     │    │
│  └────────────────────────────┘    │
│                                    │
│  ┌────────────────────────────┐    │
│  │ بسم الله الرحمن الرحيم     │    │
│  │                            │    │
│  │ In the name of Allah, the  │    │
│  │ Most Gracious, the Most    │    │
│  │ Merciful                   │    │
│  └────────────────────────────┘    │
│                                    │
│  Verse 1 of 7                      │
│  [<< Previous]  [Next >>]           │
│                                    │
│  ┌────────────────────────────┐    │
│  │  [▶️ Playing...]            │    │
│  │  ░░░░░░░░░░░░░░░░░░░░░░  2:15 │    │
│  │  [🔊 100%]                  │    │
│  └────────────────────────────┘    │
│                                    │
│  [Repeat] [Share] [Bookmark]       │
│                                    │
├────────────────────────────────────┤
│ ✨ Verse Meaning (Tafsir)           │
│                                    │
│ This verse contains the Basmalah   │
│ (بسم الله الرحمن الرحيم), which is │
│ recited at the beginning of every  │
│ chapter except Surah At-Tawbah...  │
│                                    │
│ [Full Tafsir] [Search Similar]     │
└────────────────────────────────────┘
```

**Key Features:**
- ✅ Show current reciter (can change)
- ✅ Display verse text (Arabic + English)
- ✅ Verse number (X of Y)
- ✅ Next/Previous verse buttons (skip within chapter)
- ✅ Progress bar (seek to specific verse)
- ✅ Play/pause/volume controls
- ✅ Show tafsir inline
- ✅ Repeat option (loop this verse or chapter)

---

### Feature 4: Reciter Selection Modal

**When user taps "Change Reciter":**
```
┌────────────────────────────────────┐
│ Select a Reciter            ✕      │
├────────────────────────────────────┤
│ Search: [__________]               │
│                                    │
│ ★★★★★ (Most Popular)               │
│ ┌──────────────────────────┐        │
│ │ Abdul Basit Abdul Samad  │        │
│ │ Classical • Hafs         │        │
│ │ 👥 2.5M downloads        │        │
│ │ ⏱️  ~3hrs for full Quran  │        │
│ │ [Select]                 │        │
│ └──────────────────────────┘        │
│                                    │
│ ★★★★☆ (Very Popular)               │
│ ┌──────────────────────────┐        │
│ │ Mishari Rashid al-Efasy  │        │
│ │ Contemporary • Hafs      │        │
│ │ 👥 1.8M downloads        │        │
│ │ ⏱️  ~2h 45m for full      │        │
│ │ [Select]                 │        │
│ └──────────────────────────┘        │
│                                    │
│ ★★★★☆ (Popular)                    │
│ ┌──────────────────────────┐        │
│ │ Muhammad Jibreel         │        │
│ │ Melodic • Hafs           │        │
│ │ 👥 1.2M downloads        │        │
│ │ ⏱️  ~3h for full Quran    │        │
│ │ [Select]                 │        │
│ └──────────────────────────┘        │
│                                    │
│ [View All 50+ Reciters]             │
└────────────────────────────────────┘
```

**Features:**
- ✅ Search by reciter name
- ✅ Sort by popularity (downloads)
- ✅ Show reciter style (classical, contemporary, melodic)
- ✅ Show full Quran duration estimate
- ✅ Download counter (social proof)
- ✅ One-tap selection
- ✅ Remembers user preference

---

## Part 3: Home Feed Integration

### Updated Homepage (Rich Content)

```
┌────────────────────────────────────┐
│ Adhan Connect        [👤] [📖] [🤲]│
├────────────────────────────────────┤
│ 📍 London, UK                      │
│ 🕐 Next Prayer: Dhuhr in 45 mins   │
├────────────────────────────────────┤
│ 📖 VERSE OF THE DAY                │
│ (with audio player)                │
│ "بسم الله الرحمن الرحيم"            │
│ 🎙️ Abdul Basit • [▶️] ░░░░░░░░ 8.5s│
│ [Tafsir] [Full Chapter] [Change]   │
├────────────────────────────────────┤
│ 🤲 DUA FOR THIS TIME               │
│ (time-aware)                       │
│ Fajr Dua: "اللهم بك أصبحنا..."      │
│ [Learn more] [Share]               │
├────────────────────────────────────┤
│ 💡 DID YOU KNOW?                   │
│ (Rotating Islamic tips)            │
├────────────────────────────────────┤
│ 🎵 LISTEN TO QURAN                 │
│ (Trending feature)                 │
│ [Browse All Surahs] [Your Reciters]│
│ [Continue: Surah Yasin (vers 23)]  │
├────────────────────────────────────┤
│ 🕌 YOUR FOLLOWED MOSQUES (if any)  │
│ (User data)                        │
├────────────────────────────────────┤
│ 🔥 POPULAR VERSES                  │
│ (Trending)                         │
├────────────────────────────────────┤
│ 🌍 COMMUNITY ACTIVITY              │
│ (Real-time)                        │
└────────────────────────────────────┘
```

---

## Part 4: Tab Navigation (Enhanced)

### New Bottom Tabs for Listener

```
Current (2 tabs):
┌──────────────┬──────────────┐
│ 👤 Listener  │ ⚙️ Settings  │
└──────────────┴──────────────┘

Enhanced (3-4 tabs):
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 👤 Listener  │ 📖 Quran     │ 🤲 Duas      │ ⚙️ Settings  │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Listener Tab**: Prayer times, mosques, live adhans (unchanged)  
**Quran Tab**: Browse Surahs, select reciter, listen (NEW)  
**Duas Tab**: Daily duas, duas by occasion, duas by category (NEW)  
**Settings Tab**: Profile, notifications, preferences (unchanged)  

---

## Part 5: Implementation Details

### Tech Stack
- **Audio Player**: Use existing `expo-av` (already in project)
- **API Client**: Extend `lib/api/quran.ts`
- **Storage**: Store user's preferred reciter in AsyncStorage
- **Caching**: Cache reciter list (once per week)
- **Streaming**: Stream audio directly from Quran.com CDN

### Data Flow

```
1. User opens app
   → Load saved reciter preference (AsyncStorage)
   → Fetch verse of day audio with that reciter

2. User taps "Listen to Verse"
   → Check if audio URL cached
   → If not, fetch from API (1 call)
   → Pass URL to expo-av player
   → Play audio

3. User changes reciter
   → Save new preference (AsyncStorage)
   → Fetch all verses audio with new reciter
   → Reload player

4. User browses Quran tab
   → Show list of 114 Surahs (hardcoded metadata)
   → On tap, fetch all verses for that Surah with audio URLs
   → Show verse list with playable audio
```

### API Calls Required

**On App Load (Cached 7 days):**
```
GET /resources/recitations?language=en
→ List of 50+ reciters (response ~50KB, cached 7 days)
```

**On Verse of Day Load (Cached 24h):**
```
GET /quran/verses/{randomVerseKey}/audio?recitation={reciterId}
→ Single verse audio URL + metadata
→ One call per user per day
```

**On Browse Chapter (No Cache):**
```
GET /quran/chapters/{chapterId}/verses?fields=text_uthmani&audio={reciterId}
→ All verses in chapter with audio URLs
→ ~100-300KB per chapter (variable)
→ Called only when user opens chapter
```

**Estimated Daily API Usage (1000 users):**
- Reciter list: 1 call (shared cache, per week)
- Verse of day: 1,000 calls (1 per user per day)
- Chapter browse: 50-200 calls (if 5-20% of users browse chapters)
- **Total**: ~1,050-1,200 calls/day (very safe, Quran.com unrestricted)

---

## Part 6: Audio Player Implementation

### Core Component: `components/QuranPlayer.tsx`

```typescript
interface QuranPlayerProps {
  verseKey: string; // "1:1"
  reciterId: number; // 1 (Abdul Basit)
  autoplay?: boolean;
  showControls?: boolean;
}

export function QuranPlayer({ verseKey, reciterId, autoplay, showControls }: QuranPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadAudio();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [verseKey, reciterId]);

  async function loadAudio() {
    try {
      const audioUrl = await getQuranVerseAudio(verseKey, reciterId);
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: autoplay }
      );
      soundRef.current = sound;
      setIsPlaying(autoplay ?? false);
      
      // Update duration when loaded
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        setDuration(status.durationMillis ?? 0);
      }
    } catch (err) {
      setError('Failed to load audio');
    }
  }

  async function togglePlay() {
    if (!soundRef.current) return;
    
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  }

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Slider
          value={position}
          minimumValue={0}
          maximumValue={duration}
          onValueChange={seekToPosition}
          style={styles.slider}
        />
        <Text>{formatTime(position)} / {formatTime(duration)}</Text>
      </View>

      {/* Controls */}
      {showControls && (
        <View style={styles.controls}>
          <Pressable onPress={togglePlay}>
            <Text>{isPlaying ? '⏸️' : '▶️'}</Text>
          </Pressable>
          <VolumeControl />
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
```

### Reusable Component: `components/VerseAudioCard.tsx`

```typescript
interface VerseAudioCardProps {
  verse: QuranVerse;
  reciter: Reciter;
  onReciterChange?: (reciterId: number) => void;
  showTafsir?: boolean;
}

export function VerseAudioCard({
  verse,
  reciter,
  onReciterChange,
  showTafsir = true,
}: VerseAudioCardProps) {
  return (
    <Card>
      {/* Verse Text */}
      <Text style={styles.arabic}>{verse.text_uthmani}</Text>
      <Text style={styles.english}>{verse.translation}</Text>

      {/* Audio Player */}
      <QuranPlayer
        verseKey={verse.verse_key}
        reciterId={reciter.id}
        showControls
      />

      {/* Reciter Info */}
      <Pressable onPress={() => onReciterChange?.(reciter.id)}>
        <Text>🎙️ {reciter.reciter_name}</Text>
      </Pressable>

      {/* Tafsir */}
      {showTafsir && (
        <Expandable title="Tafsir">
          <TafsirContent verseKey={verse.verse_key} />
        </Expandable>
      )}
    </Card>
  );
}
```

---

## Part 7: User Experience Flow

### First-Time User Path

```
1. User opens app
   ↓
2. Sees homepage with "Verse of the Day" card
   ↓
3. Taps play button → Hears verse recited
   ↓
4. Notices "Quran" tab at bottom
   ↓
5. Taps "Quran" tab
   ↓
6. Sees list of 114 Surahs with durations
   ↓
7. Taps "Al-Fatihah" (Surah 1)
   ↓
8. Sees verses with audio player
   ↓
9. Taps play → Hears verse
   ↓
10. Browses to verse 2, 3, etc.
    ↓
11. Discovers ability to change reciter
    ↓
12. Tries "Mishari Rashid al-Efasy" (different style)
    ↓
13. Preference saved automatically
    ↓
14. Next time app opens, uses new reciter
```

---

## Part 8: Content Strategy

### Listening Journey Progression

**Day 1:**
- Discover verse of day with audio
- Tap play, listen for 5-10 seconds
- Notice different reciter available

**Day 3:**
- Browse full Quran tab
- Pick favorite Surah (Al-Fatihah is easiest, 7 verses)
- Listen to full chapter (5 minutes)
- Explore reciter options

**Week 1:**
- Establish habit of listening to verse of day
- Pick favorite reciter
- Bookmark 2-3 favorite Surahs
- Listen during commute

**Month 1:**
- Complete listening to multiple Surahs
- Understand Quran structure
- May discover favorite passages
- Share verses with friends

---

## Part 9: Performance & Optimization

### Caching Strategy

**Permanent Cache (Hardcoded):**
- Surah names + verse counts (114 chapters)
- Popular reciters list (top 10)

**Time-based Cache:**
- Reciter list (7 days) — 50KB
- Verse of day audio URL (24 hours) — changes daily
- Chapter audio URLs (until user closes chapter) — session-based

**No Cache (Streamed):**
- Actual audio files (streamed directly from CDN)
- Tafsir text (fetched on-demand)

### Bundle Size Impact

**Additions:**
- `lib/api/quranAudio.ts`: ~8KB
- `components/QuranPlayer.tsx`: ~12KB
- `components/VerseAudioCard.tsx`: ~8KB
- `screens/QuranScreen.tsx`: ~15KB
- Surah metadata (hardcoded): ~5KB
- Top 10 reciters data: ~3KB

**Total**: ~51KB (negligible)

### Network Usage

**Per User Per Day:**
- Verse of day audio: ~3-10 MB (variable by reciter)
- Reciter list API: ~50KB (cached weekly, shared)
- Chapter browse (if user opens 1 chapter): ~100-300KB

**Typical**: 3-10 MB/day per active user (acceptable for audio streaming)

---

## Part 10: Implementation Phases

### Phase 1: Core Audio API (1 week)
- [ ] `lib/api/quranAudio.ts` — Quran.com audio API wrapper
- [ ] Reciter list fetching + caching
- [ ] Verse audio URL fetching
- [ ] Chapter audio URL fetching
- [ ] Error handling + fallbacks

### Phase 2: Audio Player Component (1 week)
- [ ] `components/QuranPlayer.tsx` — Core player
- [ ] Play/pause/progress controls
- [ ] Volume control
- [ ] Reciter metadata display
- [ ] Integration with expo-av

### Phase 3: Verse Card Enhancement (3 days)
- [ ] Update "Verse of the Day" card with audio
- [ ] Add reciter selection dropdown
- [ ] Add "Full Chapter" CTA
- [ ] Audio autoplay (optional)

### Phase 4: Quran Tab (1 week)
- [ ] New "📖 Quran" tab in navigation
- [ ] List all 114 Surahs with metadata
- [ ] Search/filter functionality
- [ ] Browse by category (Meccan, Medinan, etc.)
- [ ] Recently listened tracking

### Phase 5: Chapter Player (1 week)
- [ ] Chapter detail screen
- [ ] Verse-by-verse layout
- [ ] Verse-by-verse audio player
- [ ] Inline tafsir (expandable)
- [ ] Next/Previous verse navigation
- [ ] Progress tracking

### Phase 6: Polish & Features (1 week)
- [ ] Bookmark favorite verses
- [ ] Share verse + audio
- [ ] Repeat options (verse, chapter, play once)
- [ ] Sleep timer
- [ ] Offline mode (cache recently played)
- [ ] History + resume playback

### Phase 7: Testing & Deployment (1 week)
- [ ] UX testing with different audio players
- [ ] Audio quality testing on different networks
- [ ] Accessibility (screen reader, captions)
- [ ] Performance testing (large chapter lists)
- [ ] Bug fixes + polish

**Total Timeline**: 6-7 weeks for full implementation

---

## Part 11: Integration Points

### Homepage
```
Before: Verse of Day (text only)
After:  Verse of Day + Audio Player (streamlined)
```

### New Tab Navigation
```
Before: [👤 Listener] [⚙️ Settings]
After:  [👤 Listener] [📖 Quran] [🤲 Duas] [⚙️ Settings]
```

### Listener Experience
```
Current: Prayer times → Follow mosques → Listen to live adhan
Enhanced: Prayer times → Follow mosques → Listen to live adhan
          OR Listen to Quran recitation anytime
```

---

## Part 12: Key Features Summary

| Feature | Benefit | Timeline |
|---------|---------|----------|
| **Verse of Day + Audio** | Immediate engagement, daily habit | Week 2 |
| **Reciter Selection** | Personal preference, trust | Week 2 |
| **Quran Library Tab** | Discovery, full content access | Week 3 |
| **Chapter Player** | Complete listening experience | Week 5 |
| **Bookmarks** | Remember favorite verses | Week 6 |
| **Offline Mode** | Listen without data | Week 7 |
| **Sleep Timer** | Listen before bed | Week 7 |

---

## Part 13: Success Metrics

### Engagement
- ✅ Verse of Day played: >40% of users (daily)
- ✅ Quran tab opened: >25% of users (weekly)
- ✅ Chapter listened to completion: >15% of users (monthly)
- ✅ Avg listening time: 15+ minutes/day (active users)

### Retention
- ✅ D1 retention improved by 10-15%
- ✅ D7 retention improved by 8-12%
- ✅ Weekly active users +20%

### Satisfaction
- ✅ Users rate audio quality: 4.5+ / 5.0
- ✅ Reciter selection rated useful: >80%
- ✅ NPS increase: +5-10 points

---

## Summary & Recommendation

**Quran listening via Quran.com API adds immense value:**

✅ Keeps app meaningful beyond prayer times  
✅ Builds daily habit (verse of day)  
✅ Provides spiritual content on-demand  
✅ Never-blank homepage (always something to explore)  
✅ User can personalize reciter  
✅ Accessible to all—Islamic knowledge + education  
✅ 50+ reciters ensure variety  
✅ Scales well (minimal API usage)  
✅ Complements mosque-centric features  

**Recommended Implementation Order:**
1. **Week 1-2**: Verse of Day + Audio (Phase 1-3)
2. **Week 3**: Quran Tab + Browse (Phase 4)
3. **Week 4-5**: Chapter Player (Phase 5)
4. **Week 6-7**: Polish + Features (Phase 6-7)

**This transforms Adhan Connect from a prayer-time app into a complete Islamic learning + engagement platform.**
