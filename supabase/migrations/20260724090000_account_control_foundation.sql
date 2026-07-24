-- Durable account-control rate limiting and immutable signup policy receipts.
-- Additive and independent of public.users so it also covers signups that have
-- not yet confirmed their email or created an application profile.

create table if not exists public.account_control_rate_limits (
  key_hash text primary key
    check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null
    check (attempt_count > 0),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists account_control_rate_limits_updated_idx
  on public.account_control_rate_limits(updated_at);

alter table public.account_control_rate_limits enable row level security;
revoke all on table public.account_control_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.account_control_rate_limits to service_role;

create or replace function public.consume_account_control_rate_limit_v1(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.account_control_rate_limits%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Account-control rate limiting is server-only.'
      using errcode = '42501';
  end if;

  if p_key_hash is null
    or p_key_hash !~ '^[0-9a-f]{64}$'
    or p_limit < 1
    or p_limit > 1000
    or p_window_seconds < 1
    or p_window_seconds > 604800
  then
    raise exception 'Invalid account-control rate-limit arguments.'
      using errcode = '22023';
  end if;

  -- Opportunistic cleanup complements the required scheduled cleanup job.
  -- Thirty days is the engineering default and must be confirmed in the
  -- production retention matrix before this migration is approved.
  delete from public.account_control_rate_limits
  where updated_at < v_now - interval '30 days';

  insert into public.account_control_rate_limits (
    key_hash,
    window_started_at,
    attempt_count,
    updated_at
  )
  values (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update
  set
    window_started_at = case
      when public.account_control_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then v_now
      else public.account_control_rate_limits.window_started_at
    end,
    attempt_count = case
      when public.account_control_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then 1
      else public.account_control_rate_limits.attempt_count + 1
    end,
    updated_at = v_now
  returning * into v_row;

  return query
  select
    v_row.attempt_count <= p_limit,
    greatest(
      1,
      ceil(
        extract(
          epoch from (
            v_row.window_started_at
              + make_interval(secs => p_window_seconds)
              - v_now
          )
        )
      )::integer
    );
end;
$function$;

revoke all on function public.consume_account_control_rate_limit_v1(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_account_control_rate_limit_v1(text, integer, integer)
  to service_role;

comment on table public.account_control_rate_limits is
  'Server-only fixed-window counters. Keys are SHA-256 digests; raw user IDs and IP addresses are never stored. Schedule the purge function and confirm the 30-day security retention period before release.';

create or replace function public.purge_account_control_rate_limits_v1(
  p_retention_seconds integer default 2592000
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deleted bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Account-control cleanup is server-only.'
      using errcode = '42501';
  end if;
  if p_retention_seconds < 86400 or p_retention_seconds > 7776000 then
    raise exception 'Invalid account-control retention period.'
      using errcode = '22023';
  end if;

  delete from public.account_control_rate_limits
  where updated_at < clock_timestamp() - make_interval(secs => p_retention_seconds);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.purge_account_control_rate_limits_v1(integer)
  from public, anon, authenticated;
grant execute on function public.purge_account_control_rate_limits_v1(integer)
  to service_role;

-- Intentionally empty. A separate, reviewed production-audit migration must
-- insert the expected approval version after FK actions, triggers, RLS,
-- retention/anonymisation, owned Storage, Apple revocation, and JWT lifetime
-- have all been verified. Environment flags alone cannot enable deletion.
create table if not exists public.account_deletion_release_approvals (
  approval_version text primary key,
  enabled boolean not null default false,
  schema_audit_completed_at timestamptz not null,
  storage_audit_completed_at timestamptz not null,
  retention_matrix_version text not null,
  approved_by text not null,
  approved_at timestamptz not null default clock_timestamp(),
  notes text
);

alter table public.account_deletion_release_approvals enable row level security;
revoke all on table public.account_deletion_release_approvals
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.account_deletion_release_approvals
  to service_role;

comment on table public.account_deletion_release_approvals is
  'Fail-closed production approval gate. This foundation migration deliberately inserts no rows.';

create table if not exists public.account_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_schema_version integer not null default 1
    check (receipt_schema_version = 1),
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  privacy_version text not null,
  privacy_acknowledged_at timestamptz not null,
  special_category_consent_version text,
  special_category_consented_at timestamptz,
  special_category_withdrawn_at timestamptz,
  age_gate_version text,
  age_16_or_over_confirmed_at timestamptz,
  source text not null,
  client_context jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default clock_timestamp(),
  check (
    (special_category_consent_version is null and special_category_consented_at is null)
    or
    (special_category_consent_version is not null and special_category_consented_at is not null)
  ),
  check (
    (age_gate_version is null and age_16_or_over_confirmed_at is null)
    or
    (age_gate_version is not null and age_16_or_over_confirmed_at is not null)
  ),
  check (
    special_category_withdrawn_at is null
    or (
      special_category_consented_at is not null
      and special_category_withdrawn_at >= special_category_consented_at
    )
  )
);

alter table public.account_consents
  drop constraint if exists account_consents_source_check;
alter table public.account_consents
  add constraint account_consents_source_check
  check (source in ('auth_signup_trigger', 'auth_metadata_trigger', 'server_backfill', 'server_reconsent'));

drop index if exists public.account_consents_unique_receipt_idx;
create unique index account_consents_unique_receipt_idx
  on public.account_consents (
    user_id,
    terms_version,
    privacy_version,
    coalesce(special_category_consent_version, ''),
    coalesce(age_gate_version, '')
  )
  where special_category_withdrawn_at is null;
create index if not exists account_consents_user_recorded_idx
  on public.account_consents(user_id, recorded_at desc);

alter table public.account_consents enable row level security;
revoke all on table public.account_consents from public, anon, authenticated;
grant select, insert, update on table public.account_consents to service_role;
grant select on table public.account_consents to authenticated;

drop policy if exists "Users read their own account consent receipts"
  on public.account_consents;
create policy "Users read their own account consent receipts"
  on public.account_consents
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.has_current_account_consent_v1(
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null then
    return false;
  end if;
  if auth.role() is distinct from 'service_role'
    and p_user_id is distinct from auth.uid()
  then
    return false;
  end if;

  return exists (
    select 1
    from public.account_consents
    where user_id = p_user_id
      and terms_version = '2026-07-24'
      and privacy_version = '2026-07-24'
      and special_category_consent_version = '2026-07-24'
      and special_category_consented_at is not null
      and special_category_withdrawn_at is null
      and age_gate_version = '2026-07-24'
      and age_16_or_over_confirmed_at is not null
  );
end;
$function$;

revoke all on function public.has_current_account_consent_v1(uuid)
  from public, anon;
grant execute on function public.has_current_account_consent_v1(uuid)
  to authenticated, service_role;

comment on function public.has_current_account_consent_v1(uuid) is
  'Exact-version active account-feature consent predicate. Every personalised direct-table RLS policy must invoke this (or an equivalently reviewed predicate) before release.';

create or replace function public.capture_account_signup_consent_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_recorded_at timestamptz := case
    when tg_op = 'INSERT' then coalesce(new.created_at, clock_timestamp())
    else clock_timestamp()
  end;
  v_source text := case
    when tg_op = 'INSERT' then 'auth_signup_trigger'
    else 'auth_metadata_trigger'
  end;
  v_terms_version constant text := '2026-07-24';
  v_privacy_version constant text := '2026-07-24';
  v_special_category_version constant text := '2026-07-24';
  v_age_gate_version constant text := '2026-07-24';
begin
  -- Metadata is client-editable and is not itself authoritative evidence.
  -- This trigger allowlists the currently published versions and records the
  -- server-side auth-user creation time as the receipt timestamp.
  if v_metadata ->> 'terms_version' is distinct from v_terms_version
    or nullif(v_metadata ->> 'terms_accepted_at', '') is null
    or v_metadata ->> 'privacy_version' is distinct from v_privacy_version
    or nullif(v_metadata ->> 'privacy_acknowledged_at', '') is null
    or v_metadata ->> 'special_category_consent_version'
      is distinct from v_special_category_version
    or nullif(
      coalesce(
        v_metadata ->> 'special_category_consent_at',
        v_metadata ->> 'special_category_consented_at'
      ),
      ''
    ) is null
    or nullif(
      v_metadata ->> 'special_category_consent_withdrawn_at',
      ''
    ) is not null
    or v_metadata ->> 'age_gate_version' is distinct from v_age_gate_version
    or nullif(v_metadata ->> 'age_16_or_over_confirmed_at', '') is null
  then
    -- Do not block legacy/invite/OAuth account creation. Missing consent is a
    -- compliance state for the application to resolve before full first use.
    return new;
  end if;

  insert into public.account_consents (
    user_id,
    terms_version,
    terms_accepted_at,
    privacy_version,
    privacy_acknowledged_at,
    special_category_consent_version,
    special_category_consented_at,
    age_gate_version,
    age_16_or_over_confirmed_at,
    source,
    client_context,
    recorded_at
  )
  values (
    new.id,
    v_terms_version,
    v_recorded_at,
    v_privacy_version,
    v_recorded_at,
    v_special_category_version,
    v_recorded_at,
    v_age_gate_version,
    v_recorded_at,
    v_source,
    jsonb_build_object(
      'consent_source',
        case
          when v_metadata ->> 'consent_source' in (
            'account_completion',
            'email_signup',
            'social_auth'
          )
          then v_metadata ->> 'consent_source'
          else null
        end,
      'client_terms_accepted_at', v_metadata ->> 'terms_accepted_at',
      'client_privacy_acknowledged_at', v_metadata ->> 'privacy_acknowledged_at',
      'client_special_category_consent_at',
        coalesce(
          v_metadata ->> 'special_category_consent_at',
          v_metadata ->> 'special_category_consented_at'
        ),
      'client_age_16_or_over_confirmed_at',
        v_metadata ->> 'age_16_or_over_confirmed_at'
    ),
    v_recorded_at
  )
  on conflict do nothing;

  return new;
end;
$function$;

revoke all on function public.capture_account_signup_consent_v1()
  from public, anon, authenticated;

drop trigger if exists capture_account_signup_consent_v1 on auth.users;
create trigger capture_account_signup_consent_v1
after insert on auth.users
for each row execute function public.capture_account_signup_consent_v1();

drop trigger if exists capture_account_metadata_consent_v1 on auth.users;
create trigger capture_account_metadata_consent_v1
after update of raw_user_meta_data on auth.users
for each row
when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
execute function public.capture_account_signup_consent_v1();

create or replace function public.withdraw_account_special_category_consent_v1(
  p_user_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_withdrawn_at timestamptz := clock_timestamp();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Consent withdrawal is server-only.'
      using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'A user ID is required.'
      using errcode = '22023';
  end if;

  update public.account_consents
  set special_category_withdrawn_at = v_withdrawn_at
  where user_id = p_user_id
    and special_category_consented_at is not null
    and special_category_withdrawn_at is null;

  update auth.users
  set
    raw_user_meta_data =
      (
        coalesce(raw_user_meta_data, '{}'::jsonb)
        - 'special_category_consent_version'
        - 'special_category_consent_at'
        - 'special_category_consented_at'
      )
      || jsonb_build_object(
        'special_category_consent_withdrawn_at',
        v_withdrawn_at
      ),
    updated_at = v_withdrawn_at
  where id = p_user_id;

  if not found then
    raise exception 'The user account was not found.'
      using errcode = 'P0002';
  end if;

  return v_withdrawn_at;
end;
$function$;

revoke all on function public.withdraw_account_special_category_consent_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.withdraw_account_special_category_consent_v1(uuid)
  to service_role;

comment on table public.account_consents is
  'Versioned, server-timestamped policy and explicit special-category consent receipts. Auth user metadata is retained only as non-authoritative client context.';
