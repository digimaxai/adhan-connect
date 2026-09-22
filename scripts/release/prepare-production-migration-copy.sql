\set ON_ERROR_STOP on

-- Run only on a separately restored migration copy, never on the immutable
-- recovery export. The caller must provide both values explicitly:
--
--   psql ... \
--     --set=release_reset_token=PREPARE_ADHAN_CONNECT_PRODUCTION_COPY \
--     --set=target_project_ref=yecbsezhwvpdkuzmmziv \
--     --file scripts/release/prepare-production-migration-copy.sql

select set_config(
  'adhan_connect.release_reset_token',
  :'release_reset_token',
  false
) as release_reset_configured \gset
select set_config(
  'adhan_connect.target_project_ref',
  :'target_project_ref',
  false
) as target_project_configured \gset

do $$
begin
  if current_setting('adhan_connect.release_reset_token', true)
      <> 'PREPARE_ADHAN_CONNECT_PRODUCTION_COPY' then
    raise exception 'Release reset token missing or incorrect.';
  end if;
  if current_setting('adhan_connect.target_project_ref', true)
      <> 'yecbsezhwvpdkuzmmziv' then
    raise exception 'Target project is not the expected production project.';
  end if;
  if to_regclass('public.notification_events') is null
      or to_regclass('public.mosques') is null
      or to_regclass('auth.users') is null then
    raise exception 'Expected stable staging schema is not present.';
  end if;
end
$$;

begin;
select pg_advisory_xact_lock(hashtext('adhan-connect-production-migration-copy'));

-- Prevent application triggers from turning state cleanup into notifications
-- or other side effects. The script deletes dependants explicitly and verifies
-- the final state before commit.
set local session_replication_role = replica;

-- Auth users, identities, password hashes, MFA enrolments and WebAuthn
-- credentials remain. Runtime sessions, challenges, login flows and reusable
-- tokens do not cross environments.
delete from auth.mfa_amr_claims;
delete from auth.refresh_tokens;
delete from auth.sessions;
delete from auth.mfa_challenges;
delete from auth.webauthn_challenges;
delete from auth.saml_relay_states;
delete from auth.flow_state;
delete from auth.oauth_authorizations;
delete from auth.oauth_consents;
delete from auth.oauth_client_states;
delete from auth.one_time_tokens;
delete from auth.audit_log_entries;

update auth.users
set confirmation_token = '',
    confirmation_sent_at = null,
    recovery_token = '',
    recovery_sent_at = null,
    email_change_token_new = '',
    email_change = '',
    email_change_sent_at = null,
    phone_change = '',
    phone_change_token = '',
    phone_change_sent_at = null,
    email_change_token_current = '',
    email_change_confirm_status = 0,
    reauthentication_token = '',
    reauthentication_sent_at = null,
    last_sign_in_at = null,
    updated_at = now();

-- Notification preferences remain, but staging installations, short-lived
-- travel regions, generated events and user inbox entries start clean.
delete from public.notification_deliveries;
delete from public.notification_events;
delete from public.push_devices;
delete from public.travel_notification_regions;
delete from public.app_notifications;

-- Fail closed until the production Edge Function and cron job are configured.
update public.notification_dispatch_config
set shared_secret = encode(extensions.gen_random_bytes(32), 'hex'),
    app_variant = 'production',
    function_url = null,
    updated_at = now()
where singleton;

-- Preserve broadcast history but close any state that claimed to be live or
-- scheduled at snapshot time. Preserve configured stream rows in an offline
-- state so mosque setup does not need to be recreated.
update public.adhans
set status = case
      when status = 'live' then 'completed'::public.adhan_status
      when status = 'scheduled' then 'cancelled'::public.adhan_status
      else status
    end,
    broadcast_ended_at = case
      when status = 'live' then coalesce(broadcast_ended_at, now())
      else broadcast_ended_at
    end,
    ended_at = case
      when status = 'live' then coalesce(ended_at, now())
      else ended_at
    end,
    updated_at = now()
where status in ('live', 'scheduled');

update public.adhan_broadcasts
set status = case
      when status = 'live' then 'completed'
      when status = 'scheduled' then 'cancelled'
      else status
    end,
    ended_at = case
      when status = 'live' then coalesce(ended_at, now())
      else ended_at
    end,
    updated_at = now()
where status in ('live', 'scheduled');

update public.streams
set is_live = false,
    current_prayer = null,
    started_at = null,
    ended_at = case when is_live then coalesce(ended_at, now()) else ended_at end,
    stream_url = null,
    livekit_room_name = null,
    updated_at = now();

delete from public.mosque_live_stream_upstream_states;

-- Runtime counters and approvals are environment-specific. Account deletion
-- remains fail closed until production receives its own audited approval row.
delete from public.account_control_rate_limits;
delete from public.account_deletion_release_approvals;

-- Automation was not requested for this release. Preserve completed/reviewable
-- assistant history, cancel executable work, and remove worker heartbeats.
update public.mosque_assistant_jobs
set status = 'cancelled',
    lease_token = null,
    lease_until = null,
    error = 'Cancelled during production migration preparation.',
    updated_at = now()
where status in ('queued', 'running');

delete from public.mosque_assistant_workers;
update public.mosque_assistant_automation
set enabled = false,
    last_checked_at = null,
    last_queued = 0,
    last_error = null
where singleton;

-- The final operator must configure these jobs against production only after
-- API/secret checks pass. Do not import cron-data.sql into production.
do $cron$
declare
  job record;
begin
  if to_regclass('cron.job') is not null then
    for job in
      select jobid
      from cron.job
      where jobname in (
        'adhan-connect-push-dispatch-staging',
        'adhan-connect-push-dispatch-production',
        'fetch-elm-timetable-daily'
      )
    loop
      perform cron.unschedule(job.jobid);
    end loop;
  end if;
end
$cron$;

-- Fail the transaction if executable state survived cleanup.
do $$
begin
  if exists (select 1 from auth.sessions)
      or exists (select 1 from auth.refresh_tokens)
      or exists (select 1 from auth.one_time_tokens)
      or exists (select 1 from auth.flow_state)
      or exists (select 1 from auth.oauth_authorizations)
      or exists (select 1 from auth.oauth_consents)
      or exists (select 1 from auth.oauth_client_states)
      or exists (select 1 from auth.webauthn_challenges) then
    raise exception 'Auth runtime state remains after migration preparation.';
  end if;
  if exists (select 1 from public.push_devices)
      or exists (select 1 from public.notification_events)
      or exists (select 1 from public.notification_deliveries)
      or exists (select 1 from public.travel_notification_regions)
      or exists (select 1 from public.app_notifications) then
    raise exception 'Notification runtime state remains after migration preparation.';
  end if;
  if exists (select 1 from public.streams where is_live)
      or exists (select 1 from public.adhans where status in ('live', 'scheduled'))
      or exists (select 1 from public.adhan_broadcasts where status in ('live', 'scheduled')) then
    raise exception 'Live or scheduled broadcast state remains after migration preparation.';
  end if;
  if (select count(*) from public.notification_dispatch_config) <> 1
      or not exists (
    select 1 from public.notification_dispatch_config
    where singleton
      and app_variant = 'production'
      and function_url is null
      and shared_secret ~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'Notification dispatch did not fail closed.';
  end if;
  if (select count(*) from public.mosque_assistant_automation) <> 1
      or not exists (
        select 1 from public.mosque_assistant_automation
        where singleton and not enabled
      )
      or exists (
        select 1 from public.mosque_assistant_jobs
        where status in ('queued', 'running')
      )
      or exists (select 1 from public.mosque_assistant_workers) then
    raise exception 'Mosque assistant automation remains enabled.';
  end if;
  if not exists (select 1 from auth.users)
      or exists (select 1 from auth.users where coalesce(encrypted_password, '') = '') then
    raise exception 'Expected password-backed Auth users were not preserved.';
  end if;
  if exists (
    select 1
    from auth.users
    where coalesce(confirmation_token, '') <> ''
       or confirmation_sent_at is not null
       or coalesce(recovery_token, '') <> ''
       or recovery_sent_at is not null
       or coalesce(email_change_token_new, '') <> ''
       or coalesce(email_change_token_current, '') <> ''
       or email_change_sent_at is not null
       or coalesce(phone_change_token, '') <> ''
       or phone_change_sent_at is not null
       or coalesce(reauthentication_token, '') <> ''
       or reauthentication_sent_at is not null
  ) then
    raise exception 'Legacy Auth token fields remain populated.';
  end if;
  if exists (
    select 1
    from public.streams
    where current_prayer is not null
       or started_at is not null
       or stream_url is not null
       or livekit_room_name is not null
  ) then
    raise exception 'A stream retains environment-specific live state.';
  end if;
  if exists (select 1 from public.mosque_live_stream_upstream_states)
      or exists (select 1 from public.account_control_rate_limits)
      or exists (select 1 from public.account_deletion_release_approvals) then
    raise exception 'Environment-specific application state remains.';
  end if;
  if to_regclass('cron.job') is not null and exists (
    select 1
    from cron.job
    where jobname in (
      'adhan-connect-push-dispatch-staging',
      'adhan-connect-push-dispatch-production',
      'fetch-elm-timetable-daily'
    )
  ) then
    raise exception 'A quarantined outbound cron job remains scheduled.';
  end if;
  if exists (select 1 from pg_constraint where not convalidated) then
    raise exception 'One or more database constraints are not validated.';
  end if;
end
$$;

set local session_replication_role = origin;
commit;

select json_build_object(
  'ok', true,
  'authUsers', (select count(*) from auth.users),
  'publicUsers', (select count(*) from public.users),
  'mosques', (select count(*) from public.mosques),
  'staffRota', (select count(*) from public.staff_rota),
  'notificationPreferences', (select count(*) from public.notification_preferences),
  'streamsPreservedOffline', (select count(*) from public.streams),
  'assistantAutomationEnabled', coalesce((
    select enabled from public.mosque_assistant_automation where singleton
  ), false)
) as migration_copy_result;
