-- Automatic dispatcher for planned adhan-delivery occurrences. Pure in-database
-- polling via pg_cron calling claim_adhan_delivery_v1 directly: no HTTP call,
-- no Edge Function, no added invocation cost as mosque count grows. Cost stays
-- one small indexed scan every 10 seconds regardless of scale; the only work
-- proportional to real usage is the RPC's own row updates when something is
-- actually due.
--
-- Deliberately out of scope here (separate milestones, not folded in):
--   - Planning ahead (calling plan_adhan_delivery_v1 from resolved prayer
--     times) — a lower-frequency job, reusing existing JS prayer-time
--     resolution, tracked separately.
--   - Listener push notifications on a real fire — needs a new listener
--     opt-in preference and careful integration with the existing
--     notification_events materialization/preference pipeline, which this
--     migration does not touch. adhan_delivery_occurrences.state/reason is
--     already a complete, queryable delivery-outcome audit trail on its own.
--   - Wiring confirm_adhan_delivery_live_v1 into the real live-broadcast
--     start path (protected live code, its own deliberate change).
create extension if not exists pg_cron;

create function public.dispatch_due_adhan_deliveries_v1()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
  v_result public.adhan_delivery_occurrences;
  v_count integer := 0;
begin
  for v_row in
    select id, plan_revision from public.adhan_delivery_occurrences
    where state = 'planned' and recording_due_at <= clock_timestamp()
  loop
    begin
      select * into v_result from public.claim_adhan_delivery_v1(v_row.id, v_row.plan_revision);
      v_count := v_count + 1;
    exception when others then
      -- One occurrence's error (e.g. a concurrent planner changing its
      -- plan_revision mid-loop) must never abort the rest of this tick's
      -- batch or the cron job itself.
      raise warning 'dispatch_due_adhan_deliveries_v1: occurrence % failed: %', v_row.id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.dispatch_due_adhan_deliveries_v1() from public, anon, authenticated, service_role;

select cron.schedule(
  'adhan-connect-delivery-dispatch',
  '10 seconds',
  $$select public.dispatch_due_adhan_deliveries_v1();$$
);

comment on function public.dispatch_due_adhan_deliveries_v1() is
  'Claims every adhan_delivery_occurrences row past its recording_due_at. Idempotent and safe to run concurrently with itself or a manual claim call: claim_adhan_delivery_v1 is a no-op once a row has left the planned state.';
