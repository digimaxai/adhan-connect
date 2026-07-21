# Codex Worklog

Last updated: 2026-07-21

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

### 2026-07-21: Transactional And Idempotent Broadcast Start

Problem:

- the hosted `/api/muezzin/live-broadcast` start request could exceed the Cloudflare Worker subrequest limit
- the old sequence updated `streams`, attempted the related `adhans` write separately, and then performed another database read, so a late failure could report an error after a partial start
- the mobile client retries ambiguous failures across resolved API candidates, which could reset `started_at` or duplicate state

Root cause:

- authorization, schedule resolution, rota/cover checks, and the two live-state writes were spread across many independent Supabase requests
- stream and adhan changes were not one database transaction

Files changed:

- `supabase/migrations/20260721120000_transactional_live_broadcast_start.sql`
- `app/api/muezzin/live-broadcast+api.ts`
- `docs/mobile/beta-release-builds.md`

Fix:

- added a service-role-only `start_live_broadcast_v1` RPC that validates access and timing, locks per mosque, preserves the preconfigured stream row, and changes stream plus adhan state atomically
- matching retries return the original stream and `started_at`; conflicting fresh sessions are rejected
- test and real sessions use internal adhan source markers so a test cannot be mistaken for a retry of a real broadcast sharing the same room name
- supplied adhan UUIDs are constrained to the target mosque
- the API preloads provider config and upstream state, commits with one RPC, and assembles the unchanged `{ stream, config }` response without a post-commit network request
- rollout is gated by `LIVE_BROADCAST_START_MODE=legacy|allowlist|rpc`; the default remains `legacy`
- publisher/listener LiveKit token paths and the end/room-deletion path are unchanged

Verification:

- `git diff --check`
- `npx tsc --noEmit`
- `npm run lint`
- `npx expo export --platform web`

Production rollout:

- applied the five previously unrecorded idempotent migrations and the new `20260721120000` migration atomically; local and remote migration histories now match
- verified `start_live_broadcast_v1` is executable by `service_role` only, anonymous prayer-time reads still work, and both prayer-time tables remain in Supabase Realtime
- converted the three server credentials required by EAS Hosting from secret to sensitive visibility; they remain server-only and are not included in the client bundle
- deployed and smoke-tested legacy-mode Hosting deployment `h0tk5aa6pe`; keep this as the immediate rollback target
- deployed and promoted Harrow-only allowlist deployment `k1qi7st54w`; production points to this deployment
- the allowlist contains only Harrow Mosque (`52fbe3bf-2d08-4009-9921-208afb5b3169`)
- post-promotion EAS request telemetry showed no crashes and no limit-exceeded requests; Harrow still had one configured non-live stream and no live adhan before handoff

Residual risk / follow-up:

- complete the two-iPhone LiveKit publisher/listener/audio/end/restart test for Harrow before adding another mosque or selecting global `rpc`
- if rollback is needed, promote legacy deployment `h0tk5aa6pe`; the database RPC can remain installed because legacy mode does not call it
- no new iOS binary is required while the API response and native LiveKit code remain unchanged

### 2026-07-21: Transactional Broadcast End Harrow Canary

Problem:

- the Harrow TestFlight broadcast looked successful, but the hosted end request silently exceeded the Cloudflare Worker subrequest limit after ending the stream
- the caught failures left the related adhan in `live` status and prevented the explicit LiveKit room deletion attempt
- followers observe both `streams` and `adhans`, so a partial end can leave follower UI or an already-connected listener in a stale live state

Root cause:

- authorization, stream lookup/update, configuration, upstream state, adhan lookup/update, and LiveKit deletion were separate outbound requests
- the legacy end path updated only one stream and one adhan candidate, and deliberately swallowed the late adhan/room cleanup failures

Files changed:

- `supabase/migrations/20260721213000_transactional_live_broadcast_end.sql`
- `app/api/muezzin/live-broadcast+api.ts`
- `lib/server/livekitRoom.ts`
- `docs/mobile/beta-release-builds.md`

Fix:

- added service-role-only `end_live_broadcast_v1`, which uses the same per-mosque lock and general access rules as transactional start
- all live stream rows and all live adhan rows for the mosque now end in one idempotent transaction; supplied foreign-mosque adhan UUIDs are rejected before writes
- retries preserve the original end timestamp and return every LiveKit room from the same end transition, allowing cleanup to resume after a Worker interruption
- the RPC also returns the configuration/upstream snapshot internally, keeping the established mobile response exactly `{ stream, config }` without post-commit database reads
- LiveKit deletion remains non-fatal, but the Harrow transactional path uses a bounded retry and request timeout; legacy-mode mosques retain the previous one-attempt behavior
- rollout is independently gated by `LIVE_BROADCAST_END_MODE=legacy|allowlist|rpc` and `LIVE_BROADCAST_END_RPC_MOSQUE_IDS`

Verification:

- independent SQL, API contract, and adversarial rollout reviews
- `git diff --check`
- `npx tsc --noEmit`
- `npm run lint`
- production-environment `npx expo export --platform web --clear`
- rollback-only production compile and functional test against Harrow's exact stale state, including a second idempotent call
- installed RPC verified as security invoker with an empty search path; only `service_role` has execute permission
- immutable and production root/unauthenticated endpoint smoke checks returned the expected `200`/`401` statuses

Production rollout:

- implementation commit: `011ced3`
- applied migration `20260721213000_transactional_live_broadcast_end`
- repaired stale Harrow adhan `c5481585-0a45-4574-aa00-d8bb0b171de3` only after locking the mosque and verifying its ended stream linkage; Harrow then had zero live streams and zero live adhans
- deployed, smoke-tested, and promoted legacy-END safety deployment `jcwu288kmd`; this is the preferred rollback
- deployed, smoke-tested, and promoted Harrow-only canary `5zlqrgnnk6`; production points to this deployment
- both transactional start and end allowlists contain only Harrow Mosque (`52fbe3bf-2d08-4009-9921-208afb5b3169`)
- no iOS/TestFlight rebuild is required because the native code and `{ stream, config }` contract are unchanged
- physical Harrow Isha publisher/listener/audio/end test passed at 21:45 UTC; the start and end POSTs both returned `200`, with no crash or limit-exceeded flag
- the transactional end log recorded one ended stream, one completed adhan, and one LiveKit cleanup room
- post-test database verification found zero live stream/adhan rows and matching stream/adhan end timestamps; LiveKit reported the ended room absent

Residual risk / follow-up:

- keep the rollout Harrow-only until each additional mosque's stream/configuration state is audited and physically canaried; do not select global `rpc` yet
- wait for the end request to resolve before restarting; deterministic daily room names leave a narrow delayed-delete/restart race across two devices
- the Worker cleanup budget handles at most six distinct legacy room names per invocation; audit duplicate stream/room state before any wider rollout
- if rollback is needed, promote `jcwu288kmd`, then set `LIVE_BROADCAST_END_MODE=legacy` for future deployments; the additive RPC can remain installed

### 2026-05-12: LiveKit Listener E2E Hardening

Problem:

- muezzin LiveKit publishing was confirmed from the Android emulator, but the next E2E step needed a real Android listener phone to join the same LiveKit room
- the listener LiveKit token hook used only `EXPO_PUBLIC_API_BASE_URL`, unlike the rest of the app's API clients, so physical-device networking could fail even when emulator networking worked
- the listener live page could still invoke the older signed playback path for LiveKit streams, which do not have an Icecast/RTMP playback URL
- during emulator testing, the muezzin screen could start two LiveKit connects for the same broadcast and trigger a LiveKit client `Closing` redbox while one attempt was being torn down
- on the physical listener phone, the app attempted the listener token request but stalled/fell through API candidates before joining LiveKit

Root cause:

- LiveKit token requests had not been wired through the shared native API URL resolver
- the listener player had partial LiveKit support but still allowed legacy playback auto-start and manual switch paths to run for LiveKit rooms
- the muezzin manual start and backend-live auto-start paths could race before `roomRef` existed
- native API resolution returned only one native dev base and put the env base before native LAN/dev candidates

Files changed:

- `lib/api/apiBaseUrl.ts`
- `lib/hooks/useLiveKitBroadcast.ts`
- `lib/hooks/useLiveKitSubscribe.ts`
- `screens/muezzin/live-broadcast.tsx`
- `screens/user/now.tsx`

Fix:

- LiveKit publisher and listener token requests now use `resolveApiUrls(...)` plus timed server fetches, so emulator, LAN, tunnel, and physical-phone candidates are tried consistently
- listener LiveKit subscribe exposes explicit reconnect, logs `[LK subscribe]` phases, tracks diagnostics, and records remote audio subscription
- listener live page no longer calls the old signed playback endpoint for LiveKit rooms and surfaces LiveKit listener errors directly
- listener play button no longer cancels an in-flight LiveKit join when auto-connect is still running
- native API resolution now gathers native dev bases before the env base, so physical-device LAN candidates can be attempted before stale localhost/env values
- publisher and listener LiveKit hooks reuse an in-flight connect promise, preventing duplicate room connects from one UI action
- the muezzin screen uses the same auto-start key for manual and backend-live start paths

Verification:

- `npx tsc --noEmit`
- `npm run lint` passes with only the existing `app/_layout.tsx` unused `Platform` warning
- Expo dev server was started in LAN mode and `/api/listener/livekit-token` returned the expected unauthenticated `401` from both `localhost:8081` and `192.168.1.189:8081`
- Galaxy S9 and emulator both have `adb reverse tcp:8081 tcp:8081` set for the dev server

Residual risk / follow-up:

- final confirmation still requires the real Android phone to join while the emulator muezzin is live; LiveKit Cloud should show the room participant count increase from 1 to 2

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
