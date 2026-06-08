-- Add Asr jurisprudence school configuration to mosques.
-- Controls which shadow-length rule is used when auto-calculating Asr via Aladhan.
-- 0 = Shafi/standard (shadow = 1x object height) — Aladhan default.
-- 1 = Hanafi (shadow = 2x object height) — required for South Asian / UK mosques.
-- See https://aladhan.com/prayer-times-api (school parameter).
alter table public.mosques
  add column if not exists prayer_school integer not null default 0;

comment on column public.mosques.prayer_school is
  'Aladhan school parameter for Asr calculation. 0 = Shafi (shadow 1x, default), 1 = Hanafi (shadow 2x). Most UK South Asian mosques use 1.';

grant select (prayer_school) on public.mosques to anon, authenticated;
