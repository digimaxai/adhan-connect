-- Planning-ahead schedule: resolves prayer times for activated mosques only
-- and snapshots occurrences via plan_adhan_delivery_v1. Runs every 15 minutes
-- (ordinary pg_cron syntax, not the dispatcher's 10-second precision) — this
-- only needs to keep occurrences planned comfortably ahead of their due time,
-- not fire anything itself. Mirrors notification_dispatch_schedule's secret/
-- config pattern exactly.
create table public.adhan_delivery_plan_config (
  singleton boolean primary key default true check (singleton),
  shared_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  app_variant text check (app_variant in ('staging', 'production')),
  function_url text,
  updated_at timestamptz not null default now()
);
insert into public.adhan_delivery_plan_config(singleton) values (true) on conflict (singleton) do nothing;
alter table public.adhan_delivery_plan_config enable row level security;
revoke all on public.adhan_delivery_plan_config from public, anon, authenticated;
grant select, update on public.adhan_delivery_plan_config to service_role;

create function public.verify_adhan_delivery_plan_secret_v1(p_secret text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    digest(coalesce(p_secret, ''), 'sha256') = digest(config.shared_secret, 'sha256'), false
  ) from public.adhan_delivery_plan_config config where config.singleton;
$$;

create function public.configure_adhan_delivery_plan_schedule_v1(p_function_url text, p_app_variant text)
returns bigint language plpgsql security definer set search_path = public, extensions, cron, net as $$
declare v_job_name text; v_job_id bigint; v_existing_job_id bigint;
begin
  if p_app_variant not in ('staging', 'production') then raise exception 'Invalid app variant.'; end if;
  if p_function_url !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/adhan-delivery-plan$' then
    raise exception 'Invalid Supabase function URL.';
  end if;
  v_job_name := 'adhan-connect-delivery-plan-' || p_app_variant;
  select jobid into v_existing_job_id from cron.job where jobname = v_job_name limit 1;
  if v_existing_job_id is not null then perform cron.unschedule(v_existing_job_id); end if;
  update public.adhan_delivery_plan_config set app_variant = p_app_variant, function_url = p_function_url, updated_at = now()
    where singleton;
  select cron.schedule(v_job_name, '*/15 * * * *', format($command$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
          (select shared_secret from public.adhan_delivery_plan_config where singleton)),
        body := '{"source":"pg_cron"}'::jsonb, timeout_milliseconds := 120000
      );
    $command$, p_function_url)) into v_job_id;
  return v_job_id;
end;
$$;

revoke all on function public.verify_adhan_delivery_plan_secret_v1(text) from public, anon, authenticated;
revoke all on function public.configure_adhan_delivery_plan_schedule_v1(text, text) from public, anon, authenticated;
grant execute on function public.verify_adhan_delivery_plan_secret_v1(text) to service_role;
grant execute on function public.configure_adhan_delivery_plan_schedule_v1(text, text) to service_role;

comment on table public.adhan_delivery_plan_config is
  'Service-only scheduler endpoint and random shared secret for the adhan-delivery-plan function. Mirrors notification_dispatch_config.';
