# Codex Worklog

Last updated: 2026-03-30

## Purpose

This file is the central engineering log for recent Codex changes, live debugging notes, source-of-truth decisions, and known system behaviors.

Use this file before making further changes to:

- understand which codepaths are authoritative
- avoid re-breaking fixed listener and muezzin flows
- remember why a change was made
- identify which files should be checked first when a regression appears

This file intentionally replaces the idea of adding ad-hoc notes into many production files.

## Update Protocol

For each future change, add a short dated entry with:

1. problem observed
2. root cause
3. files changed
4. verification run
5. residual risks or follow-up work

Do not store secrets here.
Do not paste tokens, passwords, or full private URLs with embedded auth.

## Working Rules For Future Changes

Before changing prayer-time, rota, listener playback, or live broadcast code:

1. read this file first
2. decide whether the issue is:
   - source-of-truth data
   - control-plane live state
   - upstream audio
   - listener playback
3. check whether the symptom is already covered in this log
4. extend this file after the fix instead of scattering temporary notes into production files

Current documentation policy:

- this file is the central Codex engineering log
- production files should stay clean unless a code comment explains behavior
- future entries should be appended here after each meaningful fix

## Do Not Regress

### Prayer-Time Rules

- listener `Today's Prayer Times` must keep reading canonical daily data through `getDailyPrayerTimes(...)`
- listener `Next Prayer` must use real timetable data across days, not a fake `+24h` fallback
- muezzin `Today's Prayer Times` and `Next Adhan` must stay aligned to the same resolved schedule payload
- null-time placeholder slots must not be treated as real adhans

### Live-State Rules

- listener home and listener live page must agree on whether a mosque is actually live
- stale live rows must not keep the UI stuck in `LIVE`
- listener-facing reads must ignore stale stream and adhan rows
- home-card logic must not trust cached live rows indefinitely

### Playback Rules

- web playback may use validated redirect for lower latency
- native/mobile playback must keep the validated proxy path unless deliberately reworked
- ending a live session must tear down active listener audio automatically
- volume values must always be sanitized before reaching browser audio or `expo-av`

### Broadcast Architecture Rules

- the muezzin app currently controls live state only
- the muezzin app does not currently upload phone microphone audio
- real audio currently comes from AzuraCast Web DJ or another external encoder
- silence on AzuraCast public player means the problem is upstream of the listener app

## Current Source Of Truth

### Prayer Times

Canonical prayer-time source:

- `lib/api/prayerTimesUnified.ts`
- specifically `getDailyPrayerTimes(...)`

Role alignment:

- listener home and listener live surfaces use `getDailyPrayerTimes(...)`
- muezzin schedule builder also resolves timetable data through `getDailyPrayerTimes(...)`
- main admin and local admin workflows may edit/upload data elsewhere, but listener and muezzin display paths should ultimately read normalized daily data from this unified API

Important rule:

- `prayer_times` is treated as canonical over fallback/legacy CSV-derived paths when normalized daily data is available

### Listener Next Prayer / Next Adhan Card

Current listener next-prayer computation:

- `screens/user/index.tsx`
- `lib/prayerTimesDisplay.ts`

The listener next-prayer card should not fake tomorrow by adding 24 hours to today.
It should compute the next prayer across real today + tomorrow timetable data.

### Muezzin Next Adhan Card

Current muezzin next-adhan path:

- `lib/api/muezzin/schedule.ts`
- `lib/hooks/useMuezzinSchedule.ts`
- `screens/muezzin/user-home.tsx`

Important rule:

- null-time placeholder slots must not be treated as a real next adhan

### Listener Live State

Listener live-state is currently derived from:

- `screens/user/index.tsx`
- `screens/shared/hooks/useLiveStreamForMosque.ts`
- `screens/user/now.tsx`

Live-state inputs come from:

- `streams`
- `adhans`

Freshness protection:

- `lib/liveStreamFreshness.ts`

Any stream or adhan that remains marked live too long after starting is treated as stale on the listener side and ignored.

## Live Broadcast Architecture

### Current Reality

The muezzin app does not currently capture microphone audio itself.

The muezzin app is a control plane, not the audio media plane.

Current control-plane files:

- `screens/muezzin/live-broadcast.tsx`
- `lib/hooks/useLiveBroadcastEngine.ts`
- `lib/api/muezzin/liveBroadcast.ts`
- `app/api/muezzin/live-broadcast+api.ts`

Current audio source:

- AzuraCast Web DJ or another external encoder

This means:

- muezzin app can mark a mosque live
- listener app can route to the correct live playback URL
- actual audio still depends on AzuraCast/Web DJ or equivalent source sending audio upstream

### Current Confirmed Test Path

This end-to-end flow has been validated and should be preserved:

1. AzuraCast Web DJ connects using the mosque-specific streamer account
2. Web DJ microphone source is selected and real audio is present upstream
3. muezzin app marks the mosque live through the control-plane API
4. listener app sees the live state and routes to the mosque live page
5. listener playback uses a signed playback URL and then:
   - web redirects to upstream media
   - native/mobile uses the validated proxy path

If a future regression appears, identify which stage broke before editing code.

### Listener Playback Path

Client access request:

- `lib/api/liveStreamAccess.ts`
- `app/api/live-stream-access+api.ts`

Signed playback validation:

- `lib/server/liveStreamListenerAccess.ts`
- `app/api/live-stream-playback+api.ts`

Current delivery split:

- web listener: validated redirect to upstream playback URL
- native/mobile listener: validated proxy stream path for compatibility with `expo-av`

Reason for the split:

- direct redirect reduced web latency
- but mobile/native playback regressed when everything used redirect

### Current Live Config Pattern

For Icecast/AzuraCast-backed mosques, the expected pattern is:

- playback URL points to the public listener endpoint
- ingest URL points to the source/streamer endpoint
- mount path must match the broadcaster mount exactly
- source username/password must match the mosque-specific streamer account
- listener access secret is managed by Adhan Connect, not AzuraCast

Do not assume playback and ingest share the same mount or protocol.
Always verify against the actual AzuraCast station connection info.

## AzuraCast / Icecast Notes

Test environment has used:

- AzuraCast
- Icecast
- mosque-specific playback URL
- mosque-specific streamer account

Known operational facts:

- browser Web DJ can work once HTTPS is correctly configured
- browser Web DJ was a source of initial failures until domain + HTTPS were configured
- microphone not selected in Web DJ can produce a "live but silent" stream

Do not assume app-side live-state means real audio is present.
Always verify upstream audio separately when debugging silence.

## Known Important Behaviors

### Stale Live Protection

File:

- `lib/liveStreamFreshness.ts`

Current rule:

- live streams older than 20 minutes are treated as stale on listener-facing reads

Why:

- some sessions were never explicitly ended
- old Isha live rows remained `is_live = true` or `status = live`
- listener home and listener live page then showed contradictory states

### Listener Home And Live Page Must Agree

The listener home card and the listener live page previously diverged.

Root causes that were fixed:

- home card used a separate live-state combination path
- stale stream rows were cached as live
- one hook was not selecting `started_at`, so freshness checks could not work correctly

Critical file:

- `screens/shared/hooks/useLiveStreamForMosque.ts`

If home card says live but live page says "Nothing live right now", inspect this hook first.

### Listener Audio Must Stop When Broadcast Ends

Critical file:

- `screens/user/now.tsx`

Problem that was fixed:

- audio could continue in background after the live broadcast ended

Current protection:

- the player tracks the actual stream id currently playing
- if that stream disappears or stops being the active live stream, playback is torn down automatically

### Web Player Volume Safety

Critical file:

- `screens/user/now.tsx`

Problem that was fixed:

- browser error: `Failed to set the 'volume' property on 'HTMLMediaElement': The provided double value is non-finite.`

Current protection:

- volume is clamped and sanitized before:
  - UI display
  - media element updates
  - `expo-av` calls

## Recent Change Log

### 2026-03-30: Centralized Worklog Policy

Decision:

- keep future Codex notes in this file instead of scattering temporary notes across source files

Why:

- inline notes across many files become noisy quickly
- they drift and are easy to miss
- a single worklog is easier to maintain during debugging

Follow-up:

- append future entries here after meaningful fixes
- keep entries concrete and date-based

### 2026-03-30: Listener Live Page No Longer Resets On Background Refresh

Problem:

- listener live page could blink or interrupt the playback-start path while background refreshes were happening

Root cause:

- the page re-entered full loading state during refresh and reselected stream state too aggressively

Files changed:

- `screens/user/now.tsx`

Fix:

- background refreshes no longer trigger a full loading reset
- active stream selection is preserved if still valid
- only the first load gets full-page loading treatment

Verification:

- `eslint`
- `tsc --noEmit`

### 2026-03-30: Listener Home False LIVE State

Problem:

- listener home "Next Adhan" card still showed LIVE
- listener live page correctly showed "Nothing live right now"

Root causes:

- stale live stream / adhan rows existed in Supabase
- listener home hook missed `started_at`, so stale freshness check could not evaluate correctly

Files changed:

- `lib/liveStreamFreshness.ts`
- `screens/user/index.tsx`
- `screens/user/now.tsx`
- `screens/shared/hooks/useLiveStreamForMosque.ts`
- `lib/server/liveStreamListenerAccess.ts`

Verification:

- `eslint`
- `tsc --noEmit`

Important note:

- listener stale-live filtering is defensive
- stale rows may still remain in Supabase until backend cleanup or explicit broadcast end occurs

### 2026-03-30: Listener Web Playback Stability

Problem:

- web listener play could fail or throw HTML media volume errors

Root causes:

- non-finite volume values could reach the browser audio element
- web playback relied too heavily on `expo-av`

Files changed:

- `screens/user/now.tsx`

Fixes:

- clamped/sanitized volume
- added browser-native audio element path for web
- improved teardown behavior

### 2026-03-30: Mobile Listener Playback Compatibility Restored

Problem:

- listener mobile/native playback stopped starting after the delivery path was changed for latency

Root cause:

- redirect-only playback was acceptable on web but broke native/mobile start behavior

Files changed:

- `lib/api/liveStreamAccess.ts`
- `app/api/live-stream-access+api.ts`
- `lib/server/liveStreamListenerAccess.ts`
- `app/api/live-stream-playback+api.ts`

Fix:

- web keeps redirect delivery for lower latency
- native/mobile requests proxy delivery for compatibility

Verification:

- `eslint`
- `tsc --noEmit`

### 2026-03-30: Listener Audio Continued After Broadcast End

Problem:

- listener audio could continue playing until sign-out even after broadcast ended

Root cause:

- audio object remained alive after stream row disappeared

Files changed:

- `screens/user/now.tsx`

Fix:

- track currently playing stream id
- stop playback automatically if live stream disappears or active stream changes

### 2026-03-30: Playback Delivery Split For Latency And Compatibility

Problem:

- continuous server proxying added avoidable latency
- switching everything to redirect improved web but broke mobile/native listener playback

Files changed:

- `lib/api/liveStreamAccess.ts`
- `app/api/live-stream-access+api.ts`
- `app/api/live-stream-playback+api.ts`

Current result:

- web uses redirect
- native/mobile uses proxy

### 2026-03-30: Harrow Listener Home And Live Page Re-Alignment

Problem:

- listener home card could still show `LIVE` while the live page correctly said `Nothing live right now`

Root cause:

- the shared mosque live hook did not include `started_at`, so freshness logic could not invalidate stale rows

Files changed:

- `screens/shared/hooks/useLiveStreamForMosque.ts`

Fix:

- include `started_at` in the live-stream query and type so freshness checks can work

Verification:

- `eslint`
- `tsc --noEmit`

### 2026-03-30: Harrow End-To-End Live Audio Confirmed

Observed result:

- end-to-end live audio was eventually confirmed working between muezzin and listener flows

Important conclusions:

- prior silence was caused upstream by Web DJ microphone selection / routing, not by listener playback alone
- once upstream audio was real, listener live routing worked
- remaining lag is primarily a latency/tuning concern, not a basic connectivity failure

### 2026-03-29: Prayer-Time And Schedule Alignment

Problems fixed:

- listener next-prayer path diverged from canonical timetable source
- muezzin next-adhan could drift from today's prayer-times display
- listener and muezzin load failures were amplified by policy issues and slow dev-server route fallbacks

Key files involved:

- `lib/api/prayerTimesUnified.ts`
- `lib/prayerTimesDisplay.ts`
- `screens/user/index.tsx`
- `screens/user/now.tsx`
- `lib/api/muezzin/schedule.ts`
- `screens/muezzin/user-home.tsx`
- `lib/hooks/useMuezzinSchedule.ts`

Database work also done around that time:

- recursive RLS policy fix for `muezzins`
- public read fixes for active `mosques` and related public prayer-time access

### 2026-03-29: Main Admin Live Stream Config UI Cleanup

Problem:

- live stream config form showed unrelated profile fields like `Cross-mosque local-admin access`

File changed:

- `app/admin/mosques/[id].tsx`

Fix:

- split edit modal modes into profile-only and live-stream-only rendering

### 2026-03-29: Icecast Mount `/` Validation

Problem:

- app rejected valid Icecast mount path `/`

File changed:

- `lib/liveStreamProviders.ts`

Fix:

- allow `/` as a valid Icecast mount path

## Files To Check First By Symptom

### Home card says LIVE incorrectly

Check:

- `screens/user/index.tsx`
- `screens/shared/hooks/useLiveStreamForMosque.ts`
- `lib/liveStreamFreshness.ts`

### Live page says nothing live, but home says live

Check:

- `screens/shared/hooks/useLiveStreamForMosque.ts`
- `screens/user/index.tsx`

### Play button never switches to stop

Check:

- `screens/user/now.tsx`
- `lib/api/liveStreamAccess.ts`
- `app/api/live-stream-access+api.ts`
- `app/api/live-stream-playback+api.ts`
- `lib/server/liveStreamListenerAccess.ts`

### Audio keeps playing after broadcast ends

Check:

- `screens/user/now.tsx`

### Muezzin says live but listener hears nothing

Check in this order:

1. AzuraCast/Web DJ microphone source
2. AzuraCast/Web DJ microphone routing / cue / meter
3. AzuraCast public player
4. listener live page
5. signed playback path

App files to inspect:

- `screens/muezzin/live-broadcast.tsx`
- `lib/hooks/useLiveBroadcastEngine.ts`
- `lib/api/muezzin/liveBroadcast.ts`
- `screens/user/now.tsx`

Important rule:

- if AzuraCast public player is silent, fix upstream audio first

### Next prayer is wrong after the last prayer of the day

Check:

- `lib/prayerTimesDisplay.ts`
- `lib/api/prayerTimesUnified.ts`
- `screens/user/index.tsx`
- `screens/user/now.tsx`

### Muezzin next adhan is wrong

Check:

- `lib/api/muezzin/schedule.ts`
- `lib/hooks/useMuezzinSchedule.ts`
- `screens/muezzin/user-home.tsx`

## Recommended Next Improvements

1. Backend auto-end stale live rows at the source, not only on listener reads.
2. Replace `expo-av` over time with `expo-audio` / `expo-video` where appropriate.
3. Add explicit playback error instrumentation on listener live page for easier field debugging.
4. Consider a lower-latency broadcaster path than browser Web DJ if production latency becomes unacceptable.
5. If more work continues in this area, append a new dated section rather than rewriting old entries.

## Future Entry Template

Use this for future additions:

```md
### YYYY-MM-DD: Short Title

Problem:

- what the user observed

Root cause:

- what was actually broken

Files changed:

- `relative/path.ts`

Fix:

- what changed

Verification:

- `eslint ...`
- `tsc --noEmit`

Residual risk / follow-up:

- what still needs checking
```
