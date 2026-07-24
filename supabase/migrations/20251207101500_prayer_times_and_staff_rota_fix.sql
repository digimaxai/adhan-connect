-- Fix: ensure referenced tables exist so prayer_times and staff_rota can be created safely.
-- Additive and idempotent; does not modify existing tables or policies beyond adding if missing.

-- Minimal profiles stub if not present (aligns with requested FKs). If a full profiles table exists, this is skipped.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Create prayer_times (as previously specified) ----------------------------
create table if not exists prayer_times (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references mosques(id) on delete cascade,
  date date not null,

  fajr_adhan_time timestamptz,
  fajr_iqama_time timestamptz,

  dhuhr_adhan_time timestamptz,
  dhuhr_iqama_time timestamptz,

  asr_adhan_time timestamptz,
  asr_iqama_time timestamptz,

  maghrib_adhan_time timestamptz,
  maghrib_iqama_time timestamptz,

  isha_adhan_time timestamptz,
  isha_iqama_time timestamptz,

  source_type text check (source_type in ('manual','auto','upload')) default 'manual',
  generated_method text null,
  overrides_exist boolean default false,

  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_prayer_times_mosque_date on prayer_times(mosque_id, date);
create index if not exists idx_prayer_times_date on prayer_times(date);
create index if not exists idx_prayer_times_mosque on prayer_times(mosque_id);

-- Create staff_rota --------------------------------------------------------
create table if not exists staff_rota (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references mosques(id) on delete cascade,
  muezzin_user_id uuid not null references profiles(id) on delete cascade,
  prayer_name text not null,
  date date not null,

  adhan_time timestamptz,
  iqama_time timestamptz,

  notes text,
  assigned_by uuid references profiles(id) on delete set null,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_staff_rota_mosque_date on staff_rota(mosque_id, date);
create index if not exists idx_staff_rota_user_date on staff_rota(muezzin_user_id, date);
create index if not exists idx_staff_rota_prayer_date on staff_rota(prayer_name, date);

-- Enable RLS (additive) ----------------------------------------------------
alter table if exists prayer_times enable row level security;
alter table if exists staff_rota enable row level security;

-- Policies (only if missing) ----------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'prayer_times' and policyname = 'local_admin_manage_prayer_times'
  ) then
    create policy "local_admin_manage_prayer_times" on prayer_times
      for all
      using (
        exists (
          select 1 from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = prayer_times.mosque_id
        )
      )
      with check (
        exists (
          select 1 from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = prayer_times.mosque_id
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'staff_rota' and policyname = 'local_admin_manage_staff_rota'
  ) then
    create policy "local_admin_manage_staff_rota" on staff_rota
      for all
      using (
        exists (
          select 1 from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = staff_rota.mosque_id
        )
      )
      with check (
        exists (
          select 1 from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = staff_rota.mosque_id
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'staff_rota' and policyname = 'muezzin_read_own_rota'
  ) then
    create policy "muezzin_read_own_rota" on staff_rota
      for select
      using (muezzin_user_id = auth.uid());
  end if;
end$$;
