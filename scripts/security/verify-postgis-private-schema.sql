-- Read-only checks; run as postgres after the migration.
begin;
do $$ begin
  if to_regclass('public.spatial_ref_sys') is not null then raise exception 'Reference table remains public'; end if;
  if not exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis' and n.nspname='gis') then raise exception 'PostGIS is not in gis'; end if;
  if has_schema_privilege('anon','gis','USAGE') or has_schema_privilege('authenticated','gis','USAGE') then raise exception 'Client GIS access'; end if;
  if has_schema_privilege('anon','gis','CREATE') or has_schema_privilege('authenticated','gis','CREATE') then raise exception 'Client GIS creation access'; end if;
  if gis.st_srid(gis.st_transform(gis.st_setsrid(gis.st_makepoint(-0.1276,51.5072),4326),3857))<>3857 then raise exception 'Coordinate transformation failed'; end if;
  perform * from public.search_mosques(null,51.5072,-0.1276,100,5);
end $$;
set local role anon;
do $$ begin
  begin perform srid from gis.spatial_ref_sys limit 1;
    raise exception 'anon reference access';
  exception when insufficient_privilege then null; end;
  begin perform * from public.jumuah_slot_attendance_summary limit 1;
    raise exception 'anon attendance access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  perform * from public.search_mosques(null,51.5072,-0.1276,100,5);
  begin perform srid from gis.spatial_ref_sys limit 1;
    raise exception 'authenticated reference access';
  exception when insufficient_privilege then null; end;
  begin perform * from public.jumuah_slot_attendance_summary limit 1;
    raise exception 'authenticated attendance access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select jsonb_build_object('verification','passed','reference_rows',(select count(*) from gis.spatial_ref_sys), 'migration_recorded',exists(select 1 from supabase_migrations.schema_migrations where version='20260908200000'));
rollback;
