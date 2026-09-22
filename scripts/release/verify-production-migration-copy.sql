\set ON_ERROR_STOP on

do $$
begin
  if exists (select 1 from auth.sessions)
      or exists (select 1 from auth.refresh_tokens)
      or exists (select 1 from auth.one_time_tokens)
      or exists (select 1 from auth.flow_state)
      or exists (select 1 from auth.oauth_authorizations)
      or exists (select 1 from auth.oauth_consents)
      or exists (select 1 from auth.oauth_client_states)
      or exists (select 1 from auth.webauthn_challenges)
      or exists (select 1 from auth.mfa_challenges)
      or exists (select 1 from auth.mfa_amr_claims)
      or exists (select 1 from auth.audit_log_entries) then
    raise exception 'Auth runtime state is not empty.';
  end if;
  if exists (select 1 from public.push_devices)
      or exists (select 1 from public.notification_events)
      or exists (select 1 from public.notification_deliveries)
      or exists (select 1 from public.travel_notification_regions)
      or exists (select 1 from public.app_notifications) then
    raise exception 'Notification runtime state is not empty.';
  end if;
  if exists (select 1 from public.streams where is_live)
      or exists (select 1 from public.adhans where status in ('live', 'scheduled'))
      or exists (select 1 from public.adhan_broadcasts where status in ('live', 'scheduled')) then
    raise exception 'Live/scheduled state remains.';
  end if;
  if (select count(*) from public.notification_dispatch_config) <> 1
      or not exists (
    select 1
    from public.notification_dispatch_config
    where singleton
      and app_variant = 'production'
      and function_url is null
      and shared_secret ~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'Notification dispatch is not quarantined for production.';
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
    raise exception 'Executable mosque-assistant state remains.';
  end if;
  if not exists (select 1 from auth.users)
      or exists (select 1 from auth.users where coalesce(encrypted_password, '') = '') then
    raise exception 'Password-backed Auth users were not preserved.';
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

select json_build_object(
  'ok', true,
  'authUsers', (select count(*) from auth.users),
  'identities', (select count(*) from auth.identities),
  'publicUsers', (select count(*) from public.users),
  'profiles', (select count(*) from public.profiles),
  'mosques', (select count(*) from public.mosques),
  'mosqueAdmins', (select count(*) from public.mosque_admins),
  'muezzins', (select count(*) from public.muezzins),
  'staffRota', (select count(*) from public.staff_rota),
  'prayerTimes', (select count(*) from public.prayer_times),
  'mosquePrayerTimes', (select count(*) from public.mosque_prayer_times),
  'notificationPreferences', (select count(*) from public.notification_preferences),
  'storageBuckets', (select count(*) from storage.buckets),
  'storageObjects', (select count(*) from storage.objects)
) as migration_copy_verification;
