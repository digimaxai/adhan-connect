-- Canonical uniqueness and prayer schedule import audit trail.
-- Additive and idempotent: preserves the current prayer_times contract while
-- introducing import history, snapshot-based rollback, and a true unique key.

-- 1) Deduplicate canonical prayer_times rows before adding a unique index.
with ranked_rows as (
  select
    id,
    row_number() over (
      partition by mosque_id, date
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_rank
  from prayer_times
)
delete from prayer_times pt
using ranked_rows rr
where pt.id = rr.id
  and rr.row_rank > 1;

create unique index if not exists uq_prayer_times_mosque_date
  on prayer_times(mosque_id, date);

-- 2) Import headers capture who published what, when, and over which range.
create table if not exists prayer_schedule_imports (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references mosques(id) on delete cascade,
  source_type text not null
    check (source_type in ('upload', 'api', 'manual', 'rollback'))
    default 'upload',
  source_label text null,
  import_mode text null
    check (import_mode in ('smart_auto', 'explicit_iqama', 'adhan_only', 'adhan_plus_fixed_offset')),
  fixed_iqama_offset_minutes integer null
    check (fixed_iqama_offset_minutes is null or fixed_iqama_offset_minutes > 0),
  status text not null
    check (status in ('pending', 'published', 'failed', 'rolled_back'))
    default 'pending',
  coverage_start_date date null,
  coverage_end_date date null,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  initiated_by uuid references profiles(id) on delete set null,
  rolled_back_from_import_id uuid references prayer_schedule_imports(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz null,
  rolled_back_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prayer_schedule_imports_mosque_created
  on prayer_schedule_imports(mosque_id, created_at desc);
create index if not exists idx_prayer_schedule_imports_mosque_published
  on prayer_schedule_imports(mosque_id, published_at desc);
create index if not exists idx_prayer_schedule_imports_rollback_parent
  on prayer_schedule_imports(rolled_back_from_import_id);

-- 3) Snapshot rows store before/after state per date so rollback can be exact.
create table if not exists prayer_schedule_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references prayer_schedule_imports(id) on delete cascade,
  mosque_id uuid not null references mosques(id) on delete cascade,
  date date not null,
  action text not null
    check (action in ('insert', 'update', 'replace', 'rollback', 'delete'))
    default 'replace',
  previous_row jsonb null,
  published_row jsonb null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_prayer_schedule_import_rows_import_date
  on prayer_schedule_import_rows(import_id, date);
create index if not exists idx_prayer_schedule_import_rows_import
  on prayer_schedule_import_rows(import_id);
create index if not exists idx_prayer_schedule_import_rows_mosque_date
  on prayer_schedule_import_rows(mosque_id, date);

-- 4) Link canonical rows back to their most recent import record.
alter table if exists prayer_times
  add column if not exists import_id uuid references prayer_schedule_imports(id) on delete set null;

create index if not exists idx_prayer_times_import_id
  on prayer_times(import_id);

-- 5) Enable RLS and permit mosque admins plus main admins to manage audit data.
alter table if exists prayer_schedule_imports enable row level security;
alter table if exists prayer_schedule_import_rows enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where tablename = 'prayer_schedule_imports'
      and policyname = 'mosque_and_main_admin_manage_prayer_schedule_imports'
  ) then
    create policy "mosque_and_main_admin_manage_prayer_schedule_imports"
      on prayer_schedule_imports
      for all
      using (
        exists (
          select 1
          from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = prayer_schedule_imports.mosque_id
        )
        or exists (
          select 1
          from users u
          where u.id = auth.uid()
            and u.role = 'main_admin'
        )
      )
      with check (
        exists (
          select 1
          from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = prayer_schedule_imports.mosque_id
        )
        or exists (
          select 1
          from users u
          where u.id = auth.uid()
            and u.role = 'main_admin'
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where tablename = 'prayer_schedule_import_rows'
      and policyname = 'mosque_and_main_admin_manage_prayer_schedule_import_rows'
  ) then
    create policy "mosque_and_main_admin_manage_prayer_schedule_import_rows"
      on prayer_schedule_import_rows
      for all
      using (
        exists (
          select 1
          from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = prayer_schedule_import_rows.mosque_id
        )
        or exists (
          select 1
          from users u
          where u.id = auth.uid()
            and u.role = 'main_admin'
        )
      )
      with check (
        exists (
          select 1
          from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = prayer_schedule_import_rows.mosque_id
        )
        or exists (
          select 1
          from users u
          where u.id = auth.uid()
            and u.role = 'main_admin'
        )
      );
  end if;
end$$;
