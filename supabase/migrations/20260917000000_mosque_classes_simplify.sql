-- Simplify mosque classes: picked category/audience/days/times, derived status,
-- one "taking enrolments" switch. Free-text state machines and rarely-used
-- fields are removed; their content is folded into description first.

-- ---------- listings ----------
alter table public.mosque_service_listings
  add column category_key text not null default 'madrasah',
  add column audience_key text not null default 'everyone',
  add column age_note text not null default '',
  add column days text[] not null default '{}',
  add column time_from text,
  add column time_to text,
  add column start_date date,
  add column end_date date,
  add column taking_enrolments boolean not null default true;

alter table public.mosque_service_listings
  add constraint listing_category_key check (category_key in (
    'quran_tajweed','hifz','arabic','madrasah','alim_alimah','adult_classes',
    'new_muslims','youth','sisters','family_wellbeing','community_support')),
  add constraint listing_audience_key check (audience_key in (
    'children','youth','adults','women','men','everyone')),
  add constraint listing_days_valid check (days <@ array['mon','tue','wed','thu','fri','sat','sun']::text[]),
  add constraint listing_time_format check (
    (time_from is null or time_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and
    (time_to   is null or time_to   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')),
  add constraint listing_dates_ordered check (end_date is null or start_date is null or end_date >= start_date);

-- Backfill from the previous free-text shape.
update public.mosque_service_listings set
  category_key = case
    when title ~* 'alim' then 'alim_alimah'
    when title ~* 'hifz|memoris' then 'hifz'
    when title ~* 'tajweed|quran|qur''an' then 'quran_tajweed'
    when title ~* 'arabic' then 'arabic'
    when title ~* 'revert|new muslim' then 'new_muslims'
    when title ~* 'youth' then 'youth'
    when title ~* 'sister|women|ladies' then 'sisters'
    else 'madrasah' end,
  audience_key = case
    when audience ~* 'girls and boys|children|kids' then 'children'
    when audience ~* 'youth|teen' then 'youth'
    when audience ~* 'women|sisters|ladies|girls' then 'women'
    when audience ~* 'men|brothers|boys' then 'men'
    when audience ~* 'adult' then 'adults'
    else 'everyone' end,
  age_note = coalesce((regexp_match(audience, '(aged? ?\d+\+?)', 'i'))[1], ''),
  days = array_remove(array[
    case when schedule ~* 'mon' then 'mon' end, case when schedule ~* 'tue' then 'tue' end,
    case when schedule ~* 'wed' then 'wed' end, case when schedule ~* 'thu' then 'thu' end,
    case when schedule ~* 'fri' then 'fri' end, case when schedule ~* 'sat' then 'sat' end,
    case when schedule ~* 'sun' then 'sun' end]::text[], null),
  description = trim(both from concat_ws(E'\n\n', nullif(description,''), nullif(schedule,'')));

-- ---------- options (intakes) ----------
alter table public.mosque_service_intakes
  add column days text[] not null default '{}',
  add column time_from text,
  add column time_to text,
  add column taking_enrolments boolean not null default true,
  add column note text not null default '';

alter table public.mosque_service_intakes
  add constraint intake_days_valid check (days <@ array['mon','tue','wed','thu','fri','sat','sun']::text[]),
  add constraint intake_time_format check (
    (time_from is null or time_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and
    (time_to   is null or time_to   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));

update public.mosque_service_intakes set
  taking_enrolments = enrolment in ('open','waitlist') and state not in ('completed','cancelled'),
  days = array_remove(array[
    case when schedule ~* 'mon' then 'mon' end, case when schedule ~* 'tue' then 'tue' end,
    case when schedule ~* 'wed' then 'wed' end, case when schedule ~* 'thu' then 'thu' end,
    case when schedule ~* 'fri' then 'fri' end, case when schedule ~* 'sat' then 'sat' end,
    case when schedule ~* 'sun' then 'sun' end]::text[], null),
  time_from = case when schedule ~* '9:00 ?am' then '09:00' end,
  time_to   = case when schedule ~* '1:00 ?pm' then '13:00' end,
  note = trim(both from concat_ws(' ', nullif(prerequisites,''), nullif(duration_text,''), nullif(notes,'')));

-- Lift shared option values onto the parent listing where every option agrees.
update public.mosque_service_listings l set
  time_from = o.time_from, time_to = o.time_to, days = o.days,
  fee_text = case when l.fee_text = '' then o.fee_text else l.fee_text end,
  start_date = o.start_date
from (
  select service_id, min(time_from) time_from, min(time_to) time_to, min(fee_text) fee_text,
         min(start_date) start_date,
         (select array_agg(distinct d) from public.mosque_service_intakes i2, unnest(i2.days) d where i2.service_id = i.service_id) days
  from public.mosque_service_intakes i group by service_id
) o where o.service_id = l.id and l.days = '{}';

-- ---------- purge ----------
alter table public.mosque_service_listings
  drop column category, drop column kind, drop column audience, drop column schedule, drop column review_on;
alter table public.mosque_service_intakes
  drop column prerequisites, drop column schedule, drop column duration_text,
  drop column enrolment, drop column enrolment_closes_on, drop column state, drop column notes;
alter table public.mosque_service_intakes
  rename column audience to audience_note;

-- "Just turn up" classes need no contact value; everything else keeps its format check.
alter table public.mosque_service_listings drop constraint service_action_valid;
alter table public.mosque_service_listings add constraint service_action_valid check (
  (action_type = 'website' and action_value ~ '^https://[^[:space:]]+$') or
  (action_type in ('phone','whatsapp') and action_value ~ '^\+?[0-9 ()-]{7,25}$') or
  (action_type = 'email' and action_value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
  (action_type = 'drop_in' and action_value = '') or
  (status <> 'published' and action_value = '')
);

grant select on public.mosque_service_listings, public.mosque_service_intakes to anon, authenticated;
