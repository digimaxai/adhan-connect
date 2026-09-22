# Promote the stable staging backend in place

Execution companion and primary Claude instructions:
[`../claude-production-promotion-handoff-2026-09-22.md`](../claude-production-promotion-handoff-2026-09-22.md).
The review below explains the decision; the companion specifies the remaining
tasks, fixed values, verification gates and what must not be assumed.

Status: reviewed proposal and continuation handover, 22 September 2026.
The user authorised preparation of this simpler approach. No cutover, project
creation, project deletion, production environment rewrite or database reset
has been performed for this review. This document supersedes the earlier
database-replacement and hosted-rehearsal plans.

## Decision

Use the currently working staging Supabase project as the production backend.
Keep its database, Auth users, credentials, Storage and mosque settings in place.
Build the production app identities against it and publish the stable API with
matching server credentials. Finish production acceptance before resuming
feature development against a separate staging database.

The owner confirms there are no real production users/mosques to preserve.
Accounts and catalogue entries do exist; this is a business decision to retire
the old beta environment, not evidence that its database is empty.

No temporary hosted migration-rehearsal project is needed. No imported-password
test, production database replacement, or Storage object transfer is needed to
launch the promoted backend. Preserve the verified recovery exports.

Use the existing two-project allocation: retain old production during
acceptance, then prepare it as the new staging project under a separately
reviewed reset. If that reuse proves unsuitable, present a concrete alternative
before provisioning another billable project. Database preparation is still
needed for future staging, but it is outside the working production database.

## Environment map

| Resource | During preparation/demo | After production acceptance |
| --- | --- | --- |
| Supabase `zhrucqghrqkjyzmupdyy` | Working staging, frozen for feature changes | Production, same data and project ID |
| Supabase `yecbsezhwvpdkuzmmziv` | Old beta production, retained | Retained until reviewed reuse as new staging |
| EAS `preview` alias | `ct1o9bkpvl`, existing demo API | Retire its access to promoted production before new staging development |
| EAS production root | `b5blckazxb`, old API | Newly exported production API targeting `zhrucqghrqkjyzmupdyy` |
| EAS release canary | `8tahix06lu`, staging services | Test evidence only; retire after acceptance |
| iOS production | App ID `6792143739`, scheme `adhanconnect` | New Xcode Cloud internal TestFlight build |
| Android production | Package `com.maksumsdigitalagency.adhanconnect` | New GitHub Actions build; no Play release |
| New feature staging | Work remains isolated in Git | New backend plus new staging binaries before recorded-adhan work |

Renaming a project does not change its URL, keys, app configuration, or access.
The demo build becomes a temporary client of the promoted production database.
It must not later be used for destructive development tests.

## Evidence checked for this review

Repository source at `aae11ca` and the original stable baseline `520b83d`:

- `app.config.js` infers staging from `zhrucqghrqkjyzmupdyy` unless
  `APP_VARIANT=production` is explicit. A local configuration matrix verified
  production names, bundle/package IDs and scheme with that override. Without
  it the same URL generates a staging app.
- The production Android workflow still pins `yecbsezhwvpdkuzmmziv`; update it
  to the promoted target before building. Its API check currently requires only
  HTTPS; tighten it to the intended production origin.
- Xcode Cloud instructions already specify `APP_VARIANT=production`; add a
  prebuild assertion of production database, API origin and app identity. EAS
  `build.production` currently has no explicit variant; set one to avoid an
  accidental staging identity if that profile is ever used.
- Native API requests use the bundled `EXPO_PUBLIC_API_BASE_URL`; web requests
  use their current origin (`lib/api/apiBaseUrl.ts`). An installed binary is
  not retargeted by editing EAS or GitHub environment variables.
- Push registration includes `app_variant`; dispatch materialisation and claim
  operations filter by variant. Deleting all staging registrations is neither
  required nor suitable while the demo still needs notifications.
- `configure_notification_dispatch_schedule_v1` removes only the job with the
  incoming variant's name. Switching from staging to production without
  explicitly stopping the staging job can leave both cron jobs active.
- LiveKit namespaces distinguish newly named rooms, not databases. Two APIs
  sharing this database still share stream rows and can conflict. The canary
  is isolated by URL only; an authenticated start would modify demo state.
- Several seed, email, notification, messaging and local-development scripts
  hard-code the current staging project ID. Those guards become unsafe once
  that project is production; update or disable them before future test work.

Fresh SQL audit (explicit read-only transaction, aggregate output only):

- 8 Auth users; 1,116 mosques; 93 migration records, latest `20260917001000`.
- Zero live stream and live adhan markers at inspection time.
- Two active staging push registrations; dispatcher configured for staging.
- Active cron jobs: staging push dispatch every minute and ELM timetable daily.
- One enabled assistant-automation configuration row. This does not prove a
  worker is running; disable the unwanted automation at the controlled switch
  without affecting ELM timetable fetching or staff rota.
- No public tables in `supabase_realtime`. Listener code has polling fallback
  in some views. Measure live start/end propagation on devices; any required
  publication repair must be narrow and checked against RLS, not an enable-all.

Existing validation remains useful: local iOS Release compile, identity checks,
TypeScript/lint/service checks, backup restores, and canary route/API guards.
None proves signed native playback, actual notification delivery, or room-prefix
behavior in a broadcast. Those device checks remain outstanding.

## Three-stage execution

### 1. Prepare the production release without disturbing the demo

Keep the current staging branch, installed demo build, preview API, push job
and Auth callbacks working. Keep recorded-adhan changes excluded.

Update release build assertions and explicit variant configuration. Prepare a
matched environment manifest for EAS production, GitHub production secrets and
Xcode Cloud: client/server Supabase URL and keys all belong to
`zhrucqghrqkjyzmupdyy`; production API is `https://adhan-connect.expo.app`;
production app variant is explicit. Supply matching LiveKit credentials and
`LIVEKIT_ROOM_NAMESPACE=production`. Keep social login flags disabled.

Audit provider rollout variables against the promoted database: do not blindly
retain the old Harrow-only START/END allowlists. Retain the working staging
broadcast behavior first; any mode change needs its own regression evidence.
Carry required server integrations (including mosque-request messaging) from
the working environment selectively, with production links/recipients checked.

Re-export with production configuration; the existing staging canary artifact
must not be promoted unchanged. Build iOS through Xcode Cloud and Android
through GitHub. The Android debug APK is a development artifact and may need
Metro; use a signed release APK with bundled JS for standalone phone acceptance
while Google Play is unavailable. AAB compilation alone is not a phone test.

Do not assume merging main has no deployment side effects: inspect GitHub and
Xcode Cloud branch triggers first. Keep initial distribution internal/manual.

### 2. Switch and accept during a short agreed test window

Capture fresh backups and the exact old environment/alias configuration; confirm
no live broadcast is active. Freeze feature development on the retained project.

Apply an additive Auth redirect change to the retained project: add production
HTTPS callback/reset routes and preserve native production and demo callbacks.
Do not apply the old audit's patch to `yecbsezhwvpdkuzmmziv`. Use the production
HTTPS site URL when switching, with rollback values captured immediately before.

Publish the verified production API and install the matching production builds.
Retire incompatible old production beta builds; they embed the previous project
URL and will not match the newly published production API.

Change the retained project's push function variant and schedule together:
stop the staging job, review pending deliveries to avoid sending historical
alerts, configure the production job, and verify exactly one active dispatcher.
Preserve notification preferences and existing staging device rows initially;
new production installations register their own production variant. Once switched,
the old demo app no longer has guaranteed scheduled push delivery. This is an
explicit transition, not a promise that both builds remain fully supported.

Disable the unrequested assistant automation, retain the working ELM timetable
job, and leave users, sessions, passwords, roles, assignments, prayer times,
rota, Storage and historical records in place. Never run the migration-copy
reset SQL on this retained database.

Acceptance: sign-in/confirmation/recovery; listener and staff roles; mosque list
and settings; prayer and rota edits; two-device live start/audio/end/restart;
production push arrival/tap; Storage access and ELM configuration. Run broadcast
tests sequentially during the window because demo and production clients share
one database. Stop rollout if an essential behavior fails.

### 3. Separate future staging, then resume feature work

After production acceptance, back up old production and prepare its reset/reuse
as staging. Restore the required schema and deliberate test fixtures with outbound
jobs disabled; separately verify Auth, Storage and provider configuration there.
Update staging scripts, CI variables, local environment files and build workflows
to the new project. Replace/retire old staging binaries: they retain the promoted
production URL even after preview is repointed.

Inventory and retire old deployments and credentials that still grant development
access to the promoted project. Changing an alias or clearing sessions alone is
not environment isolation. Rotate server keys only with all production consumers
coordinated; verify no future staging route or mutating script targets production.
Only then merge recorded-adhan work into staging and resume feature testing.

## Rollback and handover

Before switch, the current demo and old production remain available. After switch,
return the same retained database to its captured demo API/notification configuration
and use the known demo build if production acceptance fails. Coordinate stopping
live rooms and scheduled dispatch before rollback; preserve data written meanwhile.

The old production database is not a current-data replica. Repointing to it would
lose visibility of staging-derived records. Likewise, restoring the old production
API alone leaves new binaries on the wrong database/API combination. Rollback must
pair a compatible binary, API and database; Git rollback alone is insufficient.

Working release branch: `release/stable-staging-to-production-2026-09-21`, draft
PR https://github.com/digimaxai/adhan-connect/pull/9. Worktree:
`/private/tmp/adhan-connect-production-promotion`. The original checkout has
unrelated uncommitted changes and must not be reset. Recorded-adhan work remains
in `/private/tmp/adhan-connect-cloud-recorded-adhan` and is not part of promotion.

Private recovery exports remain outside Git at
`/Users/mzk/PROJECTS/adhan-connect-backups/2026-09-21-production-promotion`.
Never print or upload their Auth data, hashes or Storage payloads into a handover.

Next concrete work: implement the release build target assertions, prepare the
matched environment changes and standalone Android release APK path, then inspect
Xcode Cloud workflow access. Bring the exact switch and rollback manifest for
owner approval once those artifacts are ready. No additional project creation is
authorised or needed by this revised plan.
