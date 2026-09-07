-- Secure scheduler configuration for the push dispatcher.
-- The random shared secret stays in a service-only table. pg_cron reads it at
-- execution time, so it is never copied into cron.job or a migration file.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.notification_dispatch_config (
  singleton boolean primary key default true check (singleton),
  shared_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  app_variant text check (app_variant in ('staging', 'production')),
  function_url text,
  updated_at timestamptz not null default now()
);

insert into public.notification_dispatch_config(singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.notification_dispatch_config enable row level security;
revoke all on public.notification_dispatch_config from public, anon, authenticated;
grant select, update on public.notification_dispatch_config to service_role;

create or replace function public.verify_notification_dispatch_secret_v1(
  p_secret text
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    digest(coalesce(p_secret, ''), 'sha256') = digest(config.shared_secret, 'sha256'),
    false
  )
  from public.notification_dispatch_config config
  where config.singleton;
$$;

create or replace function public.configure_notification_dispatch_schedule_v1(
  p_function_url text,
  p_app_variant text
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, cron, net
as $$
declare
  v_job_name text;
  v_job_id bigint;
  v_existing_job_id bigint;
begin
  if p_app_variant not in ('staging', 'production') then
    raise exception 'Invalid app variant.';
  end if;
  if p_function_url !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/push-dispatch$' then
    raise exception 'Invalid Supabase function URL.';
  end if;

  v_job_name := 'adhan-connect-push-dispatch-' || p_app_variant;
  select jobid into v_existing_job_id from cron.job where jobname = v_job_name limit 1;
  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  update public.notification_dispatch_config
  set app_variant = p_app_variant,
      function_url = p_function_url,
      updated_at = now()
  where singleton;

  select cron.schedule(
    v_job_name,
    '* * * * *',
    format(
      $command$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (
              select shared_secret
              from public.notification_dispatch_config
              where singleton
            )
          ),
          body := '{"source":"pg_cron"}'::jsonb,
          timeout_milliseconds := 25000
        );
      $command$,
      p_function_url
    )
  ) into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.verify_notification_dispatch_secret_v1(text) from public, anon, authenticated;
revoke all on function public.configure_notification_dispatch_schedule_v1(text, text) from public, anon, authenticated;
grant execute on function public.verify_notification_dispatch_secret_v1(text) to service_role;
grant execute on function public.configure_notification_dispatch_schedule_v1(text, text) to service_role;

comment on table public.notification_dispatch_config is
  'Service-only scheduler endpoint and random shared secret for the push dispatcher.';

-- Wake the dispatcher promptly for LIVE alerts. pg_net records the request in
-- its queue inside this transaction but does not perform network I/O until the
-- transaction commits. Any notification error is swallowed so it can never
-- block or roll back the authoritative Adhan status change.
create or replace function public.wake_live_notification_dispatch_v1()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_function_url text;
  v_shared_secret text;
begin
  select config.function_url, config.shared_secret
  into v_function_url, v_shared_secret
  from public.notification_dispatch_config config
  where config.singleton;

  if v_function_url is null or v_shared_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_shared_secret
    ),
    body := jsonb_build_object(
      'source', 'live_event',
      'eventId', new.id
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise warning 'Unable to wake push dispatcher for notification event %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists notification_events_wake_live_dispatch on public.notification_events;
create trigger notification_events_wake_live_dispatch
after insert on public.notification_events
for each row
when (new.kind = 'live_adhan')
execute function public.wake_live_notification_dispatch_v1();

revoke all on function public.wake_live_notification_dispatch_v1() from public, anon, authenticated;
comment on function public.wake_live_notification_dispatch_v1() is
  'Queues an asynchronous push-dispatch request after a LIVE event commits; never calls the broadcast path.';
