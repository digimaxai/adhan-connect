# Build 19 feedback — 2026-09-07

## Ask and changes

1. Make the homepage Friday strip cleaner. `components/HomeJumuahStrip.tsx`
   now has a clear header, large prayer time, separate secondary khutbah time,
   and a venue row. Repeated generic slot labels are omitted for a single slot;
   multiple slots retain labels and dividers. No moving text.
2. Respect prayer availability in Today. The homepage mosque reads now include
   `prayers_not_offered`; excluded prayers show “Not offered” instead of a time.
   The homepage Next Prayer display also skips those prayers. This filters the
   listener display only; timetable storage, rota, broadcast and notification
   scheduling are unchanged.
3. Move Current Area / Nearby to the bottom of the established listener homepage,
   after What's On, My Mosques and other content. First-run discovery is unchanged.
4. Replace ambiguous countdown HH:MM with explicit “1 hr 42 min remaining” /
   “12 min remaining”.
5. Add event attendance, likes/favourites and local-admin analytics. New event
   detail controls let authenticated users select party size 1–8, cancel their
   attendance plan, like/unlike and favourite/unfavourite. Public viewers see
   aggregate attendance; personal reactions are private. Existing event capacity
   editing remains available; decimal capacity input is now rejected.

## Database and access

Applied to **staging only**:

- `20260907120000_event_engagement.sql`: event response table, public summary,
  authenticated mutation RPC and mosque-admin summary RPC.
- `20260907123000_event_engagement_write_permissions.sql`: explicitly overrides
  Supabase default table grants so writes must use the RPC.

Attendance writes lock the event row, enforce a party-size range and capacity,
reject new attendance after the event starts, and are idempotent. Likes and
favourites update independently. Summary RPCs expose counts, not user identities.
Admin access is enforced in the database with existing main/local-admin helpers.

`components/admin/EngagementOverview.tsx` is mounted on the local-admin dashboard
for its selected mosque. It shows upcoming published public events and the next
Friday's active slots: attendees, parties, remaining capacity, utilisation, and
(event-only) likes/favourites. Existing Jumu’ah attendance records are reused;
these are attendance plans, not checked-in headcounts. Focus and dashboard
pull-to-refresh reload the metrics. Errors are explicit and retryable.

## Verification

- TypeScript and lint passed.
- Notification safety contracts passed, including 18 protected LIVE files.
- Clean web and iOS exports passed (exports are not EAS native builds).
- `scripts/test-event-engagement.mjs` tested the migration in disposable local
  PostgreSQL with Supabase-style default grants: attendance/cancellation,
  reactions, idempotency, party limits, published/started event checks, row
  privacy, admin mosque scoping, Friday filtering, and a concurrent last-space race.
- `scripts/smoke-event-engagement-staging.js` passed authenticated staging
  attendance/reactions/admin summaries, capacity rejection and direct-write
  rejection. All temporary fixtures and users were removed; no emails sent.
- Browser unavailable; visual and physical-device acceptance remains pending.

## Release status

The user authorized a fresh testing build. Staging iOS build 20
(`23872dc3-fa2a-4d32-8f48-64a8d8bff21d`) finished successfully.
Install: https://expo.dev/accounts/maksums-digital-agency/projects/adhan-connect/builds/23872dc3-fa2a-4d32-8f48-64a8d8bff21d

Web preview remains `0qmhx0zeeo`. Automatic approval review rejected an attempted
web/server deployment because the latest authorization named a test build rather
than an EAS Hosting payload upload. No web upload occurred. This does not block
iOS testing: these changes add no server route and their staging database
migrations are already applied. Production is unchanged.


## Build 20 follow-up — local changes, awaiting next build

- Slimmer Friday strip: reduced padding/gaps and inline prayer/khutbah labels
  next to their times, preserving the venue row and multiple-slot layout.
- Today uses equal-width, minimum-height boxes, single-line fitted times and
  separate “Not” / “offered” lines to prevent character wrapping on narrow phones.
- Added a thin aligned Iqamah row when at least one offered prayer has an Iqamah
  time. Missing/excluded entries show a dash; excluded prayers never show a time.
- Listener event controls no longer show remaining spaces or a capacity bar.
  Attendance/reactions, capacity enforcement and admin analytics are unchanged.
- TypeScript and lint passed. iOS export passed; visual acceptance remains pending.
- No database changes, web deployment or EAS build was made for this follow-up.
