# Live Adhan Architecture (Stage 1 — Backend Foundation)

This document captures the current backend shape (as inferred from repo code), the target model for live Adhan, and the additive migrations/policies introduced in Stage 1. No UI or routing changes are part of this stage.

## Current Tables (from code references)

- **mosques**
  - Columns used: `id`, `name`, `city`, `country`, `status`, `slug` (via slug-based lookups in mosque screens), `time_zone` (added by earlier SQL script).
  - Purpose: canonical mosque profile and timezone source.
  - Relations: referenced by `muezzins.mosque_id`, `streams.mosque_id`, `adhans.mosque_id`, `campaigns.mosque_id`, `events.mosque_id`.

- **muezzins**
  - Columns used: `id`, `user_id`, `mosque_id`, `is_active`, `created_at`.
  - Purpose: assignment of users to mosques as active muezzins.
  - Relations: `mosque_id → mosques.id`; used in RLS checks and lookups for primary mosque.

- **streams**
  - Columns used in app: `id`, `mosque_id`, `type`, `status` (expects `'active'` for normal state, `'live'` when broadcasting), `is_live` (boolean), `last_health_check`, `url` (stream playback).
  - Purpose: live state per mosque; listeners fetch rows with `is_live = true` and `status = 'active'`, muezzins update `is_live` and `status`.
  - Existing constraints: none surfaced; uniqueness on `mosque_id` not enforced in code.

- **adhans**
  - Columns used in app: `id`, `mosque_id`, `prayer` (text), `status` (`scheduled`, `live`, `completed`), `scheduled_at`, `broadcast_started_at`, `broadcast_ended_at`, `source`.
  - Purpose: schedule/history of adhans; muezzin start/end writes `status` and broadcast timestamps.
  - Existing constraints: none surfaced; no explicit enum enforcement in code.

- **events**
  - Columns used: `id`, `title`, `description`, `image_url`, `start_date`, `end_date`, `slug`, `mosque_id`.
  - Purpose: mosque events listing/detail.
  - Relations: `mosque_id → mosques.id`.

- **campaigns**
  - Columns used: `id`, `title`, `description`, `image_url`, `slug`, `mosque_id`.
  - Purpose: campaigns/donations content per mosque.
  - Relations: `mosque_id → mosques.id`.

- **staff_rota**
  - Not referenced in app code; likely rotation/availability table (schema not present in repo).

- **user_mosque_prefs**
  - Not referenced in app code; likely stores user preferences per mosque (schema not present in repo).

## Target Canonical Model (streams + adhans)

- **streams** (one live state per mosque)
  - Keys: `id` (pk), `mosque_id` (fk mosques.id)
  - Live fields: `is_live`, `current_prayer`, `started_at`, `ended_at`, `stream_url`
  - Forward-compatible: `stream_url` reserved for audio; no business logic depends on it yet.

- **adhans** (schedule and history)
  - Keys: `id` (pk), `mosque_id` (fk mosques.id)
  - Fields: `prayer`/`prayer_name`, `scheduled_at`, `status` (`scheduled` | `live` | `completed` | `cancelled`), `started_at`, `ended_at`, `stream_id` (fk streams.id, nullable)

### Gap Analysis (current vs target)

- **streams**
  - Already: `id`, `mosque_id`, `is_live`, `status`, `type`, `last_health_check`, `url` (playback).
  - Missing vs target: `current_prayer`, `started_at`, `ended_at`, `stream_url` alias (target keeps `url` as-is; `stream_url` added without changing meaning), formal indexes on `mosque_id` / `is_live`.
  - Uniqueness on `mosque_id` not enforced yet (kept as logical rule to avoid breaking existing data).

- **adhans**
  - Already: `id`, `mosque_id`, `prayer`, `status` (values used: `scheduled`, `live`, `completed`), `scheduled_at`, `broadcast_started_at`, `broadcast_ended_at`, `source`.
  - Missing vs target: `started_at`/`ended_at` (generic timestamps), `stream_id` fk, explicit index coverage on `mosque_id`, `scheduled_at`, `status`. `broadcast_*` kept; new fields added without renaming existing ones.

## Migrations Added in Stage 1 (additive, non-breaking)

- **Schema migration** (`migrations/20251206120000_live_adhan_schema_additions.sql`)
  - Adds (if absent) `current_prayer`, `started_at`, `ended_at`, `stream_url`, `is_live`, `mosque_id` FK to `streams`.
  - Adds (if absent) `status`, `started_at`, `ended_at`, `stream_id` FK to `adhans`.
  - Adds safe indexes: `streams(mosque_id)`, `streams(is_live)`, `adhans(mosque_id)`, `adhans(scheduled_at)`, `adhans(status)`.
  - Notes: entirely additive; no UNIQUE constraints introduced to avoid conflicts with existing data.

- **RLS/policy migration** (`migrations/20251206121000_live_adhan_rls_additions.sql`)
  - Adds policies (guarded by existence checks) to allow:
    - Muezzins (active in `muezzins`) to select/update `streams` and `adhans` for their mosque.
    - Listeners to select `streams` where `is_live = true` and `adhans` with non-private statuses (`live`/`completed`).
    - Admins (`users.role` in `local_admin`/`main_admin`) to select/update both tables.
  - Does **not** drop/alter existing policies and does not force-enable RLS if currently disabled.

## Realtime Contract (for later UI wiring)

- Subscribe to `streams` changes per mosque using channel name pattern `streams-mosque-{mosque_id}` (conceptual; actual via `supabase.channel(...)`).
- Trigger updates on `INSERT`/`UPDATE`/`DELETE` filtered by `mosque_id`; primary signal is `UPDATE is_live`.
- Writer roles: muezzin/admin devices update `streams` and `adhans`.
- Reader roles: listener devices read/subscribe only (gated by RLS), no writes.

## RLS Current State (observed) and Blueprint

- Observed (from code and prior SQL): `adhan_broadcasts` has RLS enabled with muezzin policies; other tables’ RLS definitions are not present in repo.
- Blueprint (additive policies added in Stage 1):
  - **streams select/update**: allowed for active muezzins on the same mosque; select allowed for live rows (`is_live = true`) for listeners; select/update allowed for admins by role.
  - **adhans select/update**: allowed for active muezzins on the same mosque; select for listeners on `status in ('live','completed')`; admin select/update for maintenance.
  - No existing policies are removed or tightened; enabling RLS is left unchanged to avoid accidental lockout.

## Types (Stage 1 placeholders)

- Supabase-generated Database types are not present in the repo; generation remains pending for a future step.
- Added shared type aliases (`lib/types/live-adhan.ts`) for:
  - `LiveStreamState`: `mosque_id`, `is_live`, `current_prayer`, `started_at`, `ended_at`, `stream_url`, `id?`.
  - `AdhanScheduleEntry`: `mosque_id`, `prayer`, `scheduled_at`, `status`, `started_at`, `ended_at`, `stream_id`, `id?`.
  - Not imported anywhere yet to keep this stage non-breaking.

## Safety Checklist

- No existing migrations modified; only new, additive migrations added.
- No DROP/RENAME/TYPE changes; only `ADD COLUMN`, `CREATE INDEX`, and new policies with guards.
- No UI or routing changes; app screens untouched.
- Backward compatibility preserved: existing columns and semantics remain intact; new fields are optional.
- RLS additions are additive and keep current behaviour unblocked; they do not force-enable RLS on tables where it may be off.
