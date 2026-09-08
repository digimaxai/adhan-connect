-- Attendance aggregates are private. Preserve the view for trusted server
-- reporting, but remove client access (including inherited PUBLIC grants).
-- security_invoker also prevents future grants from bypassing base-table RLS.
revoke all on public.jumuah_slot_attendance_summary from public, anon, authenticated;
alter view public.jumuah_slot_attendance_summary set (security_invoker = true);

do $$
begin
  if has_table_privilege('anon', 'public.jumuah_slot_attendance_summary', 'SELECT')
     or has_table_privilege('authenticated', 'public.jumuah_slot_attendance_summary', 'SELECT') then
    raise exception 'Attendance summary is still accessible to clients';
  end if;
end $$;
