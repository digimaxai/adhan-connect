create temporary table _gis_search_after on commit drop as
select 'london' as scenario, coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) as result from public.search_mosques(null,51.5072,-0.1276,100,50) s
union all select 'glasgow',coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.search_mosques(null,55.8642,-4.2518,100,50) s
union all select 'no_coordinates',coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.search_mosques(null,null,null,25,50) s;
do $$ begin
  if exists((select * from _gis_search_before except select * from _gis_search_after) union all (select * from _gis_search_after except select * from _gis_search_before)) then
    raise exception 'Search behavior changed';
  end if;
end $$;
set local role anon;
do $$ begin
  if has_function_privilege(current_user,'public.search_mosques(text,double precision,double precision,double precision,integer)','EXECUTE') then
    perform * from public.search_mosques(null,51.5072,-0.1276,100,5);
  end if;
  if has_column_privilege(current_user,'public.mosques','location_geog','SELECT') then
    perform location_geog from public.mosques limit 1;
  end if;
  begin
    perform * from gis.spatial_ref_sys limit 1;
    raise exception 'Anonymous GIS access unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  if has_function_privilege(current_user,'public.search_mosques(text,double precision,double precision,double precision,integer)','EXECUTE') then
    perform * from public.search_mosques(null,51.5072,-0.1276,100,5);
  end if;
  begin
    perform * from gis.spatial_ref_sys limit 1;
    raise exception 'Authenticated GIS access unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ declare uid uuid; begin
  if to_regprocedure('public.nearby_mosque_context_v1(double precision,double precision,double precision,integer)') is not null then
    perform * from public.nearby_mosque_context_v1(51.5072,-0.1276,100,10);
    -- Subtransaction rolls back fixture writes, even on a committed migration.
    begin
      select id into uid from public.users limit 1;
      if uid is null then raise exception 'No staging user for travel RPC test'; end if;
      perform set_config('request.jwt.claim.sub',uid::text,true);
      perform public.set_travel_notification_region_v1(51.5072,-0.1276,15,'Migration verification',1);
      perform public.materialize_notification_deliveries_v1('staging',1);
      raise exception using errcode='ZX001', message='Rollback test writes';
    exception when sqlstate 'ZX001' then null;
    end;
  end if;
end $$;
