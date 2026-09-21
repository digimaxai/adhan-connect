# Codex Worklog

Last updated: 2026-09-04

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

### 2026-07-21: Main-Admin Broadcast Readiness Workflow

Problem:

- the main-admin portal could enable a provider but could not prove that a mosque was operationally ready to broadcast
- transactional start deliberately requires a preconfigured stream row, while portal saves only updated the mosque configuration
- production's legacy `staff_rota` table was missing `adhan_time`, `iqama_time`, and `assigned_by`, even though current rota code and transactional start use those canonical columns
- START and END canary selection is a deployment control and must not be confused with ordinary mosque configuration

Files changed:

- `supabase/migrations/20260721230000_broadcast_onboarding_readiness.sql`
- `app/api/admin/broadcast-readiness+api.ts`
- `lib/server/broadcastReadiness.ts`
- `lib/types/broadcastReadiness.ts`
- `app/api/admin/mosque-workspace+api.ts`
- `app/admin/mosques/[id].tsx`
- `docs/admin/live-broadcast-onboarding.md`

Fix:

- added the missing canonical rota columns additively without reinterpreting or rewriting the legacy `start_at` / `end_at` data
- enforced one stream state row per mosque after the production preflight confirmed there were no duplicates
- added service-only broadcast-onboarding state and append-only audit events
- added a main-admin-only readiness API that checks provider configuration, server credentials, local admin and muezzin coverage, schedule source, stream cardinality, stale live state, mosque launch status, and the effective START/END rollout for only the selected mosque
- added an idempotent provisioning RPC that shares the mosque lock used by transactional start/end, preserves one clean dormant stream, refuses live or duplicate state, and creates no adhan, room, notification, or public live state
- added explicit audited milestones for setup pending, ready for test, physical test passed, and live
- added the web readiness panel plus main-admin default-muezzin controls
- kept EAS allowlists external and operator-controlled; the portal reports effective booleans but never returns or edits the lists

Verification:

- `git diff --check`
- `npx tsc --noEmit`
- `npm run lint`
- `npx expo export --platform web --clear`

Deployment status / follow-up:

- code and migration are committed only; production migration and Hosting deployment require a separate reviewed rollout
- apply the database migration before deploying the portal/API code
- retain Harrow-only START and END allowlists until another mosque passes the documented readiness and physical canary process

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

### 2026-07-22: LiveKit onboarding clarity and readiness rollout

Problem:

- the main-admin mosque workspace still presented legacy playback, ingest,
  stream-key, listener-secret, and provider-callback fields for LiveKit
  in-app microphone broadcasts
- broadcast readiness failed because the production database had not yet
  received `public.mosque_broadcast_onboarding`
- readiness needed to use the same effective rota assignee and mosque-local
  date as transactional START/END

Files changed:

- `app/admin/mosques/[id].tsx`
- `app/admin/mosques/index.tsx`
- `app/api/admin/mosque-workspace+api.ts`
- `lib/server/broadcastReadiness.ts`
- `lib/timeZones.ts`
- `supabase/migrations/20260721230000_broadcast_onboarding_readiness.sql`
- `docs/admin/live-broadcast-onboarding.md`

Fix:

- made the admin live-stream card provider-aware; LiveKit now explains that
  room access and listener playback are automatic and hides legacy external
  encoder/provider controls
- added editable, validated mosque timezones to the existing profile workflow
- aligned readiness with `muezzin_user_id ?? staff_user_id` and the validated
  mosque-local calendar date
- applied migration `20260721230000_broadcast_onboarding_readiness` to the
  linked production project and recorded the matching migration history entry
- used the authenticated Supabase Management API query path because the legacy
  `db push` subprocess did not inherit the CLI's macOS Keychain session

Verification:

- `git diff --check`
- `npx tsc --noEmit`
- `npm run lint`
- `npx expo export --platform web --clear`
- local and remote migration histories match through `20260721230000`
- both readiness tables exist with RLS enabled and are exposed through
  PostgREST without a schema-cache error
- both readiness RPCs are security-invoker and executable only by
  `service_role`
- the one-stream-per-mosque unique index is valid and no duplicate mosque
  stream rows exist
- rollout was non-activating: Harrow retained one dormant stream row, with no
  live stream and no live adhan

Residual risk / follow-up:

- the provider-aware portal changes remain a code deployment concern separate
  from the completed database migration
- each new mosque still requires a controlled two-device private canary before
  approval and production launch

### 2026-07-24 to 2026-07-25: Claude Code picks up Codex's handoff, builds a real staging environment, lands the auth/GDPR changeset there

Problem:

- Codex's session ended (usage limit) mid-way through the sign-in
  simplification + GDPR account-controls work, with a large uncommitted
  changeset and an unapplied migration
  (`supabase/migrations/20260724090000_account_control_foundation.sql`)
- `preview` and `production` EAS environments shared one Supabase project,
  so there was no safe place to test that migration, or anything else,
  without risking the real production database
- `migrations/` and `supabase/migrations/` were duplicated top-level
  folders with an actual gap: 14 core tables (`users`, `mosques`, `streams`,
  `muezzins`, `adhans`, `adhan_broadcasts`, `campaigns`, `donations`,
  `events`, `follows`, `mosque_prayer_times`, `recorded_adhans`,
  `subscriptions`, `user_mosque_prefs`) and 13 enum types had no creating
  migration anywhere — they predated migration tracking (2025-12-06)
  entirely and were never captured

Root cause:

- the migration-folder duplication and untracked genesis tables were
  historical (predate this session); nobody had ever tried a from-scratch
  replay before, so the gap was invisible until this work specifically
  tried to reproduce the schema on a new project
- there was no CI and no branch protection at all before this session, so
  `main` had been receiving direct pushes since the repo's first commit

Files changed (representative, not exhaustive — see the actual PR diffs on
GitHub for the full list):

- `supabase/migrations/20251206000000_genesis_core_schema.sql` (new)
- `supabase/migrations/` — 10 files moved in from the old `migrations/`
  folder, which was then deleted
- `supabase/.gitignore` (new)
- `.github/workflows/ci.yml` (new)
- `docs/mobile/beta-release-builds.md` — added the staging/production
  promotion runbook
- `app/api/muezzin/live-broadcast+api.ts` — recovered after an accidental
  over-commit (see below), now correctly has the `accountConsentAccess`
  integration plus two unrelated fixes
- 11 files across `lib/`, `app/(admin)/`, `screens/` — explicit `: string`
  parameter types added to `.split(',').map(...)`-style callbacks (CI-only
  implicit-any errors, see Verification)
- `lib/server/liveStreamUpstreamPolicy.ts` — one `.map<T>()` generic call
  changed to a return-type-annotated callback for the same reason
- the entire pending auth/GDPR changeset (111 files) merged into `staging`
  via PR #3 on top of the above

Fix:

- reconciled the migration folders: verified byte-identical overlap,
  merged the 10 missing files in, linked the Supabase CLI to production,
  and confirmed no real drift directly against the live schema (via
  PostgREST, since Docker wasn't available yet) before retiring
  `migrations/`
- wrote and validated a genesis migration for the 14 untracked tables —
  deliberately scoped to tables/types only (not the ~20 untracked
  functions, which are a documented follow-up), verified end-to-end by
  applying it to a disposable Supabase-flavoured Postgres container via
  Docker before committing
- created a new `adhan-connect-staging` Supabase project (same org/region
  as production), schema-cloned from production via `pg_dump`/`db query`
  (not `db diff`/replay, since the genesis gap made replay fail on a truly
  blank database), seeded with synthetic test users only
- split `SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE` in EAS from
  one shared record across all three environments into independent
  per-environment records — this was not obvious from the CLI and caused a
  near-miss (see Residual risk)
- created the `staging` branch, added `.github/workflows/ci.yml` (tsc +
  lint on PRs into `staging`/`main` and on push to `staging`), protected
  `main` via the GitHub API (PR required, 0 required reviewers, required
  `checks` status, no force-push/deletion, `enforce_admins: false` as a
  deliberate owner escape hatch)
- landed the full pending auth/GDPR changeset as
  `feature/auth-gdpr-account-controls`, merged into `staging` via PR,
  applied `20260724090000_account_control_foundation.sql` to staging
- cut EAS `preview`-profile builds (Android and iOS) from `staging` for
  real-device testing; iOS additionally required registering a test device
  (`eas device:create`) and enabling Developer Mode on the physical device

Verification:

- `npx tsc --noEmit`, `npm run lint`, `npx expo export` (web/iOS/Android)
  all clean before continuing Codex's work; independent two-pass security
  review of the full pending changeset found zero high-confidence findings
- migration reconciliation verified against production's actual live
  schema (table/function existence checks via PostgREST), not assumed from
  the migration files alone
- genesis migration applied successfully end-to-end to a disposable
  Postgres container (Docker), then to both staging and production
  bookkeeping (`migration repair --status applied`) since the schema
  already existed in both
- staging's full schema diffed against production's table list: exact
  match
- CI failures were real and were each root-caused against actual CI output
  rather than guessed at: an accidental over-commit that broke `tsc` on
  `main` (see below), then a set of CI-only implicit-any errors on
  `.split(',').map(...)` callbacks that could not be reproduced locally
  despite ruling out Node version, OS, and CPU architecture one at a time
  via Docker — fixed with explicit type annotations, confirmed green
  against real CI, not local reproduction
- after the full changeset merged into staging: `migration list --linked`
  showed 55/55 matched on staging, and separately confirmed production
  still shows exactly one unmatched migration
  (`20260724090000`, i.e. correctly still unapplied there)

Residual risk / follow-up:

- **near-miss, self-corrected:** partway through, an `eas env:set` update
  intended for `preview`/`development` only briefly changed
  `production`'s Supabase URL too, because those variables were originally
  a single record shared across all three environments rather than
  separate per-environment ones. Caught immediately via `eas env:list
  --format long` (check the `Environments:` field before trusting a
  variable is actually scoped the way it looks), fixed by splitting each
  into independent records, verified production correct afterward. No
  build was cut with the bad values in between.
- **near-miss, self-corrected:** a git commit intended to fix one stale
  comment in `app/api/muezzin/live-broadcast+api.ts` accidentally staged
  that file's entire pending Codex diff instead, because the file already
  had uncommitted changes sitting in the tree at commit time. This broke
  `main`'s `tsc` build; caught by the newly-added CI on the very next PR,
  reverted via a follow-up PR, and Codex's actual intended change (the
  `accountConsentAccess` integration) was recovered via a 3-way merge
  against commit `35c0382` since it was no longer present in any stash.
  Lesson: always check `git status` on a specific file before `git add`ing
  it, even mid-unrelated-task, if the working tree might already have
  unrelated pending changes.
- ~20 functions in production (some superseded/legacy broadcast RPCs, some
  still-used trigger/helper functions like `handle_new_auth_user`,
  `ensure_profile_exists`, `search_mosques`) have no creating migration
  anywhere, and neither do the RLS policies on the 14 genesis tables that
  depend on those functions or on `mosque_admins`. Deliberately deferred,
  not guessed at — needs its own pass to triage dead vs. needed before
  writing a follow-up migration.
- separately, a pre-existing bug unrelated to this session's work:
  `20251207100000_prayer_times_and_staff_rota.sql` (already applied to
  production) references a `profiles` table that isn't created until
  `20251207101500`, 15 minutes later. Only surfaced because this was the
  first time anyone tried replaying the full migration history from
  scratch. Not fixed — editing an already-applied production migration
  file needs its own deliberate follow-up.
- the exact reason `tsc` produced different implicit-any errors in GitHub
  Actions than in every local reproduction attempt (matched Node version,
  OS, and CPU architecture one at a time) was never conclusively
  identified. The specific errors are fixed and verified; the underlying
  "why" is not understood.
- still blocked, per `docs/auth/account-auth-release-gates.md`: production
  RLS migration, legal review of the draft Privacy/Terms pages, Apple/Google
  provider setup, and hard-deletion enablement. None of today's work
  changes any of those gates.
- staging is live and UAT-ready; promoting `staging` into `main` and
  applying the migration to production both remain explicitly gated on the
  product owner's sign-off after real-device testing, not an automated
  next step.

### 2026-08-31: Email diagnosis corrected and August API routes made operational

Problem:

- email confirmation was reported as a staging Supabase infrastructure outage
  after a localhost sign-up showed a verification screen while staging Resend
  recorded no attempt
- the six new Quran, dua, tip, mosque and live-adhan endpoints returned the web
  HTML shell instead of JSON
- Discover mosque cards and the live-adhan card contained nested web buttons

Root cause:

- the running localhost portal was compiled from the production-pointing
  `.env`, while SMTP changes and metrics were being inspected in staging
- Supabase default SMTP failure was treated as infrastructure evidence even
  though default delivery is restricted to organization-member addresses and
  has a very low rate limit
- a direct staging Auth request does reproduce HTTP `500`, `Error sending
  confirmation email`, so a staging SMTP handoff/config problem remains; the
  available Supabase management token is expired, preventing Auth-log/config
  inspection in this pass
- the six route filenames lacked Expo Router's required `+api.ts` suffix, and
  the location handlers used schema names that do not exist (`latitude`,
  `longitude`, `adhan_time`, and `broadcast_url`)

Files changed:

- `scripts/start-web-fast.js`
- `scripts/check-env.js`
- `scripts/test-staging-email.js`
- `package.json`
- `app/api/mosques/nearby+api.ts`
- `app/api/mosques/search+api.ts`
- `app/api/quran/reciters+api.ts`
- `app/api/duas/daily+api.ts`
- `app/api/tips/daily+api.ts`
- `app/api/live-adhans/location+api.ts`
- `screens/user/discover.tsx`
- `components/LiveAdhansCard.tsx`
- `app/(auth)/sign-up-step2.tsx`
- `app/(user)/duas.tsx`
- `app/(user)/quran.tsx`
- `CLAUDE.md`
- `docs/claude-code-handoff-2026-08-31.md`

Fix:

- pulled EAS preview variables into ignored `.env.local` for local staging work
- added a staging-branch startup guard that refuses the known production
  Supabase ref without an explicit override
- added a repeatable staging-only email smoke test using Resend's designated
  delivered test address with immediate test-user cleanup
- renamed all six handlers to `+api.ts`, aligned coordinates and prayer/adhan
  fields with the real schema, bounded input, sanitized search filters, and
  restored canonical stale-live filtering
- replaced nested Pressables with sibling or non-button presentation elements
- removed the plaintext Resend credential from the handoff documentation

Verification:

- direct staging Auth smoke: HTTP `500`, `Error sending confirmation email`
  (expected current blocker; no test user persisted)
- local staging route smoke: all six endpoints return `application/json`;
  nearby mosques `200` with two results, search `200` with one result, reciters
  `200` with twelve results, dua/tip `200`, live adhans `200` with a valid empty
  result
- `npx tsc --noEmit`
- `npm run lint`
- `git diff --check`

Residual risk / follow-up:

- rotate the exposed Resend API key, update staging SMTP, inspect the exact
  staging Auth-log error, and rerun `npm run test:email:staging` until it returns
  `200`; only then resume browser/real-device sign-up E2E
- amend the unpushed handoff commit so the credential is absent from reachable
  local history before pushing
- contact Supabase Support only if the rotated, verified configuration still
  fails and include the exact Auth-log event/timestamp

### 2026-08-31: Staging email verification restored

Root cause:

- Supabase Auth logs showed every failing sign-up attempting DNS lookup of
  `smtpsmtp.resend.com`; the duplicated `smtp` prefix prevented any connection
  from reaching Resend
- this was a staging configuration error, not an account-level Supabase email
  outage

Fix:

- authenticated the project-scoped Supabase MCP and a local Supabase CLI
  Management API session
- rotated the previously exposed Resend credential and restored the complete
  staging custom-SMTP block with host `smtp.resend.com`, port `465`, username
  `resend`, and the verified `mail.adhanconnect.com` sender
- kept automatic confirmation disabled so email verification remains required
- did not change production

Verification:

- `npm run test:email:staging` returned HTTP `200`, reported
  `verification_required: true`, and deleted its temporary test user
- the matching staging Auth log recorded `user_confirmation_requested`, status
  `200`, and no `error` or `error_code`

Operational note:

- a single-field Management API `PATCH` for `smtp_host` cleared the hosted SMTP
  block; future SMTP changes must submit the complete SMTP configuration with a
  current credential and verify the saved non-secret fields with a fresh `GET`
- the first real web confirmation was accepted (`user_signedup`, HTTP `303`),
  but staging rejected its unlisted localhost redirect and fell back to
  `adhanconnect://callback`; exact localhost callback and password-reset URLs
  for ports `8081` and `8082` were added without removing the native URLs
- the affected real account was confirmed despite the failed browser handoff;
  a subsequent controlled sign-up logged `http://localhost:8082/callback`,
  proving that staging now accepts the web redirect

### 2026-08-31: Quran API and player integration repaired

Findings:

- the recitations response does not contain `english_name`, and seven of the
  current twelve records have a nullable `style`
- the previous `/verses/:key?recitation=...` request returned HTTP `404`
- Quran Foundation's working ayah-recitation endpoint returns relative or
  absolute CDN paths, and recitation ID `2` is AbdulBaset Murattal
- the Quran screen selected a reciter visually but never requested audio or
  mounted `QuranPlayer`

Fix:

- normalize reciters to a stable `display_name` and nullable `style`
- fetch verse audio from `/quran/recitations/:id?verse_key=...`, resolve only
  allowlisted HTTPS Quran CDN hosts, and convert upstream seconds to player
  milliseconds
- add `GET /api/quran/verse-audio` with bounded input validation and a 24-hour
  public cache
- use the shared API-base resolver for web and native Quran requests
- connect reciter selection to featured-verse playback and make the first play
  press start audio immediately
- remove the unused chapter-audio stub because chapter-reciter IDs are a
  separate namespace from ayah-recitation IDs
- add `npm run test:quran:api`

Verification:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:quran:api`: 12 normalized reciters, verse `1:1` for
  recitation `2`, 1 KiB valid CDN audio range, validation `400` cases, and
  unavailable-audio `404`
- Quran metadata uses the Expo server route; MP3 bytes are downloaded directly
  from `verses.quran.foundation`; Supabase is not in the request path

### 2026-08-31: Mobile Quran and Duas UX rebuilt

Problem:

- the Quran screen exposed a fixed verse, a long reciter list, and inert
  “Browse chapters”/Tafsir controls; users could not choose an ayah naturally
- audio selection and playback were separate, high-friction steps
- “Islamic Wisdom” was vague and audience-misaligned, while collections and
  learning-resource rows looked interactive but did nothing

Fix:

- add seven-day cached `/api/quran/chapters` and `/api/quran/chapter` routes
  using Quran Foundation chapter/verse data and Saheeh International English
  text, with footnote markup removed for safe mobile display
- fetch every upstream page so long surahs are complete; Al-Baqarah returns all
  286 ayahs
- rebuild Quran around a default useful state, searchable 114-surah sheet,
  reciter sheet, explicit per-ayah Listen buttons, Arabic/translation cards,
  loading/retry states, and a compact persistent player dock
- remove inactive Quran CTAs and unrelated Dua content from the Quran tab
- rename “Islamic Wisdom” to “Duas & Adhkar”; add working Fajr/Dhuhr/Asr/
  Maghrib/Isha filters, optional transliteration, eight reflection themes,
  retry controls, and a real next-reminder action
- make Quran, Dua, and reminder clients resolve the configured API host on
  native rather than assuming a web-relative URL
- add `npm run test:devotional:api` and expand `npm run test:quran:api`

Verification:

- `npx tsc --noEmit`
- `npm run lint`
- `git diff --check`
- Quran smoke: 12 reciters, 114 surahs, 7 Al-Fatihah ayahs, all 286
  Al-Baqarah ayahs, verse audio, CDN range bytes, and validation failures
- devotional smoke: all five prayer filters, eight themes, rotating reminders,
  and invalid prayer/theme failures
- automated in-app visual inspection remains unavailable because this Codex
  installation exposes no browser preview backend; physical mobile UX QA is
  still required

### 2026-08-31: Full-surah playback added

Problem:

- Quran listeners could play individual ayahs but had no obvious way to listen
  to a selected surah from beginning to end

Fix:

- add a prominent `Play full surah` action inside the selected-surah header
- add `/api/quran/surah-audio`, which validates the surah/reciter, retrieves the
  complete ordered ayah queue in one Quran Foundation metadata request, caches
  it for 24 hours, and returns direct Quran CDN URLs
- automatically advance through the queue and show the current ayah position,
  with previous/next controls in the bottom player
- preserve individual ayah playback as an immediate override and preserve the
  current ayah when the reciter changes during full-surah playback

Verification:

- `npx tsc --noEmit`
- `npm run lint`
- `git diff --check`
- Quran integration smoke confirms 7 queued tracks for Al-Fatihah and all 286
  queued tracks for Al-Baqarah, plus validation and direct CDN playback

### 2026-08-31: Qur'anic Arabic reading typography refined

- retain Arabic as the primary source text and English as supporting
  translation rather than removing the Arabic from the Quran reader
- bundle the OFL-licensed Amiri Quran face through the Expo Google Fonts
  package and load it once at the application root
- apply it only to Quran verses and Arabic surah names, with 31px verse text,
  generous 56px line height for diacritics, RTL alignment, and a low-glare
  warm reading panel
- `npx tsc --noEmit`, `npm run lint`, `git diff --check`, dependency resolution,
  and the live web bundle pass; visual mobile QA remains manual because the
  in-app preview backend is unavailable

### 2026-08-31: Shared reading system and Daily Reflection naming

- rename the user-facing `Duas & Adhkar` page to `Daily Reflection` and its
  bottom-tab label to `Reflect`; the internal route remains `/duas`
- centralise the Quran/dua sage palette in `tokens.color.reading`
- centralise the bilingual reading scale in `tokens.typography.reading`
- set Arabic source text to Amiri Quran 25px/46px and English translation to
  15px/24px on both pages, preserving diacritic clearance without letting the
  Arabic visually overpower the translation
- move Daily Reflection filters, badges, reading panels, reflection card, and
  actions onto the shared sage visual system

### 2026-09-02: Bilingual alignment and seamless full-surah playback

Problem:

- Latin translations did not share the Arabic text's right-hand reading edge
- full-surah mode unloaded one ayah MP3 before loading the next, producing an
  audible pause or clipped-feeling transition

Fix:

- right-align Arabic and Latin reading text on Quran and Daily Reflection while
  retaining left-to-right word order for English and transliteration
- use Quran Foundation's chapter-recitation endpoint for a single continuous
  MP3 and validated millisecond ayah timestamps
- track the active ayah from playback position and seek previous/next controls
  inside the loaded chapter file instead of replacing the audio object
- explicitly map only verified ayah-reciter/chapter-reciter IDs; retain the
  accurate per-ayah queue for reciter 11 because the live chapter ID currently
  resolves to a different voice
- allow only the observed Quran Foundation audio hosts; MP3 bytes remain a
  direct client-to-CDN transfer and do not pass through Expo or Supabase

Verification:

- `npx tsc --noEmit`
- `npm run lint`
- `git diff --check`
- `npm run test:quran:api`: 12 reciters, 114 surahs, continuous Al-Fatihah and
  all 286 Al-Baqarah timestamps, reciter-11 queue fallback, and 1 KiB range
  reads from both the verse and continuous-audio CDNs

### 2026-09-02: Production live workflow regression gate

Protected outcome:

- preserve the deployed listener homepage, muezzin assignment, staff rota,
  muezzin start/end, LiveKit publisher/listener, and listener teardown paths
  while Quran and Daily Reflection work continues

Impact audit:

- the current Quran/Reflection working-tree changes do not alter
  `screens/user/index.tsx`, `screens/user/now.tsx`,
  `screens/shared/hooks/useLiveStreamForMosque.ts`, the muezzin/admin assignment
  and rota routes, the broadcast route, or the LiveKit token routes
- `components/LiveAdhansCard.tsx` only removes invalid nested button markup;
  it retains the outer row press handler and is not used by the established
  listener homepage
- `app/api/live-adhans/location+api.ts` is the corrected supplemental nearby-
  broadcast discovery route; the established homepage still derives its live
  state through `useLiveStreamForMosque`
- the broader committed `staging` branch is not a zero-diff production patch:
  it is 20 commits ahead of and 3 behind `main`, and includes earlier reviewed
  auth/consent and live-playback hardening. It must not be promoted wholesale
  without reconciliation and the authenticated physical canary below

New non-mutating regression check:

- `npm run test:live:contracts` serves listener home/live, muezzin broadcast,
  muezzin assignment, and rota pages
- it verifies missing-auth `401` boundaries for broadcast state/start,
  publisher/subscriber token creation, listener playback access, muezzin
  assignment, rota workspace/save, and muezzin rota
- it verifies unsigned playback and invalid nearby-live requests fail closed
- the smoke never authenticates and reports `productionDataMutations: 0`

Verification:

- `npm run test:live:contracts`: all five protected pages `200`; all nine
  protected endpoint checks `401`; unsigned/invalid requests `400`
- clean Expo export completed for iOS, Android, and server-output web
- the test portal was explicitly confirmed against staging Supabase, not
  production
- the embedded browser preview was unavailable, so no authenticated visual or
  audible E2E claim is made
- a read-only EAS Hosting crash-telemetry query was attempted but Expo's API
  returned an unexpected server error; it is not counted as verification

Mandatory pre-production acceptance gate:

1. reconcile the branch with current `main` and review every protected-path
   delta
2. in staging/preview, assign a muezzin, save a rota slot, and confirm it appears
   in the muezzin workspace
3. use the assigned muezzin to start a broadcast on a real publisher device
4. confirm the established listener homepage changes to LIVE, the live page
   agrees, and a second real device receives audible audio
5. end the broadcast and confirm listener audio stops, homepage/live-page state
   clears, stream and adhan rows are ended, and the LiveKit room is absent
6. restart once to verify idempotent start/end behavior
7. only then use the existing Harrow-only production canary/rollback process;
   do not widen the transactional allowlist as part of this feature release

### 2026-09-02: Listener mobile navigation and first-run refinement

Problem:

- Expo Router was automatically exposing the invite/request utility routes as
  sixth and seventh tabs, forcing every label to truncate on iPhone widths
- inactive navigation contrast and generic outline-only feedback made the
  primary navigation difficult to scan
- a signed-in listener with no followed mosque saw duplicate setup prompts and
  an unavailable prayer card before the product explained what to do
- development builds could keep an older EAS API base and stop at its `404`
  rather than trying the Metro server that supplied the active bundle

Fix:

- retain five primary listener destinations: Home, Qur’an, Reflect, Mosques,
  and Settings; explicitly hide the invite/request routes from the tab bar
- add filled/outline Ionicons, accessible labels, stronger contrast, safe-area
  spacing, selection haptics, and a restrained spring interaction
- move both mosque onboarding utilities into a labelled Settings section with
  direct, descriptive rows
- add a focused first-run listener state with one primary mosque-search action,
  an optional-location explanation, clear benefits, and a missing-mosque path
- isolate that state to authenticated listeners with no subscription and no
  staff/default primary mosque; established listener and muezzin home branches
  continue through their existing paths
- make native development API discovery prefer the current Metro host, retain
  configured-server fallbacks, reload the surah catalogue with the main retry,
  and replace raw HTTP errors with concise user-facing recovery copy

Verification:

- `npx tsc --noEmit`
- `npm run lint`
- clean iOS Expo export (1,801 modules)
- `npm run test:quran:api`: 114 surahs, 286-ayah pagination, verse audio,
  continuous surah audio, and queued-reciter fallback
- `npm run test:devotional:api`: all five prayer filters and eight reflection
  categories
- `npm run test:live:contracts`: all five protected pages served; nine guarded
  endpoints remained `401`; zero data mutations
- staging port 8081 returned `200` for chapters, daily dua, and daily reflection
- the in-app browser backend was unavailable; final narrow-screen visual and
  authenticated interaction QA remains a physical-device check

### 2026-09-04: Role-aware push alerts and travel-safe nearby context

Outcome:

- added opt-in upcoming and LIVE Adhan alerts with independent listener and
  muezzin controls; assignment/rota activity remains available in its existing
  inbox whether push is enabled or not
- listener reminders use existing subscriptions and the saved primary-mosque
  preference; muezzin duty reminders read the existing authoritative
  `staff_rota` assignments rather than introducing a second assignment system
- added short-lived current-area LIVE alerts: coordinates are rounded to about
  1 km, expire within 24 hours, and never replace or add a followed/default
  mosque
- added `Near you now` to the listener home with PostGIS distance ordering,
  current next-Adhan context, LIVE-first ordering, directions, exact mosque
  navigation, and direct LIVE listening
- location is refreshed on foreground/resume and by explicit refresh, with no
  background tracking or 30-second GPS polling
- calculation fallbacks are labelled as estimates and grouped/cached so a
  nearby screen does not multiply third-party prayer-time requests for adjacent
  mosques

Backend and broadcast isolation:

- staging migrations `20260903120000` and `20260903143000` are applied; the
  `push-dispatch` Edge Function is deployed for the staging variant and its
  one-minute `pg_cron` schedule is active
- LIVE status changes only write a durable outbox event locally; a separate
  `pg_net` wake-up runs after commit and catches all errors, so Expo/APNs,
  scheduler, or network failure cannot fail a broadcast transaction
- the dispatcher requires a random DB-held secret even though platform JWT
  verification is disabled for the database scheduler; an unauthenticated
  request was verified to return `401`
- production Supabase, LiveKit configuration, start/end RPCs, stream state,
  muezzin assignment, and rota write paths were not changed
- notification native modules are loaded fail-soft, allowing older development
  binaries to keep opening for LIVE testing; actual push registration requires
  a newly built staging binary

Verification:

- `npx tsc --noEmit` and `npm run lint`
- clean staging iOS and Android Expo exports (1,896 and 1,901 modules)
- `npm run test:notifications:safety`: 18 broadcast/assignment/rota/listener
  files hash-protected, fail-open outbox delivery, zero subscription mutations
- `npm run test:live:contracts`: five protected pages `200`, nine protected
  endpoints fail closed at `401`, zero data mutations
- `npm run test:quran:api` and `npm run test:devotional:api`
- staging nearby context returned distance-sorted active mosques with next
  prayer/time/source and LIVE fields
- physical APNs delivery and the authenticated publisher/listener audio flow
  remain mandatory on the fresh staging build; see
  `docs/mobile/push-nearby-staging-test.md`

### 2026-09-04: Physical notification-settings QA and duty fallback repair

Observed on staging preview build 5:

- a muezzin opening Notifications waited too long at “Loading your
  preferences”, then saw listener and travel controls that did not match the
  active workspace
- a global busy flag made independent switches and the travel action appear
  disabled while any save or secondary query was running
- device permission and push registration succeeded, and the muezzin preference
  row persisted, but an upcoming Dhuhr for the mosque's default muezzin created
  no outbox event

Client fix:

- make Notifications role/workspace-aware: the muezzin workspace shows only
  My duties and Assignment updates; listener/travel preferences remain
  available after switching to Listener mode
- load preferences first and defer secondary listener/activity queries
- replace the global save lock with per-control optimistic saves and spinners
- persist small preference patches rather than rewriting the whole row
- avoid registering the same physical device again for every individual switch
  once iOS permission is already granted

Backend diagnosis and repair:

- staging held an active iOS push device and the expected muezzin preference
  values, but there was no explicit `staff_rota` row for the prayer
- the app's established schedule and LIVE authorization already resolve duties
  as approved/provisional cover, explicit rota, then active mosque default
  muezzin; the reminder scheduler previously stopped after explicit rota
- migration `20260904123000_muezzin_duty_reminder_assignment_fallback.sql`
  aligns reminder assignment resolution with that existing precedence and only
  inserts idempotent `notification_events`
- the first staging runtime call exposed legacy `prayer_t` enum columns being
  passed to `trim()`; the failed transaction created no events or other data
- the canonical migration was corrected for fresh databases and compatibility
  migration `20260904124500_fix_muezzin_duty_prayer_enum_cast.sql` patches the
  already-installed staging function using explicit `::text` casts
- a staging runtime RPC call then completed successfully; zero events were
  expected because the test Dhuhr had already passed

Staging build and verification:

- iOS internal preview build 6 finished successfully:
  `22179f10-de9b-4a06-8e79-178a9e31e4e1`
- bundle ID: `com.maksumsdigitalagency.adhanconnect.staging`; all three
  registered iPhones are included in the ad hoc profile
- one physical iPhone has installed build 6 and saved muezzin preferences
- `npx tsc --noEmit`, `npm run lint`,
  `npm run test:notifications:safety`, and `npm run test:live:contracts` pass
- the notification safety test now asserts cover → explicit rota → active
  default precedence and rejects notification migrations that mutate LIVE,
  stream, rota, muezzin, mosque, timetable, or subscription tables
- clean iOS export passes and the linked staging database reports no pending
  migrations
- production Supabase and the established LIVE control/media paths remain
  untouched

Remaining acceptance evidence:

- set a fresh staging prayer around 12 minutes ahead for the active default
  muezzin and confirm the configured 10- and 5-minute physical pushes arrive
- then test explicit rota and approved cover precedence, tap routing, opt-out,
  sign-out isolation, listener LIVE, current-area LIVE, and real two-device
  LiveKit audio/start/end/restart behavior
- do not promote notification work until the complete physical gate in
  `docs/mobile/push-nearby-staging-test.md` passes

Fresh test build:

- iOS internal preview build 7 finished successfully after the fixes:
  `d42e1d24-33f7-4e7f-a8ea-3ea1632a214f`
- EAS confirmed `com.maksumsdigitalagency.adhanconnect.staging`, build number 7,
  an active Push-enabled ad hoc profile, and all three registered iPhones
- stable install page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/d42e1d24-33f7-4e7f-a8ea-3ea1632a214f`
- production was not built, submitted, migrated, or changed

### 2026-09-04: Reminder multi-select and workspace transition repair

Physical feedback on build 7:

- 5/10/30-minute muezzin reminder choices could feel locked during a save and
  multiple taps could be calculated from stale render state
- the resulting staging preference row ended with only `[5]`, even though the
  user intended to configure more than one lead
- workspace selection was pushed over a nested settings route without first
  marking an explicit workspace change; notification taps could also open a
  different workspace without synchronizing the stored workspace preference

Read-only staging evidence:

- the active default-muezzin assignment produced both 10-minute and 5-minute
  Isha events
- both deliveries reached `delivered` with one attempt and no error
- this confirms assignment fallback, scheduling, dispatcher, Expo/APNs receipt,
  and device registration were healthy; the remaining issue was client state
- no 30-minute event was expected after its scheduling window had already
  passed

Client repair:

- preference mutations now read a synchronous current-state ref and serialize
  saves per field, so rapid multi-select taps cannot arrive out of order or
  overwrite a newer selection
- selected muezzin leads show checkmarks, an explicit multi-select instruction,
  selected count, and a saving message; only removal of the final remaining
  lead is prevented
- Notifications now exposes a direct workspace action for multi-workspace
  accounts and returns deterministically to the current workspace's settings
- shared listener/muezzin Settings and the Admin dashboard mark workspace
  selection as required and replace the nested route with `/role-entry`
- notification taps synchronize the preferred listener/muezzin workspace and
  replace the old workspace route before opening their destination

Verification and fresh build:

- TypeScript, lint, notification safety, protected LIVE hashes, and a clean iOS
  Expo export pass
- notification safety now reports `ordered-multi-select` and
  `synchronized-replace`
- an optional local protected-route run was not counted because Expo CLI became
  stuck in local port discovery; this was a portal-startup issue, not an app
  compile or runtime failure
- iOS internal staging preview build 8 finished successfully:
  `de7300a8-36e7-45c9-9ece-f674b53e3573`
- build page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/de7300a8-36e7-45c9-9ece-f674b53e3573`
- the profile contains all three registered iPhones; production remains
  untouched

### 2026-09-04: Local Admin loading-loop repair after notification save

Physical build-8 reproduction:

- Muezzin → Settings → Notifications → save a preference → Switch workspace →
  Local Admin could remain forever on `app/(admin)/index.tsx`'s “Loading…” state
- static review found the admin dashboard started a second admin-mosque access
  chain containing raw Supabase auth and Postgrest calls immediately after the
  notification write
- the dashboard also redirected a transient muezzin-only result from its own
  independent role hook, even though RootNavigator had already authorised the
  admin route

Repair:

- the protected Admin layout and dashboard reuse RootNavigator's resolved
  session-access cache, keeping role flags consistent during the transition
- the dashboard seeds `useAdminMosque` from the already-verified
  `adminMosques` payload and does not start another Supabase auth/query chain
- the legacy fallback receives the mounted session, has a 10-second absolute
  deadline, and aborts its Postgrest reads when that deadline expires
- the transient `isMuezzin && !isAdmin` redirect was removed; a 12-second
  recovery screen now offers Retry and Choose workspace instead of an
  unbounded spinner
- pull-to-refresh now performs a fresh authoritative access check

Verification:

- `npx tsc --noEmit`, `npm run lint`, clean iOS Expo export, and
  `npm run test:notifications:safety` pass
- the safety contract now reports
  `adminWorkspaceEntry: cached-authority-bounded-fallback`
- all 18 protected LIVE/broadcast/assignment/rota/listener file hashes remain
  unchanged; production was not touched

Fresh staging build:

- iOS internal preview build 9 finished successfully:
  `ce64a3bf-f83d-4c3d-bfdf-5fb05eed5fef`
- EAS confirmed build number 9, staging bundle identifier
  `com.maksumsdigitalagency.adhanconnect.staging`, active signing credentials,
  and all three registered iPhones in the profile
- install page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/ce64a3bf-f83d-4c3d-bfdf-5fb05eed5fef`
- a signed IPA range-download check returned HTTP 206 successfully; production
  was not built, submitted, or changed

### 2026-09-05: Full notification-system review after build-9 device failure

Physical evidence showed the previous targeted fixes were insufficient: the
Muezzin Notifications device card and preference page could still wait
indefinitely. The review was expanded across native permission/token setup,
preference transport, save ordering, dispatcher freshness, workspace routing,
and the product role model.

Implemented:

- a bounded, session-scoped notification Supabase client that uses the mounted
  access token instead of reacquiring the shared auth lock
- independent device and preference state with explicit Retry/error outcomes
- single-flight Expo device registration with a short successful-registration
  cache
- absolute deadlines for network, Expo, SecureStore, notification permission,
  location permission, GPS, and reverse-geocoding operations
- ref-based, per-field queued preference saves so rapid 5/10/30 multi-select
  updates remain ordered and persist the intended set
- workspace-specific notification UX: personal Listener controls only in
  Listener; operational duty controls only in Muezzin
- removal of deceptive Admin push switches that had no backend consumer
- an additive role model where every authenticated person retains Listener and
  Admin/Muezzin are separate operational workspaces
- a genuinely independent Listener route for staff accounts; it no longer
  substitutes a served Muezzin mosque or suppresses travel/nearby features
- separate Admin and Listener default-mosque storage, with Listener primary
  notification persistence moved onto the bounded session transport
- cached, consistent workspace authority and bounded Admin recovery after a
  notification save
- serialized local file mutations so concurrent workspace-choice writes cannot
  overwrite each other or restore stale navigation state
- atomic travel region/preference RPCs, strict preference constraints, stale
  outbox expiry, and bounded Expo dispatcher calls

Deployed to staging only:

- migration `20260904231500_notification_preferences_reliability.sql`
- updated `push-dispatch` Edge Function
- service-only dispatcher smoke passed
- aggregate audit: 1 active granted iOS device, 1 valid preference row, 2 recent
  Muezzin duty events, 2 delivered, 0 old pending, 0 errors

Final automated evidence:

- TypeScript, lint, diff check, and notification safety contracts pass
- all 18 protected LIVE/broadcast/rota file hashes remain unchanged
- fresh iOS production bundle export passes
- local staging LIVE contract passes all five page checks, nine authorization
  guards, invalid-request fail-closed checks, and reports zero production
  mutations

Build 9 does not contain this comprehensive repair. A fresh staging build and
the physical acceptance matrix in
`docs/claude-code-handoff-2026-09-04.md` are still required. Production was not
built, migrated, submitted, or otherwise changed.

### 2026-09-05: Main-admin web login false access failure

- A staging owner/main-admin login reached RootNavigator's fail-closed account
  access screen.
- Read-only inspection confirmed a verified Auth user, complete current consent
  metadata and immutable receipt, and a valid `main_admin` profile. No account
  repair or role mutation was needed.
- `/api/session-access` was embedding the entire 1,115-row staging mosque
  directory in the authorization response while web requests had a 1.5-second
  deadline. Cold route compilation plus Auth/consent/role queries could exceed
  that deadline and turn a healthy account into an apparent access failure.
- The route now returns only authority and explicit membership context. Global
  main-admin mosque pages continue to fetch/paginate their own directory.
- The session-access client now uses a dedicated bounded 10-second deadline.
- TypeScript, lint, diff validation, notification safety, and LIVE regression
  contracts pass; zero production mutations occurred.
- The corrected staging portal was restarted on port 8081 for user acceptance.

### 2026-09-05: Direct email-to-password sign-in UX

- Removed the redundant post-email “Sign in / Create account” choice.
- Continue now advances every valid email directly to password entry.
- Account creation remains a quiet link on the initial email screen; it is not
  shown after an existing user presses Continue.
- No identifier lookup was introduced, preserving account-enumeration
  resistance and neutral sign-in errors.
- Password reset and change-email actions remain on the password step.
- TypeScript, lint, diff validation, and a clean iOS export pass.

### 2026-09-05: Internal iOS staging preview build 10

- EAS build `b252f7a6-b1ef-4052-ab26-87b655a34c47` finished successfully.
- EAS confirmed app build version 10, internal `preview` distribution, and
  staging bundle identifier `com.maksumsdigitalagency.adhanconnect.staging`.
- The active ad hoc profile includes all three registered physical iPhones.
- Install/status page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/b252f7a6-b1ef-4052-ab26-87b655a34c47`
- This is the replacement for build 9 and includes the comprehensive
  notification/workspace repair, main-admin session-access correction, and
  direct email-to-password sign-in UX.
- The physical notification and two-device LIVE acceptance matrix remains
  mandatory. Production was not built, submitted, configured, or changed.

### 2026-09-05: Three-minute LIVE reminder and staging content API recovery

- Physical testing proved that the 5-minute Muezzin duty push arrives, but its
  old broadcast destination appeared before the established three-minute LIVE
  start window.
- Added a distinct 3-minute choice alongside 5/10/30. Earlier alerts now open
  My Rota for preparation; the 3-minute alert opens the existing LIVE screen
  and leaves every existing broadcast/assignment guard intact.
- Added and deployed staging-only migration
  `20260905103000_muezzin_three_minute_live_window.sql`. It changes only
  notification preferences and notification-event copy/routing; no production
  migration or LIVE/stream/rota mutation occurred.
- Investigated simultaneous Quran and Daily Reflection 404s on physical
  devices. All affected requests returned the same EAS Hosting HTML 404, while
  live Quran Foundation metadata/audio endpoints remained healthy. Daily
  Reflection is internal curated content and does not depend on Quran.com.
- Exported the complete current server route set and created hosting deployment
  `9cuik64wko`. Reassigned only the existing `preview` alias; the production
  alias remains on `b5blckazxb`.
- The exact preview alias now passes all Quran chapter/reciter/ayah/full-surah
  tests, direct Quran CDN byte-range checks, five prayer-dua filters, and eight
  reflection categories. Already-installed build 10 receives this server-side
  repair after reopen/Retry.
- TypeScript, lint, notification safety contracts, iOS export, staging LIVE
  regression contracts, and the staging notification audit pass. All 18
  protected LIVE/broadcast/assignment/rota source hashes remain unchanged and
  the regression smoke reports zero production mutations.
- After explicit private-source upload approval, EAS internal iOS preview build
  11 (`034cc7a5-8a8a-43a9-9dd7-238d78dfc467`) finished successfully with
  staging bundle identifier `com.maksumsdigitalagency.adhanconnect.staging`.
  Its active ad hoc profile covers all three registered iPhones. Install page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/034cc7a5-8a8a-43a9-9dd7-238d78dfc467`.
- Build 11 supersedes build 10 for notification acceptance. Production was not
  built, submitted, configured, migrated, or changed.

### 2026-09-05: Guidance hub and compact nearby-home hierarchy

- Consolidated Qur’an and Daily Reflection beneath a new `Guidance` tab,
  reducing the Listener bottom bar to Home, Guidance, Mosques and Settings.
- Added a calm, scalable two-column Guidance hub with working Qur’an and Daily
  Reflection cards plus an honest non-interactive Knowledge Centre `Coming
  soon` card.
- Added nested Guidance routes while retaining the existing `/quran` and
  `/duas` modules for compatibility. Nested reading pages include an explicit
  return to Guidance.
- Replaced the four-card nearby directory that previously displaced the Home
  prayer hero with a compact one-result summary below the primary next-prayer
  and prayer strip. A nearby LIVE result remains one tap from listening.
- Moved the full nearby list into the existing Mosques tab and added Nearby and
  Following modes alongside search, directions and mosque details. No sixth tab
  or duplicate nearby destination was introduced.
- Retained more prominent nearby suggestions for a first-run listener who has
  not yet followed a mosque, capped at three results.
- TypeScript, lint, diff validation, clean iOS/web exports and notification
  safety contracts pass. All 18 protected LIVE/broadcast/assignment/rota files
  remain unchanged.
- Build 11 predates this navigation redesign. A fresh internal staging build is
  required before physical acceptance; production remains untouched.

### 2026-09-05: Internal iOS staging preview build 12

- EAS build `25a4cf65-5506-4253-9f4c-7723d73bdb22` finished successfully as
  app build version 12, internal `preview` distribution, with staging bundle
  identifier `com.maksumsdigitalagency.adhanconnect.staging`.
- The active ad hoc profile includes all three registered physical iPhones.
- Install/status page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/25a4cf65-5506-4253-9f4c-7723d73bdb22`
- Build 12 contains the four-tab Guidance/Mosques navigation and compact
  nearby-home hierarchy. Production was not built, submitted or changed.

### 2026-09-05: Guidance hub visual and interaction polish

- Removed the large non-actionable intro panel and the fragile wrapping grid
  after physical review showed excessive vertical space, awkward text wrapping
  and overlap around the Knowledge Centre card.
- Rebuilt Qur’an and Daily Reflection as equal, complete-card actions with
  calmer gradients, concise copy, clear Open affordances and subtle selection
  haptics. Responsive behavior stacks the cards on narrow screens or when the
  system accessibility font scale is above 1.2.
- Moved Knowledge Centre into its own full-width future-content module with a
  non-interactive Coming Soon state and explicit accessibility semantics.
- TypeScript, Expo lint, diff validation, a clean iOS export, and notification
  safety contracts pass. All 18 protected LIVE/broadcast/assignment/rota files
  remain unchanged. Build 12 predates this visual follow-up, so physical review
  requires a later build.

### 2026-09-05: Internal iOS staging preview build 13

- EAS build `819b8e41-1e38-4f13-89e2-a4847abf102e` finished successfully as
  app build version 13, internal `preview` distribution, with staging bundle
  identifier `com.maksumsdigitalagency.adhanconnect.staging`.
- The active ad hoc profile includes all three registered physical iPhones.
- Install/status page:
  `https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/819b8e41-1e38-4f13-89e2-a4847abf102e`
- Build 13 supersedes build 12 for physical Guidance-page visual acceptance.
  Production was not built, submitted or changed.

### 2026-09-05: Claude Code — Event/Campaign/Notice cover images and document attachments

Problem:

- the user showed real WhatsApp announcements from a nearby mosque (flyer
  images, formatted schedules) and asked whether the Local Admin Content hub
  should support the same; `events`/`announcements` had no media columns,
  `campaigns.cover_image_url` existed but was never wired into any code path,
  and no Supabase Storage bucket existed anywhere in the app

Root cause:

- genuinely missing capability, not a bug — confirmed via full codebase
  research before planning

Files changed (new):

- `supabase/migrations/20260905150000_content_attachments.sql`
- `lib/api/admin/contentAttachments.ts`
- `components/admin/ContentAttachmentsEditor.tsx`
- `components/ContentDetailHero.tsx`
- `components/ContentDocumentsList.tsx`

Files changed (modified):

- `screens/admin/event/[id].tsx`, `screens/admin/campaign/[id].tsx`,
  `screens/admin/announcement/[id].tsx`
- `screens/user/event/[id].tsx`, `screens/user/campaign/[id].tsx`
- `screens/user/mosque/[id].tsx`, `screens/user/index.tsx`
- `app.json`, `package.json` (new dependency `expo-image-picker`)

Fix:

- new `content_attachments` table + public `content-media` Storage bucket on
  **staging only**, RLS mirrored exactly from the existing
  `is_main_admin()`/`is_local_admin_for_mosque()` pattern in
  `20260516090000_content_management_columns.sql`; storage object policies
  derive the owning mosque from the object path
  (`{mosque_id}/{content_type}/{content_id}/{file}`)
- admin editors gained a Cover Image/Attachments section, deliberately placed
  at the **bottom** of each form (after user feedback that inserting it
  mid-form pushed core fields down and made editing harder); description
  `maxLength` raised 1000 → 4000 with a visible counter
- listener event/campaign detail pages rebuilt around a new
  `ContentDetailHero` that measures the real image aspect ratio on load and
  sizes itself to match (no more forced cropping of portrait flyer posters),
  shows the item's own title on a gradient placeholder when no image exists,
  and keeps back/share buttons inside a `useSafeAreaInsets()`-aware overlay
  with a permanent scrim so they stay legible and correctly positioned
  regardless of image content or device notch
- mosque-page and Home "What's On" list rows gained cover-image thumbnails
  and switched from 1-line ellipsis truncation to 2-line wrap with
  `adjustsFontSizeToFit`/`minimumFontScale` shrink-to-fit for long titles
- explicitly deferred by user decision: no notification-on-publish trigger
  this pass (avoids touching the just-stabilized notification system), no
  multi-image gallery, no structured schedule fields

Verification:

- `npx tsc --noEmit`, `npm run lint`,
  `node ./scripts/test-notification-safety-contracts.js` (all 18 protected
  LIVE/broadcast/rota/listener files unchanged) before every build
- clean `npx expo export --platform web`
- staging migration verified live post-deploy via REST/Storage API: table
  readable, bucket exists and is public, anon object-level reads return 200
- two rounds of real physical-device feedback from the user, each fully
  addressed before the next build (see `docs/claude-code-handoff-2026-09-05.md`
  for the itemized list)

Staging build/billing:

- builds 14 (`c1334348-e3fc-4ada-ae0b-f452d99b123f`) and 15
  (`18617a44-dc1c-42a3-8ce1-a24eeead5571`) succeeded normally
- build 16 failed: the EAS account had exhausted its Free-plan monthly iOS
  build allowance; advised against creating a second Expo account to work
  around this (likely a ToS violation, and would not solve anything anyway
  since Apple Distribution Certificate/Provisioning Profile credentials and
  the three registered test-iPhone UDIDs are tied to the Apple Developer
  Team, not the Expo account) — `eas build --local` was also checked and
  found unavailable on this Mac (Xcode Command Line Tools only, no full
  Xcode.app, no CocoaPods/fastlane)
- the user upgraded the EAS plan directly; build 17
  (`24db4f89-e966-4bd3-af37-11ecd77ec905`) then succeeded with Round 2's
  fixes — this is the current build; build 16's failed attempt still
  incremented the remote build-number counter, so numbering skips from 15 to
  17

Residual risk / follow-up:

- notification-on-publish for new events/campaigns remains unimplemented —
  a real gap if the product intent is for followers to be alerted
  automatically, not just able to discover new content
- build 17 has not yet been re-confirmed by the user on a physical device as
  of this entry
- production Supabase and all 18 protected LIVE/broadcast/rota files were
  not touched at any point in this work


## 2026-09-06 — Mosque About staging deployment (Codex)

Deployed the current staging server/web export to the EAS `preview` alias,
deployment `jz92ipqnks`, using the explicit preview environment. Verified local
public Supabase configuration targets staging before exporting.

Corrected the native OTA claim in the Claude handoff: the actual build-17 IPA
has `EXUpdatesEnabled: false`, and the project lacks OTA configuration and
`expo-updates`. No EAS Update was published. The user authorized a replacement
iOS build; staging preview build **18** completed successfully:
https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/849ce6d8-5162-4166-9944-03a700429bbc

Validation: TypeScript, lint, fresh web export, export secret scan, notification
safety contracts, and deployed LIVE/Quran/devotional smokes passed. Staging
anonymous profile reads verified the new columns and Guidance Centre seed;
mosque pages returned 200 and the protected workspace API rejected missing auth.
Browser visual verification was unavailable. Physical-device acceptance remains
outstanding. Production and the deferred migration/column cleanup were untouched.


## 2026-09-06 — Services and homepage Friday strip release (Codex)

Following user authorization, deployed both accumulated changes to EAS preview
`0qmhx0zeeo` and completed staging iOS build **19**
(`c7fec1e9-be0f-46ab-b617-efb16c6d0148`). This includes the off-site Jumu’ah
service option, daily congregation labels derived from prayer exclusions, and
the primary mosque’s Friday slots/venues between Next Prayer and Today.

TypeScript, lint, notification safety, fresh web export and secret scan passed.
Deployed LIVE/Quran/devotional smokes passed. Homepage, mosque and Friday routes
returned 200, and the deployed JS bundle includes both changes. Physical-device
visual and tap acceptance remains pending. Production was unchanged.


## 2026-09-07 — Build 19 feedback

Implemented the five requested improvements: clearer Friday strip, Today and
Next Prayer availability-aware display, Nearby at the homepage bottom, explicit
hours/minutes countdown, and event attendance/likes/favourites with mosque-scoped
local-admin event and Jumu’ah capacity summaries. See
`docs/claude-code-handoff-2026-09-07.md` for details, migration status and tests.

The event migrations are applied to staging; local PostgreSQL concurrency/privacy
tests and a temporary-fixture authenticated staging smoke passed. All staging
fixtures were removed. UI awaits a new deployment/build; production unchanged.


## 2026-09-07 — Staging iOS build 20

Completed the user-requested testing build with all five build-19 feedback changes:
https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/23872dc3-fa2a-4d32-8f48-64a8d8bff21d

TypeScript, lint, notification safety, fresh web export and secret scan passed.
The database changes and authenticated staging smoke had already passed.
Web preview remains `0qmhx0zeeo`: automatic approval review rejected the attempted
web/server upload because the latest request authorized an iOS test build.
No new server routes are required for build 20. Production is unchanged.
Physical-device visual and interaction acceptance remains outstanding.

## 2026-09-20 — Private cloud adhan preparation (feature branch only)

Implemented the first cloud-recorded-adhan milestone on
`feature/cloud-recorded-adhan` in an isolated worktree: off-by-default local-admin
setup, private signed uploads/previews, optional Fajr audio, draft modes/prayers,
main-admin catalogue (up to five), archive protections and audit history.
Draft settings cannot activate broadcasts. The additive migration introduces no
live triggers or scheduled jobs. Existing live, rota, assignment, prayer and
listener implementations are unchanged; no shared backend, build or deployment
was modified.

Typecheck, lint (six existing warnings), service rules, new API/audio validation,
local PostgreSQL permission/concurrency/deletion tests and web export passed.
Existing live route/access contracts passed against localhost placeholders.
All 18 protected live/rota files match staging `520b83d`; the historical notification
safety script has three pre-existing stale hashes, documented in the handoff.
Browser connection was unavailable; visual review, real Supabase storage round-trip
and physical device/audio canaries remain outstanding. Metadata validation does not
replace listening/decoding checks. Full scheduling, arbitration and listener support
are subsequent milestones, not delivered by this checkpoint.

The user requested a Claude handoff before credits run out. Full requirements,
branch/worktree safety, implementation, validation evidence and remaining work are
in `docs/claude-handoff-cloud-recorded-adhan-2026-09-20.md`, also copied into the
original checkout without touching its unrelated changes.

## 2026-09-20 — Recording schedule preview and decision core

Continued after the user explicitly requested it. Added a read-only two-day
preview of saved recording settings and the mosque's existing prayer times,
with unavailable-prayer, missing-time/audio, timezone/date and Fajr handling.
The existing legacy/calculated fallback assumes London; new automation candidates
outside London therefore require matching explicit canonical timestamps.
No existing prayer resolver was changed or adjustments applied twice.

Added a private service-only delivery occurrence/transaction core, with stable
mosque/date/prayer identity, immutable winners, CAS plan revisions, confirmed
live before a fixed 10-second deadline, recorded-only without a grace period,
late-job expiry, cancellation and snapshot/archive protection. Core tests exercise
concurrent workers and early/late live evidence in a disposable local database.
No scheduler, provider readiness bridge, live guard, notification or listener
consumer is installed. Runtime activation must remain separate from draft settings;
these are foundations and preview functionality, not active broadcasts.

The full Claude handoff lists the new files, contracts, checks and remaining
integration boundary. Staging/backup refs remain at `520b83d`; the first feature
checkpoint `c224823` passed GitHub CI and web/iOS/Android bundle exports.

## 2026-09-21 — Simplified recording setup after review

The user accepted Live only or Scheduled recording only for the first release,
deferring automatic live fallback, and authorized a short work session before
resuming in the evening. Removed the hybrid picker option and premature playback
activation controls; kept uploads, previews and preparation settings. The API now
blocks activation and hybrid preparation even for older clients, and refuses
draft saves consumed by an active earlier scheduling test. Existing recovery
deactivation remains accessible to authorized admins. Added focused API tests.

This is a setup checkpoint, not a scheduler lifecycle repair or a working listener
playback release. The independent review's R1–R4 remain open. The next milestone
is safe effective configuration and scheduling for recording-only, not hybrid
publisher-readiness/fallback integration. No shared deployment, SQL migration,
native build or existing live/rota/prayer implementation changed. The full handoff
records the accepted scope and continuation steps.
