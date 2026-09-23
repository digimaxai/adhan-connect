-- Override Supabase default table grants: all writes must use the locking RPC.
revoke all on public.event_engagement from public, anon, authenticated;
grant select on public.event_engagement to authenticated;
