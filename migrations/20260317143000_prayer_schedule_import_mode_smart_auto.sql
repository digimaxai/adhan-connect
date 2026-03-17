alter table if exists public.prayer_schedule_imports
  drop constraint if exists prayer_schedule_imports_import_mode_check;

alter table if exists public.prayer_schedule_imports
  add constraint prayer_schedule_imports_import_mode_check
  check (
    import_mode is null
    or import_mode in ('smart_auto', 'explicit_iqama', 'adhan_only', 'adhan_plus_fixed_offset')
  );
