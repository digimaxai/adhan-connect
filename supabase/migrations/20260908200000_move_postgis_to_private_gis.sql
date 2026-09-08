-- Move PostGIS out of the public Data API without dropping application columns.
-- Rehearsed on staging and production; preserve data, grants, RLS and RPCs.
-- This migration requires a transaction and PostGIS 3.3.7 in public.
-- Execute in a transaction. No CASCADE: unknown dependencies must abort.
set local lock_timeout = '5s';
set local statement_timeout = '40s';
create temporary table _gis_columns on commit drop as
select a.attrelid, a.attname, format_type(a.atttypid,a.atttypmod) as old_type,
       a.attnum, a.attnotnull, a.attacl, col_description(a.attrelid,a.attnum) as comment,
       a.attgenerated, ad.oid as default_oid
from pg_attribute a join pg_type t on t.oid=a.atttypid
join pg_namespace n on n.oid=t.typnamespace
left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
where n.nspname='public' and t.typname in ('geography','geometry')
  and a.attnum>0 and not a.attisdropped
  and a.attrelid in (select oid from pg_class where relkind in ('r','p'));

do $$ begin
  if not exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis' and n.nspname='public' and e.extversion='3.3.7') then
    raise exception 'Expected PostGIS 3.3.7 in public';
  end if;
  if exists(select 1 from pg_namespace where nspname='gis') then
    raise exception 'gis already exists; inspect before proceeding';
  end if;
  if exists(select 1 from _gis_columns where attgenerated<>'' or default_oid is not null or old_type<>'geography(Point,4326)') then
    raise exception 'Unexpected geography column definition';
  end if;
end $$;

-- Lock before taking comparison snapshots; concurrent writers cannot race them.
do $$ declare r record; begin
  for r in select distinct attrelid from _gis_columns order by attrelid loop
    execute format('lock table %s in access exclusive mode',r.attrelid::regclass);
  end loop;
end $$;
create temporary table _gis_rows (relid oid, row_data jsonb) on commit drop;
create temporary table _gis_tables on commit drop as
select c.oid, c.relacl, c.relrowsecurity, c.relforcerowsecurity
from pg_class c where c.oid in (select attrelid from _gis_columns);
do $$ declare r record; begin
  for r in select distinct attrelid from _gis_columns loop
    execute format('insert into _gis_rows select %s, to_jsonb(t) from %s t',r.attrelid,r.attrelid::regclass);
  end loop;
end $$;
create temporary table _gis_reference on commit drop as select * from public.spatial_ref_sys;
create temporary table _gis_indexes on commit drop as
select distinct i.indexrelid, pg_get_indexdef(i.indexrelid) as definition,
       obj_description(i.indexrelid,'pg_class') as comment
from pg_index i join _gis_columns c on c.attrelid=i.indrelid and c.attnum=any(i.indkey);
create temporary table _gis_functions on commit drop as
select p.oid, p.oid::regprocedure::text as signature, p.proacl, p.proowner,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind='f'
  and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  and p.prosrc ~* '(geography|geometry|\mst_[a-z]|spatial_ref_sys)';

do $$ begin
  if exists(select 1 from _gis_functions where signature not in (
    'search_mosques(text,double precision,double precision,double precision,integer)',
    'nearby_mosque_context_v1(double precision,double precision,double precision,integer)',
    'set_travel_notification_region_v1(double precision,double precision,integer,text,integer)',
    'materialize_notification_deliveries_v1(text,integer)'
  )) then raise exception 'Unaudited spatial function; review before migrating'; end if;
end $$;

do $$ declare r record; begin
  for r in select * from _gis_indexes loop
    execute format('drop index %s restrict',r.indexrelid::regclass);
  end loop;
  for r in select * from _gis_columns loop
    execute format('alter table %s alter column %I type text using %I::text',r.attrelid::regclass,r.attname,r.attname);
  end loop;
end $$;

drop extension postgis restrict;
create schema gis authorization postgres;
revoke all on schema gis from public, anon, authenticated;
grant usage on schema gis to service_role;
create extension postgis with schema gis version '3.3.7';
-- Refuse to commit if reinstalling changes any reference definitions (checked below).

do $$ declare r record; definition text; changed boolean; begin
  for r in select * from _gis_columns loop
    execute format('alter table %s alter column %I type gis.geography(Point,4326) using %I::gis.geography(Point,4326)',r.attrelid::regclass,r.attname,r.attname);
  end loop;
  for r in select * from _gis_indexes loop
    execute r.definition;
    if r.comment is not null then
      execute format('comment on index %s is %L', substring(r.definition from 'INDEX ([^ ]+) ON'), r.comment);
    end if;
  end loop;
  for r in select * from _gis_functions loop
    -- Only the audited built-in spatial calls and type references are rewritten.
    definition := replace(r.definition,'public.geography','gis.geography');
    definition := regexp_replace(definition,'\m(st_distance|st_dwithin|st_setsrid|st_makepoint)\M','gis.\1','gi');
    definition := regexp_replace(definition,'([^a-zA-Z0-9_.])geography\(','\1gis.geography(','g');
    if definition ~ 'public\.gis\.' then raise exception 'Unexpected qualified spatial call'; end if;
    execute definition;
    if (select proacl is distinct from r.proacl or proowner<>r.proowner from pg_proc where oid=r.oid) then
      raise exception 'Function grants or ownership changed: %',r.signature;
    end if;
  end loop;
  if exists(select 1 from _gis_columns old join pg_attribute a on a.attrelid=old.attrelid and a.attnum=old.attnum where a.attnotnull<>old.attnotnull or a.attacl is distinct from old.attacl or col_description(a.attrelid,a.attnum) is distinct from old.comment) then
    raise exception 'Column constraints, grants or comments changed';
  end if;
  -- Compare full rows, including nulls and all non-spatial application data.
  for r in select distinct attrelid from _gis_columns loop
    execute format('select exists((select row_data from _gis_rows where relid=%s except all select to_jsonb(t) from %s t) union all (select to_jsonb(t) from %s t except all select row_data from _gis_rows where relid=%s))',r.attrelid,r.attrelid::regclass,r.attrelid::regclass,r.attrelid) into changed;
    if changed then raise exception 'Data mismatch in %',r.attrelid::regclass; end if;
  end loop;
  if exists(select 1 from _gis_tables old join pg_class c on c.oid=old.oid where c.relacl is distinct from old.relacl or c.relrowsecurity<>old.relrowsecurity or c.relforcerowsecurity<>old.relforcerowsecurity) then
    raise exception 'Table security changed';
  end if;
  if exists((select * from _gis_reference except select * from gis.spatial_ref_sys) union all (select * from gis.spatial_ref_sys except select * from _gis_reference)) then
    raise exception 'Spatial reference definitions changed';
  end if;
  if has_schema_privilege('anon','gis','USAGE') or has_schema_privilege('authenticated','gis','USAGE') then
    raise exception 'Private GIS schema is accessible to client roles';
  end if;
end $$;
notify pgrst, 'reload schema';
