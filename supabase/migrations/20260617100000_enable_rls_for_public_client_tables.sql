-- Address Supabase Security Advisor rls_disabled_in_public findings for
-- client-facing tables that existed before the newer RLS migrations.

alter table if exists public.streams enable row level security;
alter table if exists public.adhans enable row level security;
alter table if exists public.events enable row level security;
alter table if exists public.campaigns enable row level security;
alter table if exists public.subscriptions enable row level security;

-- Subscriptions: users can only read/create/delete their own follow rows.
do $$
begin
  if to_regclass('public.subscriptions') is not null then
    execute 'grant select, insert, delete on public.subscriptions to authenticated';

    execute 'drop policy if exists "subscriptions_select_own" on public.subscriptions';
    execute 'create policy "subscriptions_select_own" on public.subscriptions for select to authenticated using (auth.uid() is not null and auth.uid() = user_id)';

    execute 'drop policy if exists "subscriptions_insert_own" on public.subscriptions';
    execute 'create policy "subscriptions_insert_own" on public.subscriptions for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id)';

    execute 'drop policy if exists "subscriptions_delete_own" on public.subscriptions';
    execute 'create policy "subscriptions_delete_own" on public.subscriptions for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id)';
  end if;
end $$;

-- Streams: listeners can read only live stream metadata; muezzins/admins can
-- create and update rows for mosques they are allowed to broadcast from.
do $$
declare
  stream_read_columns text;
begin
  if to_regclass('public.streams') is not null then
    revoke select on public.streams from anon, authenticated;

    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into stream_read_columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'streams'
      and column_name = any (array[
        'id',
        'mosque_id',
        'type',
        'status',
        'is_live',
        'started_at',
        'ended_at',
        'current_prayer',
        'last_health_check',
        'livekit_room_name'
      ]);

    if stream_read_columns is not null then
      execute format('grant select (%s) on public.streams to anon, authenticated', stream_read_columns);
    end if;

    execute 'grant insert, update on public.streams to authenticated';

    execute 'drop policy if exists "streams_listener_select_live" on public.streams';
    execute 'create policy "streams_listener_select_live" on public.streams for select to anon, authenticated using (is_live = true)';

    execute 'drop policy if exists "streams_broadcaster_select" on public.streams';
    execute 'create policy "streams_broadcaster_select" on public.streams for select to authenticated using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id) or public.is_active_muezzin_for_mosque(mosque_id))';

    execute 'drop policy if exists "streams_broadcaster_insert" on public.streams';
    execute 'create policy "streams_broadcaster_insert" on public.streams for insert to authenticated with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id) or public.is_active_muezzin_for_mosque(mosque_id))';

    execute 'drop policy if exists "streams_broadcaster_update" on public.streams';
    execute 'create policy "streams_broadcaster_update" on public.streams for update to authenticated using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id) or public.is_active_muezzin_for_mosque(mosque_id)) with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id) or public.is_active_muezzin_for_mosque(mosque_id))';
  end if;
end $$;

-- Adhans: public clients may read live/completed rows, while mosque
-- broadcasters/admins can manage rows scoped to their mosque.
do $$
begin
  if to_regclass('public.adhans') is not null then
    execute 'grant select on public.adhans to anon, authenticated';
    execute 'grant insert, update on public.adhans to authenticated';

    execute 'drop policy if exists "adhans_listener_select_live_completed" on public.adhans';
    execute 'create policy "adhans_listener_select_live_completed" on public.adhans for select to anon, authenticated using (status in (''live'', ''completed''))';

    execute 'drop policy if exists "adhans_broadcaster_select" on public.adhans';
    execute 'create policy "adhans_broadcaster_select" on public.adhans for select to authenticated using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id) or public.is_active_muezzin_for_mosque(mosque_id))';

    execute 'drop policy if exists "adhans_broadcaster_insert" on public.adhans';
    execute 'create policy "adhans_broadcaster_insert" on public.adhans for insert to authenticated with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id) or public.is_active_muezzin_for_mosque(mosque_id))';

    execute 'drop policy if exists "adhans_broadcaster_update" on public.adhans';
    execute 'create policy "adhans_broadcaster_update" on public.adhans for update to authenticated using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id) or public.is_active_muezzin_for_mosque(mosque_id)) with check (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id) or public.is_active_muezzin_for_mosque(mosque_id))';
  end if;
end $$;

-- Events and campaigns: public reads are limited to published/active content;
-- mosque admins retain full CRUD for their mosque.
do $$
declare
  event_read_columns text;
  campaign_read_columns text;
begin
  if to_regclass('public.events') is not null then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into event_read_columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = any (array[
        'id',
        'mosque_id',
        'title',
        'description',
        'location',
        'capacity',
        'start_at',
        'status',
        'is_public',
        'created_at'
      ]);

    if event_read_columns is not null then
      execute format('grant select (%s) on public.events to anon, authenticated', event_read_columns);
    end if;

    execute 'grant insert, update, delete on public.events to authenticated';

    execute 'drop policy if exists "events_public_select_published" on public.events';
    execute 'create policy "events_public_select_published" on public.events for select to anon, authenticated using (status = ''published'' and is_public = true)';

    execute 'drop policy if exists "events_admin_select" on public.events';
    execute 'create policy "events_admin_select" on public.events for select to authenticated using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))';
  end if;

  if to_regclass('public.campaigns') is not null then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into campaign_read_columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campaigns'
      and column_name = any (array[
        'id',
        'mosque_id',
        'title',
        'description',
        'goal_cents',
        'raised_cents',
        'end_at',
        'status',
        'created_at'
      ]);

    if campaign_read_columns is not null then
      execute format('grant select (%s) on public.campaigns to anon, authenticated', campaign_read_columns);
    end if;

    execute 'grant insert, update, delete on public.campaigns to authenticated';

    execute 'drop policy if exists "campaigns_public_select_active" on public.campaigns';
    execute 'create policy "campaigns_public_select_active" on public.campaigns for select to anon, authenticated using (status::text = ''active'' and (end_at is null or end_at >= current_date))';

    execute 'drop policy if exists "campaigns_admin_select" on public.campaigns';
    execute 'create policy "campaigns_admin_select" on public.campaigns for select to authenticated using (public.is_main_admin() or public.is_local_admin_for_mosque(mosque_id))';
  end if;
end $$;
