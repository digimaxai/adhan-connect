-- Bootstrap helpers to satisfy FK references before other additive migrations run.
-- Fully additive and idempotent: creates minimal tables only if they do not already exist.

-- Minimal profiles table (only id + created_at) to satisfy FK references.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Minimal mosque_admins table to satisfy admin policy lookups (user_id / mosque_id).
create table if not exists mosque_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mosque_id uuid not null references mosques(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_mosque_admins_mosque_user on mosque_admins(mosque_id, user_id);
