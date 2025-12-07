# Prayer Times & Staff Rota Schema (Silent Additive Rollout)

This document describes the new backend tables introduced for prayer times and muezzin staff scheduling. No existing tables, policies, or UI are modified; these changes are additive only.

## Tables

### profiles (bootstrap helper, only if missing)
- **id** uuid pk → auth.users.id (cascade)
- **created_at** timestamptz default now()
- Purpose: minimal stub to satisfy FKs if a full profiles table wasn’t present. Creation is guarded by `if not exists`.

### mosque_admins (bootstrap helper, only if missing)
- **id** uuid pk default gen_random_uuid()
- **user_id** uuid not null → auth.users.id (cascade)
- **mosque_id** uuid not null → mosques.id (cascade)
- **created_at** timestamptz default now()
- **Index**: (mosque_id, user_id)
- Purpose: supports admin policy checks; created only if absent.

### prayer_times
- **id** uuid pk (default gen_random_uuid)
- **mosque_id** uuid not null → mosques.id (cascade)
- **date** date not null (defensive add if missing)
- **fajr_adhan_time**, **fajr_iqama_time** timestamptz
- **dhuhr_adhan_time**, **dhuhr_iqama_time** timestamptz
- **asr_adhan_time**, **asr_iqama_time** timestamptz
- **maghrib_adhan_time**, **maghrib_iqama_time** timestamptz
- **isha_adhan_time**, **isha_iqama_time** timestamptz
- **source_type** text check in ('manual','auto','upload') default 'manual'
- **generated_method** text nullable
- **overrides_exist** boolean default false
- **created_by**, **updated_by** uuid → profiles.id (set null on delete)
- **created_at**, **updated_at** timestamptz default now()
- **Indexes**: (mosque_id, date), (date), (mosque_id)
- Purpose: store daily adhan/iqama times per mosque with provenance flags.

### staff_rota
- **id** uuid pk (default gen_random_uuid)
- **mosque_id** uuid not null → mosques.id (cascade)
- **muezzin_user_id** uuid not null → profiles.id (cascade) (defensive add if missing)
- **prayer_name** text not null (defensive add if missing, default 'unspecified')
- **date** date not null (defensive add if missing)
- **adhan_time**, **iqama_time** timestamptz
- **notes** text
- **assigned_by** uuid → profiles.id (set null on delete)
- **created_at**, **updated_at** timestamptz default now()
- **Indexes**: (mosque_id, date), (muezzin_user_id, date), (prayer_name, date)
- Purpose: assign muezzins to daily prayer duties with optional timing overrides and notes.

## Relationships
- `prayer_times.mosque_id` and `staff_rota.mosque_id` → mosques.id.
- `staff_rota.muezzin_user_id` and `staff_rota.assigned_by` → profiles.id.
- `prayer_times.created_by`/`updated_by` → profiles.id.
- Bootstrap tables (`profiles`, `mosque_admins`) are created only if absent to satisfy FKs and policies safely.

## RLS Policies (additive, non-invasive)
- `prayer_times` RLS enabled.
  - Policy: `local_admin_manage_prayer_times` (for all) when user is a mosque admin via `mosque_admins` for that mosque (using/with check guards).
- `staff_rota` RLS enabled.
  - Policy: `local_admin_manage_staff_rota` (for all) with same admin guard.
  - Policy: `muezzin_read_own_rota` allows a muezzin to select rows where `muezzin_user_id = auth.uid()`.
- No public/listener policies added.
- Policies are added only if absent to keep migrations idempotent and avoid changing existing behaviour.

## Future Workflows (admin & muezzin)
- Admin:
  - Upload or input daily prayer times into `prayer_times` (with source_type/manual/auto/upload markers).
  - Assign muezzins to prayers via `staff_rota` (adhan/iqama times and notes).
- Muezzin:
  - View personal assignments from `staff_rota` (select-only).
  - Later stages may surface these in muezzin UI; none implemented yet.

## Silent Rollout Notes
- No UI or existing migrations touched; this is backend-only.
- No UNIQUE constraints beyond primary keys; indexes are non-unique.
- RLS is enabled but only additive policies are created, preserving current access patterns elsewhere.
