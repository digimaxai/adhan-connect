create temporary table _gis_search_before on commit drop as
select 'london' as scenario, coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) as result from public.search_mosques(null,51.5072,-0.1276,100,50) s
union all select 'glasgow',coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.search_mosques(null,55.8642,-4.2518,100,50) s
union all select 'no_coordinates',coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.search_mosques(null,null,null,25,50) s;
