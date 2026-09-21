# Independent review of Claude's recorded-adhan continuation

Reviewed by Codex on 21 September 2026. Reviewed code: `a16c8f5f3e8d14fa09300fedbec2ae2f72fc1e23`, branch `feature/cloud-recorded-adhan`. Changes examined: `eb46ede..a16c8f5`, including implementation commits `7f2aad2` and `45f4dab`. This review changes documentation only; none of the issues below has been fixed by this review.

## Recommendation

Keep the feature isolated and disabled for the demo. Claude made useful progress on local Storage verification, shared schedule resolution, SQL dispatch and explicit activation, but the activation/planning integration does not yet satisfy its own safety contract. Four important failures were reproduced beyond the existing passing tests. Resolve these before integrating listener playback or enabling automation in a shared environment.

There is no evidence in the reviewed source changes of a regression to the existing live, rota, assignment or prayer-time paths. That is narrower than a guarantee about an installed app: no physical devices or hosted deployment inventory were inspected in this review.

## Findings requiring correction

### R1 — P1: activated configuration is still the editable draft

Location: [planner lines 29–65](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/lib/server/adhanDeliveryPlanner.ts#L29), [activation schema](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/migrations/20260922000000_adhan_audio_activation.sql#L8), [admin wording](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/app/%28admin%29/adhan-audio.tsx#L215).

Activation stores a boolean and attribution, but no effective settings snapshot or revision. Every planner run reads `mosque_adhan_audio_settings` afresh. After activation, saving a different recording, mode or prayer selection therefore changes subsequent planning without another activation. This contradicts the screen's instruction that a changed draft only applies after deactivation/reactivation.

Reproduced with the real planner and its existing mocked transport: keep the activation list unchanged, change only the saved draft from recorded-only/revision 3 to hybrid/revision 4, run again. All ten planning calls use hybrid/revision 4 without any activation call. Reverting the draft to live-only makes the planner issue no calls, including no cancellation of already-planned recordings; returning the draft to recorded mode resumes planning without reactivation.

Required correction: store immutable effective configuration with an activation/configuration generation. Planning and claims must use that approved generation, independently of editable drafts. Applying a draft should be a separate explicit operation; keep active recording references protected from archival. Test edits to mode, default/Fajr audio, enabled prayers and live-only while already active.

### R2 — P1: an in-flight planner can schedule after deactivation

Location: [deactivation lines 73–83](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/migrations/20260922000000_adhan_audio_activation.sql#L73), [planner planning call](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/lib/server/adhanDeliveryPlanner.ts#L63). The existing `plan_adhan_delivery_v1` and `claim_adhan_delivery_v1` in `20260920002000_adhan_delivery_core.sql` do not check activation.

Sequence: planner reads active=true, awaits prayer-time HTTP; admin switches off and the cancellation transaction finishes; that planner then inserts a previously absent occurrence. The dispatcher can select the recording while activation is false. Cancelling rows that exist at the instant of deactivation is insufficient to fence out in-flight planning work.

Reproduced against the actual SQL RPCs in disposable PostgreSQL: deactivate, complete the stale planner's insert, let its due time arrive, then claim. Observed `active=false` and `state=recording_selected` together. This is a scheduling-state failure; there is currently no listener consumer to audibly reproduce it.

Required correction: serialize activation changes and plan/claim decisions through a consistent per-mosque locking/generation protocol. Recheck current activation and expected generation within the transaction before planning or selecting audio. A stale worker must be rejected even after off/on. Test both orderings of planner/deactivation and claim/deactivation. Preserve the existing rule for an adhan that has already started.

### R3 — P1: off/on can disable upcoming prayers for the planning horizon

Location: [deactivation cancellation](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/migrations/20260922000000_adhan_audio_activation.sql#L78), [planner existing-row handling](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/lib/server/adhanDeliveryPlanner.ts#L59), [core terminal-state rule](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/migrations/20260920002000_adhan_delivery_core.sql#L79).

The planner creates today/tomorrow's occurrences. Deactivation marks every pending one cancelled; activation only flips the mosque's boolean back on. The core intentionally never replans a cancelled occurrence with the same unique mosque/date/prayer key. Following the UI's instruction to deactivate/reactivate after editing settings can therefore suppress the remaining planned prayers through tomorrow while showing automation as on.

Reproduced against the SQL RPCs: plan tomorrow's Fajr, deactivate, activate again, replan the same future prayer. The activation row is true but the occurrence remains cancelled.

Required correction: distinguish an explicit permanent per-prayer cancellation from a temporary configuration suspension, and define how a newer activation generation restores only eligible never-started future occurrences. Preserve unique delivery identity and the no-replay guarantee for delivered, expired or explicitly cancelled prayers. Test off/on across the full two-day horizon, including already-started and manually-cancelled cases.

### R4 — P1: timetable edits can leave the old time executable

Location: [15-minute planning schedule](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/migrations/20260922001000_adhan_delivery_plan_schedule.sql#L39), [planner skips non-ready slots](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/lib/server/adhanDeliveryPlanner.ts#L56), [claim availability checks](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/migrations/20260920002000_adhan_delivery_core.sql#L155).

No timetable-write invalidation or schedule-version check connects the existing prayer-time editor to the new occurrences. For example, plan Dhuhr at 13:05 in the 13:00 run; an admin corrects it to 13:10 at 13:02; dispatch still selects the 13:05 occurrence before the next 13:15 planner run. Once the old time arrives, the core freezes it, so the later refresh cannot repair the decision. A deleted/unresolvable time can also leave an old row because skipped slots do not invalidate existing plans. Mosque inactivity/exclusion/timezone are checked, but the timetable itself is not.

Reproduced the missing claim safeguard using a disposable canonical timetable row: save a future time, plan it, move that time one hour later, claim at the old time. The actual claim RPC returns `recording_selected`.

Required correction: add a reliable timetable/configuration revision and invalidation path covering the existing write routes, imports, adjustments and applicable source changes. Stale plans must not claim. Refresh invalidated future plans promptly; a 15-minute reconciliation can remain a recovery mechanism. Test time moves forward/backward shortly before prayer, removal, source errors, adjustments, DST and mosque timezone changes. Changes to protected prayer/live paths need their established regression checks.

### R5 — P2: ten-second polling is not exact prayer-time dispatch

Location: [dispatcher schedule](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/migrations/20260921000000_adhan_delivery_dispatch_schedule.sql#L48).

The recording-only due time has no added grace, which is correct. However, an arbitrary due time is only discovered on the next ten-second tick. With ticks at :00/:10/:20 and prayer at :02, recording-only is selected at :10; hybrid's :12 deadline is selected at :20. That is eight seconds of polling delay in addition to the hybrid's ten-second grace. Database load and downstream delivery can add more. Claude's reported exact-T/exact-T+10 local observations do not establish that guarantee for other tick phases. The interval semantics are documented by [pg_cron](https://github.com/citusdata/pg_cron#cron-syntax).

Required correction: explicitly settle the acceptable server scheduling tolerance against the original requirement. If recorded-only must be close to T, reduce/align the dispatch interval or use an appropriate deadline mechanism, then measure different phases and load. Keep server selection latency separate from phone playback latency. A scheduler cannot guarantee that a suspended/force-closed phone starts full audio.

### R6 — P2: admin switch promises listener playback that does not exist

Location: [admin switch and success message](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/app/%28admin%29/adhan-audio.tsx#L212), [activation response](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/lib/server/adhanAudioAdmin.ts#L103).

The UI says activation turns on settings for real listeners and reports automatic playback on. The API still correctly returns `automaticPlaybackActive: false`; there is no listener playback or notification consumer. Hybrid activation is permitted although no real provider-readiness bridge suppresses fallback and the existing live-start/token path does not honour a recorded winner.

Required correction: keep this screen explicitly labelled as setup/scheduler testing, and retain a separate disabled runtime release gate until live arbitration, notification consent and listener audio are integrated. Do not expose this as working automatic playback in a mosque demo. The incomplete integrations are acknowledged in Claude's handoff; the UI needs to acknowledge the same boundary.

### R7 — P2: scheduled Edge requests need an explicit deployment authentication setting

Location: [cron HTTP request](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/migrations/20260922001000_adhan_delivery_plan_schedule.sql#L40), [handler's secret authentication](https://github.com/digimaxai/adhan-connect/blob/a16c8f5/supabase/functions/adhan-delivery-plan/index.ts#L57).

Cron sends `x-cron-secret` without an Authorization JWT. The handler verifies that secret, but Supabase's default gateway JWT check can reject the request before the handler runs. No tracked `supabase/config.toml`, deployment command, or handoff instruction configures this new function's gateway setting. A successful manual service-role request does not prove the cron request will pass the gateway. Supabase documents `verify_jwt=true` as the default and `--no-verify-jwt` as an override in its [CLI configuration reference](https://supabase.com/docs/guides/local-development/cli/config#functions.function_name.verify_jwt).

Required correction: record and test a reproducible per-function deployment configuration compatible with the existing secret-authenticated handler, or provide an appropriately verified JWT in cron. Do not remove the handler's secret/service authorization. Test a real cron-shaped request with a valid secret, missing secret and wrong secret through the gateway. This is a deployment gap, not evidence of an already-failed hosted deployment; none was inspected.

## Scale, verification and smaller follow-ups

- **Planner bounds:** the activation query has no pagination/order and the per-mosque loop is sequential. Each mosque resolves two dates over HTTP and reads an occurrence plus calls an RPC per ready prayer. A single returned page cannot establish that all mosques are covered. Add pagination, bounded/resumable batches, progress tracking and tests beyond a configured API page size. Benchmark this whole path, not only the SQL claim loop. Supabase imposes finite Edge runtime/request limits; see [official limits](https://supabase.com/docs/guides/functions/limits).
- **Timeout includes body:** `readDailyOverHttp` clears its abort timer as soon as `fetch` returns headers; `response.json()` occurs later outside that timeout. A stalled body can block the sequential planner. Bound the full response consumption and overall job, including database calls.
- **Cost statement:** SQL polling avoids an Edge invocation per ten-second tick. It still uses shared database resources, and the newly added planner invokes an Edge Function every 15 minutes (96 scheduled invocations/day), even with no prayers due. At full two-day planning, one mosque can generate 192 prayer-date HTTP reads and up to 960 planning RPC calls/day before optimizations. These are counts derived from the code, not a currency estimate. The reported 2,000-mosque/93-ms SQL benchmark does not prove zero cost or whole-system scale. No benchmark harness for that claim was found in the committed additions.
- **Activation contract:** SQL `v_settings.revision <> p_expected_settings_revision` does not reject NULL. Reproduced successful activation with NULL. The current HTTP handler rejects it, so this is defence-in-depth for trusted service callers rather than a demonstrated client bypass. Activation also lacks synchronization with draft saves/archive; address together with R1/R2, and reject inactive/invalid-timezone/unplannable mosques before reporting success.
- **Real-stack test scope:** the script exercises real Storage/PostgREST and SQL service calls, but injects `contextFor(...)` instead of authenticating requests through `requireAdminAccess`. Its cross-mosque denial is first enforced by the application policy using that injected scope. It is useful storage integration coverage, not a complete signed-in admin/consent/RLS end-to-end test. This review could not rerun it because the local Supabase endpoint was unreachable; no shared service was substituted. The temporary local bootstrap/schema prerequisites should be made reproducible without moving tracked migrations.
- **Account data:** Claude correctly flagged authored-content export/deletion parity as unfinished. Its SQL attribution/deletion test is useful; account workflow and object retention/cleanup still require completion before their release gates open.
- **Runtime stop procedure:** removing setup allowlists or setup flags only closes the admin endpoint; neither planner nor dispatcher reads those environment gates. Until R2 is fixed, stopping both scheduling jobs and dealing with in-flight planners is necessary for a reliable runtime stop. Do not describe the setup flag as a universal playback kill switch.

## Independently verified in this review

- Remote `staging` and `backup/staging-before-recorded-adhan-2026-09-19` still point to `520b83da9e47d1b3a2bc019b7e91c572a69b78e7`; original checkout remains on staging with its existing unrelated iOS/auth changes. Feature worktree started clean at `a16c8f5`.
- All 18 protected live/rota files are byte-identical to `520b83d`. Both prayer resolvers, `app/api/prayer-times-daily+api.ts` and `lib/api/prayerTimesUnified.ts`, are also unchanged.
- [GitHub CI for a16c8f5](https://github.com/digimaxai/adhan-connect/actions/runs/35541442675) passed; implementation commit `45f4dab` also has [passing CI](https://github.com/digimaxai/adhan-connect/actions/runs/35541318652).
- Locally reran TypeScript, lint, services tests, audio/API tests, delivery tests, planner tests, disposable SQL concurrency/security/activation tests and dispatcher tests. All passed; lint has the same six existing warnings. PostgreSQL required the sandbox's escalation for local shared memory, then passed without accessing any cloud database.
- Fresh web/server, iOS and Android exports passed with setup enabled and localhost placeholder values, with dotenv loading disabled. Client JavaScript/Hermes scan found none of the checked server-only worker RPC names, metadata parser, service-role variable, API-base variable or allowlist. Exports are bundle checks, not IPA/APK/AAB builds or installation tests.
- Live-route smoke against that export passed: five pages 200, nine protected endpoints 401 without authentication, invalid playback/location 400. Initial attempts stopped at existing missing Supabase/LiveKit configuration guards; supplying only local placeholder configuration allowed the intended authentication checks to run. The server shut down after the test.
- Additional review probes reproduced R1–R4 plus the NULL-revision issue. They assert the current erroneous behaviour, so their successful run means a bug was reproduced, not that its fix passed. The SQL probes use actual migrations/RPCs in a disposable cluster; the planner probe uses the real planner with mocked database transport.
- Historical `test:notifications:safety` hashes are known stale at baseline. This review verified actual protected-file equality to the baseline rather than altering those hashes. The historical script was not rerun or amended.

Local supporting artifacts (temporary, not required for app builds):

```
/private/tmp/adhan-claude-review-20260921/activation-repros.cjs
/private/tmp/adhan-claude-review-20260921/activation-repros.log
/private/tmp/adhan-claude-review-20260921/planner-repros.cjs
/private/tmp/adhan-claude-review-export-20260921/
/private/tmp/adhan-claude-review-export-20260921.log
```

Run the probes from the feature worktree, where their relative migration/test imports resolve. They extend the existing test harnesses at the reviewed SHA. They do not accept remote database URLs. Convert the reproduced scenarios into proper expected-behaviour regression tests when fixing the corresponding issues.

## Deployment and continuation instructions

Claude reports no shared deployment and a user-verified Xcode Cloud staging-only branch filter. This review confirmed Git refs and GitHub CI, but did not independently access Apple's dashboard or audit hosted SQL/functions. No native build, merge, cloud migration, cron configuration or deployment was performed during this review. Keep the known demo binary/backend in use.

Continue on the feature worktree. Fix R1–R4 as one coherent configuration/occurrence lifecycle design, with explicit tests for concurrent activation, deactivation, draft saves, timetable edits and delayed workers. Address R5–R7 and planner limits before real activation. Then integrate provider readiness and late-live guards, listener consent and deduplicated notifications, one audio owner, signed playback/late joining, and the agreed rota indicators. Preserve current assignment authority and mosque prayer resolution. Obtain the actual five permitted recordings; none have been supplied yet.

Before shared rollout, run authenticated local/main-admin flows and real Storage tests, visual review, and physical iOS/Android canaries: broadcaster/listener audible live start-stop-reconnect, recorded-only, confirmed-live hybrid suppression, fallback, late live start, off/on, prayer-time edit, foreground opt-in, background playback, notification tap, expired sessions and network loss. Keep platform limits explicit. Prepare an exact branch/SHA/environment deployment and rollback decision; passing CI alone is insufficient.
