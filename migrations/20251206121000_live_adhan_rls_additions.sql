-- Live Adhan MVP - RLS additions (additive only)
-- Adds policies required for live-streaming without altering existing policies.
-- Does NOT force-enable RLS if currently disabled, to avoid accidental lockouts.

-- Helper predicates
create or replace view live_adhan_admins as
select id from users where role in ('local_admin','main_admin');

-- STREAMS policies ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'streams' and policyname = 'streams muezzin select own mosque'
  ) then
    create policy "streams muezzin select own mosque" on streams
      for select using (
        exists (
          select 1 from muezzins m
          where m.user_id = auth.uid()
            and m.mosque_id = streams.mosque_id
            and m.is_active = true
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'streams' and policyname = 'streams muezzin update own mosque'
  ) then
    create policy "streams muezzin update own mosque" on streams
      for update using (
        exists (
          select 1 from muezzins m
          where m.user_id = auth.uid()
            and m.mosque_id = streams.mosque_id
            and m.is_active = true
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'streams' and policyname = 'streams listener select live'
  ) then
    create policy "streams listener select live" on streams
      for select using (is_live = true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'streams' and policyname = 'streams admin select'
  ) then
    create policy "streams admin select" on streams
      for select using (
        exists (select 1 from live_adhan_admins a where a.id = auth.uid())
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'streams' and policyname = 'streams admin update'
  ) then
    create policy "streams admin update" on streams
      for update using (
        exists (select 1 from live_adhan_admins a where a.id = auth.uid())
      );
  end if;
end$$;

-- ADHANS policies ----------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'adhans' and policyname = 'adhans muezzin select own mosque'
  ) then
    create policy "adhans muezzin select own mosque" on adhans
      for select using (
        exists (
          select 1 from muezzins m
          where m.user_id = auth.uid()
            and m.mosque_id = adhans.mosque_id
            and m.is_active = true
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'adhans' and policyname = 'adhans muezzin update own mosque'
  ) then
    create policy "adhans muezzin update own mosque" on adhans
      for update using (
        exists (
          select 1 from muezzins m
          where m.user_id = auth.uid()
            and m.mosque_id = adhans.mosque_id
            and m.is_active = true
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'adhans' and policyname = 'adhans listener select live-completed'
  ) then
    create policy "adhans listener select live-completed" on adhans
      for select using (status in ('live','completed'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'adhans' and policyname = 'adhans admin select'
  ) then
    create policy "adhans admin select" on adhans
      for select using (
        exists (select 1 from live_adhan_admins a where a.id = auth.uid())
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'adhans' and policyname = 'adhans admin update'
  ) then
    create policy "adhans admin update" on adhans
      for update using (
        exists (select 1 from live_adhan_admins a where a.id = auth.uid())
      );
  end if;
end$$;
