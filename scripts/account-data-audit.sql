-- Adhan Connect account-data / deletion-readiness audit
-- Read-only: safe to run in the Supabase SQL editor with the
-- `supabase_read_only_user` role. Do not replace this audit with assumptions
-- from the tracked migration folders; the production schema is authoritative.

-- 1. Every foreign key that points directly at the three known user/profile
-- relations. `delete_action = no action` or `restrict` is a deletion blocker
-- until it has an intentional retention/reassignment rule.
select
  constraint_schema.nspname as source_schema,
  source_table.relname as source_table,
  constraint_record.conname as constraint_name,
  target_schema.nspname as target_schema,
  target_table.relname as target_table,
  case constraint_record.confdeltype
    when 'a' then 'no action'
    when 'r' then 'restrict'
    when 'c' then 'cascade'
    when 'n' then 'set null'
    when 'd' then 'set default'
    else constraint_record.confdeltype::text
  end as delete_action,
  pg_catalog.pg_get_constraintdef(constraint_record.oid, true) as definition
from pg_catalog.pg_constraint as constraint_record
join pg_catalog.pg_class as source_table
  on source_table.oid = constraint_record.conrelid
join pg_catalog.pg_namespace as constraint_schema
  on constraint_schema.oid = source_table.relnamespace
join pg_catalog.pg_class as target_table
  on target_table.oid = constraint_record.confrelid
join pg_catalog.pg_namespace as target_schema
  on target_schema.oid = target_table.relnamespace
where constraint_record.contype = 'f'
  and constraint_record.confrelid in (
    pg_catalog.to_regclass('auth.users'),
    pg_catalog.to_regclass('public.users'),
    pg_catalog.to_regclass('public.profiles')
  )
order by target_schema.nspname, target_table.relname,
  constraint_schema.nspname, source_table.relname, constraint_record.conname;

-- 2. Foreign-key chains from the user-facing relations. This exposes indirect
-- cascades such as profile -> muezzin -> rota.
with recursive target_relations as (
  select relation_oid, path, depth
  from (
    values
      (pg_catalog.to_regclass('auth.users'), array['auth.users']::text[], 0),
      (pg_catalog.to_regclass('public.users'), array['public.users']::text[], 0),
      (pg_catalog.to_regclass('public.profiles'), array['public.profiles']::text[], 0)
  ) as seed(relation_oid, path, depth)
  where relation_oid is not null

  union all

  select
    constraint_record.conrelid,
    target_relations.path || constraint_record.conrelid::regclass::text,
    target_relations.depth + 1
  from target_relations
  join pg_catalog.pg_constraint as constraint_record
    on constraint_record.confrelid = target_relations.relation_oid
   and constraint_record.contype = 'f'
  where target_relations.depth < 8
    and not (constraint_record.conrelid::regclass::text = any(target_relations.path))
)
select distinct
  depth,
  array_to_string(path, ' -> ') as dependency_path
from target_relations
where depth > 0
order by depth, dependency_path;

-- 3. User-like UUID columns without a declared foreign key. These may contain
-- personal attribution that a cascade cannot find.
with user_like_columns as (
  select
    columns.table_schema,
    columns.table_name,
    columns.column_name
  from information_schema.columns
  where columns.table_schema in ('public', 'storage')
    and columns.data_type = 'uuid'
    and (
      columns.column_name = 'id'
      or columns.column_name = 'owner'
      or columns.column_name like '%user_id'
      or columns.column_name like '%created_by'
      or columns.column_name like '%updated_by'
      or columns.column_name like '%assigned_by'
      or columns.column_name like '%initiated_by'
      or columns.column_name like '%resolved_by%'
      or columns.column_name like '%started_by%'
    )
),
foreign_key_columns as (
  select
    namespace_record.nspname as table_schema,
    table_record.relname as table_name,
    attribute_record.attname as column_name
  from pg_catalog.pg_constraint as constraint_record
  join pg_catalog.pg_class as table_record
    on table_record.oid = constraint_record.conrelid
  join pg_catalog.pg_namespace as namespace_record
    on namespace_record.oid = table_record.relnamespace
  join lateral unnest(constraint_record.conkey) as key_column(attnum)
    on true
  join pg_catalog.pg_attribute as attribute_record
    on attribute_record.attrelid = table_record.oid
   and attribute_record.attnum = key_column.attnum
  where constraint_record.contype = 'f'
)
select user_like_columns.*
from user_like_columns
left join foreign_key_columns
  using (table_schema, table_name, column_name)
where foreign_key_columns.column_name is null
order by user_like_columns.table_schema, user_like_columns.table_name,
  user_like_columns.column_name;

-- 4. Triggers on user/profile/auth-related tables. Review every non-internal
-- trigger for inserts, mirrors, audit writes, and deletion side effects.
select
  namespace_record.nspname as table_schema,
  table_record.relname as table_name,
  trigger_record.tgname as trigger_name,
  procedure_namespace.nspname as function_schema,
  procedure_record.proname as function_name,
  pg_catalog.pg_get_triggerdef(trigger_record.oid, true) as trigger_definition
from pg_catalog.pg_trigger as trigger_record
join pg_catalog.pg_class as table_record
  on table_record.oid = trigger_record.tgrelid
join pg_catalog.pg_namespace as namespace_record
  on namespace_record.oid = table_record.relnamespace
join pg_catalog.pg_proc as procedure_record
  on procedure_record.oid = trigger_record.tgfoid
join pg_catalog.pg_namespace as procedure_namespace
  on procedure_namespace.oid = procedure_record.pronamespace
where not trigger_record.tgisinternal
  and (
    trigger_record.tgrelid in (
      pg_catalog.to_regclass('auth.users'),
      pg_catalog.to_regclass('public.users'),
      pg_catalog.to_regclass('public.profiles')
    )
    or pg_catalog.pg_get_triggerdef(trigger_record.oid, true)
       ~* '(auth[.]users|public[.](users|profiles)|user_id)'
  )
order by table_schema, table_name, trigger_name;

-- 5. Confirm the current shape of the principal identity/profile tables.
select
  columns.table_schema,
  columns.table_name,
  columns.ordinal_position,
  columns.column_name,
  columns.data_type,
  columns.is_nullable,
  columns.column_default
from information_schema.columns
where (columns.table_schema, columns.table_name) in (
  ('auth', 'users'),
  ('public', 'users'),
  ('public', 'profiles'),
  ('public', 'mosque_admins'),
  ('public', 'muezzins'),
  ('public', 'staff_rota'),
  ('public', 'muezzin_cover_requests'),
  ('public', 'adhan_broadcasts'),
  ('public', 'streams'),
  ('storage', 'objects')
)
order by columns.table_schema, columns.table_name, columns.ordinal_position;

-- 6. RLS state for every public/storage table with user-like columns.
select distinct
  namespace_record.nspname as table_schema,
  table_record.relname as table_name,
  table_record.relrowsecurity as rls_enabled,
  table_record.relforcerowsecurity as rls_forced
from pg_catalog.pg_class as table_record
join pg_catalog.pg_namespace as namespace_record
  on namespace_record.oid = table_record.relnamespace
join pg_catalog.pg_attribute as attribute_record
  on attribute_record.attrelid = table_record.oid
where namespace_record.nspname in ('public', 'storage')
  and table_record.relkind in ('r', 'p')
  and attribute_record.attnum > 0
  and not attribute_record.attisdropped
  and (
    attribute_record.attname = 'owner'
    or attribute_record.attname like '%user_id'
    or attribute_record.attname like '%created_by'
    or attribute_record.attname like '%updated_by'
    or attribute_record.attname like '%assigned_by'
    or attribute_record.attname like '%initiated_by'
    or attribute_record.attname like '%resolved_by%'
    or attribute_record.attname like '%started_by%'
  )
order by table_schema, table_name;

-- 7. Actual RLS policy definitions. Enabled RLS without the expected USING and
-- WITH CHECK clauses is not evidence that self-service boundaries are safe.
select
  policies.schemaname as table_schema,
  policies.tablename as table_name,
  policies.policyname as policy_name,
  policies.permissive,
  policies.roles,
  policies.cmd,
  policies.qual as using_expression,
  policies.with_check as with_check_expression
from pg_catalog.pg_policies as policies
where policies.schemaname in ('public', 'storage')
order by policies.schemaname, policies.tablename, policies.policyname;

-- 8. Direct table privileges that can bypass or broaden the intended API
-- surface. Review anon/authenticated grants together with the policies above.
select
  grants.table_schema,
  grants.table_name,
  grants.grantee,
  grants.privilege_type,
  grants.is_grantable
from information_schema.role_table_grants as grants
where grants.table_schema in ('public', 'storage')
  and grants.grantee in ('anon', 'authenticated', 'service_role')
order by grants.table_schema, grants.table_name, grants.grantee,
  grants.privilege_type;

-- 9. Storage buckets and ownership-column availability. Do not include object
-- names in an audit report unless access to the report is restricted.
select
  buckets.id,
  buckets.public,
  buckets.file_size_limit,
  buckets.allowed_mime_types
from storage.buckets as buckets
order by buckets.id;

-- 10. Test the assumed `{auth-user-uuid}/...` object-path convention without
-- disclosing object names. Any non-matching rows need a bucket-specific
-- ownership/export/deletion rule before ACCOUNT_DELETION_STORAGE_AUDITED=true.
select
  objects.bucket_id,
  count(*) as object_count,
  count(*) filter (
    where split_part(objects.name, '/', 1)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) as user_uuid_prefix_count,
  count(*) filter (
    where split_part(objects.name, '/', 1)
      !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) as other_prefix_count
from storage.objects as objects
group by objects.bucket_id
order by objects.bucket_id;

-- 11. Applied migration history. Compare this result with both local migration
-- folders before applying any account-data migration.
select
  migration.version,
  migration.name
from supabase_migrations.schema_migrations as migration
order by migration.version;

-- 12. Per-policy evidence for personalised direct-table consent enforcement.
-- PostgreSQL permissive policies are ORed, while restrictive policies are
-- ANDed. Therefore a table-level bool_or can produce a dangerous false green:
-- one consent-aware permissive policy does not close another permissive bypass
-- path. Review every row and command. A deliberately tested restrictive
-- consent policy can gate the applicable permissive policies; otherwise every
-- applicable permissive USING/WITH CHECK path must contain the predicate.
-- API/client routing does not replace RLS.
with personalised_tables(table_name) as (
  values
    ('subscriptions'),
    ('mosque_admins'),
    ('muezzins'),
    ('staff_rota'),
    ('muezzin_cover_requests'),
    ('app_notifications'),
    ('jumuah_attendance_intents'),
    ('adhan_broadcasts'),
    ('streams')
),
policy_evidence as (
  select
    personalised_tables.table_name,
    policies.policyname,
    policies.permissive,
    policies.roles,
    policies.cmd,
    policies.qual,
    policies.with_check,
    coalesce(policies.qual, '') ~ 'has_current_account_consent_v1'
      as using_has_consent_predicate,
    coalesce(policies.with_check, '') ~ 'has_current_account_consent_v1'
      as check_has_consent_predicate
  from personalised_tables
  left join pg_catalog.pg_policies as policies
    on policies.schemaname = 'public'
   and policies.tablename = personalised_tables.table_name
)
select
  policy_evidence.table_name,
  policy_evidence.policyname,
  policy_evidence.permissive,
  policy_evidence.roles,
  policy_evidence.cmd,
  policy_evidence.using_has_consent_predicate,
  policy_evidence.check_has_consent_predicate,
  policy_evidence.qual as using_expression,
  policy_evidence.with_check as with_check_expression
from policy_evidence
order by policy_evidence.table_name, policy_evidence.cmd,
  policy_evidence.policyname;

-- 13. Aggregate rollout check only; no user identifiers are returned. Current
-- metadata without a matching active receipt needs reviewed re-consent or
-- backfill before server/RLS consent enforcement is enabled.
with account_rollout as (
  select
    users.id,
    (
      users.raw_user_meta_data ->> 'terms_version' = '2026-07-24'
      and nullif(users.raw_user_meta_data ->> 'terms_accepted_at', '') is not null
      and users.raw_user_meta_data ->> 'privacy_version' = '2026-07-24'
      and nullif(users.raw_user_meta_data ->> 'privacy_acknowledged_at', '') is not null
      and users.raw_user_meta_data ->> 'special_category_consent_version' = '2026-07-24'
      and nullif(
        coalesce(
          users.raw_user_meta_data ->> 'special_category_consent_at',
          users.raw_user_meta_data ->> 'special_category_consented_at'
        ),
        ''
      ) is not null
      and nullif(
        users.raw_user_meta_data ->> 'special_category_consent_withdrawn_at',
        ''
      ) is null
      and users.raw_user_meta_data ->> 'age_gate_version' = '2026-07-24'
      and nullif(
        users.raw_user_meta_data ->> 'age_16_or_over_confirmed_at',
        ''
      ) is not null
    ) as has_current_metadata,
    exists (
      select 1
      from public.account_consents
      where account_consents.user_id = users.id
        and account_consents.receipt_schema_version = 1
        and account_consents.terms_version = '2026-07-24'
        and account_consents.terms_accepted_at is not null
        and account_consents.privacy_version = '2026-07-24'
        and account_consents.privacy_acknowledged_at is not null
        and account_consents.special_category_consent_version = '2026-07-24'
        and account_consents.special_category_consented_at is not null
        and account_consents.special_category_withdrawn_at is null
        and account_consents.age_gate_version = '2026-07-24'
        and account_consents.age_16_or_over_confirmed_at is not null
    ) as has_current_active_receipt
  from auth.users as users
)
select
  count(*) filter (where has_current_metadata) as current_metadata_users,
  count(*) filter (where has_current_active_receipt)
    as current_active_receipt_users,
  count(*) filter (
    where has_current_metadata and not has_current_active_receipt
  ) as metadata_without_receipt_users,
  count(*) filter (
    where has_current_active_receipt and not has_current_metadata
  ) as receipt_without_metadata_users
from account_rollout;
