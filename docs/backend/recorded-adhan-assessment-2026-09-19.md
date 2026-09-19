# Recorded adhan and live fallback assessment — 19 September 2026

This is an assessment of the repository and published platform documentation, not an implementation or an audit of the deployed database. The user confirmed that the mosque's local admin selects the recording, including selections from the five-item worldwide catalogue. Listeners retain control over whether their own phone plays audio.

The current direction is cloud-managed recordings, prayer scheduling and live/fallback decisions, with online playback and no listener download feature, persistent offline audio library or device-scheduled audio alarms. Ordinary temporary streaming buffers are still necessary. The local admin manages the content; listeners receive one playback experience without managing files.

This is a simpler design to operate and keeps source selection consistent for connected listeners. It removes download/version synchronisation and local-alarm cancellation work. It does not improve offline availability or guarantee that a closed listener app starts audio. The initial experience is foreground autoplay where enabled and supported, continued background listening where verified, and a notification with tap-to-listen when the app is closed. Notification timing and delivery remain subject to the operating system.

The requirement is feasible as a staged feature. Scheduled recordings are a moderate extension; coordination with live broadcasts is more involved. This assessment does not treat returning to cloud delivery as acceptance of reduced autoplay behaviour: the closed-app limitation remains an explicit product boundary to resolve before promising full automatic playback.

| Mosque mode | Behaviour for an enabled prayer at time T | Staff requirement |
| --- | --- | --- |
| Live only | Existing live broadcast behaviour. No automatic recording. | Existing assignment, cover and live readiness rules. |
| Recorded only | Schedule the selected recording at T, with no intentional grace delay. | No digital broadcast duty or active muezzin account required. |
| Live with recording fallback | Use a qualifying live session; otherwise start the selected recording at T + 10 seconds. | Keep existing assignments and cover, with a visible fallback deadline. |

Use 10 seconds as a fixed initial fallback delay. A later release can offer 5 or 10 seconds if needed. A pause control is separate from these modes. “At T” means the intended start time: device scheduling, network delivery and audio buffering still affect the audible start.

Each recording-enabled mosque chooses either an uploaded staff recording or one of five centrally managed recordings. Both use the same playback path. Catalogue selection is not a fourth broadcast mode. Provide a separate Fajr selection where needed and have the mosque approve the recording used for each prayer.

The following findings materially affect the design:

| Existing area | Evidence in the repository | Consequence |
| --- | --- | --- |
| Recording foundation | [Genesis schema](../../supabase/migrations/20251206000000_genesis_core_schema.sql) includes `recorded_adhans` with mosque, title, storage path, duration, creator and visibility; `adhans` has `recording_url` and `source` restricted to `live` or `recording`. | Extend the existing foundation after inspecting deployed data. It does not demonstrate a functioning recorded-adhan feature. No matching end-to-end recording flow was found in the app. |
| Live lifecycle | [Broadcast API](../../app/api/muezzin/live-broadcast+api.ts), [START transaction](../../supabase/migrations/20260721120000_transactional_live_broadcast_start.sql), [END transaction](../../supabase/migrations/20260721213000_transactional_live_broadcast_end.sql). Transactional paths are enabled by deployment settings, with a legacy path still present. | Hybrid mode must coordinate with every enabled start path. A scheduler that checks `is_live` and then plays a file can race a muezzin starting live. |
| Live window | [Broadcast engine](../../lib/hooks/useLiveBroadcastEngine.ts) and server allow starts from T − 3 minutes to T + 2 minutes. | A fallback at T + 10 seconds creates a new operational deadline. Once recording wins, an otherwise valid late live start must not create a second adhan. |
| Staff authorization | Broadcast API checks explicit assignment, active default muezzin for a blank rota slot, approved/provisional cover, or mosque admin override. | Preserve those permissions for live starts. Older documentation saying rota is informational is no longer sufficient. |
| Microphone startup | [Muezzin screen](../../screens/muezzin/live-broadcast.tsx) commits backend start before connecting the LiveKit microphone; it tries to end the backend session if connection fails. | Database live state alone does not prove a publisher is ready. Define a bounded connecting state before using it to suppress fallback. |
| Listener audio | [Current player](../../screens/user/now.tsx) uses LiveKit on demand and can automatically start external-provider audio while the screen is mounted. | This is not a phone-wide prayer-time autoplay service. Recording playback needs an explicit source type and app-level audio coordination. |
| Notifications | [Notification runtime](../../components/NotificationRuntime.tsx) handles navigation on response; [push dispatcher](../../supabase/functions/push-dispatch/index.ts) sends default sounds. [Cron configuration](../../supabase/migrations/20260903143000_notification_dispatch_schedule.sql) runs scheduled dispatch every minute, with a separate immediate wake for live events. | Existing scheduled push dispatch cannot provide a 5–10-second fallback deadline. A push is also not an instruction that guarantees full audio playback. |
| Live classification | [Live notification trigger](../../supabase/migrations/20260903120000_push_notifications_travel_nearby.sql) fires on `adhans.status = 'live'` without checking `source`. Live lists and freshness checks also use live status/stream fields. | Merely inserting `source='recording', status='live'` would produce misleading live alerts and potentially enter live-specific flows. |
| Prayer times | [Daily API](../../app/api/prayer-times-daily+api.ts) and [shared helper](../../lib/api/prayerTimesUnified.ts) resolve canonical, legacy, rota, calculated/ELM times and adjustments. | The scheduler must consume the mosque's resolved adhan time, including automatic sources, not just rows in `prayer_times`. |
| Timing discrepancies | [Duty reminder SQL](../../supabase/migrations/20260904123000_muezzin_duty_reminder_assignment_fallback.sql) prefers rota time over canonical time for duties; live authorization prefers canonical time. Some date handling uses UTC dates and some bare-time conversion is London-specific. | Agree one effective prayer occurrence and mosque-local date before automating it. Global recording choices do not by themselves require global mosque scheduling, but non-London rollout needs timezone verification. |
| Readiness | [Readiness service](../../lib/server/broadcastReadiness.ts) requires active staff, coverage, provider configuration and a dormant stream. [Onboarding](../admin/live-broadcast-onboarding.md) reserves provisioning and milestones for main admins. | Recorded-only mosques need a distinct readiness path without microphone, LiveKit or rota prerequisites. |

The proposed impact on staff, prayer times and administrators is as follows:

| Area | Recommended behaviour |
| --- | --- |
| Rota and staff assignments | Keep staff accounts, rota records and cover history. Recorded-only slots display “Automatic recording” and require no digital broadcast assignment. Preserve any physical mosque duty; a recording is not evidence that a member of staff attended or performed a duty. |
| Staff reminders | Suppress “Go live” reminders and broadcast-cover prompts for recorded-only slots. Retain genuine staff assignment updates where staff duties remain. Hybrid reminders should show the fallback deadline. |
| Attendance and reporting | Record “Live”, “Scheduled recording”, “Fallback used”, “Cancelled” or “Failed” as delivery outcomes. Do not count a recording as a successful human broadcast or automatically mark someone absent because fallback was used. |
| Prayer timing | Use adhan/beginning time, not iqamah. Reuse manual/imported schedules, source selection, school and applicable adjustments. Do not apply adjustments twice. |
| Timetable changes | Rebuild pending cloud occurrences when timings, timezone, source, adjustment, availability or audio settings change. Cancel stale jobs and queued alerts. Changes must not create another adhan for an occurrence already started. |
| Missing times and unavailable prayers | Distinguish missing data from a prayer not offered at the mosque. Block automatic scheduling when timing is unresolved and show the admin the reason. Initially disable automatic audio for `prayers_not_offered`; any digital-only exception should be an explicit future option. Existing time helpers can fill nulls, so a null check is insufficient. |
| Friday and additional events | Limit the first release to the five daily prayer slots. Preserve existing Jumu'ah features and do not automatically add a second Friday adhan or turn iqamah events into adhans. |
| Local admins | Add mosque-scoped “Adhan audio” settings. Enforce server-side access using the current mosque-admin membership checks, including for upload, preview, selection and cancellation. The recording belongs to the mosque even when the admin changes. |
| Main admins | Manage the shared catalogue, feature rollout and operational visibility. Preserve existing authority over live provisioning and public mosque approval. Local audio selection must not activate a pending mosque publicly. |
| Listener preferences | Keep prayer selection, mute and notification permissions. Add a separate opt-in for automatic audio; existing notification consent is not automatic-audio consent. Initially use one primary mosque for autoplay to avoid simultaneous adhans from followed mosques. |

Local admin settings should remain small:

1. Mosque name and audio mode: Live only / Recorded only / Live with fallback.
2. Recording source: mosque upload / shared catalogue, with title, reciter, duration and preview.
3. Default recording and an optional Fajr recording.
4. Enabled prayers and a temporary pause. Initially the mode applies mosque-wide; mixed per-prayer live/recorded modes can wait.
5. For hybrid mode, a clear explanation of the fixed 10-second deadline and late-start behaviour.
6. A preview of the next scheduled plays in the mosque's timezone, plus recent delivery outcomes and failures.

An admin preview plays only on that admin's device. Changing mode or recording affects future occurrences; reject or defer a change during an active occurrence. Validate a playable asset and resolved upcoming timings before enabling recordings. Start with file upload and preview; an in-app recording studio can be added later.

The scheduling design needs one authoritative decision for each `(mosque, mosque-local date, prayer)` occurrence. A separate delivery record can hold the UTC scheduled time, timetable/settings version, selected recording version, chosen source, actual start/end, reason and links to existing live adhan/stream rows. Its uniqueness must survive a timetable edit; the scheduled timestamp alone is a poor identity because changing it could create another play.

Use an additive delivery table/state rather than immediately broadening the meaning of the existing live status. Keep `streams.is_live` for live transport. Expose a source-aware playback response so the listener opens LiveKit for live audio and streams a cloud-hosted audio file for recordings. Existing `adhans` recording fields may support history, but their readers and triggers need deliberate adaptation before they are used for active playback.

The first hybrid state rules should be deterministic:

1. Resolve the occurrence in advance and snapshot its mode and recording. Recorded-only has a due time of T; hybrid has a fallback due time of T + 10 seconds.
2. Live start and fallback selection acquire the same database lock/claim. An authenticated live attempt enters a bounded connecting state; server-verified publisher/track presence can confirm readiness. This confirms transport, not that the recitation is audible or correct.
3. At the hybrid deadline, suppress fallback if a qualifying live session has started for that occurrence, including one that started early and already completed. A stale stream for a different prayer or an unconfirmed microphone attempt must not suppress it.
4. Otherwise claim recorded playback once. Reject competing live starts, including retries and stale microphone connections, with “The automatic adhan has started.” Ensure publisher token/connection paths also honour the winning source. An admin may stop the session; automatic handover to live is deferred.
5. Once genuine live delivery has begun, a later disconnect does not trigger a second full adhan in the first release. Mid-broadcast rescue requires a separate policy and testing.
6. Emit one logical start event with a stable occurrence ID. Make retries, duplicate pushes, reconnects and multiple scheduler workers harmless. Expire late automatic-start events rather than suddenly playing an old adhan.

This deliberately preserves the existing live-only time window while changing the practical deadline for opted-in hybrid mosques. If hybrid is enabled, keep its starts on the coordinated transactional path; an unmodified legacy route must not bypass the claim. Existing live-only mosques should retain their established behaviour throughout rollout.

A durable scheduler with execution measured in seconds is needed for hybrid mode. Prepare jobs ahead of time; do not sleep inside an ordinary API request or depend on the muezzin leaving the app open. A worker restart must recover pending jobs without replaying expired occurrences. Measure server decision delay separately from device notification and audio-start delay. Prepare and validate assets in cloud storage/CDN before their scheduled use. Exact simultaneous audio on every phone is not a credible guarantee.

Cloud file playback is the simplest initial transport. It does not require a simulated LiveKit broadcaster or a continuously running audio stream. The scheduler publishes an authoritative session with its start/end time and recording URL; listeners retrieve audio while listening. A late listener can join at the elapsed position, with an explicit replay action if desired. Keep one device audio owner so recording, live adhan, Quran audio and admin preview cannot play over each other. A listener's Stop action should suppress automatic restarting for that occurrence.

Streaming requires internet access and incurs ongoing audio delivery bandwidth. Use bounded retries and show connection errors; do not turn a listener's connection failure into a new mosque-wide fallback decision. Monitor the scheduler, asset availability and duplicate-event prevention. A cloud session starting successfully is not confirmation that every phone played it: report server outcomes, notification delivery and observed player starts separately.

The existing `recorded_adhans.mosque_id` is non-null, so a global catalogue should have its own small asset table or a carefully designed shared ownership model. Do not invent a fake mosque for catalogue assets. Catalogue records need a verified source, reciter/display information, duration, prayer suitability and permission to distribute/cache that recording. Select the actual five recordings after that review; a famous recording being publicly available does not establish permission to redistribute it.

Uploads need size/format/duration validation, a playback-ready version and consistent volume. Keep the selected version immutable for an active occurrence. A replacement should become selectable only after validation succeeds. Prevent deleting a selected asset until it is replaced or scheduling is disabled. Check both table policies and storage policies: the schema contains existing permissive read policies, so adding a narrower policy alone would not establish private draft access. A staff departure need not remove the audio automatically; the mosque should retain a clear withdrawal/replacement process.

The listener experience for the cloud-only direction is:

| Phone/app state | Assessment and initial product promise |
| --- | --- |
| App open and active | Full recording playback is feasible with listener opt-in, a resolved cloud occurrence, internet access and a ready asset. Implement and test the scheduler listener and audio coordinator. |
| Audio already playing, then phone locks | Continuing an established audio session is a different case from starting a new session. Existing background audio configuration is useful, but needs physical-device verification. |
| iOS app suspended or closed, using ordinary notifications | Offer a scheduled alert and tap to listen. Apple's ordinary custom notification sounds must be under 30 seconds; silent background pushes are not guaranteed. Do not promise a complete adhan at an exact time through this mechanism. [Apple notification sounds](https://developer.apple.com/documentation/usernotifications/unnotificationsound), [Apple background updates](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app). |
| Android app in background or closed | Use notifications and tap-to-listen for the initial release. Notification presentation does not itself guarantee playback; Android force-stop requires reopening the app before notifications work again. [Expo notification behaviour](https://docs.expo.dev/push-notifications/what-you-need-to-know/). |
| Phone offline | No new streamed adhan playback. Show a connection message when the listener opens the app. Do not play an expired adhan automatically when connectivity returns. |

The project uses Expo SDK 54. Its notification plugin currently has no custom sound assets configured. Use the existing generic alert sound followed by streamed playback for this direction. Custom recorded notification sounds and native alarm playback are outside this scope. [Expo SDK 54 notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/).

All live-versus-recorded decisions occur in the cloud. Phones never interpret a missed push or a failed connection as evidence that the muezzin did not start. On notification tap or reconnect, fetch current session state and check its expiry before playing. The earlier local-download/native-alarm alternative is deferred; it is not required to deliver this online experience.

Recommended delivery sequence:

| Stage | Scope | Relative complexity and exit condition |
| --- | --- | --- |
| Feasibility prototype | Physical iPhone/Android tests for online playback, continuing playback after screen lock, and notification-to-player navigation from closed apps; confirm schedule sources and existing recording data/storage. | Time-boxed investigation. Verify the stated online experience; do not promise automatic starts from closed apps. |
| Initial release | Live-only behaviour plus recorded-only mode; admin upload or catalogue selection; default/Fajr audio; enabled prayers; timetable preview; source-labelled playback; listener opt-in; alerts and tap-to-listen when autoplay is unavailable. | Moderate, involving backend, storage, admin and listener work. This delivers the feature for mosques unable to broadcast live. |
| Hybrid release | Fixed 10-second fallback; shared transaction/claim; publisher readiness; late-start handling; notification deduplication; mode-aware staff prompts and delivery history. | Medium to high. Requires concurrency and real-device tests before enabling per mosque. |
| Later options | Mixed modes per prayer, in-app recording, more catalogue items or explicit live handover. | Separate increments based on demonstrated need. Offline downloads and native scheduled audio would require a separate scope decision. |

For a smaller first implementation, ship the catalogue before staff uploads, or ship one mosque recording per mosque before a larger catalogue. Neither shortcut removes the native-platform autoplay constraint. Avoid adding per-prayer mode overrides, arbitrary delay sliders and mid-adhan switching in the first release.

The release checks should cover these concrete cases:

- Existing live-only start/audio/end/restart, assigned/default/cover/admin access, unassigned denial and provider cleanup remain functional.
- Recorded-only scheduling works without muezzin accounts, rota or a LiveKit stream, and has no configured grace delay.
- Canonical and automatic timetable sources produce the same occurrence seen by listeners and staff; changes, DST, timezone boundaries, unavailable prayers and missing times are handled consistently.
- Hybrid live start before/at/after the deadline, backend start followed by failed mic connection, successful early completion, concurrent workers and retries produce one source per occurrence.
- A recording never generates a “mosque is live” alert or appears as a live provider stream. Duplicate reminders and expired playback events do not restart audio.
- Foreground, lock screen, background, terminated app, permissions denied, offline, asset unavailable, listener mute/stop, multiple followed mosques and other active audio have explicit expected behaviour.
- Local admins cannot read unpublished assets or modify settings for another mosque; recorded-only readiness works while live provisioning remains protected.
- Timetable or mode changes cancel pending work, while rollback pauses future automation without accidentally enabling live broadcasting or replaying an active occurrence.

The existing live contract and notification safety scripts are useful regression inputs. The notification safety script also freezes hashes of live files; intentional hybrid changes will need reviewed updates to those contracts, not simply removal of the protections. New concurrency and device checks are essential because those existing scripts cannot prove precise scheduling or audible delivery.

The feature is isolated for the upcoming mosque demonstration:

| Reference | Recorded state on 19 September 2026 |
| --- | --- |
| Feature branch | `feature/cloud-recorded-adhan`, created from staging commit `520b83da9e47d1b3a2bc019b7e91c572a69b78e7`. |
| Baseline branch | `backup/staging-before-recorded-adhan-2026-09-19`, pointing to that same pre-feature source commit. Keep it unchanged. |
| Staging checks | [CI run 35388007389](https://github.com/digimaxai/adhan-connect/actions/runs/35388007389) succeeded at `520b83d`, verified through GitHub. |
| Android build | [Staging build 35272703573](https://github.com/digimaxai/adhan-connect/actions/runs/35272703573) succeeded at `d30f936`, verified through GitHub. `520b83d` changes only documentation on top of that app code. Build success is not a fresh device test. |
| iOS build | The [18 September handoff](../claude-code-handoff-2026-09-18.md) reports a successful Xcode Cloud/TestFlight build at `d30f936`. The installed demo build and current Apple workflow configuration have not been independently verified here. |
| Hosted API | That handoff records deployment `ct1o9bkpvl` at the `preview` alias. This is a historical reference, not a live deployment verification. |

Keep the tested demo binaries and their shared staging services unchanged before the demonstration. Continue development on the feature branch in a separate checkout/worktree so existing uncommitted iOS/Xcode and authentication-review files are preserved. The baseline branch contains committed source only; it does not back up those uncommitted files, the database, secrets, storage, hosted deployment or installed binaries.

The existing build services can be reused. The Android staging workflow is manual (`workflow_dispatch`) and can be run against the chosen feature branch when ready. For iOS, select the feature branch for a manual build or use a separate Xcode Cloud workflow with controlled start conditions and tester distribution. Do not redirect the demo workflow or automatically distribute feature builds to demo devices. Apple-side start conditions and distribution settings are not represented by the local Xcode Cloud manifest and were not changed during branch setup. [GitHub manual workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [Apple workflow configuration](https://developer.apple.com/documentation/xcode/xcode-cloud-workflow-reference).

Sharing the same staging app identity and backend does not provide isolation between feature and demo builds. Before the demo, keep experimental API deployments, migrations, scheduler jobs and automated notifications away from the shared demo environment. Use local/disposable services or an isolated feature backend if backend testing cannot wait. Building a feature client against unchanged staging does not make its new server endpoints available.

After the demo, introduce automation disabled by default, enable it only for a dedicated test mosque, keep database changes additive, and provide a server-side stop control. These are proposed implementation requirements, not controls already installed. Before the first deployment, record the actual native build identifiers, API deployment, configuration and database backup/restore point. Reverting a Git commit alone will not undo applied migrations, restore data, stop scheduled jobs or replace a build on a phone. Rollback must first stop automation, then restore compatible server/client versions, handling database changes separately.

No application code, database migrations, deployed settings or live services were changed during this assessment. No physical-device playback or production database checks were performed. Effort levels above are architectural estimates, not a delivery commitment; a calendar estimate should follow the device prototype and deployed-schema check.
