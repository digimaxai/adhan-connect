-- Safety fix: ensure date columns exist before indexes/policies run.
-- Additive only; does not drop or rename anything.

-- prayer_times: add date column if missing (default to current date to satisfy not-null if needed).
alter table if exists prayer_times
  add column if not exists date date not null default current_date;

-- staff_rota: add date column if missing.
alter table if exists staff_rota
  add column if not exists date date not null default current_date;
