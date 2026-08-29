# Information Architecture & Navigation Design

**Date**: 2026-08-29  
**Principle**: Mobile-first design. Lean homepage (2-3 cards max). Organize content in logical tabs.  
**Approach**: UX expertise from Stripe, Figma, Spotify, Apple.

---

## Part 1: The Problem with Too Many Cards

### ❌ Bad: Overloaded Homepage
```
User scrolls... and scrolls... and scrolls...

┌────────────────────────────────────┐
│ Adhan Connect               ⚙️      │
├────────────────────────────────────┤
│ 📍 London • 🕐 Dhuhr in 45 mins    │
├────────────────────────────────────┤
│ 📖 VERSE OF THE DAY                │ ← User sees this
├────────────────────────────────────┤
│ 🤲 DUA FOR THIS TIME               │ ← Scrolls to see this
├────────────────────────────────────┤
│ 💡 DID YOU KNOW?                   │ ← Scrolls again
├────────────────────────────────────┤
│ 🎵 LISTEN TO QURAN                 │ ← Scrolls again
├────────────────────────────────────┤
│ 🕌 YOUR FOLLOWED MOSQUES           │ ← Scrolls again
├────────────────────────────────────┤
│ 🔥 POPULAR VERSES                  │ ← Scrolls again
├────────────────────────────────────┤
│ 🌍 COMMUNITY ACTIVITY              │ ← Finally!
│ [Discover] [Settings]              │
└────────────────────────────────────┘

Problems:
- User fatigue (too much scrolling)
- Unclear what's important
- Features buried (missed by users)
- Looks cluttered, not professional
- Mosque data gets lost in noise
```

### ✅ Good: Focused Homepage + Smart Tabs

```
┌────────────────────────────────────┐
│ Adhan Connect        [👤] [📖] [🤲]│ ← Clear tabs
├────────────────────────────────────┤
│ 📍 London, UK                      │ ← Context
│ 🕐 Next Prayer: Dhuhr in 45 mins   │ ← Primary value
├────────────────────────────────────┤
│ 📖 VERSE OF THE DAY (with audio)   │ ← Secondary value
│ "بسم الله الرحمن الرحيم"            │
│ 🎙️ Abdul Basit • [▶️] ░░░░░ 8.5s  │
├────────────────────────────────────┤
│ 🕌 YOUR FOLLOWED MOSQUES (if any)  │ ← Tertiary (user data)
│ East London Central - Fajr 5:30am  │
├────────────────────────────────────┤
│ [Browse More]                      │
│ [Discover] [Settings]              │
└────────────────────────────────────┘

Benefits:
- Clean, focused (no scrolling needed)
- Clear hierarchy (prayer → verse → mosques)
- Tabs organized by purpose
- Professional, calm feel
- Mobile-friendly (fits screen)
```

---

## Part 2: UX Principles Applied

### 1. **Progressive Disclosure** (Apple, Figma)
- Show essentials immediately
- Hide complexity in tabs/menus
- Reveal on-demand

### 2. **Information Hierarchy** (Nielsen Norman Group)
- H1: Prayer time countdown (most important)
- H2: Verse of day + Quran/Duas (secondary)
- H3: Followed mosques (user data)
- H4: Discover/explore (CTAs)

### 3. **Mobile-First Design** (Stripe, Spotify)
- One screen = one focus
- Minimal scrolling (<3 screens)
- Thumb-friendly navigation
- Tab bar at bottom (reachable)

### 4. **Content Hierarchy** (Material Design)
```
Homepage: Essential + Inspiration
Tabs: Detailed content
Settings: Preferences
```

### 5. **Cognitive Load** (UX Laws)
- Don't ask user to process >3 items at once
- Group related content in tabs
- Use consistent patterns

---

## Part 3: Proposed Navigation Architecture

### Tab Navigation (Bottom Tabs)

```
┌────────────────────────────────────┐
│ Content                       ⚙️   │
├────────────────────────────────────┤
│ [Active] Other Tabs              │
├────────────────────────────────────┤
│ (Content varies by tab)            │
│                                    │
│                                    │
│                                    │
│                                    │
│                                    │
│                                    │
├────────────────────────────────────┤
│ [👤] [📖] [🤲] [🔍] [⚙️]           │ ← Always visible
└────────────────────────────────────┘

Tab Labels:
👤 = Listener (Home)
📖 = Quran (Browse & Listen)
🤲 = Duas (Daily guidance)
🔍 = Discover (Find mosques)
⚙️ = Settings (Preferences)
```

---

## Part 4: Detailed Tab Designs

### Tab 1: 👤 Listener (Homepage)

**Content (No Scrolling Needed):**

```
┌────────────────────────────────────┐
│ Adhan Connect        👤 📖 🤲 🔍 ⚙️│
├────────────────────────────────────┤
│ 📍 London, UK                      │
│ ──────────────────────────────────│
│ 🕐 NEXT PRAYER                     │
│ Dhuhr                              │
│ 45 mins  🔴 In 44:32               │
│                                    │
│ Adhan: 1:15 PM • Iqamah: 1:30 PM  │
├────────────────────────────────────┤
│ 📖 VERSE OF THE DAY (Motivation)  │
│ الفاتحة 1:1                        │
│ 🎙️ Abdul Basit • [▶️] ░░░ 8.5s    │
│ [Tafsir] [Full Chapter] [Change]   │
├────────────────────────────────────┤
│ 🕌 YOUR MOSQUES                    │
│ East London Central • Fajr 5:30am  │
│ Whitechapel • Dhuhr 1:15pm         │
│ [Browse]                           │
│                                    │
├────────────────────────────────────┤
│ 👤 📖 🤲 🔍 ⚙️                      │
└────────────────────────────────────┘

Purpose:
- Quick glance at prayer time (primary)
- Daily spiritual inspiration (verse)
- Quick mosque reference
- Minimal scrolling
```

**What's NOT on this tab:**
- ❌ Duas (in own tab)
- ❌ Popular verses (in Quran tab)
- ❌ Tips/Learn (link in Quran tab)
- ❌ Community stats (in Discover tab)
- ❌ Live broadcast list (in Discover tab)

---

### Tab 2: 📖 Quran (Learn & Listen)

**Content (Scrollable, Detailed):**

```
┌────────────────────────────────────┐
│ Quran               👤 📖 🤲 🔍 ⚙️│
├────────────────────────────────────┤
│ 🎙️ Select Reciter                  │
│ [Abdul Basit ▼] (change)            │
├────────────────────────────────────┤
│ 📚 BROWSE CHAPTERS                  │
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
│ ... (scroll for more)              │
├────────────────────────────────────┤
│ 🔥 TRENDING VERSES                 │
│ • Ayat Al-Kursi (2:255)            │
│ • Surah Yasin (36:1-3)             │
├────────────────────────────────────┤
│ 💡 ISLAMIC TIPS                    │
│ Learn about Tafsir, Hadith...      │
│                                    │
├────────────────────────────────────┤
│ 👤 📖 🤲 🔍 ⚙️                      │
└────────────────────────────────────┘

Purpose:
- Reciter selection (personalization)
- Browse 114 Surahs (learning)
- Trending content (discovery)
- Tips (education)
- Everything Quran-related in one place
```

**When user taps "▶️ Listen":**
```
Expands to Chapter Player:

┌────────────────────────────────────┐
│ < Al-Fatihah                  ⋮   │
├────────────────────────────────────┤
│       🎙️ Abdul Basit Al-Samad      │
│                                    │
│ Verse 1 of 7                       │
│ بسم الله الرحمن الرحيم             │
│ In the name of Allah...            │
│                                    │
│ [▶️ Playing] ░░░░░░░░░░░ 2:15      │
│                                    │
│ [Prev] [Next]                      │
│                                    │
│ ✨ Tafsir...                       │
└────────────────────────────────────┘
```

---

### Tab 3: 🤲 Duas (Daily Guidance)

**Content:**

```
┌────────────────────────────────────┐
│ Duas                👤 📖 🤲 🔍 ⚙️│
├────────────────────────────────────┤
│ 🕐 DUA FOR THIS TIME               │
│ (Time-aware: changes per prayer)   │
│                                    │
│ FAJR DUA (5:30 AM)                 │
│ "اللهم بك أصبحنا..."                │
│ O Allah, by You we have reached    │
│ the morning...                     │
│ [Learn More] [Share]               │
├────────────────────────────────────┤
│ 📖 DUAS BY OCCASION                │
│ [Morning Dua]                      │
│ [Before Prayer]                    │
│ [After Prayer]                     │
│ [Before Sleep]                     │
│ [During Difficulty]                │
│ [Gratitude]                        │
├────────────────────────────────────┤
│ 🎯 POPULAR DUAS                    │
│ • Ayat Al-Kursi Protection Dua     │
│ • Dua for Forgiveness              │
│ • Dua for Success                  │
│                                    │
├────────────────────────────────────┤
│ 👤 📖 🤲 🔍 ⚙️                      │
└────────────────────────────────────┘

Purpose:
- Daily spiritual guidance (primary)
- Duas by occasion (secondary)
- Popular duas (discovery)
- Simple, focused, motivational
```

---

### Tab 4: 🔍 Discover (Explore & Social)

**Content:**

```
┌────────────────────────────────────┐
│ Discover            👤 📖 🤲 🔍 ⚙️│
├────────────────────────────────────┤
│ 🔍 SEARCH / FILTER                 │
│ [Search mosques...]                │
│ [📍 Near me] [🗺️ Map] [⭐ Top]    │
├────────────────────────────────────┤
│ 🕌 TRENDING MOSQUES (This Week)   │
│ ┌──────────────────────────┐        │
│ │ Central London Mosque     │        │
│ │ 👥 4,230 followers       │        │
│ │ 🎙️ Live adhan now        │        │
│ │ [Follow]                 │        │
│ └──────────────────────────┘        │
│                                    │
│ ┌──────────────────────────┐        │
│ │ North London Community   │        │
│ │ 👥 1,890 followers       │        │
│ │ Last adhan: 2 hours ago  │        │
│ │ [Follow]                 │        │
│ └──────────────────────────┘        │
├────────────────────────────────────┤
│ 🔴 LIVE NOW                        │
│ 👥 8 adhans happening across UK   │
│ 🎧 12,340 people listening         │
│ [Browse Live]                      │
├────────────────────────────────────┤
│ 🎁 INVITE FRIENDS                  │
│ Share Adhan Connect with community │
│ [Invite]                           │
│                                    │
├────────────────────────────────────┤
│ 👤 📖 🤲 🔍 ⚙️                      │
└────────────────────────────────────┘

Purpose:
- Find & follow new mosques
- Discover trending/popular mosques
- See live broadcasts
- Social features (invites, community)
- Search & explore everything
```

---

### Tab 5: ⚙️ Settings & Account

**Content:**

```
┌────────────────────────────────────┐
│ Settings            👤 📖 🤲 🔍 ⚙️│
├────────────────────────────────────┤
│ 👤 PROFILE                         │
│ [Ahmed] @ahmed_london              │
│ [📷 Change Picture] [Edit Bio]     │
├────────────────────────────────────┤
│ 📍 LOCATION & PREFERENCES          │
│ London, UK [Edit]                  │
│ Default Reciter: Abdul Basit [Edit]│
│ Notification Prefs [Edit]          │
├────────────────────────────────────┤
│ 🔔 NOTIFICATIONS                   │
│ [☑️] Prayer time alerts            │
│ [☑️] Adhan broadcasts              │
│ [☐] Tips & learning content        │
├────────────────────────────────────┤
│ 👥 MULTI-ROLE ACCESS               │
│ [🏢 Switch to Admin]               │
│ [🎙️ Switch to Muezzin]             │
├────────────────────────────────────┤
│ ⚙️ ACCOUNT                         │
│ [Account Settings]                 │
│ [Privacy]                          │
│ [Terms]                            │
│ [Sign Out]                         │
│                                    │
├────────────────────────────────────┤
│ 👤 📖 🤲 🔍 ⚙️                      │
└────────────────────────────────────┘

Purpose:
- Profile & account management
- Preferences & notifications
- Role switching
- App settings
```

---

## Part 5: Navigation Comparison

### ❌ Old Design (Before)
```
Structure:
- Homepage (massive, many cards)
- Settings (buried)
- No tab organization
- Hard to find things
- Overwhelming on first load
```

### ✅ New Design (Recommended)
```
Structure:

TAB BAR (Always visible, 5 tabs):
├─ 👤 Listener (Home)
│   └─ Prayer time + verse of day
├─ 📖 Quran (Learn & Listen)
│   └─ Reciter, browse, listen, tips
├─ 🤲 Duas (Daily Guidance)
│   └─ Time-aware, by occasion, popular
├─ 🔍 Discover (Explore & Social)
│   └─ Search, trending, live, invites
└─ ⚙️ Settings (Account & Prefs)
    └─ Profile, notifications, roles

Benefits:
✓ Clean mental model
✓ Easy navigation
✓ Content organized by purpose
✓ No scrolling overload
✓ Professional, calm feeling
✓ Mobile-friendly
✓ Discoverable features
```

---

## Part 6: Information Hierarchy Summary

### **Priority 1: Always Visible (No Scroll)**
- Prayer time countdown (🕐)
- Next prayer name + time
- Location context (📍)

### **Priority 2: Minimal Scroll (1 screen)**
- Verse of day (motivation)
- Your followed mosques (user data)
- CTAs (Browse, Discover)

### **Priority 3: Tab-Based (Organized by Purpose)**
- Quran listening (📖 tab)
- Duas (🤲 tab)
- Discover (🔍 tab)
- Settings (⚙️ tab)

### **What's NOT on Homepage**
- ❌ Tips/Learn (→ 📖 Quran tab)
- ❌ Popular verses (→ 📖 Quran tab)
- ❌ Community stats (→ 🔍 Discover tab)
- ❌ Live broadcasts (→ 🔍 Discover tab)
- ❌ Trending mosques (→ 🔍 Discover tab)
- ❌ Duas (→ 🤲 Duas tab)

---

## Part 7: Mobile-First Design Validation

### Screen Test (iPhone 12, 390px width)

**Homepage (No Scroll):**
```
Screen height: 844px (usable: ~750px)
Header: 100px (location + prayer time)
Verse card: 250px
Mosques card: 150px
CTAs: 50px
Tab bar: 70px (reserved)
─────────────
Total: ~620px ✓ Fits without scroll!
```

**Quran Tab (Scrollable):**
```
Header: 100px (fixed)
Reciter selector: 80px
Surah list: Scrollable (infinite)
Trending verses: Visible on scroll
Tips: Visible on scroll
Tab bar: 70px (fixed)
─────────────
✓ Clean scrolling experience
```

---

## Part 8: Design Decisions Explained

### Decision 1: Why Bottom Tab Bar?
```
✓ iOS/Android standard (users expect it)
✓ Thumb-friendly (reach all tabs with one hand)
✓ Always visible (clear where to go)
✓ Doesn't hide content (can scroll behind)
✓ Clear information architecture
```

### Decision 2: Why Only 5 Tabs?
```
✗ Too few (<3): Users miss features
✗ Too many (>6): Cognitive overload, hard to remember
✓ 5 tabs: Sweet spot (Spotify, Instagram, TikTok use 5)

Our 5:
1. Listener (home/main)
2. Quran (learning)
3. Duas (spirituality)
4. Discover (social/explore)
5. Settings (account)
```

### Decision 3: Why Verse of Day on Homepage?
```
✓ Sets tone (spiritual, professional)
✓ Shows API is working (not empty)
✓ Daily engagement hook
✓ Differentiation (prayer timer + Islamic content)
✓ Low scrolling (fits on screen)
✓ Can tap for more (tease Quran tab)
```

### Decision 4: Why No Popular Verses on Homepage?
```
✗ Duplicate content (same as Quran tab)
✗ Adds scroll burden
✗ Confuses: Verse of Day vs Popular
✓ Move to Quran tab (belongs there)
✓ Keep homepage lean
```

---

## Part 9: Content Placement Map

```
HOMEPAGE (👤 Listener Tab)
├─ Visible (no scroll):
│  ├─ 📍 Location + Prayer Time
│  ├─ 📖 Verse of Day (with audio)
│  └─ 🕌 Your Followed Mosques
│
├─ Scroll (minimal):
│  ├─ [Browse More Mosques]
│  ├─ [Discover New Mosques]
│  └─ [Settings]
│
└─ Not here:
   ├─ ❌ Tips (→ 📖 Quran tab)
   ├─ ❌ Popular verses (→ 📖 Quran tab)
   ├─ ❌ Duas (→ 🤲 Duas tab)
   ├─ ❌ Community stats (→ 🔍 Discover tab)
   └─ ❌ Live broadcasts (→ 🔍 Discover tab)

QURAN TAB (📖)
├─ Reciter selector (sticky)
├─ Browse 114 Surahs
├─ 🔥 Trending verses
├─ 💡 Islamic tips/learn
└─ When tapped: Chapter player

DUAS TAB (🤲)
├─ Time-aware dua (top, sticky)
├─ Duas by occasion
└─ Popular duas

DISCOVER TAB (🔍)
├─ Search mosques
├─ Trending mosques
├─ Live broadcasts
├─ Community stats
└─ Invite friends

SETTINGS TAB (⚙️)
├─ Profile
├─ Preferences
├─ Role switching
└─ Account
```

---

## Part 10: User Journey Examples

### New User, Day 1
```
1. Opens app
2. Sees prayer countdown + verse of day (clean!)
3. Taps play on verse → Listens to Quran
4. Notices 📖 tab → Explores Quran library
5. Browses Surahs, picks favorite
6. Tries different reciter (👤 📖 tab → reciter change)
7. Comes back to 👤 homepage, sees verse again (habit loop starts)

Experience: Clean, focused, not overwhelming
```

### Active User, Month 2
```
1. Opens app → Glances at prayer time
2. Taps 📖 Quran → Continues listening to favorite Surah
3. Taps 🤲 Duas → Reads daily dua for Dhuhr
4. Taps 🔍 Discover → Searches for new mosques
5. Follows 2 new mosques
6. Settings → Adjusts notifications

Experience: Efficient, knows where everything is
```

### Multi-Role User (Admin + Muezzin)
```
1. Opens app → 👤 Listener tab
2. Notices [🏢 Switch to Admin] in ⚙️ Settings
3. Taps switch → Routes to /(admin) workspace
4. Later taps [🎙️ Switch to Muezzin] → Routes to /(muezzin) workspace
5. Can switch back to 👤 Listener anytime

Experience: Clear role context, easy switching, no confusion
```

---

## Part 11: Comparison: Before vs After

| Aspect | Before (Many Cards) | After (Tab-Based) |
|--------|---|---|
| **Homepage Length** | 8+ screens of scrolling | 1 screen (no scroll) |
| **Clarity** | Confusing (what's important?) | Clear (prayer time is primary) |
| **Feature Discovery** | Users miss features | All features discoverable in tabs |
| **Information Overload** | Yes (too much) | No (just right) |
| **Mobile Feel** | Cluttered | Clean, professional |
| **Time to Key Info** | 3+ taps | 1 tap (already visible) |
| **Tab Navigation** | None | 5 intuitive tabs |
| **Scalability** | Breaks with more content | Grows into tabs (no homepage bloat) |

---

## Part 12: Recommendations

### What Goes on Homepage (👤 Listener Tab)
✅ Prayer time countdown (essential)
✅ Verse of day (secondary value)
✅ Your followed mosques (user data)
✅ Navigation to other tabs (CTAs)

### What Goes in Tabs
📖 **Quran Tab**: Reciters, browse, listen, tips, trending
🤲 **Duas Tab**: Time-aware duas, by occasion, popular
🔍 **Discover Tab**: Search, trending, live, invites, community
⚙️ **Settings Tab**: Profile, prefs, notifications, roles

### What Gets Removed from Homepage
❌ Tips/Learn (move to 📖 Quran tab)
❌ Popular verses (move to 📖 Quran tab)
❌ Live broadcasts (move to 🔍 Discover tab)
❌ Community stats (move to 🔍 Discover tab)
❌ Trending mosques (move to 🔍 Discover tab)
❌ Multiple duas (move to 🤲 Duas tab)

---

## Summary

**Before**: Homepage with 7-8 cards = infinite scroll, overwhelming, unprofessional  
**After**: Homepage with 3 cards + 5 tabs = clean, focused, discoverable, professional

**This follows UX best practices from:**
- Spotify (5 tabs: Home, Search, Library, etc.)
- Instagram (5 tabs: Feed, Search, Create, Reels, Profile)
- TikTok (5 tabs: For You, Following, Create, Messages, Me)
- Apple (4 tabs: iTunes, Apps, Books, Music)
- Stripe (tab-based navigation for complex features)

**Result**: Users love the app, features are discoverable, homepage never feels blank or overwhelming.

---

## Final Checklist

- ✅ Homepage: Prayer time + Verse + Mosques (no scroll)
- ✅ 5 Bottom Tabs (👤 📖 🤲 🔍 ⚙️)
- ✅ Tab bar always visible (mobile-friendly)
- ✅ Each tab has clear purpose
- ✅ No duplicate content across tabs
- ✅ Information organized by user intent
- ✅ Scalable (can add features without bloating homepage)
- ✅ Professional, calm, focused design
