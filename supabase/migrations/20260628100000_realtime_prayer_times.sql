-- Enable push updates for listener prayer-time displays.
-- The app also reconciles periodically, but Realtime should carry manual edits immediately.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'prayer_times'
  ) then
    alter publication supabase_realtime add table public.prayer_times;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mosque_prayer_times'
  ) then
    alter publication supabase_realtime add table public.mosque_prayer_times;
  end if;
end $$;
