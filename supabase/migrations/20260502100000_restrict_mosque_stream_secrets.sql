-- Restrict live stream credential columns from public/authenticated reads.
-- Before this migration, the "public_read_active_mosques" policy granted all
-- columns (including secrets) to anon and authenticated. We revoke the
-- table-level privilege and re-grant only columns that listener/admin UIs
-- need client-side. Server APIs use service_role and are unaffected.

revoke select on public.mosques from anon, authenticated;

do $$
declare
  safe_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into safe_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'mosques'
    and column_name = any (array[
      'id',
      'name',
      'slug',
      'description',
      'status',
      'is_active',
      'active',
      'city',
      'country',
      'country_code',
      'timezone',
      'time_zone',
      'address_line1',
      'address_line2',
      'postcode',
      'location',
      'allow_multi_mosque_local_admins',
      'live_stream_enabled',
      'prayer_calculation_method',
      'created_at',
      'updated_at'
    ]);

  if safe_columns is not null then
    execute format('grant select (%s) on public.mosques to anon, authenticated', safe_columns);
  end if;
end $$;
