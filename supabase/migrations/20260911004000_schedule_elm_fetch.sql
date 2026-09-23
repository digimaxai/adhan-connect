-- Schedule daily fetch-elm-timetable Edge Function invocation
-- Runs at 01:00 UTC daily to populate elm_timetable cache before London Fajr times

-- pg_cron extension (should already be enabled in production, but safe to check)
create extension if not exists pg_cron;

-- Grant permissions so postgres role can schedule jobs
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Schedule the fetch-elm-timetable Edge Function to run daily at 01:00 UTC
select cron.schedule(
  'fetch-elm-timetable-daily',
  '0 1 * * *',  -- every day at 01:00 UTC
  $$
  select
    net.http_post(
      url := concat(current_setting('app.supabase_url'), '/functions/v1/fetch-elm-timetable'),
      headers := jsonb_build_object(
        'Authorization', concat('Bearer ', current_setting('app.service_role_key')),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id
  $$
);
