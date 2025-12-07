-- Safety fix: ensure staff_rota.muezzin_user_id exists before indexes/policies.
-- Additive only; no drops or renames.

alter table if exists staff_rota
  add column if not exists muezzin_user_id uuid references profiles(id) on delete cascade;

-- If prayer_times or staff_rota were partially created without date, ensure date exists (defensive).
alter table if exists prayer_times
  add column if not exists date date not null default current_date;

alter table if exists staff_rota
  add column if not exists date date not null default current_date;
