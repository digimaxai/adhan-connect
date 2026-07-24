-- Safety fix: ensure staff_rota.prayer_name exists before indexes/policies.
-- Additive only; no drops or renames.

alter table if exists staff_rota
  add column if not exists prayer_name text not null default 'unspecified';
