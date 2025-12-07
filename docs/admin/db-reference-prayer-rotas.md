# Database Reference: Prayer Times, Staff Rota, Mosques, Users, Roles

This document summarizes how the app uses Supabase tables for prayer scheduling, staff assignments, mosques, and roles, and how these tie to each role’s capabilities.

## Core Tables

### mosques
- **Columns (used)**: `id`, `name`, `city`, `country`, `status`, `slug`, `time_zone`.
- **Relations**: FK target for `prayer_times.mosque_id`, `staff_rota.mosque_id`, `muezzins.mosque_id`, `mosque_admins.mosque_id`, `streams.mosque_id`, `adhans.mosque_id`.
- **Role usage**:
  - Admin: reads/updates their assigned mosques.
  - Muezzin: reads their assigned mosque.
  - Listener: reads public mosque info.

### users (public.users)
- **Columns (used)**: `id`, `email`, `role` (`user`, `local_admin`, `main_admin`).
- **Role flags**: drives `useRoleFlags`.
- **Relations**: `users.id` referenced by `muezzins.user_id`; also linked to `auth.users` for auth identity.

### auth.users
- **Purpose**: authentication identities.
- **Link**: `users.id` and `profiles.id` both reference `auth.users.id`.

### profiles (bootstrap stub added if missing)
- **Columns (minimal)**: `id` (pk → `auth.users.id`), `created_at`.
- **Use**: FKs for `prayer_times.created_by/updated_by`, `staff_rota.muezzin_user_id/assigned_by`.

### mosque_admins (bootstrap stub added if missing)
- **Columns**: `id`, `user_id` (→ `auth.users.id`), `mosque_id` (→ `mosques.id`), `created_at`.
- **Use**: authorizes admin access per mosque (RLS policies for `prayer_times` and `staff_rota`).

### muezzins
- **Columns (used)**: `id`, `user_id`, `mosque_id`, `is_active`, `created_at`.
- **Role usage**: determines muezzin assignment; also used by staff rota to list active muezzins for a mosque.

### prayer_times (Stage A)
- **Columns**: `id`, `mosque_id`, `date`, adhan/iqama times per prayer (`fajr_adhan_time`, etc.), `source_type`, `generated_method`, `overrides_exist`, `created_by`, `updated_by`, timestamps.
- **Indexes**: `(mosque_id,date)`, `(date)`, `(mosque_id)`.
- **Role usage**:
  - Admin: read/write via RLS if in `mosque_admins`.
  - Muezzin/Listener: indirectly referenced for display; not directly editable.

### staff_rota (Stage A)
- **Columns**: `id`, `mosque_id`, `muezzin_user_id`, `prayer_name`, `date`, `adhan_time`, `iqama_time`, `notes`, `assigned_by`, timestamps.
- **Indexes**: `(mosque_id,date)`, `(muezzin_user_id,date)`, `(prayer_name,date)`.
- **Role usage**:
  - Admin: read/write via RLS if in `mosque_admins`.
  - Muezzin: read own assignments (RLS); used for highlighting and next-adhan preference.

### adhans
- **Columns (used)**: `id`, `mosque_id`, `prayer`, `status`, `scheduled_at`, `started_at`, `ended_at`, `broadcast_started_at`, `broadcast_ended_at`, `stream_id`.
- **Role usage**:
  - Muezzin: start/end broadcast updates status/timestamps.
  - Listener: read live/completed state via RLS.
  - Admin: oversight.

### streams
- **Columns (used)**: `id`, `mosque_id`, `is_live`, `status`, `current_prayer`, `started_at`, `ended_at`, `last_health_check`, `stream_url/url`.
- **Role usage**:
  - Muezzin: marks live on start/end broadcast.
  - Listener: listens for `is_live=true` to show “Listen Live”.

### mosque_prayer_times (legacy/fallback)
- **Columns (used)**: `prayer_date`, `fajr`, `dhuhr`, `asr`, `maghrib`, `isha` (time).
- **Role usage**: still used as fallback for listener/muezzin view; admin editor currently writes to `prayer_times` (new table), so data may need syncing.

## Role Mapping and Access

### Admin (local_admin/main_admin)
- Determined by `users.role`.
- Per-mosque authorization via `mosque_admins` (RLS checks).
- Can manage:
  - `prayer_times` (select/insert/update/delete) for assigned mosques.
  - `staff_rota` (select/insert/update/delete) for assigned mosques.

### Muezzin
- Determined by presence in `muezzins` (`is_active=true`).
- Can:
  - Read own `staff_rota` rows (assigned prayers, times).
  - Start/end broadcast: updates `streams` and `adhans`.
  - Read today’s `adhans` for their mosque.

### Listener/User
- Determined by `users.role = 'user'` (default).
- Can:
  - Read live streams (`streams` where `is_live = true`).
  - Read adhans with status live/completed (RLS permitting).

## RLS Summary (additive policies from migrations)
- `prayer_times`:
  - `local_admin_manage_prayer_times`: admins via `mosque_admins` can select/insert/update/delete for their mosque.
- `staff_rota`:
  - `local_admin_manage_staff_rota`: admins via `mosque_admins` can select/insert/update/delete for their mosque.
  - `muezzin_read_own_rota`: muezzins can select rows where `muezzin_user_id = auth.uid()`.
- Other tables (not defined here) retain their existing RLS.

## Data Flows (Current App)
- **Admin Prayer Times**: reads/writes `prayer_times`. If your data is still in `mosque_prayer_times`, rows must be migrated/copied or the UI pointed back to that table.
- **Admin Staff Rota**: reads `prayer_times` (to show daily times), reads `muezzins` for dropdown, reads/writes `staff_rota`.
- **Muezzin Home**: shows schedule from `adhans` and highlights assigned prayers from `staff_rota` (today, matching `auth.uid`).
- **Muezzin Live**: broadcasts update `streams` and `adhans`; listener “Listen Live” appears when `streams.is_live=true`/`status='active'`.
- **Listener**: subscribes to `streams` for live state; may fall back to `adhans` for status.

## Integration Notes
- If admin-entered times appear blank: ensure data exists in `prayer_times` (not just `mosque_prayer_times`), and RLS permits the admin user via `mosque_admins`.
- If listener “Listen Live” is missing: ensure a `streams` row exists for the mosque and is set to `is_live=true`/`status='active'` when broadcasting; listener must follow/point to that mosque.
- Bootstrap tables (`profiles`, `mosque_admins`) are created only if missing in migrations to satisfy FKs and policies.
