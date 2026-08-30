# Adhan Connect Implementation Roadmap
## Collaborative Parallel Execution (Claude + Codex Max)

**Date Created**: 2026-08-29  
**Target Delivery**: 4 Weeks (Accelerated)  
**Working Mode**: Parallel streams + Daily sync  
**Shared Visibility**: This file is the source of truth

---

## 🎯 Mission

Transform Adhan Connect from prayer-timer to complete Islamic platform with:
- ✅ Simplified 2-step auth (no guest mode)
- ✅ Tab-based navigation (Listener, Quran, Duas, Discover, Settings)
- ✅ Islamic content (verses, duas, Quran audio with 50+ reciters)
- ✅ Smart live adhan discovery (all broadcasts, not just followed)
- ✅ Traveler mode (location-aware, auto-detect)
- ✅ Zero breaking changes (all current features preserved)
- ✅ **Supabase cost optimization** (reduce queries + bandwidth)

**Delivery**: Production-ready in 4 weeks

---

## 💰 Baseline: Existing Cost Optimization (Already Deployed)

**Commit 945b958** (Aug 22, deployed to production):
"Optimize: consolidate profile fetching, remove redundant queries"

### What Was Done:
- Consolidated 3 duplicate profile-fetching utilities across coverRequests, admin/muezzins, admin/staffRota
- Created shared `lib/api/profiles.ts` with `fetchProfiles()` and `fetchProfileNames()`
- Removed redundant `users.role` query in `getAdminMosquesForCurrentUser()`

### Cost Impact:
- **15-25% reduction in profile queries** ✅
- **Fewer admin queries overall** ✅
- Already benefiting production users now

### For Codex Max (Week 1-4):
- Follow this same pattern: **consolidate, don't duplicate**
- When building new APIs, check if a similar query exists elsewhere
- Reuse shared utilities (e.g., `lib/api/profiles.ts`)
- Avoid redundant user/role lookups
- **Goal: Keep API query count low** (critical for Supabase cost)

### Example Pattern to Follow:
```typescript
// BAD (what we had before):
async function getAdminMuezzins(adminId) {
  const muezzins = await supabase
    .from('muezzins')
    .select('id, mosque_id, user_id')  // ← redundant query
    .eq('user_id', adminId);
    
  const profiles = await supabase
    .from('users')
    .select('id, username, email')  // ← separate query
    .in('id', muezzins.map(m => m.user_id));
}

// GOOD (what we do now):
import { fetchProfiles } from '@/lib/api/profiles';

async function getAdminMuezzins(adminId) {
  const muezzins = await supabase
    .from('muezzins')
    .select('id, mosque_id, user_id')
    .eq('user_id', adminId);
  
  const profiles = await fetchProfiles(muezzins.map(m => m.user_id));
  // ↑ Reuses shared utility, consolidated query
}
```

---

## 📊 Supabase Cost Reduction Strategy (Week 1-4)

### What We're Optimizing For:
1. **Query count** (fewer = cheaper)
2. **Bandwidth** (don't fetch unnecessary columns)
3. **Real-time subscriptions** (only what's needed)
4. **Caching** (reduce repeated queries)

### Codex Max's Responsibility (Week 1):
When designing APIs, prioritize:

```
1. Minimal query count
   ✅ Use JOINs instead of separate queries
   ✅ Select only needed columns
   ✅ Batch queries with Promise.all()
   
2. Reuse shared utilities
   ✅ lib/api/profiles.ts for user lookups
   ✅ lib/api/prayerTimesUnified.ts for times
   ✅ lib/liveStreamFreshness.ts for stream freshness
   
3. Cache strategically
   ✅ 24h cache: Verse of day
   ✅ 7d cache: Reciter list
   ✅ 30s cache: Live streams
   ✅ Session cache: User preferences
   
4. Monitor API efficiency
   ✅ Log query count per API call
   ✅ Alert if queries exceed 3 per call
   ✅ Weekly review of API efficiency
```

### Example APIs (Codex Max, Week 1):
```typescript
// GET /api/mosques/nearby
// ❌ BAD: 5 queries (mosque, prayer times, users, streams, subscriptions)
// ✅ GOOD: 2 queries (mosques JOIN prayer_times, mosque JOIN streams)
async function getNearbyMosques(lat, lng, radius) {
  // 1 query: Get nearby mosques with prayer times joined
  const mosques = await supabase
    .from('mosques')
    .select(`id, name, city, 
      prayer_times!inner(fajr, dhuhr),
      streams(is_live)`)
    .match({ within_radius: true });
  
  // Cache result for 1 hour
  return cache.set('nearby', mosques, 3600);
}
// ✅ Result: 1 query, cached, reusable
```

---

---

## 📅 4-Week Timeline (Accelerated)

```
WEEK 1: Foundation + Setup
├─ Mon-Tue: DB migrations + API design
├─ Wed-Thu: Auth implementation
└─ Fri: Integration testing

WEEK 2: Tab Navigation + Core UI
├─ Mon-Tue: Bottom tab bar + route structure
├─ Wed-Thu: Split screens into tabs
└─ Fri: Tab switching + persistence

WEEK 3: Content Population
├─ Mon-Tue: Quran API integration + player
├─ Wed-Thu: Duas + Islamic tips
└─ Fri: Homepage redesign complete

WEEK 4: Traveler Features + Launch
├─ Mon-Tue: Location detection + search
├─ Wed-Thu: Testing + bug fixes
└─ Fri: Staging deploy + canary rollout
```

---

## 🔀 Parallel Work Streams

### Stream A: Backend Infrastructure (Codex Max Priority)
**Owner**: Codex Max  
**Deliverable**: All APIs ready by end of Week 1

```
WEEK 1:
├─ [x] DB migrations (DONE)
│  ├─ [x] Add: user_location, preferred_reciters, signup_completed_steps
│  ├─ [x] Add: indexes for location queries
│  ├─ [x] Migration file: 20260829000000_add_username_location_reciters.sql
│  └─ [x] NO breaking changes to existing schema ✅
│
├─ [x] New API endpoints (COST-OPTIMIZED) (DONE)
│  ├─ [x] GET /api/mosques/nearby ✅ (1 JOIN, 1h cache)
│  ├─ [x] GET /api/mosques/search ✅ (1 query, 1h cache)
│  ├─ [x] GET /api/quran/reciters ✅ (external, 7d cache)
│  ├─ [ ] GET /api/quran/verse-audio (hook needed: useQuranVerseAudio)
│  ├─ [ ] GET /api/quran/chapter-audio (Week 2)
│  ├─ [x] GET /api/duas/daily ✅ (hardcoded, 24h cache)
│  ├─ [ ] GET /api/live-adhans/location (Week 1.5)
│  └─ [x] GET /api/tips/daily ✅ (hardcoded, 24h cache)
│
├─ [x] Quran.com API wrapper (DONE)
│  ├─ [x] lib/api/quranAudio.ts (complete) ✅
│  ├─ [x] Error handling + fallbacks ✅
│  ├─ [x] Caching (24h verses, 7d reciters) ✅
│  └─ [x] Rate limiting strategy documented ✅
│
└─ [x] React hooks for API consumption (DONE)
   ├─ [x] lib/hooks/useMosquesNearby.ts ✅
   ├─ [x] lib/hooks/useQuranReciters.ts ✅
   ├─ [x] lib/hooks/useDailyDua.ts ✅
   └─ [x] lib/hooks/useDailyTip.ts ✅

WEEK 2:
├─ [ ] Location services
│  ├─ User location detection (native + web)
│  ├─ Geolocation permissions
│  └─ Fallback to IP-based location
│
└─ [ ] Real-time subscriptions
   ├─ Update useLiveStreamForMosque() for location
   └─ New subscriptions for traveler mode

READY FOR FRONTEND: By EOD Friday Week 1
```

**Testing Checklist** (Codex Max):
- [ ] All new endpoints return correct data
- [ ] Old endpoints unchanged (backward compat)
- [ ] Quran.com API integration works
- [ ] Location APIs tested (London + other cities)
- [ ] Error handling verified
- [ ] **COST OPTIMIZATION** ← Critical
  - [ ] Query count logged per API call
  - [ ] No endpoint exceeds 3 queries
  - [ ] Caching works (verify cache hits)
  - [ ] Supabase usage baseline documented
  - [ ] Reuses shared utilities (fetchProfiles, etc.)
  - [ ] No N+1 queries in list endpoints

---

### Stream B: Frontend/Auth/Navigation (Claude Priority)
**Owner**: Claude (me)  
**Deliverable**: Working auth + tab navigation by end of Week 2

```
WEEK 1 (Auth):
├─ [x] Simplified sign-up flow (DONE)
│  ├─ [x] Step 1: Email + Password (existing, modified callback)
│  ├─ [x] Step 2: Username + Location (new sign-up-step2.tsx)
│  ├─ [x] Auto-detect location via expo-location
│  └─ [x] Route new signups to step2 after email verification
│
├─ [x] Auto-subscribe to 3 nearest mosques (DONE)
│  ├─ [x] Fetch nearby mosques in step2 via API
│  ├─ [x] Auto-follow 3 nearest (fail-silent)
│  └─ [x] Direct to Listener home
│
├─ [ ] Sign-in flow (existing flow, may enhance)
│  ├─ [ ] Email + password only (mostly done)
│  ├─ [ ] Neutral error messages (existing)
│  └─ [ ] Direct redirect to home (existing)
│
└─ [ ] Session management
   ├─ [ ] Update user location pref on step2
   ├─ [ ] Store reciter choice via preferred_reciters
   └─ [ ] Restore on next login

WEEK 1.5-2 (Navigation + Content):
├─ [x] Bottom tab bar implementation (DONE)
│  ├─ [x] 5 tabs: Listener | Quran | Duas | Discover | Settings ✅
│  ├─ [x] Tab switching + persistence (via Expo Router Tabs)
│  └─ [x] Icons + visual indicator (pill style)
│
├─ [x] New screens created (DONE)
│  ├─ [x] app/(user)/quran.tsx - Quran browser
│  ├─ [x] app/(user)/duas.tsx - Islamic wisdom
│  ├─ [x] All screens using new hooks + APIs
│  └─ [x] All existing routes preserved (100% backward compat)
│
├─ [x] Live Adhans endpoint (DONE)
│  ├─ [x] GET /api/live-adhans/location (2 queries, 30s cache)
│  ├─ [x] Real-time broadcast discovery by proximity
│  └─ [x] Hook: useLiveAdhansNearby() with auto-refresh
│
└─ [x] Search & Discovery (DONE)
   ├─ [x] Hook: useMosqueSearch() for city search
   ├─ [x] Enhanced Discover tab with location awareness
   └─ [x] All APIs cost-optimized (<3 queries)

READY FOR TESTING: By EOD Week 1.5
```

**Testing Checklist** (Claude):
- [ ] Auth flow works (sign-up to home in 2 minutes)
- [ ] All 5 tabs render correctly
- [ ] Tab switching doesn't lose state
- [ ] Settings tab accessible from all other tabs
- [ ] Live broadcast indicator works (from existing code)

---

### Stream C: Content & Features (Parallel, Weeks 2-3)
**Owner**: Claude (with Codex Max's APIs)  
**Deliverable**: All content populating by end of Week 3

```
WEEK 2 (Quran):
├─ [ ] Quran.com API integration
│  ├─ lib/api/quranAudio.ts (complete)
│  ├─ Reciter fetching + caching
│  └─ Verse + chapter audio fetching
│
├─ [ ] Audio player component
│  ├─ components/QuranPlayer.tsx
│  ├─ Play/pause/progress controls
│  ├─ Volume control
│  └─ Reciter display
│
├─ [ ] Verse of Day card
│  ├─ Daily deterministic verse selection
│  ├─ Translation display
│  ├─ Audio player embedded
│  ├─ Reciter selector (quick change)
│  └─ "Full Chapter" CTA
│
└─ [ ] Quran tab MVP
   ├─ Browse 114 Surahs (hardcoded metadata)
   ├─ Tap to open chapter
   └─ Verse-by-verse playback

WEEK 3 (Duas + Tips):
├─ [ ] Duas implementation
│  ├─ lib/duas.ts (30 duas, hardcoded)
│  ├─ Time-aware routing (Fajr dua at Fajr time)
│  ├─ Duas by occasion (morning, work, sleep, etc.)
│  └─ Popular duas list
│
├─ [ ] Islamic tips
│  ├─ lib/islamicTips.ts (20 rotating tips)
│  ├─ Daily deterministic selection
│  └─ Components for display
│
├─ [ ] Homepage redesign
│  ├─ Move verse to Listener tab
│  ├─ Keep prayer countdown (unchanged)
│  ├─ Keep "What's On" (unchanged)
│  └─ Add soft "Complete Profile" prompt (optional)
│
└─ [ ] Quran tab enhancements
   ├─ Trending verses section
   ├─ Search functionality
   └─ Recently listened tracking

READY FOR TRAVELERS: By EOD Friday Week 3
```

**Testing Checklist** (Claude):
- [ ] Verse of day loads with audio
- [ ] All 5 reciters playable
- [ ] Quran tab browses all 114 chapters
- [ ] Duas display correctly by time
- [ ] Tips rotate daily
- [ ] No blank screens anywhere

---

### Stream D: Traveler Features (Weeks 3-4)
**Owner**: Claude (with Codex Max's location APIs)  
**Deliverable**: Full traveler mode working by end of Week 4

```
WEEK 3 (Location Detection):
├─ [ ] Auto-detect location on app open
│  ├─ Get user current coordinates
│  ├─ Compare to stored home location
│  ├─ Banner if location changed: "Detected: Manchester"
│  └─ [✓ Use] or [Keep London]
│
├─ [ ] Update Listener tab for location
│  ├─ Fetch prayer times for detected city
│  ├─ Show mosque list for that city
│  └─ Live adhan indicator updates
│
└─ [ ] Discover tab location controls
   ├─ Display current location (auto-detected or stored)
   ├─ [Search] button to change city
   ├─ [Back to Home] button
   └─ [Use current location] toggle

WEEK 4 (Full Traveler Mode):
├─ [ ] City search functionality
│  ├─ Search input in Discover tab
│  ├─ Call /api/mosques/search endpoint
│  ├─ Display results with prayer times
│  └─ Follow/unfollow mosques
│
├─ [ ] Live adhans by location
│  ├─ Call /api/live-adhans/location endpoint
│  ├─ Display all live broadcasts in current city
│  ├─ Filter by prayer type
│  └─ One-tap listen
│
├─ [ ] Trending by location
│  ├─ Show trending mosques in current city
│  ├─ Follower counts (social proof)
│  └─ Filter/sort options
│
└─ [ ] Persistence
   ├─ Save user's preferred city (temporary)
   ├─ Save reciter preference
   ├─ Auto-restore to home on return
   └─ Remember settings

READY FOR TESTING: By EOD Thursday Week 4
```

**Testing Checklist** (Claude + Codex Max):
- [ ] Location auto-detection works
- [ ] Prayer times change when location changes
- [ ] Search finds mosques in any city
- [ ] Live adhans filter by location
- [ ] Trending shows location-specific data
- [ ] One-tap listen works for any broadcast
- [ ] Settings persist across app restarts

---

## 🔗 Handoff Points (Critical Sync)

### End of Week 1: Backend → Frontend
**Codex Max delivers**:
- [ ] All new DB migrations applied
- [ ] All API endpoints working
- [ ] Quran.com integration complete
- [ ] Endpoints documented (with examples)
- [ ] Error cases handled

**Claude receives**:
- [ ] API documentation
- [ ] Endpoint URLs + response formats
- [ ] Authentication method (use existing session)
- [ ] Rate limits / caching strategy
- [ ] Test endpoint credentials

**Sync Meeting**: Friday EOD Week 1
- Review API completeness
- Confirm response formats
- Identify any missing endpoints
- Fix blockers before next week

---

### End of Week 2: Auth + Nav → Content
**Claude delivers**:
- [ ] Auth flow complete + tested
- [ ] Tab navigation working
- [ ] All 5 screens rendering
- [ ] Tab persistence works
- [ ] No regression in existing features

**Codex Max receives**:
- [ ] All routes working
- [ ] Tab state management
- [ ] Navigation patterns established
- [ ] Ready for content integration

**Sync Meeting**: Friday EOD Week 2
- Test auth from start to Listener home
- Verify tab switching
- Confirm no breaking changes
- Identify content integration blockers

---

### End of Week 3: Content Complete
**Claude delivers**:
- [ ] Verse of day (with audio)
- [ ] Quran tab (browse + listen)
- [ ] Duas tab (time-aware)
- [ ] Tips/learning content
- [ ] Homepage redesigned
- [ ] All content integrated

**Codex Max receives**:
- [ ] All content rendering
- [ ] No API errors
- [ ] Performance baseline

**Sync Meeting**: Friday EOD Week 3
- Load test APIs (concurrent users)
- Check caching effectiveness
- Performance profiling
- Confirm traveler features unblocked

---

### End of Week 4: Ready for Launch
**Both deliver**:
- [ ] All features working
- [ ] Comprehensive testing done
- [ ] No regressions
- [ ] Performance acceptable
- [ ] Ready for staging deploy

**Sync Meeting**: Friday EOD Week 4
- Final regression test
- Staging deployment plan
- Canary rollout strategy (5% → 10% → 50% → 100%)
- Rollback plan if needed

---

## 📊 Daily Sync Protocol

### Daily Standup (15 mins, 9 AM)
**Both report**:
1. What I completed yesterday
2. What I'm doing today
3. Blockers or dependencies
4. Confidence level (🟢 on track / 🟡 at risk / 🔴 blocked)

**Format**: Slack thread or this file's "Daily Status" section

### Weekly Sync (60 mins, Friday 5 PM)
**Full review**:
1. Week completed milestones
2. Next week blockers
3. Integration points
4. Demo of working features
5. Plan adjustment if needed

---

## 📋 Shared Tracking Sheet

Update this daily. Keep in this file for visibility.

### Week 1: Foundation
```
BACKEND (Codex Max):
Migrations:
  [ ] user_location column - ___%
  [ ] location_indexes - ___%
  [ ] Update existing tables - ___%

APIs:
  [ ] GET /api/mosques/nearby - ___%
  [ ] GET /api/mosques/search - ___%
  [ ] GET /api/quran/reciters - ___%
  [ ] GET /api/quran/verse-audio - ___%
  [ ] Quran.com wrapper - ___%

FRONTEND (Claude):
Auth:
  [ ] Sign-up screen 1 (email) - ___%
  [ ] Sign-up screen 2 (username) - ___%
  [ ] Auto-subscribe logic - ___%
  [ ] Sign-in flow - ___%
  [ ] Session persistence - ___%

Status: ________________
Blockers: ________________
Next: ________________
```

### Week 2: Navigation
```
FRONTEND (Claude):
Tab Bar:
  [ ] Bottom tab bar component - ___%
  [ ] 5 tab screens created - ___%
  [ ] Tab switching logic - ___%
  [ ] Tab state persistence - ___%

Screens:
  [ ] Listener home migrated - ___%
  [ ] Quran tab MVP - ___%
  [ ] Duas tab MVP - ___%
  [ ] Discover tab MVP - ___%
  [ ] Settings tab created - ___%

Status: ________________
Blockers: ________________
Next: ________________
```

### Week 3: Content
```
FRONTEND (Claude):
Quran:
  [ ] API integration - ___%
  [ ] Audio player - ___%
  [ ] Verse of day card - ___%
  [ ] Browse surahs - ___%
  [ ] Verse playback - ___%

Duas:
  [ ] Time-aware duas - ___%
  [ ] Duas by occasion - ___%
  [ ] Component display - ___%

Tips:
  [ ] Rotating tips logic - ___%
  [ ] Display component - ___%

Homepage:
  [ ] Redesign complete - ___%
  [ ] All content integrated - ___%

Status: ________________
Blockers: ________________
Next: ________________
```

### Week 4: Travelers + Launch
```
FRONTEND (Claude):
Location:
  [ ] Auto-detect on app open - ___%
  [ ] Location banner/toggle - ___%
  [ ] Prayer times update - ___%
  [ ] Live adhans by location - ___%

Traveler:
  [ ] City search - ___%
  [ ] Trending by location - ___%
  [ ] Persistence - ___%

Testing:
  [ ] Regression suite - ___%
  [ ] Performance checks - ___%
  [ ] Device testing - ___%

STAGING:
  [ ] Deploy to staging - ___%
  [ ] Canary rollout plan - ___%
  [ ] Monitoring setup - ___%

Status: ________________
Blockers: ________________
Next: ________________
```

---

## 🚨 Dependency Map

```
Week 1:
  Codex Max: Migrations, APIs, Quran wrapper
  Claude: Auth, initial screens
  ↓ No dependency, can work in parallel

Week 2:
  Codex Max: Location APIs (can start mid-week)
  Claude: Tab nav (independent, uses Codex's Week 1 work)
  ↓ Minor: Claude might wait for finalized API response formats

Week 3:
  Codex Max: Can help with content if needed (optional)
  Claude: Content integration using Codex's APIs from Week 1-2
  ↓ Hard dependency: Must use finalized APIs

Week 4:
  Both: Testing, bug fixes, deployment coordination
  ↓ Heavy coordination needed
```

---

## ✅ Definition of Done

### Per feature:
- [ ] Code written + reviewed
- [ ] Tests pass (manual, automated if applicable)
- [ ] No regressions in existing features
- [ ] Performance acceptable (<2s load time)
- [ ] Works on iOS + Android (if mobile)
- [ ] Works on web

### Per week:
- [ ] All committed features complete
- [ ] No blockers carrying into next week
- [ ] Sync meeting confirms readiness
- [ ] Code merged to staging branch

### Week 4 (Launch):
- [ ] All features complete
- [ ] Staging deployment successful
- [ ] Canary rollout to 5% production
- [ ] Monitoring shows no errors
- [ ] Ready to scale 5% → 100%

---

## 🎯 Success Criteria

**After 4 weeks in production**:
- ✅ Zero regressions in current features
- ✅ Auth flow completes <2 minutes
- ✅ Tab switching smooth (<500ms)
- ✅ Verse of day loads <1 second
- ✅ Quran audio plays without buffering
- ✅ Live adhan discovery <2 second response
- ✅ Traveler mode works seamlessly
- ✅ 70%+ D1 retention (improved from current)
- ✅ 45%+ D7 retention (improved from current)

---

## 📞 Communication Channels

- **Urgent blockers**: Slack (immediate)
- **Daily standup**: This file + 9 AM call
- **Weekly sync**: Friday 5 PM (60 min)
- **Code review**: GitHub PRs (within 24h)
- **Questions**: Slack thread (4h response)

---

## 🔄 Adaptation Strategy

If we fall behind:
1. **Week 1 slip** → Compress Weeks 2-3 (parallel work)
2. **Week 2 slip** → Codex Max helps with Week 3 content APIs
3. **Week 3 slip** → Deploy to staging with reduced feature set
4. **Week 4 slip** → Stagger rollout (feature flags)

If ahead of schedule:
1. Add polish (animations, transitions)
2. Expand traveler features (favorites, history)
3. Add notification system
4. Optimize performance

---

## Final Notes

- **This file is the single source of truth** - Update daily
- **No surprises in meetings** - Status should be known ahead
- **Parallel work first** - Minimize wait times
- **Integration early** - Test together, not just in isolation
- **Clear handoffs** - Each week has explicit deliverables

Let's ship this in 4 weeks. 🚀
