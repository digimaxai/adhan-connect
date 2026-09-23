-- The first staging deployment exposed that staff_rota.prayer_name/prayer can
-- be the prayer_t enum rather than text. Keep the canonical migration correct
-- for fresh databases and patch only an already-installed uncast definition.

do $migration$
declare
  v_original text;
  v_corrected text;
begin
  select pg_get_functiondef(
    'public.enqueue_due_adhan_reminders_v1(timestamptz)'::regprocedure
  ) into v_original;

  v_corrected := replace(
    replace(
      v_original,
      'trim(rota.prayer_name)',
      'trim(rota.prayer_name::text)'
    ),
    'trim(rota.prayer)',
    'trim(rota.prayer::text)'
  );

  if v_corrected is distinct from v_original then
    execute v_corrected;
  end if;
end;
$migration$;

