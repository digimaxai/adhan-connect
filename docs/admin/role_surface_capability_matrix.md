# Role / Surface Capability Matrix

## Goal
- Separate admin experiences by job-to-be-done and ergonomics, not by backend or data model.
- Keep one canonical source of truth for prayer scheduling and mosque operations.
- Use web for dense, high-risk, multi-step workflows.
- Use mobile for quick operational actions, same-day fixes, and field use.

## Product Principle
- `Web` is for setup, bulk operations, review, audit, import, and configuration.
- `Mobile` is for speed, confirmation, same-day correction, and lightweight management.
- Both surfaces must write to the same backend contracts and the same canonical tables.

## Current Surface Map
- Main admin web portal: [app/admin](c:/Users/hmakh/Documents/Project/adhan-connect/app/admin)
- Local admin mobile flows: [app/(admin)](c:/Users/hmakh/Documents/Project/adhan-connect/app/(admin))
- Legacy local-admin CSV import entry point: [app/(tabs)/admin/prayer-times.tsx](c:/Users/hmakh/Documents/Project/adhan-connect/app/(tabs)/admin/prayer-times.tsx)
- Canonical prayer-time write/read model:
  - [lib/api/admin/prayerTimes.ts](c:/Users/hmakh/Documents/Project/adhan-connect/lib/api/admin/prayerTimes.ts)
  - [lib/api/prayerTimesUnified.ts](c:/Users/hmakh/Documents/Project/adhan-connect/lib/api/prayerTimesUnified.ts)

## Role-by-Surface Matrix

### Main Admin
#### Web
- Primary surface.
- Full access to mosque onboarding, approvals, assignments, user management, audits, imports, provider configuration, and system-level settings.
- Owns cross-mosque operations and exception handling.

#### Mobile
- Optional secondary surface only.
- Read-only operational snapshots, alerts, and urgent approvals if needed later.
- Do not optimize major main-admin workflows for mobile.

### Local Admin
#### Web
- Primary surface for high-friction mosque-management workflows.
- Upload annual or monthly prayer timetables.
- Review import previews, validation errors, diffs, and publish actions.
- Configure future API/provider sync per mosque.
- Manage schedule history, rollback, audit trail, and recurring schedule rules.

#### Mobile
- Primary surface for day-to-day operational work.
- Quick same-day prayer-time edits.
- Last-minute iqama corrections.
- Staff rota updates and confirmations.
- Lightweight mosque status tasks and assignment checks.

### Muezzin
#### Web
- Minimal or no first-class product investment.
- At most, simple read-only support later.

#### Mobile
- Primary surface.
- View assignments, reminders, live adhan status, and start/stop broadcast actions.

### Listener / General User
#### Web
- Optional secondary discovery surface.
- Lightweight read-only mosque information if needed later.

#### Mobile
- Primary surface.
- Follow mosques, view prayer times, receive alerts, and listen to live adhan.

## Prayer Times Capability Split

### Local Admin Mobile should own
- Edit one day.
- Edit one prayer quickly.
- Apply emergency changes for today or tomorrow.
- Confirm that imported times are correct.
- Add small manual overrides after an import or API sync.

### Local Admin Web should own
- Upload CSV/XLSX timetable files.
- Preview parsed rows before publish.
- Validate columns, dates, timezone, and prayer ordering.
- Show add/update/skip/error counts before publish.
- Publish across date ranges.
- Roll back to the previous published version.
- Configure and monitor future provider/API sync.

### Main Admin Web should own
- Enable import/provider functionality for a mosque.
- Troubleshoot failed imports.
- Re-run or revert a mosque schedule at a system level.
- View audit history across mosques.

## Canonical Backend Rule
- All prayer schedule creation and publication must end in `prayer_times`.
- `mosque_prayer_times` remains legacy-read-only until migration cleanup is complete.
- Mobile manual edits and web imports must use the same publish pipeline and provenance fields.

## Recommended Architecture

### Shared backend
- Canonical table: `prayer_times`
- Legacy fallback table: `mosque_prayer_times`
- Assignment table: `staff_rota`
- Add import metadata and staging so web uploads and future API sync use the same normalization path.

### Surface-specific UX
- Mobile local-admin prayer tool becomes `Quick Edit`.
- Web local-admin prayer tool becomes `Import, Review, Publish`.
- Both surfaces can display the last published source and status.

## Target User Flows

### Local Admin Mobile: Quick correction
1. Open mosque.
2. See today’s published times.
3. Tap one prayer.
4. Adjust adhan or iqama.
5. Save override.

### Local Admin Web: Timetable upload
1. Choose mosque.
2. Upload file or select provider.
3. Review mapping and detected date range.
4. Inspect warnings and row errors.
5. Publish to canonical prayer schedule.
6. Optionally notify mosque staff or create follow-up tasks.

### Main Admin Web: Exception management
1. Open mosque workspace.
2. Inspect latest schedule source, publish time, and error state.
3. Fix assignment or source configuration.
4. Re-run import/sync or roll back.

## Prayer-Times Roadmap Refactor

### Phase 1
- Keep the existing mobile manual editor as the operational fallback.
- Stop enhancing the legacy CSV screen in [app/(tabs)/admin/prayer-times.tsx](c:/Users/hmakh/Documents/Project/adhan-connect/app/(tabs)/admin/prayer-times.tsx) except for migration-safe fixes.
- Define the canonical import pipeline around `prayer_times`.

### Phase 2
- Build a local-admin web schedule workspace.
- Support CSV first, then XLSX.
- Add preview, validation, and publish flow.
- Record source metadata such as `manual`, `upload`, and later `api`.

### Phase 3
- Add import job history, rollback, and audit trail.
- Add per-mosque source configuration.
- Add provider adapter layer for future API integrations.

### Phase 4
- Add scheduled provider sync for supported mosque sources.
- Keep mobile focused on confirmation and override, not configuration.

## Delivery Recommendation
- Do not split by creating separate business logic for mobile and web.
- Do split by creating separate route experiences and component systems for each role and surface.
- Build the prayer-times backend once, then expose:
  - `Quick Edit` on mobile
  - `Import / Review / Publish` on web
  - `Audit / Recovery / Oversight` on main-admin web

## Immediate Next Build Steps
1. Create a local-admin web prayer-schedule route and shell.
2. Move bulk import work off the legacy mobile/tabs screen.
3. Add import staging plus validation/publish backend contracts.
4. Keep mobile manual editing wired to the same canonical `prayer_times` data.
