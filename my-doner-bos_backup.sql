--
-- PostgreSQL database dump
--

\restrict hdfli0DTtJLXf4osRZfd4WXNM9JlCfZnjmLbbECTy80mlJqfhfRFDCtOE3kf2ag

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA supabase_migrations;


ALTER SCHEMA supabase_migrations OWNER TO postgres;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_realtime_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in',
    'like',
    'ilike',
    'is',
    'match',
    'imatch',
    'isdistinct'
);


ALTER TYPE realtime.equality_op OWNER TO supabase_realtime_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text,
	negate boolean
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_realtime_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_realtime_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_realtime_admin;

--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE storage.buckettype OWNER TO supabase_storage_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
begin
    if not exists (
        select 1
        from pg_event_trigger_ddl_commands() ev
        join pg_catalog.pg_extension e on ev.objid = e.oid
        where e.extname = 'pg_graphql'
    ) then
        return;
    end if;

    drop function if exists graphql_public.graphql;
    create or replace function graphql_public.graphql(
        "operationName" text default null,
        query text default null,
        variables jsonb default null,
        extensions jsonb default null
    )
        returns jsonb
        language sql
    as $$
        select graphql.resolve(
            query := query,
            variables := coalesce(variables, '{}'),
            "operationName" := "operationName",
            extensions := extensions
        );
    $$;

    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,
    -- which in turn triggers set_graphql_placeholder to reinstall the "not enabled" stub.
    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

    grant usage on schema graphql to postgres, anon, authenticated, service_role;
    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;
    grant usage on schema graphql to postgres with grant option;
    grant usage on schema graphql_public to postgres with grant option;
end;
$_$;


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: supabase_admin
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


ALTER FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) OWNER TO supabase_admin;

--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- Name: close_daily_sales(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.close_daily_sales(p_daily_sales_header_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if not public.current_user_has_role(array['owner', 'branch_admin']) then
    raise exception 'Only an Owner or Branch Admin can close a business day';
  end if;

  update public.daily_sales_headers
    set status = 'closed', closed_at = now(), closed_by = auth.uid()
    where id = p_daily_sales_header_id and status = 'posted';

  if not found then
    raise exception 'Only a posted daily sales entry can be closed';
  end if;
end;
$$;


ALTER FUNCTION public.close_daily_sales(p_daily_sales_header_id uuid) OWNER TO postgres;

--
-- Name: current_organisation_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_organisation_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select organisation_id from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION public.current_organisation_id() OWNER TO postgres;

--
-- Name: current_user_accessible_branch_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_user_accessible_branch_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select b.id
  from public.branches b
  where b.organisation_id = public.current_organisation_id()
    and (
      exists (
        select 1 from public.user_branch_roles ubr
        where ubr.profile_id = auth.uid() and ubr.branch_id is null
      )
      or exists (
        select 1 from public.user_branch_roles ubr
        where ubr.profile_id = auth.uid() and ubr.branch_id = b.id
      )
    );
$$;


ALTER FUNCTION public.current_user_accessible_branch_ids() OWNER TO postgres;

--
-- Name: current_user_has_role(text[], uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_user_has_role(p_role_keys text[], p_branch_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_branch_roles ubr
    join public.roles r on r.id = ubr.role_id
    where ubr.profile_id = auth.uid()
      and r.key = any (p_role_keys)
      and (
        p_branch_id is null
        or ubr.branch_id is null
        or ubr.branch_id = p_branch_id
      )
  );
$$;


ALTER FUNCTION public.current_user_has_role(p_role_keys text[], p_branch_id uuid) OWNER TO postgres;

--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, organisation_id, full_name, preferred_language)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'organisation_id')::uuid,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en')
  );
  return new;
end;
$$;


ALTER FUNCTION public.handle_new_auth_user() OWNER TO postgres;

--
-- Name: log_audit_event(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_audit_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row record;
  v_reason text;
  v_organisation_id uuid;
begin
  v_row := coalesce(new, old);

  v_reason := coalesce(
    to_jsonb(v_row) ->> 'void_reason',
    to_jsonb(v_row) ->> 'reopen_reason',
    to_jsonb(v_row) ->> 'override_reason',
    to_jsonb(v_row) ->> 'reason'
  );

  v_organisation_id := (to_jsonb(v_row) ->> 'organisation_id')::uuid;
  if v_organisation_id is null then
    v_organisation_id := public.current_organisation_id();
  end if;

  insert into public.audit_logs (
    organisation_id, branch_id, actor_id, actor_name, entity_table, entity_id, action, before_data, after_data, reason
  ) values (
    v_organisation_id,
    (to_jsonb(v_row) ->> 'branch_id')::uuid,
    auth.uid(),
    (select full_name from public.profiles where id = auth.uid()),
    tg_table_name,
    (to_jsonb(v_row) ->> 'id')::uuid,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end,
    v_reason
  );

  return v_row;
end;
$$;


ALTER FUNCTION public.log_audit_event() OWNER TO postgres;

--
-- Name: post_daily_sales(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.post_daily_sales(p_daily_sales_header_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_header public.daily_sales_headers%rowtype;
  v_line public.daily_sales_lines%rowtype;
  v_price numeric;
  v_recipe_version_id uuid;
  v_recipe_line record;
begin
  select * into v_header from public.daily_sales_headers where id = p_daily_sales_header_id;
  if not found then
    raise exception 'Daily sales entry not found';
  end if;
  if v_header.status <> 'draft' then
    raise exception 'Only a draft daily sales entry can be posted';
  end if;

  for v_line in select * from public.daily_sales_lines where daily_sales_header_id = p_daily_sales_header_id loop
    if v_line.revenue_override is not null then
      v_price := v_line.revenue_override / v_line.quantity_sold;
    else
      select price into v_price
        from public.product_prices
        where product_variant_id = v_line.product_variant_id
          and branch_id = v_header.branch_id
          and effective_from <= v_header.business_date
          and (effective_to is null or effective_to >= v_header.business_date)
        order by effective_from desc
        limit 1;
    end if;

    if v_price is null then
      raise exception 'No effective price found for a sold variant — set one in Menu > Prices first';
    end if;

    update public.daily_sales_lines
      set revenue = coalesce(v_line.revenue_override, v_price * v_line.quantity_sold)
      where id = v_line.id;

    -- Theoretical stock consumption from the variant's currently published
    -- recipe. A variant with no published recipe is still sold (revenue
    -- above is unaffected) but consumes no ledger stock — same "sellable
    -- before its composition is modeled" stance as Sprint 2/3.
    select id into v_recipe_version_id
      from public.recipe_versions
      where product_variant_id = v_line.product_variant_id and status = 'published' and effective_to is null;

    if v_recipe_version_id is not null then
      for v_recipe_line in
        select rl.inventory_item_id, rl.quantity, coalesce(ii.average_cost, 0) as cost
        from public.recipe_lines rl
        join public.inventory_items ii on ii.id = rl.inventory_item_id
        where rl.recipe_version_id = v_recipe_version_id
      loop
        insert into public.inventory_ledger (
          organisation_id, branch_id, inventory_item_id, transaction_type,
          quantity_base, cost_basis, source_type, source_id, business_date, created_by
        ) values (
          v_header.organisation_id, v_header.branch_id, v_recipe_line.inventory_item_id, 'sale_consumption',
          -(v_recipe_line.quantity * v_line.quantity_sold), v_recipe_line.cost,
          'daily_sales_line', v_line.id, v_header.business_date, auth.uid()
        );
      end loop;
    end if;
  end loop;

  update public.daily_sales_headers
    set status = 'posted', posted_at = now(), posted_by = auth.uid()
    where id = p_daily_sales_header_id;
end;
$$;


ALTER FUNCTION public.post_daily_sales(p_daily_sales_header_id uuid) OWNER TO postgres;

--
-- Name: post_opening_balance(uuid, uuid, numeric, numeric, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.post_opening_balance(p_branch_id uuid, p_inventory_item_id uuid, p_quantity numeric, p_unit_cost numeric, p_business_date date) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_organisation_id uuid;
  v_purchase_to_base numeric;
  v_base_qty numeric;
  v_base_unit_cost numeric;
  v_existing_count int;
begin
  if not public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']) then
    raise exception 'Only an Owner, Branch Admin or Inventory Manager can set opening stock';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative';
  end if;

  select organisation_id, purchase_to_base_factor
    into v_organisation_id, v_purchase_to_base
    from public.inventory_items
    where id = p_inventory_item_id;
  if not found then
    raise exception 'Ingredient not found';
  end if;

  select count(*) into v_existing_count
    from public.inventory_ledger
    where branch_id = p_branch_id and inventory_item_id = p_inventory_item_id;
  if v_existing_count > 0 then
    raise exception 'This ingredient already has stock movements at this branch — use a purchase or stock count to adjust it instead';
  end if;

  v_base_qty := p_quantity * coalesce(v_purchase_to_base, 1);
  v_base_unit_cost := p_unit_cost / coalesce(v_purchase_to_base, 1);

  insert into public.inventory_ledger (
    organisation_id, branch_id, inventory_item_id, transaction_type,
    quantity_base, cost_basis, source_type, source_id, business_date, created_by
  ) values (
    v_organisation_id, p_branch_id, p_inventory_item_id, 'opening_balance',
    v_base_qty, v_base_unit_cost, 'opening_balance', gen_random_uuid(), p_business_date, auth.uid()
  );

  update public.inventory_items
    set average_cost = v_base_unit_cost,
        current_cost = v_base_unit_cost,
        last_cost = v_base_unit_cost,
        updated_at = now()
    where id = p_inventory_item_id;
end;
$$;


ALTER FUNCTION public.post_opening_balance(p_branch_id uuid, p_inventory_item_id uuid, p_quantity numeric, p_unit_cost numeric, p_business_date date) OWNER TO postgres;

--
-- Name: post_production(uuid, uuid, numeric, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.post_production(p_inventory_item_id uuid, p_branch_id uuid, p_actual_yield_quantity numeric, p_business_date date) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_organisation_id uuid;
  v_source text;
  v_recipe_version public.recipe_versions%rowtype;
  v_line record;
  v_scale numeric;
  v_ingredient_cost numeric;
  v_total_cost numeric := 0;
  v_qty_on_hand numeric;
  v_old_avg_cost numeric;
  v_new_avg_cost numeric;
  v_cost_per_unit numeric;
begin
  if not public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']) then
    raise exception 'Only an Owner, Branch Admin or Inventory Manager can record production';
  end if;
  if p_actual_yield_quantity is null or p_actual_yield_quantity <= 0 then
    raise exception 'Yield must be greater than zero';
  end if;

  select organisation_id, source into v_organisation_id, v_source
    from public.inventory_items where id = p_inventory_item_id;
  if not found then
    raise exception 'Ingredient not found';
  end if;
  if v_source <> 'prepared' then
    raise exception 'Only a prepared item can have a production batch recorded';
  end if;

  select * into v_recipe_version
    from public.recipe_versions
    where inventory_item_id = p_inventory_item_id
      and status = 'published'
      and effective_to is null
    order by version_number desc
    limit 1;
  if not found then
    raise exception 'This item has no published recipe yet — publish one in Production first';
  end if;

  v_scale := p_actual_yield_quantity / v_recipe_version.batch_yield_quantity;

  for v_line in
    select rl.inventory_item_id, rl.quantity, ii.average_cost
    from public.recipe_lines rl
    join public.inventory_items ii on ii.id = rl.inventory_item_id
    where rl.recipe_version_id = v_recipe_version.id
  loop
    v_ingredient_cost := coalesce(v_line.average_cost, 0);
    v_total_cost := v_total_cost + (v_line.quantity * v_scale * v_ingredient_cost);

    insert into public.inventory_ledger (
      organisation_id, branch_id, inventory_item_id, transaction_type,
      quantity_base, cost_basis, source_type, source_id, business_date, created_by
    ) values (
      v_organisation_id, p_branch_id, v_line.inventory_item_id, 'production_consumption',
      -(v_line.quantity * v_scale), v_ingredient_cost, 'production_batch', v_recipe_version.id, p_business_date, auth.uid()
    );
  end loop;

  v_cost_per_unit := v_total_cost / p_actual_yield_quantity;

  select coalesce(sum(quantity_base), 0) into v_qty_on_hand
    from public.inventory_ledger where inventory_item_id = p_inventory_item_id;
  select average_cost into v_old_avg_cost from public.inventory_items where id = p_inventory_item_id;

  if v_qty_on_hand + p_actual_yield_quantity > 0 then
    v_new_avg_cost := (v_qty_on_hand * coalesce(v_old_avg_cost, 0) + p_actual_yield_quantity * v_cost_per_unit)
      / (v_qty_on_hand + p_actual_yield_quantity);
  else
    v_new_avg_cost := v_cost_per_unit;
  end if;

  insert into public.inventory_ledger (
    organisation_id, branch_id, inventory_item_id, transaction_type,
    quantity_base, cost_basis, source_type, source_id, business_date, created_by
  ) values (
    v_organisation_id, p_branch_id, p_inventory_item_id, 'production_yield',
    p_actual_yield_quantity, v_cost_per_unit, 'production_batch', v_recipe_version.id, p_business_date, auth.uid()
  );

  update public.inventory_items
    set average_cost = v_new_avg_cost,
        current_cost = v_cost_per_unit,
        last_cost = v_cost_per_unit,
        updated_at = now()
    where id = p_inventory_item_id;
end;
$$;


ALTER FUNCTION public.post_production(p_inventory_item_id uuid, p_branch_id uuid, p_actual_yield_quantity numeric, p_business_date date) OWNER TO postgres;

--
-- Name: post_purchase(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.post_purchase(p_purchase_header_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_header public.purchase_headers%rowtype;
  v_line public.purchase_lines%rowtype;
  v_purchase_to_base numeric;
  v_base_qty numeric;
  v_base_unit_cost numeric;
  v_qty_on_hand numeric;
  v_old_avg_cost numeric;
  v_new_avg_cost numeric;
begin
  select * into v_header from public.purchase_headers where id = p_purchase_header_id;
  if not found then
    raise exception 'Purchase not found';
  end if;
  if v_header.status <> 'draft' then
    raise exception 'Only draft purchases can be posted';
  end if;

  for v_line in select * from public.purchase_lines where purchase_header_id = p_purchase_header_id loop
    select purchase_to_base_factor, average_cost
      into v_purchase_to_base, v_old_avg_cost
      from public.inventory_items where id = v_line.inventory_item_id;

    v_base_qty := v_line.quantity * coalesce(v_purchase_to_base, 1);
    v_base_unit_cost := (v_line.unit_cost * coalesce(v_header.exchange_rate, 1)) / coalesce(v_purchase_to_base, 1);

    select coalesce(sum(quantity_base), 0) into v_qty_on_hand
      from public.inventory_ledger where inventory_item_id = v_line.inventory_item_id;

    if v_qty_on_hand + v_base_qty > 0 then
      v_new_avg_cost := (v_qty_on_hand * coalesce(v_old_avg_cost, 0) + v_base_qty * v_base_unit_cost)
        / (v_qty_on_hand + v_base_qty);
    else
      v_new_avg_cost := v_base_unit_cost;
    end if;

    insert into public.inventory_ledger (
      organisation_id, branch_id, inventory_item_id, transaction_type,
      quantity_base, cost_basis, source_type, source_id, business_date, created_by
    ) values (
      v_header.organisation_id, v_header.branch_id, v_line.inventory_item_id, 'purchase_receipt',
      v_base_qty, v_base_unit_cost, 'purchase_line', v_line.id, v_header.receiving_date, auth.uid()
    );

    update public.inventory_items
      set average_cost = v_new_avg_cost,
          current_cost = v_base_unit_cost,
          last_cost = v_base_unit_cost,
          updated_at = now()
      where id = v_line.inventory_item_id;
  end loop;

  update public.purchase_headers
    set status = 'posted', posted_at = now(), posted_by = auth.uid()
    where id = p_purchase_header_id;
end;
$$;


ALTER FUNCTION public.post_purchase(p_purchase_header_id uuid) OWNER TO postgres;

--
-- Name: post_stock_count(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.post_stock_count(p_stock_count_header_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_header public.stock_count_headers%rowtype;
  v_line public.stock_count_lines%rowtype;
  v_variance numeric;
  v_cost numeric;
begin
  select * into v_header from public.stock_count_headers where id = p_stock_count_header_id;
  if not found then
    raise exception 'Stock count not found';
  end if;
  if v_header.status <> 'draft' then
    raise exception 'Only draft stock counts can be posted';
  end if;

  for v_line in select * from public.stock_count_lines where stock_count_header_id = p_stock_count_header_id loop
    v_variance := v_line.counted_quantity - v_line.expected_quantity;
    if v_variance <> 0 then
      select average_cost into v_cost from public.inventory_items where id = v_line.inventory_item_id;

      insert into public.inventory_ledger (
        organisation_id, branch_id, inventory_item_id, transaction_type,
        quantity_base, cost_basis, source_type, source_id, business_date, created_by
      ) values (
        v_header.organisation_id, v_header.branch_id, v_line.inventory_item_id, 'count_adjustment',
        v_variance, coalesce(v_cost, 0), 'stock_count_line', v_line.id, v_header.count_date, auth.uid()
      );
    end if;
  end loop;

  update public.stock_count_headers
    set status = 'posted', posted_at = now(), posted_by = auth.uid()
    where id = p_stock_count_header_id;
end;
$$;


ALTER FUNCTION public.post_stock_count(p_stock_count_header_id uuid) OWNER TO postgres;

--
-- Name: record_waste(uuid, uuid, numeric, uuid, date, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_waste(p_branch_id uuid, p_inventory_item_id uuid, p_quantity_base numeric, p_waste_reason_id uuid, p_business_date date, p_notes text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_organisation_id uuid;
  v_cost numeric;
  v_waste_id uuid;
begin
  select public.current_organisation_id() into v_organisation_id;

  select average_cost into v_cost from public.inventory_items where id = p_inventory_item_id;

  insert into public.waste_records (
    organisation_id, branch_id, inventory_item_id, quantity_base,
    waste_reason_id, business_date, notes, created_by
  ) values (
    v_organisation_id, p_branch_id, p_inventory_item_id, p_quantity_base,
    p_waste_reason_id, p_business_date, p_notes, auth.uid()
  ) returning id into v_waste_id;

  insert into public.inventory_ledger (
    organisation_id, branch_id, inventory_item_id, transaction_type,
    quantity_base, cost_basis, source_type, source_id, business_date, created_by
  ) values (
    v_organisation_id, p_branch_id, p_inventory_item_id, 'waste',
    -abs(p_quantity_base), coalesce(v_cost, 0), 'waste_record', v_waste_id, p_business_date, auth.uid()
  );

  return v_waste_id;
end;
$$;


ALTER FUNCTION public.record_waste(p_branch_id uuid, p_inventory_item_id uuid, p_quantity_base numeric, p_waste_reason_id uuid, p_business_date date, p_notes text) OWNER TO postgres;

--
-- Name: reopen_daily_sales(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reopen_daily_sales(p_daily_sales_header_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if not public.current_user_has_role(array['owner']) then
    raise exception 'Only an Owner can reopen a closed business day';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to reopen a closed day';
  end if;

  update public.daily_sales_headers
    set status = 'posted', reopened_at = now(), reopened_by = auth.uid(), reopen_reason = p_reason
    where id = p_daily_sales_header_id and status = 'closed';

  if not found then
    raise exception 'Only a closed daily sales entry can be reopened';
  end if;
end;
$$;


ALTER FUNCTION public.reopen_daily_sales(p_daily_sales_header_id uuid, p_reason text) OWNER TO postgres;

--
-- Name: void_purchase(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.void_purchase(p_purchase_header_id uuid, p_void_reason text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_header public.purchase_headers%rowtype;
  v_line public.purchase_lines%rowtype;
  v_original_ledger public.inventory_ledger%rowtype;
begin
  if not public.current_user_has_role(array['owner']) then
    raise exception 'Only an Owner can void a purchase';
  end if;
  if p_void_reason is null or btrim(p_void_reason) = '' then
    raise exception 'A reason is required to void a purchase';
  end if;

  select * into v_header from public.purchase_headers where id = p_purchase_header_id;
  if not found then
    raise exception 'Purchase not found';
  end if;
  if v_header.status <> 'posted' then
    raise exception 'Only a posted purchase can be voided';
  end if;

  for v_line in select * from public.purchase_lines where purchase_header_id = p_purchase_header_id loop
    for v_original_ledger in
      select * from public.inventory_ledger
      where source_type = 'purchase_line' and source_id = v_line.id
    loop
      insert into public.inventory_ledger (
        organisation_id, branch_id, inventory_item_id, transaction_type,
        quantity_base, cost_basis, source_type, source_id, business_date, created_by
      ) values (
        v_original_ledger.organisation_id, v_original_ledger.branch_id, v_original_ledger.inventory_item_id,
        'manual_correction', -v_original_ledger.quantity_base, v_original_ledger.cost_basis,
        'purchase_void', p_purchase_header_id, current_date, auth.uid()
      );
    end loop;
  end loop;

  update public.purchase_headers
    set status = 'voided', voided_at = now(), voided_by = auth.uid(), void_reason = p_void_reason
    where id = p_purchase_header_id;
end;
$$;


ALTER FUNCTION public.void_purchase(p_purchase_header_id uuid, p_void_reason text) OWNER TO postgres;

--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
    -- Regclass of the table e.g. public.notes
    entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

    -- I, U, D, T: insert, update ...
    action realtime.action = (
        case wal ->> 'action'
            when 'I' then 'INSERT'
            when 'U' then 'UPDATE'
            when 'D' then 'DELETE'
            else 'ERROR'
        end
    );

    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

    subscriptions realtime.subscription[] = array_agg(subs)
        from
            realtime.subscription subs
        where
            subs.entity = entity_
            -- Filter by action early - only get subscriptions interested in this action
            -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
            and (subs.action_filter = '*' or subs.action_filter = action::text);

    -- Subscription vars
    working_role regrole;
    working_selected_columns text[];
    claimed_role regrole;
    claims jsonb;

    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';

    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];

    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

    -- Primary jsonb output for record
    output jsonb;

    -- Loop record for iterating unique roles (outer loop)
    role_record record;
    -- Loop record for iterating unique selected_columns within a role (inner loop)
    cols_record record;
    -- Subscription ids visible at the role level (before fanning out by selected_columns)
    visible_role_sub_ids uuid[] = '{}';

begin
    perform set_config('role', null, true);

    columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'columns') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    old_columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'identity') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    for role_record in
        select claims_role
        from (select distinct claims_role from unnest(subscriptions)) t
        order by claims_role::text
    loop
        working_role := role_record.claims_role;

        -- Update `is_selectable` for columns and old_columns (once per role)
        columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(columns) c;

        old_columns =
                array_agg(
                    (
                        c.name,
                        c.type_name,
                        c.type_oid,
                        c.value,
                        c.is_pkey,
                        pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                    )::realtime.wal_column
                )
                from
                    unnest(old_columns) c;

        if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
            -- Fan out 400 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 400: Bad Request, no primary key']
                )::realtime.wal_rls;
            end loop;

        -- The claims role does not have SELECT permission to the primary key of entity
        elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
            -- Fan out 401 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 401: Unauthorized']
                )::realtime.wal_rls;
            end loop;

        else
            -- Create the prepared statement (once per role)
            if is_rls_enabled and action <> 'DELETE' then
                if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                    deallocate walrus_rls_stmt;
                end if;
                execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
            end if;

            -- Collect all visible subscription IDs for this role (filter check + RLS check)
            visible_role_sub_ids = '{}';

            for subscription_id, claims in (
                    select
                        subs.subscription_id,
                        subs.claims
                    from
                        unnest(subscriptions) subs
                    where
                        subs.entity = entity_
                        and subs.claims_role = working_role
                        and (
                            realtime.is_visible_through_filters(columns, subs.filters)
                            or (
                              action = 'DELETE'
                              and realtime.is_visible_through_filters(old_columns, subs.filters)
                            )
                        )
            ) loop

                if not is_rls_enabled or action = 'DELETE' then
                    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                else
                    -- Check if RLS allows the role to see the record
                    perform
                        -- Trim leading and trailing quotes from working_role because set_config
                        -- doesn't recognize the role as valid if they are included
                        set_config('role', trim(both '"' from working_role::text), true),
                        set_config('request.jwt.claims', claims::text, true);

                    execute 'execute walrus_rls_stmt' into subscription_has_access;

                    -- Reset the role on every FOR..LOOP batch execution.
                    -- The first batch of 10 rows is pre-fetched using the current connection role (PG internal behaviour)
                    -- then we have to reset it again otherwise it would use the role defined in the `set_config` above
                    -- to fetch the remaining rows when rows>10, which could be a user-defined role that lacks execution grants.
                    -- The flow is:
                    --   1. run batch with conn role
                    --   2. set_config working_role
                    --   3. execute walrus
                    --   4. reset role (revert)
                    --   5. repeat
                    perform set_config('role', null, true);

                    if subscription_has_access then
                        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                    end if;
                end if;
            end loop;

            perform set_config('role', null, true);

            -- Inner loop: per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;

                output = jsonb_build_object(
                    'schema', wal ->> 'schema',
                    'table', wal ->> 'table',
                    'type', action,
                    'commit_timestamp', to_char(
                        ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ),
                    'columns', (
                        select
                            jsonb_agg(
                                jsonb_build_object(
                                    'name', pa.attname,
                                    'type', pt.typname
                                )
                                order by pa.attnum asc
                            )
                        from
                            pg_attribute pa
                            join pg_type pt
                                on pa.atttypid = pt.oid
                            left join (
                                select unnest(conkey) as pkey_attnum
                                from pg_constraint
                                where conrelid = entity_ and contype = 'p'
                            ) pk on pk.pkey_attnum = pa.attnum
                        where
                            attrelid = entity_
                            and attnum > 0
                            and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
                            and (working_selected_columns is null or pa.attname = any(working_selected_columns) or pk.pkey_attnum is not null)
                    )
                )
                -- Add "record" key for insert and update
                || case
                    when action in ('INSERT', 'UPDATE') then
                        jsonb_build_object(
                            'record',
                            (
                                select
                                    jsonb_object_agg(
                                        -- if unchanged toast, get column name and value from old record
                                        coalesce((c).name, (oc).name),
                                        case
                                            when (c).name is null then (oc).value
                                            else (c).value
                                        end
                                    )
                                from
                                    unnest(columns) c
                                    full outer join unnest(old_columns) oc
                                        on (c).name = (oc).name
                                where
                                    coalesce((c).is_selectable, (oc).is_selectable)
                                    and (working_selected_columns is null or coalesce((c).name, (oc).name) = any(working_selected_columns) or coalesce((c).is_pkey, (oc).is_pkey))
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            )
                        )
                    else '{}'::jsonb
                end
                -- Add "old_record" key for update and delete
                || case
                    when action = 'UPDATE' then
                        jsonb_build_object(
                                'old_record',
                                (
                                    select jsonb_object_agg((c).name, (c).value)
                                    from unnest(old_columns) c
                                    where
                                        (c).is_selectable
                                        and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                        and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                )
                            )
                    when action = 'DELETE' then
                        jsonb_build_object(
                            'old_record',
                            (
                                select jsonb_object_agg((c).name, (c).value)
                                from unnest(old_columns) c
                                where
                                    (c).is_selectable
                                    and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                    and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                            )
                        )
                    else '{}'::jsonb
                end;

                -- Filter visible_role_sub_ids to those matching the current selected_columns group
                visible_to_subscription_ids = coalesce(
                    (
                        select array_agg(s.subscription_id)
                        from unnest(subscriptions) s
                        where s.claims_role = working_role
                          and (s.selected_columns is not distinct from working_selected_columns)
                          and s.subscription_id = any(visible_role_sub_ids)
                    ),
                    '{}'::uuid[]
                );

                return next (
                    output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    case
                        when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                        else '{}'
                    end
                )::realtime.wal_rls;
            end loop;

        end if;
    end loop;

    perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_realtime_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_realtime_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_realtime_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_realtime_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
/*
Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
*/
declare
    op_symbol text = (
        case
            when op = 'eq' then '='
            when op = 'neq' then '!='
            when op = 'lt' then '<'
            when op = 'lte' then '<='
            when op = 'gt' then '>'
            when op = 'gte' then '>='
            when op = 'in' then '= any'
            else 'UNKNOWN OP'
        end
    );
    res boolean;
begin
    execute format(
        'select %L::'|| type_::text || ' ' || op_symbol
        || ' ( %L::'
        || (
            case
                when op = 'in' then type_::text || '[]'
                else type_::text end
        )
        || ')', val_1, val_2) into res;
    return res;
end;
$$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_realtime_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
    op_symbol text;
    res boolean;
begin
    -- IS DISTINCT FROM / IS NOT DISTINCT FROM: infix, both sides typed literals
    if op = 'isdistinct' then
        execute format(
            'select %L::%s %s %L::%s',
            val_1,
            type_::text,
            case when negate then 'IS NOT DISTINCT FROM' else 'IS DISTINCT FROM' end,
            val_2,
            type_::text
        ) into res;
        return res;
    end if;

    -- IS requires a keyword RHS (NULL, TRUE, FALSE, UNKNOWN), not a typed literal
    if op = 'is' then
        if val_2 not in ('null', 'true', 'false', 'unknown') then
            raise exception 'invalid value for is filter: must be null, true, false, or unknown';
        end if;
        execute format(
            'select %L::%s %s %s',
            val_1,
            type_::text,
            case when negate then 'IS NOT' else 'IS' end,
            upper(val_2)
        ) into res;
        return res;
    end if;

    op_symbol = case
        when op = 'eq'    then '='
        when op = 'neq'   then '!='
        when op = 'lt'    then '<'
        when op = 'lte'   then '<='
        when op = 'gt'    then '>'
        when op = 'gte'   then '>='
        when op = 'in'    then '= any'
        when op = 'like'   then 'LIKE'
        when op = 'ilike'  then 'ILIKE'
        when op = 'match'  then '~'
        when op = 'imatch' then '~*'
        else null
    end;

    if op_symbol is null then
        raise exception 'unsupported equality operator: %', op::text;
    end if;

    execute format(
        'select %L::%s %s (%L::%s)',
        val_1,
        type_::text,
        op_symbol,
        val_2,
        case when op = 'in' then type_::text || '[]' else type_::text end
    ) into res;

    return case when negate then not res else res end;
end;
$$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) OWNER TO supabase_realtime_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select
        filters is null
        or array_length(filters, 1) is null
        or coalesce(
            count(col.name) = count(1)
            and sum(
                realtime.check_equality_op(
                    op:=f.op,
                    type_:=coalesce(col.type_oid::regtype, col.type_name::regtype),
                    val_1:=col.value #>> '{}',
                    val_2:=f.value,
                    negate:=coalesce(f.negate, false)
                )::int
            ) filter (where col.name is not null) = count(col.name),
            false
        )
    from
        unnest(filters) f
        left join unnest(columns) col
            on f.column_name = col.name;
$$;


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_realtime_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_realtime_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT
    realtime.wal2json_escape_identifier(nsp.nspname::text)
    || '.'
    || realtime.wal2json_escape_identifier(pc.relname::text)
  FROM pg_class pc
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  WHERE pc.oid = entity
$$;


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_realtime_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_realtime_admin;

--
-- Name: send_binary(bytea, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, binary_payload, event, topic, private, extension)
    VALUES (generated_id, payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) OWNER TO supabase_realtime_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
    col_names text[] = coalesce(
            array_agg(a.attname order by a.attnum),
            '{}'::text[]
        )
        from
            pg_catalog.pg_attribute a
        where
            a.attrelid = new.entity
            and a.attnum > 0
            and not a.attisdropped
            and pg_catalog.has_column_privilege(
                (new.claims ->> 'role'),
                a.attrelid,
                a.attnum,
                'SELECT'
            );
    filter realtime.user_defined_filter;
    col_type regtype;
    in_val jsonb;
    selected_col text;
begin
    for filter in select * from unnest(new.filters) loop
        if not filter.column_name = any(col_names) then
            raise exception 'invalid column for filter %', filter.column_name;
        end if;

        col_type = (
            select atttypid::regtype
            from pg_catalog.pg_attribute
            where attrelid = new.entity
                  and attname = filter.column_name
        );
        if col_type is null then
            raise exception 'failed to lookup type for column %', filter.column_name;
        end if;

        if filter.op = 'in'::realtime.equality_op then
            in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
            if coalesce(jsonb_array_length(in_val), 0) > 100 then
                raise exception 'too many values for `in` filter. Maximum 100';
            end if;
        elsif filter.op = 'is'::realtime.equality_op then
            -- `is` requires a keyword RHS rather than a typed literal
            if filter.value not in ('null', 'true', 'false', 'unknown') then
                raise exception 'invalid value for is filter: must be null, true, false, or unknown';
            end if;
            -- IS NULL works for any type, but IS TRUE/FALSE/UNKNOWN require a boolean
            -- operand. Reject the non-null keywords on non-boolean columns here so they
            -- don't abort apply_rls at WAL time.
            if filter.value <> 'null' and col_type <> 'boolean'::regtype then
                raise exception 'is % filter requires a boolean column, got %', filter.value, col_type::text;
            end if;
        elsif filter.op in ('like'::realtime.equality_op, 'ilike'::realtime.equality_op) then
            -- like/ilike apply the text pattern operator (~~); reject column types that
            -- have no such operator instead of failing at WAL time
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = '~~' and oprleft = col_type
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
        elsif filter.op in ('match'::realtime.equality_op, 'imatch'::realtime.equality_op) then
            -- match/imatch apply the regex operators ~ / ~*; reject column types that have
            -- no such operator (e.g. integer) instead of failing at WAL time, mirroring the
            -- like/ilike guard above.
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = case when filter.op = 'imatch'::realtime.equality_op then '~*' else '~' end
                  and oprleft = col_type
                  and oprright = col_type
                  and oprresult = 'boolean'::regtype
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
            -- validate the regex eagerly so a bad pattern is rejected here, not inside
            -- apply_rls where it would abort the WAL stream for the entity
            begin
                perform '' ~ filter.value;
            exception when others then
                raise exception 'invalid regular expression for % filter: %', filter.op::text, sqlerrm;
            end;
        else
            -- eq/neq/lt/lte/gt/gte: value must be coercable to the type
            perform realtime.cast(filter.value, col_type);
        end if;
    end loop;

    if new.selected_columns is not null then
        for selected_col in select * from unnest(new.selected_columns) loop
            if not selected_col = any(col_names) then
                raise exception 'invalid column for select %', selected_col;
            end if;
        end loop;
    end if;

    -- Apply consistent order to filters so the unique constraint can't be tricked by a
    -- different filter order. negate is part of the sort key.
    new.filters = coalesce(
        array_agg(f order by f.column_name, f.op, f.value, f.negate),
        '{}'
    ) from unnest(new.filters) f;

    new.selected_columns = (
        select array_agg(c order by c)
        from unnest(new.selected_columns) c
    );

    return new;
end;
$$;


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_realtime_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_realtime_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: wal2json_escape_identifier(text); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.wal2json_escape_identifier(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  -- Prefix `\`, `,`, `.`, and any whitespace with `\`
  SELECT regexp_replace(name, '([\\,.[:space:]])', '\\\1', 'g')
$$;


ALTER FUNCTION realtime.wal2json_escape_identifier(name text) OWNER TO supabase_realtime_admin;

--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION storage.allow_any_operation(expected_operations text[]) OWNER TO supabase_storage_admin;

--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION storage.allow_only_operation(expected_operation text) OWNER TO supabase_storage_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION storage.enforce_bucket_name_length() OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text) OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.protect_delete() OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


ALTER TABLE auth.custom_oauth_providers OWNER TO supabase_auth_admin;

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


ALTER TABLE auth.webauthn_challenges OWNER TO supabase_auth_admin;

--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


ALTER TABLE auth.webauthn_credentials OWNER TO supabase_auth_admin;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    organisation_id uuid NOT NULL,
    base_currency text DEFAULT 'UZS'::text NOT NULL,
    trading_days jsonb DEFAULT '[1, 2, 3, 4, 5, 6, 7]'::jsonb NOT NULL,
    financial_month_start_day smallint DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT app_settings_financial_month_start_day_check CHECK (((financial_month_start_day >= 1) AND (financial_month_start_day <= 28)))
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid,
    actor_id uuid,
    entity_table text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    before_data jsonb,
    after_data jsonb,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_name text,
    CONSTRAINT audit_logs_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    timezone text DEFAULT 'Asia/Tashkent'::text NOT NULL,
    opening_hours jsonb,
    reporting_currency text DEFAULT 'UZS'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT branches_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.branches OWNER TO postgres;

--
-- Name: bundle_components; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bundle_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bundle_variant_id uuid NOT NULL,
    component_type text NOT NULL,
    component_product_variant_id uuid,
    component_inventory_item_id uuid,
    quantity numeric(10,3) DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bundle_components_check CHECK ((((component_type = 'product_variant'::text) AND (component_product_variant_id IS NOT NULL) AND (component_inventory_item_id IS NULL)) OR ((component_type = 'ingredient'::text) AND (component_inventory_item_id IS NOT NULL) AND (component_product_variant_id IS NULL)))),
    CONSTRAINT bundle_components_component_type_check CHECK ((component_type = ANY (ARRAY['product_variant'::text, 'ingredient'::text]))),
    CONSTRAINT bundle_components_quantity_check CHECK ((quantity > (0)::numeric))
);


ALTER TABLE public.bundle_components OWNER TO postgres;

--
-- Name: cash_flow_adjustments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_flow_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    adjustment_date date NOT NULL,
    amount numeric(14,2) NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.cash_flow_adjustments OWNER TO postgres;

--
-- Name: cash_reconciliations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    business_date date NOT NULL,
    opening_cash numeric(14,2) DEFAULT 0 NOT NULL,
    cash_expenses numeric(14,2) DEFAULT 0 NOT NULL,
    cash_deposits numeric(14,2) DEFAULT 0 NOT NULL,
    cash_withdrawals numeric(14,2) DEFAULT 0 NOT NULL,
    actual_closing_cash numeric(14,2),
    card_expected numeric(14,2),
    card_actual numeric(14,2),
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    signed_off_at timestamp with time zone,
    signed_off_by uuid,
    CONSTRAINT cash_reconciliations_cash_deposits_check CHECK ((cash_deposits >= (0)::numeric)),
    CONSTRAINT cash_reconciliations_cash_expenses_check CHECK ((cash_expenses >= (0)::numeric)),
    CONSTRAINT cash_reconciliations_cash_withdrawals_check CHECK ((cash_withdrawals >= (0)::numeric)),
    CONSTRAINT cash_reconciliations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'signed_off'::text])))
);


ALTER TABLE public.cash_reconciliations OWNER TO postgres;

--
-- Name: currencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.currencies (
    code text NOT NULL,
    name text NOT NULL,
    symbol text NOT NULL,
    minor_unit smallint DEFAULT 2 NOT NULL
);


ALTER TABLE public.currencies OWNER TO postgres;

--
-- Name: daily_payment_totals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_payment_totals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daily_sales_header_id uuid NOT NULL,
    payment_method_id uuid NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT daily_payment_totals_amount_check CHECK ((amount >= (0)::numeric))
);


ALTER TABLE public.daily_payment_totals OWNER TO postgres;

--
-- Name: daily_sales_headers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_sales_headers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    business_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    discount_amount numeric(14,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    orders_count integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    posted_at timestamp with time zone,
    posted_by uuid,
    closed_at timestamp with time zone,
    closed_by uuid,
    reopened_at timestamp with time zone,
    reopened_by uuid,
    reopen_reason text,
    CONSTRAINT daily_sales_headers_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT daily_sales_headers_refund_amount_check CHECK ((refund_amount >= (0)::numeric)),
    CONSTRAINT daily_sales_headers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'closed'::text])))
);


ALTER TABLE public.daily_sales_headers OWNER TO postgres;

--
-- Name: daily_sales_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_sales_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daily_sales_header_id uuid NOT NULL,
    product_variant_id uuid NOT NULL,
    quantity_sold numeric(10,2) NOT NULL,
    revenue_override numeric(14,2),
    override_reason text,
    revenue numeric(14,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_sales_lines_check CHECK (((revenue_override IS NULL) OR (override_reason IS NOT NULL))),
    CONSTRAINT daily_sales_lines_quantity_sold_check CHECK ((quantity_sold > (0)::numeric))
);


ALTER TABLE public.daily_sales_lines OWNER TO postgres;

--
-- Name: employee_pay_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_pay_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    pay_rate numeric(14,2) NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT employee_pay_rates_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT employee_pay_rates_pay_rate_check CHECK ((pay_rate >= (0)::numeric))
);


ALTER TABLE public.employee_pay_rates OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    name text NOT NULL,
    role_title text,
    employment_status text DEFAULT 'active'::text NOT NULL,
    pay_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT employees_employment_status_check CHECK ((employment_status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT employees_pay_type_check CHECK ((pay_type = ANY (ARRAY['hourly'::text, 'monthly'::text])))
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    from_currency text NOT NULL,
    to_currency text NOT NULL,
    rate numeric(18,6) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT exchange_rates_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT exchange_rates_rate_check CHECK ((rate > (0)::numeric))
);


ALTER TABLE public.exchange_rates OWNER TO postgres;

--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT expense_categories_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.expense_categories OWNER TO postgres;

--
-- Name: expense_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    expense_category_id uuid NOT NULL,
    vendor text,
    currency text DEFAULT 'UZS'::text NOT NULL,
    exchange_rate numeric(18,6),
    amount numeric(14,2) NOT NULL,
    accrual_date date NOT NULL,
    payment_date date,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    posted_at timestamp with time zone,
    posted_by uuid,
    CONSTRAINT expense_transactions_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT expense_transactions_check CHECK (((currency = 'UZS'::text) OR (exchange_rate IS NOT NULL))),
    CONSTRAINT expense_transactions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text])))
);


ALTER TABLE public.expense_transactions OWNER TO postgres;

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    uzbek_name text,
    category text NOT NULL,
    base_unit_id uuid NOT NULL,
    purchase_unit_id uuid NOT NULL,
    purchase_to_base_factor numeric(18,6) DEFAULT 1 NOT NULL,
    default_supplier_id uuid,
    current_cost numeric(14,4),
    last_cost numeric(14,4),
    average_cost numeric(14,4),
    reorder_level numeric(14,3),
    target_stock_level numeric(14,3),
    shelf_life_days integer,
    tax_category_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    source text DEFAULT 'purchased'::text NOT NULL,
    CONSTRAINT inventory_items_category_check CHECK ((category = ANY (ARRAY['food'::text, 'drink'::text, 'packaging'::text, 'consumable'::text]))),
    CONSTRAINT inventory_items_purchase_to_base_factor_check CHECK ((purchase_to_base_factor > (0)::numeric)),
    CONSTRAINT inventory_items_source_check CHECK ((source = ANY (ARRAY['purchased'::text, 'prepared'::text]))),
    CONSTRAINT inventory_items_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.inventory_items OWNER TO postgres;

--
-- Name: inventory_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    transaction_type text NOT NULL,
    quantity_base numeric(14,4) NOT NULL,
    cost_basis numeric(14,4) NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    business_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT inventory_ledger_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['opening_balance'::text, 'purchase_receipt'::text, 'sale_consumption'::text, 'waste'::text, 'count_adjustment'::text, 'supplier_return'::text, 'transfer_in'::text, 'transfer_out'::text, 'manual_correction'::text, 'production_consumption'::text, 'production_yield'::text])))
);


ALTER TABLE public.inventory_ledger OWNER TO postgres;

--
-- Name: units_of_measure; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.units_of_measure (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    CONSTRAINT units_of_measure_category_check CHECK ((category = ANY (ARRAY['mass'::text, 'volume'::text, 'count'::text])))
);


ALTER TABLE public.units_of_measure OWNER TO postgres;

--
-- Name: inventory_stock_on_hand; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.inventory_stock_on_hand WITH (security_invoker='true') AS
 SELECT l.organisation_id,
    l.branch_id,
    l.inventory_item_id,
    i.name AS inventory_item_name,
    i.category,
    u.code AS base_unit_code,
    i.reorder_level,
    i.target_stock_level,
    i.average_cost,
    sum(l.quantity_base) AS quantity_on_hand,
    (sum(l.quantity_base) * COALESCE(i.average_cost, (0)::numeric)) AS stock_value
   FROM ((public.inventory_ledger l
     JOIN public.inventory_items i ON ((i.id = l.inventory_item_id)))
     JOIN public.units_of_measure u ON ((u.id = i.base_unit_id)))
  GROUP BY l.organisation_id, l.branch_id, l.inventory_item_id, i.name, i.category, u.code, i.reorder_level, i.target_stock_level, i.average_cost;


ALTER VIEW public.inventory_stock_on_hand OWNER TO postgres;

--
-- Name: kpi_targets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kpi_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid,
    food_cost_target numeric(5,2),
    labour_cost_target numeric(5,2),
    net_margin_target numeric(5,2),
    is_estimate boolean DEFAULT true NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT kpi_targets_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)))
);


ALTER TABLE public.kpi_targets OWNER TO postgres;

--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    role text,
    CONSTRAINT menu_categories_role_check CHECK ((role = ANY (ARRAY['core'::text, 'side'::text, 'drink'::text]))),
    CONSTRAINT menu_categories_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.menu_categories OWNER TO postgres;

--
-- Name: organisations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organisations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organisations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.organisations OWNER TO postgres;

--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT payment_methods_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- Name: product_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    product_variant_id uuid NOT NULL,
    price numeric(14,2) NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT product_prices_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT product_prices_price_check CHECK ((price >= (0)::numeric))
);


ALTER TABLE public.product_prices OWNER TO postgres;

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    availability jsonb,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT product_variants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.product_variants OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    menu_category_id uuid,
    name text NOT NULL,
    sku text,
    tax_category_id uuid,
    reporting_category text,
    image_url text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    organisation_id uuid NOT NULL,
    full_name text NOT NULL,
    preferred_language text DEFAULT 'en'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: purchase_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_header_id uuid NOT NULL,
    kind text NOT NULL,
    storage_path text NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_by uuid,
    CONSTRAINT purchase_attachments_kind_check CHECK ((kind = ANY (ARRAY['receipt'::text, 'goods_photo'::text])))
);


ALTER TABLE public.purchase_attachments OWNER TO postgres;

--
-- Name: purchase_headers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_headers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    invoice_number text,
    invoice_date date NOT NULL,
    receiving_date date NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    exchange_rate numeric(18,6),
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    due_date date,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    posted_at timestamp with time zone,
    posted_by uuid,
    voided_at timestamp with time zone,
    voided_by uuid,
    void_reason text,
    CONSTRAINT purchase_headers_check CHECK (((currency = 'UZS'::text) OR (exchange_rate IS NOT NULL))),
    CONSTRAINT purchase_headers_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'partially_paid'::text, 'paid'::text]))),
    CONSTRAINT purchase_headers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'voided'::text])))
);


ALTER TABLE public.purchase_headers OWNER TO postgres;

--
-- Name: purchase_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_header_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity numeric(14,4) NOT NULL,
    unit_cost numeric(14,4) NOT NULL,
    tax_amount numeric(14,4) DEFAULT 0 NOT NULL,
    line_total numeric(16,4) GENERATED ALWAYS AS (((quantity * unit_cost) + tax_amount)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_lines_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT purchase_lines_tax_amount_check CHECK ((tax_amount >= (0)::numeric)),
    CONSTRAINT purchase_lines_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


ALTER TABLE public.purchase_lines OWNER TO postgres;

--
-- Name: recipe_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipe_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_version_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity numeric(14,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipe_lines_quantity_check CHECK ((quantity > (0)::numeric))
);


ALTER TABLE public.recipe_lines OWNER TO postgres;

--
-- Name: recipe_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipe_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    product_variant_id uuid,
    version_number integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    is_estimate boolean DEFAULT true NOT NULL,
    effective_from date,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    published_at timestamp with time zone,
    published_by uuid,
    inventory_item_id uuid,
    batch_yield_quantity numeric(14,4),
    CONSTRAINT recipe_versions_batch_yield_check CHECK (((inventory_item_id IS NULL) OR ((batch_yield_quantity IS NOT NULL) AND (batch_yield_quantity > (0)::numeric)))),
    CONSTRAINT recipe_versions_check CHECK ((((status = 'draft'::text) AND (effective_from IS NULL)) OR ((status = 'published'::text) AND (effective_from IS NOT NULL)))),
    CONSTRAINT recipe_versions_check1 CHECK (((effective_to IS NULL) OR ((effective_from IS NOT NULL) AND (effective_to >= effective_from)))),
    CONSTRAINT recipe_versions_owner_check CHECK ((((product_variant_id IS NOT NULL) AND (inventory_item_id IS NULL)) OR ((product_variant_id IS NULL) AND (inventory_item_id IS NOT NULL)))),
    CONSTRAINT recipe_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


ALTER TABLE public.recipe_versions OWNER TO postgres;

--
-- Name: recurring_expense_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recurring_expense_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid,
    expense_category_id uuid NOT NULL,
    name text NOT NULL,
    amount numeric(14,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    allocation_method text DEFAULT 'calendar_day'::text NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT recurring_expense_templates_allocation_method_check CHECK ((allocation_method = ANY (ARRAY['calendar_day'::text, 'trading_day'::text, 'actual_transaction'::text]))),
    CONSTRAINT recurring_expense_templates_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT recurring_expense_templates_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)))
);


ALTER TABLE public.recurring_expense_templates OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: shift_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shift_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    work_date date NOT NULL,
    hours_worked numeric(5,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT shift_entries_hours_worked_check CHECK (((hours_worked > (0)::numeric) AND (hours_worked <= (24)::numeric)))
);


ALTER TABLE public.shift_entries OWNER TO postgres;

--
-- Name: stock_count_headers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_count_headers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    count_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    posted_at timestamp with time zone,
    posted_by uuid,
    CONSTRAINT stock_count_headers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text])))
);


ALTER TABLE public.stock_count_headers OWNER TO postgres;

--
-- Name: stock_count_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_count_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stock_count_header_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    counted_quantity numeric(14,4) NOT NULL,
    expected_quantity numeric(14,4) NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_count_lines_counted_quantity_check CHECK ((counted_quantity >= (0)::numeric))
);


ALTER TABLE public.stock_count_lines OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    contact_name text,
    phone text,
    email text,
    payment_terms text,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    type text,
    CONSTRAINT suppliers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT suppliers_type_check CHECK ((type = ANY (ARRAY['market'::text, 'delivery_account'::text, 'packaging_equipment'::text, 'services_other'::text])))
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: tax_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    rate numeric(6,3) DEFAULT 0 NOT NULL,
    is_inclusive boolean DEFAULT true NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT tax_categories_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.tax_categories OWNER TO postgres;

--
-- Name: unit_conversions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unit_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_unit_id uuid NOT NULL,
    to_unit_id uuid NOT NULL,
    factor numeric(18,6) NOT NULL,
    CONSTRAINT unit_conversions_factor_check CHECK ((factor > (0)::numeric))
);


ALTER TABLE public.unit_conversions OWNER TO postgres;

--
-- Name: user_branch_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_branch_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid,
    profile_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.user_branch_roles OWNER TO postgres;

--
-- Name: waste_reasons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.waste_reasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT waste_reasons_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.waste_reasons OWNER TO postgres;

--
-- Name: waste_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.waste_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity_base numeric(14,4) NOT NULL,
    waste_reason_id uuid NOT NULL,
    business_date date NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT waste_records_quantity_base_check CHECK ((quantity_base > (0)::numeric))
);


ALTER TABLE public.waste_records OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea
)
PARTITION BY RANGE (inserted_at);


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone DEFAULT now()
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    selected_columns text[],
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


ALTER TABLE realtime.subscription OWNER TO supabase_realtime_admin;

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL,
    versioning_status text DEFAULT 'DISABLED'::text NOT NULL,
    CONSTRAINT buckets_versioning_dark_check CHECK ((versioning_status = 'DISABLED'::text)),
    CONSTRAINT buckets_versioning_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR (versioning_status = 'DISABLED'::text))),
    CONSTRAINT buckets_versioning_status_check CHECK ((versioning_status = ANY (ARRAY['DISABLED'::text, 'ENABLED'::text, 'SUSPENDED'::text])))
);


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE storage.buckets_analytics OWNER TO supabase_storage_admin;

--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.buckets_vectors OWNER TO supabase_storage_admin;

--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    archived_at timestamp with time zone,
    is_delete_marker boolean DEFAULT false NOT NULL,
    is_versioned boolean DEFAULT false NOT NULL
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.vector_indexes OWNER TO supabase_storage_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: postgres
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.custom_oauth_providers (id, provider_type, identifier, name, client_id, client_secret, acceptable_client_ids, scopes, pkce_enabled, attribute_mapping, authorization_params, enabled, email_optional, issuer, discovery_url, skip_nonce_check, cached_discovery, discovery_cached_at, authorization_url, token_url, userinfo_url, jwks_uri, created_at, updated_at, custom_claims_allowlist) FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at, invite_token, referrer, oauth_client_state_id, linking_target_id, email_optional) FROM stdin;
669b4628-47ca-49c8-a69c-a4ca12d2909c	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	b623857f-a7b1-4a50-b3f1-b2c0c8e0a2f7	s256	Fpp0CYk3MmjPVdf_lTRibZsqjuoIqId-EHiFIkdCPzs	recovery			2026-07-26 11:31:43.674113+00	2026-07-26 11:31:43.674113+00	recovery	\N	\N	\N	\N	\N	f
1c39bcb4-8eb7-434b-89a8-c7c35123d020	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	c3a6e88c-ebbb-4179-92ef-a6032dfc143c	s256	c2hT_KVnMoH1gutNm_q7pC0IPOlAloFoYHvdsF3SLHc	recovery			2026-07-26 11:32:28.50989+00	2026-07-26 11:32:28.50989+00	recovery	\N	\N	\N	\N	\N	f
fca9098b-7e19-4f6a-b40c-eb1d9f5a6d58	0d4cae11-1083-4757-80f3-efd1e2eba2e3	beea916d-b90c-437d-9503-08d4479c8987	s256	MV1K5IZCuoQnTnFACdMWWzdVR2j4Gsj2NsVpQ1RZ0nU	recovery			2026-08-05 14:32:08.717899+00	2026-08-05 14:32:08.717899+00	recovery	\N	\N	\N	\N	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
efe41f66-ad6b-481b-a7ed-b7b9a17481f3	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	{"sub": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "email": "digimaxartstudio@gmail.com", "email_verified": true, "phone_verified": false}	email	2026-07-26 09:52:16.257035+00	2026-07-26 09:52:16.257112+00	2026-07-26 09:52:16.257112+00	72f9f73f-1b3a-4393-b263-ff070bdb593c
db4f6e61-c2f4-4350-a6d2-8e6cbb9843ea	db4f6e61-c2f4-4350-a6d2-8e6cbb9843ea	{"sub": "db4f6e61-c2f4-4350-a6d2-8e6cbb9843ea", "email": "fkarimboy2012@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-26 17:44:52.312112+00	2026-07-26 17:44:52.312179+00	2026-07-26 17:44:52.312179+00	09b2bfbf-640e-499a-87f5-05e38a25d241
0d4cae11-1083-4757-80f3-efd1e2eba2e3	0d4cae11-1083-4757-80f3-efd1e2eba2e3	{"sub": "0d4cae11-1083-4757-80f3-efd1e2eba2e3", "email": "faridkarimboy@gmail.com", "email_verified": true, "phone_verified": false}	email	2026-08-05 14:05:01.914244+00	2026-08-05 14:05:01.914306+00	2026-08-05 14:05:01.914306+00	2659c565-a1a4-4dcf-9096-1664c21ebb77
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
7c9aa837-e8fe-4a73-a965-829ee6e409a7	2026-08-08 09:16:51.489186+00	2026-08-08 09:16:51.489186+00	password	0e6d3f56-f822-428c-a570-9324b50e56da
0cffc6c1-7fe7-4350-a8ca-948b050f5231	2026-08-08 10:17:11.757409+00	2026-08-08 10:17:11.757409+00	password	686da7a5-6081-4dc0-83c9-9d3eb99d397f
e211700d-b699-45a7-a8fc-06d420185cf5	2026-08-11 13:04:44.106806+00	2026-08-11 13:04:44.106806+00	password	8e497a61-760e-4937-9f59-65545823bc95
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type, token_endpoint_auth_method) FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
3c71ee3f-3c83-4b11-bb2a-6f643fc88038	db4f6e61-c2f4-4350-a6d2-8e6cbb9843ea	confirmation_token	33c88b3ca0549de4f3b8339ad3d4b6db9594511fcf1028f9c6fab777	fkarimboy2012@gmail.com	2026-07-26 17:44:52.741126	2026-07-26 17:44:52.741126
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
00000000-0000-0000-0000-000000000000	62	hfw3ye65a5nr	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	t	2026-08-08 09:16:51.486106+00	2026-08-08 10:16:29.473102+00	\N	7c9aa837-e8fe-4a73-a965-829ee6e409a7
00000000-0000-0000-0000-000000000000	63	egckalk2mycf	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	t	2026-08-08 10:16:29.47472+00	2026-08-09 16:06:30.434199+00	hfw3ye65a5nr	7c9aa837-e8fe-4a73-a965-829ee6e409a7
00000000-0000-0000-0000-000000000000	65	67x7l6gfvvxf	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	t	2026-08-09 16:06:30.440906+00	2026-08-10 09:45:56.189604+00	egckalk2mycf	7c9aa837-e8fe-4a73-a965-829ee6e409a7
00000000-0000-0000-0000-000000000000	66	txnthsal6dmy	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	f	2026-08-10 09:45:56.191852+00	2026-08-10 09:45:56.191852+00	67x7l6gfvvxf	7c9aa837-e8fe-4a73-a965-829ee6e409a7
00000000-0000-0000-0000-000000000000	67	4hblv2ukggha	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	f	2026-08-11 13:04:44.103113+00	2026-08-11 13:04:44.103113+00	\N	e211700d-b699-45a7-a8fc-06d420185cf5
00000000-0000-0000-0000-000000000000	64	ymiaujtwf33l	0d4cae11-1083-4757-80f3-efd1e2eba2e3	t	2026-08-08 10:17:11.755274+00	2026-08-13 06:39:03.924878+00	\N	0cffc6c1-7fe7-4350-a8ca-948b050f5231
00000000-0000-0000-0000-000000000000	68	x5awaqcyaxw3	0d4cae11-1083-4757-80f3-efd1e2eba2e3	t	2026-08-13 06:39:03.931942+00	2026-08-13 12:03:51.001483+00	ymiaujtwf33l	0cffc6c1-7fe7-4350-a8ca-948b050f5231
00000000-0000-0000-0000-000000000000	69	4avyvpjzewda	0d4cae11-1083-4757-80f3-efd1e2eba2e3	t	2026-08-13 12:03:51.003187+00	2026-08-19 07:05:15.777179+00	x5awaqcyaxw3	0cffc6c1-7fe7-4350-a8ca-948b050f5231
00000000-0000-0000-0000-000000000000	70	53k77axmwggx	0d4cae11-1083-4757-80f3-efd1e2eba2e3	f	2026-08-19 07:05:15.784546+00	2026-08-19 07:05:15.784546+00	4avyvpjzewda	0cffc6c1-7fe7-4350-a8ca-948b050f5231
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
20260115000000
20260121000000
20260219120000
20260302000000
20260625000000
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
7c9aa837-e8fe-4a73-a965-829ee6e409a7	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-08 09:16:51.483754+00	2026-08-10 09:45:56.495372+00	\N	aal1	\N	2026-08-10 09:45:56.495253	node	13.213.67.22	\N	\N	\N	\N	\N
e211700d-b699-45a7-a8fc-06d420185cf5	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-11 13:04:44.100196+00	2026-08-11 13:04:44.100196+00	\N	aal1	\N	\N	node	18.207.188.180	\N	\N	\N	\N	\N
0cffc6c1-7fe7-4350-a8ca-948b050f5231	0d4cae11-1083-4757-80f3-efd1e2eba2e3	2026-08-08 10:17:11.753576+00	2026-08-19 07:05:15.793855+00	\N	aal1	\N	2026-08-19 07:05:15.793722	node	18.170.24.173	\N	\N	\N	\N	\N
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	authenticated	authenticated	digimaxartstudio@gmail.com	$2a$10$mXAjmeDFWW2iKZoyBgoNse9ma1rkZ0mLdtX8ErJ8xyMwjTD3aEQGK	2026-07-26 11:20:32.925459+00	2026-07-26 11:11:54.132196+00		\N		\N			\N	2026-08-11 13:04:44.100079+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Owner", "email_verified": true, "organisation_id": "00000000-0000-0000-0000-000000000001", "preferred_language": "en"}	\N	2026-07-26 09:52:16.225888+00	2026-08-11 13:04:44.105333+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	0d4cae11-1083-4757-80f3-efd1e2eba2e3	authenticated	authenticated	faridkarimboy@gmail.com	$2a$10$sr01T8HnZU7Lv8EK0Q/pleGSO8l6Mi3DkxUuqy977.LdLTsDUi6z.	2026-08-05 14:31:19.402514+00	2026-08-05 14:05:01.915804+00		\N		\N			\N	2026-08-08 10:17:11.753452+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Farid", "email_verified": true, "organisation_id": "00000000-0000-0000-0000-000000000001", "preferred_language": "en"}	\N	2026-08-05 14:05:01.904633+00	2026-08-19 07:05:15.789028+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	db4f6e61-c2f4-4350-a6d2-8e6cbb9843ea	authenticated	authenticated	fkarimboy2012@gmail.com		\N	2026-07-26 17:44:52.313548+00	33c88b3ca0549de4f3b8339ad3d4b6db9594511fcf1028f9c6fab777	2026-07-26 17:44:52.313548+00		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Seoul Admin", "organisation_id": "00000000-0000-0000-0000-000000000001", "preferred_language": "en"}	\N	2026-07-26 17:44:52.305661+00	2026-07-26 17:44:52.738261+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.webauthn_challenges (id, user_id, challenge_type, session_data, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.webauthn_credentials (id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, transports, backup_eligible, backed_up, friendly_name, created_at, updated_at, last_used_at) FROM stdin;
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (organisation_id, base_currency, trading_days, financial_month_start_day, updated_at, updated_by) FROM stdin;
00000000-0000-0000-0000-000000000001	UZS	[1, 2, 3, 4, 5, 6, 7]	1	2026-07-26 11:49:00.53192+00	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, organisation_id, branch_id, actor_id, entity_table, entity_id, action, before_data, after_data, reason, created_at, actor_name) FROM stdin;
7b336e12-46ab-435b-9dc7-c0d84b53dd6e	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	expense_transactions	964661ff-245e-419f-b73e-79120550a6b3	insert	\N	\N	\N	2026-07-26 15:31:44.650854+00	Owner
78085cb9-7448-4824-a8a7-a9b6ec79348d	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	expense_transactions	964661ff-245e-419f-b73e-79120550a6b3	update	\N	\N	\N	2026-07-26 15:32:01.061649+00	Owner
e3d05739-3bb0-40c8-ab46-e74a13b2bcfa	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	daily_sales_headers	bc1b68ab-961d-4e92-abee-dfc1872f7398	insert	\N	{"id": "bc1b68ab-961d-4e92-abee-dfc1872f7398", "notes": null, "status": "draft", "branch_id": "00000000-0000-0000-0000-000000000002", "closed_at": null, "closed_by": null, "posted_at": null, "posted_by": null, "created_at": "2026-07-26T17:36:51.99712+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "reopened_at": null, "reopened_by": null, "orders_count": null, "business_date": "2026-07-26", "refund_amount": 0.00, "reopen_reason": null, "discount_amount": 0.00, "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-07-26 17:36:51.99712+00	Owner
edca0d5e-c859-4fbf-a18c-e792fc5c84c7	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	1ea16ef5-c1ad-535a-b90b-db9867959996	insert	\N	{"id": "1ea16ef5-c1ad-535a-b90b-db9867959996", "price": 12000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "7bdce91e-f45b-564b-afad-bae0680df4e9"}	\N	2026-07-26 17:40:37.428944+00	\N
f23a20bb-cfaa-46d8-ab88-b4775f5febfe	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	e1ca3a81-27e9-5ad7-8850-9bbdbacf8840	insert	\N	{"id": "e1ca3a81-27e9-5ad7-8850-9bbdbacf8840", "price": 12000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "8ddd9963-e44e-53ef-b770-070062074efc"}	\N	2026-07-26 17:40:37.428944+00	\N
fd781470-5e92-4cee-b315-630c8b5c2188	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	57ef104f-cbad-5c31-ba13-2ece4c468bbf	insert	\N	{"id": "57ef104f-cbad-5c31-ba13-2ece4c468bbf", "price": 12000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "9639fb2f-9725-504f-87fc-67c505eff81e"}	\N	2026-07-26 17:40:37.428944+00	\N
df9d45ad-9fb1-4890-9d92-de47993c95c9	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	2b8d7654-2b72-5489-950f-80285a3de5eb	insert	\N	{"id": "2b8d7654-2b72-5489-950f-80285a3de5eb", "price": 12000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "7d4302c4-5430-5a04-854a-89031881983a"}	\N	2026-07-26 17:40:37.428944+00	\N
2a1a450e-3dd8-48d4-80d1-6564e4c7823d	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	7426ff9d-6413-5901-8cd3-bd202f353065	insert	\N	{"id": "7426ff9d-6413-5901-8cd3-bd202f353065", "price": 12000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "237564cc-bd3d-5aaf-a295-39b33ab676a2"}	\N	2026-07-26 17:40:37.428944+00	\N
39625327-247c-408c-9e71-3320b247e8b4	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	57ad0b06-054d-51e3-aa48-63336441fadd	insert	\N	{"id": "57ad0b06-054d-51e3-aa48-63336441fadd", "price": 6100.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "9c810feb-f79b-5755-946a-e03e6d354b7b"}	\N	2026-07-26 17:40:37.428944+00	\N
cf7df9b1-ea80-4ddf-a25d-b0382d21607d	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	d2a93a4b-5c7e-5fe7-81d2-374cad3c084a	insert	\N	{"id": "d2a93a4b-5c7e-5fe7-81d2-374cad3c084a", "price": 12000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "9ec6cdfa-9d46-5d04-bbbf-215f1ba882a7"}	\N	2026-07-26 17:40:37.428944+00	\N
b13ddc0c-7b24-4834-869c-ba0738afc026	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	b7c05b56-a176-540c-8f1f-819fdea220b0	insert	\N	{"id": "b7c05b56-a176-540c-8f1f-819fdea220b0", "price": 8000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "e41e80bc-85e3-5c64-80d0-f01b8c7377b5"}	\N	2026-07-26 17:40:37.428944+00	\N
a52b2fd3-ddf9-42ee-a9a1-5f04237d7cd4	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	270e5ab5-d835-5803-a1ad-de4ec7e9bf5b	insert	\N	{"id": "270e5ab5-d835-5803-a1ad-de4ec7e9bf5b", "price": 5000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "21d0ff6b-8869-5e31-ab48-2aa0ea1f083c"}	\N	2026-07-26 17:40:37.428944+00	\N
d950fcb1-da1b-4259-9ce0-b401f74955fb	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	013b61a4-7c05-55d8-9e75-ba2f69b340bd	insert	\N	{"id": "013b61a4-7c05-55d8-9e75-ba2f69b340bd", "price": 30000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "809f6c37-b9cf-5195-8725-8139512aca83"}	\N	2026-07-26 17:40:37.428944+00	\N
a3f0e921-3df3-43d7-a8a1-94b2822209ee	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	5cfea3eb-a905-538a-b3d6-18df3486d650	insert	\N	{"id": "5cfea3eb-a905-538a-b3d6-18df3486d650", "price": 20000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "ebc3070c-8408-557b-95f5-6d8dfdf30173"}	\N	2026-07-26 17:40:37.428944+00	\N
37876104-dd9f-4dd1-843e-9483aba88abd	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	80bd57df-fd99-5d39-ab64-114fc1c4596c	insert	\N	{"id": "80bd57df-fd99-5d39-ab64-114fc1c4596c", "price": 15000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "2d15c473-25d8-5906-957f-22294fe8e0d2"}	\N	2026-07-26 17:40:37.428944+00	\N
18dccd3c-30e8-4bfb-b8b1-857fd836c168	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	7a91a32b-67ce-5782-8e0a-58231d8cbb43	insert	\N	{"id": "7a91a32b-67ce-5782-8e0a-58231d8cbb43", "price": 12000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "2a6c7bb7-1452-5367-bc45-75b654296d85"}	\N	2026-07-26 17:40:37.428944+00	\N
5d2d059a-31e0-40d3-b6ce-a742c380abac	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	cf797b03-171a-53eb-ae1a-85cdc48504ba	insert	\N	{"id": "cf797b03-171a-53eb-ae1a-85cdc48504ba", "price": 10000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "a417f368-c2d4-52ea-9fb4-d3947c683d37"}	\N	2026-07-26 17:40:37.428944+00	\N
5ceaaa60-5aec-4ca5-b42d-77825d685486	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	eeeaf1f6-9fd7-5d63-8362-ff2433b029fa	insert	\N	{"id": "eeeaf1f6-9fd7-5d63-8362-ff2433b029fa", "price": 10000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "bda3605c-2740-5ba7-8bb8-a02171891870"}	\N	2026-07-26 17:40:37.428944+00	\N
d9596e5d-e0f1-43f9-9d87-d21e938d3b0f	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	164f08c7-6c7d-551d-8099-0ae560d445b0	insert	\N	{"id": "164f08c7-6c7d-551d-8099-0ae560d445b0", "price": 12000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "22cd5b54-d856-598b-b855-d912407994db"}	\N	2026-07-26 17:40:37.428944+00	\N
a684dac8-da27-46fe-8a18-f74310499e10	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	0083d483-6bac-5746-aeea-1b3df625c98b	insert	\N	{"id": "0083d483-6bac-5746-aeea-1b3df625c98b", "price": 10000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "93277325-6732-5409-87a7-5b6234a3fb4c"}	\N	2026-07-26 17:40:37.428944+00	\N
b225ec67-ef66-462b-9c90-13f2e674344e	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	79f6e127-4c5b-509f-8671-49905a4cfe90	insert	\N	{"id": "79f6e127-4c5b-509f-8671-49905a4cfe90", "price": 6000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "39d5cbcf-9346-5f98-bebc-a71631241bd5"}	\N	2026-07-26 17:40:37.428944+00	\N
ec71c60d-c5c6-4771-8cd8-53212e875257	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	fa685f0d-db17-5d75-af82-6cd5906014ca	insert	\N	{"id": "fa685f0d-db17-5d75-af82-6cd5906014ca", "price": 6000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "232d2546-83a3-5394-9ba8-a0d687465513"}	\N	2026-07-26 17:40:37.428944+00	\N
6d078d92-bb18-4ce3-85f9-343ba63b29f6	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	19132446-365b-5ba9-aa56-7fb7f184e424	insert	\N	{"id": "19132446-365b-5ba9-aa56-7fb7f184e424", "price": 6000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "fb7dd3f5-dfbf-5935-8ecf-b0fae153f9de"}	\N	2026-07-26 17:40:37.428944+00	\N
a5c4ba6d-3eee-475b-b4b0-1b5f65364935	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	2dcb0ef9-e200-56c4-84fa-9618670f731d	insert	\N	{"id": "2dcb0ef9-e200-56c4-84fa-9618670f731d", "price": 1000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "0ffff08e-78be-5171-97c9-09fd9efee8ba"}	\N	2026-07-26 17:40:37.428944+00	\N
c469aa14-d9d4-4baf-af2b-312e2ccbecbd	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	\N	product_prices	3db04603-b3b3-59c1-b8b2-a9ce565af502	insert	\N	{"id": "3db04603-b3b3-59c1-b8b2-a9ce565af502", "price": 49322.22, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T17:40:37.428944+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "576ca9e9-1b96-5603-a269-26b41b5e8c22"}	\N	2026-07-26 17:40:37.428944+00	\N
34d18c5d-f0a6-48cd-937d-054072fedfee	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	daily_sales_headers	bc1b68ab-961d-4e92-abee-dfc1872f7398	update	{"id": "bc1b68ab-961d-4e92-abee-dfc1872f7398", "notes": null, "status": "draft", "branch_id": "00000000-0000-0000-0000-000000000002", "closed_at": null, "closed_by": null, "posted_at": null, "posted_by": null, "created_at": "2026-07-26T17:36:51.99712+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "reopened_at": null, "reopened_by": null, "orders_count": null, "business_date": "2026-07-26", "refund_amount": 0.00, "reopen_reason": null, "discount_amount": 0.00, "organisation_id": "00000000-0000-0000-0000-000000000001"}	{"id": "bc1b68ab-961d-4e92-abee-dfc1872f7398", "notes": null, "status": "posted", "branch_id": "00000000-0000-0000-0000-000000000002", "closed_at": null, "closed_by": null, "posted_at": "2026-07-26T17:41:30.892635+00:00", "posted_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "created_at": "2026-07-26T17:36:51.99712+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "reopened_at": null, "reopened_by": null, "orders_count": null, "business_date": "2026-07-26", "refund_amount": 0.00, "reopen_reason": null, "discount_amount": 0.00, "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-07-26 17:41:30.892635+00	Owner
ce6a226e-5f3b-4dc5-be18-903c8c55b298	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	stock_count_headers	f828b07b-ea89-4ae1-92bc-44c035badc08	insert	\N	{"id": "f828b07b-ea89-4ae1-92bc-44c035badc08", "notes": null, "status": "draft", "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": null, "posted_by": null, "count_date": "2026-07-26", "created_at": "2026-07-26T17:51:20.194105+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-07-26 17:51:20.194105+00	Owner
d9576c9e-c1f8-486e-ae80-5d3adcad9358	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	product_prices	2a74182e-ddc5-4327-a9f5-df8aaa7fcb72	insert	\N	{"id": "2a74182e-ddc5-4327-a9f5-df8aaa7fcb72", "price": 1000.00, "currency": "UZS", "branch_id": "00000000-0000-0000-0000-000000000002", "created_at": "2026-07-26T18:01:31.642109+00:00", "created_by": null, "effective_to": null, "effective_from": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "64fc8e0e-d6c6-4594-96be-f88f8b5abc06"}	\N	2026-07-26 18:01:31.642109+00	Owner
30f4c2f9-560b-4cea-869a-1ff654016a50	00000000-0000-0000-0000-000000000001	\N	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	recipe_versions	a82a631e-d203-47d6-ade8-22aa0f297fa4	insert	\N	{"id": "a82a631e-d203-47d6-ade8-22aa0f297fa4", "status": "draft", "created_at": "2026-08-05T19:43:34.550752+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "is_estimate": true, "effective_to": null, "published_at": null, "published_by": null, "effective_from": null, "version_number": 1, "organisation_id": "00000000-0000-0000-0000-000000000001", "product_variant_id": "237564cc-bd3d-5aaf-a295-39b33ab676a2"}	\N	2026-08-05 19:43:34.550752+00	Owner
1ec27a5d-49d2-4c9a-8eed-b17445b7c875	00000000-0000-0000-0000-000000000001	a93de0a6-8f06-459c-9256-55cf6ac74cb2	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	43c233b2-eb4e-4bee-a5f5-f29de97c318c	insert	\N	{"id": "43c233b2-eb4e-4bee-a5f5-f29de97c318c", "notes": "No receipt given, cash purchase at the market", "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "a93de0a6-8f06-459c-9256-55cf6ac74cb2", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-07T12:38:21.580397+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-07 12:38:21.580397+00	Owner
2fb44da4-ea73-4809-8bc4-8bc6954ba40e	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	29ce5919-5b5f-4e6a-ac1a-9ae3b1e3f73d	insert	\N	{"id": "29ce5919-5b5f-4e6a-ac1a-9ae3b1e3f73d", "notes": null, "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-07T12:59:32.035892+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-07 12:59:32.035892+00	Owner
96c3341d-4373-4844-baf9-5a1df5e3df75	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	0d4cae11-1083-4757-80f3-efd1e2eba2e3	purchase_headers	96e3e28d-61bd-4c4c-9bf1-b3a93c86c22b	insert	\N	{"id": "96e3e28d-61bd-4c4c-9bf1-b3a93c86c22b", "notes": null, "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-07T13:02:14.167442+00:00", "created_by": "0d4cae11-1083-4757-80f3-efd1e2eba2e3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-07 13:02:14.167442+00	Farid
9b73fbd0-9233-431a-903e-85cc877eae9a	00000000-0000-0000-0000-000000000001	a93de0a6-8f06-459c-9256-55cf6ac74cb2	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	43c233b2-eb4e-4bee-a5f5-f29de97c318c	update	{"id": "43c233b2-eb4e-4bee-a5f5-f29de97c318c", "notes": "No receipt given, cash purchase at the market", "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "a93de0a6-8f06-459c-9256-55cf6ac74cb2", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-07T12:38:21.580397+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	{"id": "43c233b2-eb4e-4bee-a5f5-f29de97c318c", "notes": "No receipt given, cash purchase at the market", "status": "posted", "currency": "UZS", "due_date": null, "branch_id": "a93de0a6-8f06-459c-9256-55cf6ac74cb2", "posted_at": "2026-08-07T13:34:23.817164+00:00", "posted_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "voided_at": null, "voided_by": null, "created_at": "2026-08-07T12:38:21.580397+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-07 13:34:23.817164+00	Owner
bddaa5df-fb12-4104-8ca7-c8246bd9e9d6	00000000-0000-0000-0000-000000000001	a93de0a6-8f06-459c-9256-55cf6ac74cb2	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	43c233b2-eb4e-4bee-a5f5-f29de97c318c	update	{"id": "43c233b2-eb4e-4bee-a5f5-f29de97c318c", "notes": "No receipt given, cash purchase at the market", "status": "posted", "currency": "UZS", "due_date": null, "branch_id": "a93de0a6-8f06-459c-9256-55cf6ac74cb2", "posted_at": "2026-08-07T13:34:23.817164+00:00", "posted_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "voided_at": null, "voided_by": null, "created_at": "2026-08-07T12:38:21.580397+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	{"id": "43c233b2-eb4e-4bee-a5f5-f29de97c318c", "notes": "No receipt given, cash purchase at the market", "status": "voided", "currency": "UZS", "due_date": null, "branch_id": "a93de0a6-8f06-459c-9256-55cf6ac74cb2", "posted_at": "2026-08-07T13:34:23.817164+00:00", "posted_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "voided_at": "2026-08-07T14:19:21.719087+00:00", "voided_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "created_at": "2026-08-07T12:38:21.580397+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": "test purchase", "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	test purchase	2026-08-07 14:19:21.719087+00	Owner
aa890f67-1ed8-47a0-b40c-49319ff5263a	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	a14a816e-fdeb-40b9-875b-231efc5587e1	insert	\N	{"id": "a14a816e-fdeb-40b9-875b-231efc5587e1", "notes": null, "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-07T14:50:50.834581+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "5a87aeef-e466-41be-97d6-a12c7121c8c7", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": "3", "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-07 14:50:50.834581+00	Owner
81d27c1d-a6b4-46c4-aeba-3142a373786e	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	a14a816e-fdeb-40b9-875b-231efc5587e1	update	{"id": "a14a816e-fdeb-40b9-875b-231efc5587e1", "notes": null, "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-07T14:50:50.834581+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "5a87aeef-e466-41be-97d6-a12c7121c8c7", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": "3", "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	{"id": "a14a816e-fdeb-40b9-875b-231efc5587e1", "notes": null, "status": "posted", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": "2026-08-07T14:53:39.308684+00:00", "posted_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "voided_at": null, "voided_by": null, "created_at": "2026-08-07T14:50:50.834581+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "5a87aeef-e466-41be-97d6-a12c7121c8c7", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": "3", "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-07 14:53:39.308684+00	Owner
a9c9a9d3-f229-474e-92bf-75eb18e65809	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	9ac13900-7693-4687-9cd5-4e6bb05d3185	update	{"id": "9ac13900-7693-4687-9cd5-4e6bb05d3185", "notes": null, "status": "posted", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": "2026-07-26T13:43:05.058785+00:00", "posted_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "voided_at": null, "voided_by": null, "created_at": "2026-07-26T13:41:04.981673+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "5a87aeef-e466-41be-97d6-a12c7121c8c7", "void_reason": null, "invoice_date": "2026-07-26", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001"}	{"id": "9ac13900-7693-4687-9cd5-4e6bb05d3185", "notes": null, "status": "voided", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": "2026-07-26T13:43:05.058785+00:00", "posted_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "voided_at": "2026-08-07T14:54:39.432484+00:00", "voided_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "created_at": "2026-07-26T13:41:04.981673+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "5a87aeef-e466-41be-97d6-a12c7121c8c7", "void_reason": "duplicate", "invoice_date": "2026-07-26", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-07-26", "organisation_id": "00000000-0000-0000-0000-000000000001"}	duplicate	2026-08-07 14:54:39.432484+00	Owner
3a138c40-53c0-44f3-a7a0-7da192da5400	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	ad748e88-542e-41ca-8f79-4abceff3465e	insert	\N	{"id": "ad748e88-542e-41ca-8f79-4abceff3465e", "notes": null, "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-07T14:56:49.441355+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": "1", "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-07 14:56:49.441355+00	Owner
4efb3fc5-08f3-4982-aa00-6cf23d9b7f77	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	ad748e88-542e-41ca-8f79-4abceff3465e	update	{"id": "ad748e88-542e-41ca-8f79-4abceff3465e", "notes": null, "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-07T14:56:49.441355+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": "1", "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	{"id": "ad748e88-542e-41ca-8f79-4abceff3465e", "notes": null, "status": "posted", "currency": "UZS", "due_date": null, "branch_id": "00000000-0000-0000-0000-000000000002", "posted_at": "2026-08-07T14:59:34.725296+00:00", "posted_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "voided_at": null, "voided_by": null, "created_at": "2026-08-07T14:56:49.441355+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd", "void_reason": null, "invoice_date": "2026-08-07", "exchange_rate": null, "invoice_number": "1", "payment_status": "unpaid", "receiving_date": "2026-08-07", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-07 14:59:34.725296+00	Owner
273f45fb-c75c-4cf0-8e8a-8e72d2d0b200	00000000-0000-0000-0000-000000000001	\N	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	recipe_versions	88e7611c-20d4-492a-9358-dec0fa2e7ab5	insert	\N	{"id": "88e7611c-20d4-492a-9358-dec0fa2e7ab5", "status": "draft", "created_at": "2026-08-08T09:03:18.081842+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "is_estimate": true, "effective_to": null, "published_at": null, "published_by": null, "effective_from": null, "version_number": 1, "organisation_id": "00000000-0000-0000-0000-000000000001", "inventory_item_id": "3d4ecf4c-780c-5dd2-8a05-05a17528f329", "product_variant_id": null, "batch_yield_quantity": 5.0000}	\N	2026-08-08 09:03:18.081842+00	Owner
457d8a0d-91df-4f53-86be-70dc10dee59d	00000000-0000-0000-0000-000000000001	a93de0a6-8f06-459c-9256-55cf6ac74cb2	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	purchase_headers	0106d193-fba0-43d2-af56-555e0fb52364	insert	\N	{"id": "0106d193-fba0-43d2-af56-555e0fb52364", "notes": null, "status": "draft", "currency": "UZS", "due_date": null, "branch_id": "a93de0a6-8f06-459c-9256-55cf6ac74cb2", "posted_at": null, "posted_by": null, "voided_at": null, "voided_by": null, "created_at": "2026-08-08T09:40:24.392782+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "supplier_id": "5a87aeef-e466-41be-97d6-a12c7121c8c7", "void_reason": null, "invoice_date": "2026-08-08", "exchange_rate": null, "invoice_number": null, "payment_status": "unpaid", "receiving_date": "2026-08-08", "organisation_id": "00000000-0000-0000-0000-000000000001"}	\N	2026-08-08 09:40:24.392782+00	Owner
83ede71d-e476-4fb5-8e0d-81b3f420dc36	00000000-0000-0000-0000-000000000001	\N	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	recipe_versions	4271f36b-bfca-429a-8c65-58db288e9ed7	insert	\N	{"id": "4271f36b-bfca-429a-8c65-58db288e9ed7", "status": "draft", "created_at": "2026-08-10T09:49:47.749446+00:00", "created_by": "efe41f66-ad6b-481b-a7ed-b7b9a17481f3", "is_estimate": true, "effective_to": null, "published_at": null, "published_by": null, "effective_from": null, "version_number": 1, "organisation_id": "00000000-0000-0000-0000-000000000001", "inventory_item_id": "6eeb056d-9531-515b-8f5c-6178c7de18c6", "product_variant_id": null, "batch_yield_quantity": 30.0000}	\N	2026-08-10 09:49:47.749446+00	Owner
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, organisation_id, name, address, timezone, opening_hours, reporting_currency, status, created_at, updated_at, created_by, updated_by) FROM stdin;
00000000-0000-0000-0000-000000000002	00000000-0000-0000-0000-000000000001	Seoul Mun / Tashkent	\N	Asia/Tashkent	\N	UZS	active	2026-07-26 09:39:07.211029+00	2026-07-26 09:39:07.211029+00	\N	\N
a93de0a6-8f06-459c-9256-55cf6ac74cb2	00000000-0000-0000-0000-000000000001	Qatartal	\N	Asia/Tashkent	\N	UZS	inactive	2026-08-05 18:04:36.990173+00	2026-08-05 18:04:36.990173+00	\N	\N
\.


--
-- Data for Name: bundle_components; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bundle_components (id, bundle_variant_id, component_type, component_product_variant_id, component_inventory_item_id, quantity, created_at) FROM stdin;
838960b0-27b5-5209-9257-b24a0865ad25	516b335c-037e-5a1d-bfa9-88ea31ac4903	product_variant	5a07627a-6f29-5d7e-8725-fbc1af4881ff	\N	1.000	2026-07-26 17:12:41.989903+00
9c431a96-b0d5-57cc-b550-b3e624f6a0ad	516b335c-037e-5a1d-bfa9-88ea31ac4903	product_variant	45c5f5d7-f184-5605-8ffe-62e5c0a53185	\N	1.000	2026-07-26 17:12:41.989903+00
c123caf0-80fa-5a37-83af-096558a592e7	516b335c-037e-5a1d-bfa9-88ea31ac4903	ingredient	\N	168b02a9-435d-5d99-acf2-4f72adeb6422	1.000	2026-07-26 17:12:41.989903+00
b026ee1d-3804-537d-8c30-72f4623d220d	a5e001fe-0e77-53b7-b422-adb82c7b2737	product_variant	80fffe82-c45c-5cac-81fe-33bc417ce741	\N	1.000	2026-07-26 17:12:41.989903+00
e7058401-b931-599d-a636-396164f69e4f	a5e001fe-0e77-53b7-b422-adb82c7b2737	product_variant	45c5f5d7-f184-5605-8ffe-62e5c0a53185	\N	1.000	2026-07-26 17:12:41.989903+00
c4f7aeb5-3907-554a-b303-213e5075a4f5	a5e001fe-0e77-53b7-b422-adb82c7b2737	ingredient	\N	168b02a9-435d-5d99-acf2-4f72adeb6422	1.000	2026-07-26 17:12:41.989903+00
d5df0520-8ac4-59af-9d62-94fba09d8fa8	92de75ea-84c5-5b7e-949a-c084506b032f	product_variant	f922c426-c78c-5b89-bfe1-9c5e39dd1ef6	\N	1.000	2026-07-26 17:12:41.989903+00
20188cc0-5a04-5ffd-9a53-274a506f0431	92de75ea-84c5-5b7e-949a-c084506b032f	product_variant	45c5f5d7-f184-5605-8ffe-62e5c0a53185	\N	1.000	2026-07-26 17:12:41.989903+00
8db33933-3868-559f-b1ce-85680ac64c8d	92de75ea-84c5-5b7e-949a-c084506b032f	ingredient	\N	168b02a9-435d-5d99-acf2-4f72adeb6422	1.000	2026-07-26 17:12:41.989903+00
164e191f-5a32-5dd3-af6e-ccf6c3b094a6	bfb9b742-4188-5f93-b7e7-b06ffd64b31b	product_variant	72c12c55-a72b-573f-a961-22a16760bc41	\N	1.000	2026-07-26 17:12:41.989903+00
077f12c3-d130-556c-a99f-3428d015bac6	bfb9b742-4188-5f93-b7e7-b06ffd64b31b	product_variant	45c5f5d7-f184-5605-8ffe-62e5c0a53185	\N	1.000	2026-07-26 17:12:41.989903+00
3b059b36-b821-5f0e-a47c-23c0354f1844	bfb9b742-4188-5f93-b7e7-b06ffd64b31b	ingredient	\N	168b02a9-435d-5d99-acf2-4f72adeb6422	1.000	2026-07-26 17:12:41.989903+00
632c9486-b5c1-503c-93e3-73df0a68c2d7	91750655-321c-5178-97e5-d5bfc11a9887	product_variant	6bae66b0-65d4-513a-aaf8-85c02fa75aef	\N	1.000	2026-07-26 17:12:41.989903+00
07dfb54b-9429-54c8-a12a-1e5524053d4d	91750655-321c-5178-97e5-d5bfc11a9887	product_variant	45c5f5d7-f184-5605-8ffe-62e5c0a53185	\N	1.000	2026-07-26 17:12:41.989903+00
d7939390-d1d2-5faf-8dbb-cadb61250112	91750655-321c-5178-97e5-d5bfc11a9887	ingredient	\N	168b02a9-435d-5d99-acf2-4f72adeb6422	1.000	2026-07-26 17:12:41.989903+00
c940053d-792d-554d-b399-9a8bce417520	60e7aed0-43be-5734-a7e1-fb458b234c46	product_variant	7c2389e6-f3ad-54e8-b604-0f0bf2e4d6d8	\N	1.000	2026-07-26 17:12:41.989903+00
26efab52-b89e-5a9b-aaaf-fa900c598bac	60e7aed0-43be-5734-a7e1-fb458b234c46	ingredient	\N	168b02a9-435d-5d99-acf2-4f72adeb6422	1.000	2026-07-26 17:12:41.989903+00
3d0af77d-415e-514c-8b52-b463cebfe863	9880294f-dd27-50c1-9064-6744e94cdb58	product_variant	923ed535-f74b-5d05-a8a3-1c314a1c7ef2	\N	1.000	2026-07-26 17:12:41.989903+00
15917bd3-5109-529d-adb3-c10d9394826d	9880294f-dd27-50c1-9064-6744e94cdb58	ingredient	\N	168b02a9-435d-5d99-acf2-4f72adeb6422	1.000	2026-07-26 17:12:41.989903+00
1dc65aa3-1183-51b2-b8fc-fab09de1bae6	c36d1dfe-26d0-5c78-8e99-4b6f958fee78	product_variant	5a07627a-6f29-5d7e-8725-fbc1af4881ff	\N	2.000	2026-07-26 17:12:41.989903+00
7e500df1-d88a-56b5-85ba-82814bfba9f6	c36d1dfe-26d0-5c78-8e99-4b6f958fee78	product_variant	80fffe82-c45c-5cac-81fe-33bc417ce741	\N	2.000	2026-07-26 17:12:41.989903+00
83fadd2b-3617-5358-8d05-b0d8bdb29481	c36d1dfe-26d0-5c78-8e99-4b6f958fee78	product_variant	6bae66b0-65d4-513a-aaf8-85c02fa75aef	\N	1.000	2026-07-26 17:12:41.989903+00
3cac74df-0a63-518f-bf14-537957ffc947	c36d1dfe-26d0-5c78-8e99-4b6f958fee78	product_variant	9c295608-570c-5150-916c-21c026c175e0	\N	2.000	2026-07-26 17:12:41.989903+00
34124fd5-e71a-5bd9-95ea-c279049271a5	c36d1dfe-26d0-5c78-8e99-4b6f958fee78	ingredient	\N	168b02a9-435d-5d99-acf2-4f72adeb6422	4.000	2026-07-26 17:12:41.989903+00
785cdae9-c54f-4d91-b9c1-c5c8fd5094f7	2b1ae522-bdb5-43c2-9381-3167b7037792	product_variant	72c12c55-a72b-573f-a961-22a16760bc41	\N	1.000	2026-08-06 14:27:21.153319+00
ededb052-fc9a-4801-930e-cc2ad05a3c7e	2b1ae522-bdb5-43c2-9381-3167b7037792	product_variant	7c2389e6-f3ad-54e8-b604-0f0bf2e4d6d8	\N	1.000	2026-08-06 14:27:22.760744+00
0b5c63c0-9b35-465a-85a1-1fbfc31956b7	2b1ae522-bdb5-43c2-9381-3167b7037792	product_variant	f922c426-c78c-5b89-bfe1-9c5e39dd1ef6	\N	2.000	2026-08-06 14:27:27.711875+00
3d2eac28-734e-4def-8ebb-e332e80c8b2f	2b1ae522-bdb5-43c2-9381-3167b7037792	product_variant	923ed535-f74b-5d05-a8a3-1c314a1c7ef2	\N	1.000	2026-08-06 14:27:31.031462+00
9a6b1dd9-3033-4219-b9a9-c820a0f9bbb3	2b1ae522-bdb5-43c2-9381-3167b7037792	product_variant	5a07627a-6f29-5d7e-8725-fbc1af4881ff	\N	2.000	2026-08-06 14:27:34.756288+00
30575d5e-595b-4772-9bf7-d761ca0438b7	2b1ae522-bdb5-43c2-9381-3167b7037792	product_variant	80fffe82-c45c-5cac-81fe-33bc417ce741	\N	2.000	2026-08-06 14:27:40.436091+00
504323a3-ed97-42cc-bdad-f4fd1f5ce892	2b1ae522-bdb5-43c2-9381-3167b7037792	product_variant	8ddd9963-e44e-53ef-b770-070062074efc	\N	6.000	2026-08-06 14:27:58.819797+00
\.


--
-- Data for Name: cash_flow_adjustments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_flow_adjustments (id, organisation_id, branch_id, adjustment_date, amount, reason, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: cash_reconciliations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_reconciliations (id, organisation_id, branch_id, business_date, opening_cash, cash_expenses, cash_deposits, cash_withdrawals, actual_closing_cash, card_expected, card_actual, status, notes, created_at, created_by, signed_off_at, signed_off_by) FROM stdin;
\.


--
-- Data for Name: currencies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.currencies (code, name, symbol, minor_unit) FROM stdin;
USD	US Dollar	$	2
UZS	Uzbekistani so'm	so'm	0
\.


--
-- Data for Name: daily_payment_totals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_payment_totals (id, daily_sales_header_id, payment_method_id, amount) FROM stdin;
\.


--
-- Data for Name: daily_sales_headers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_sales_headers (id, organisation_id, branch_id, business_date, status, discount_amount, refund_amount, orders_count, notes, created_at, created_by, posted_at, posted_by, closed_at, closed_by, reopened_at, reopened_by, reopen_reason) FROM stdin;
\.


--
-- Data for Name: daily_sales_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_sales_lines (id, daily_sales_header_id, product_variant_id, quantity_sold, revenue_override, override_reason, revenue, created_at) FROM stdin;
\.


--
-- Data for Name: employee_pay_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_pay_rates (id, employee_id, pay_rate, currency, effective_from, effective_to, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, organisation_id, branch_id, name, role_title, employment_status, pay_type, created_at, created_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: exchange_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exchange_rates (id, organisation_id, from_currency, to_currency, rate, effective_from, effective_to, created_at, created_by) FROM stdin;
0f066d77-4153-4f58-9893-d23872f3aea9	00000000-0000-0000-0000-000000000001	USD	UZS	11935.000000	2026-07-26	2026-08-06	2026-07-26 15:08:29.057144+00	\N
a21e62fc-733c-417d-9858-0b2b332a1577	00000000-0000-0000-0000-000000000001	USD	UZS	11935.000000	2026-08-07	\N	2026-08-07 10:08:23.654892+00	\N
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_categories (id, organisation_id, name, status, created_at, created_by, updated_at, updated_by) FROM stdin;
1b6b19d7-ce2d-5a0b-91dd-1fe3f557e4d4	00000000-0000-0000-0000-000000000001	Staff	active	2026-07-26 14:26:20.541603+00	\N	2026-07-26 14:26:20.541603+00	\N
ccd5b92e-1b7d-58a2-96bd-cbdf480c0aa8	00000000-0000-0000-0000-000000000001	Rent	active	2026-07-26 14:26:20.541603+00	\N	2026-07-26 14:26:20.541603+00	\N
ed0347cc-8121-5143-a01a-b606991f2e4b	00000000-0000-0000-0000-000000000001	Electricity	active	2026-07-26 14:26:20.541603+00	\N	2026-07-26 14:26:20.541603+00	\N
957d9953-f231-5c3e-8304-7bfc784aaf6b	00000000-0000-0000-0000-000000000001	Property/rent tax	active	2026-07-26 14:26:20.541603+00	\N	2026-07-26 14:26:20.541603+00	\N
e9d0c830-54ed-5c12-b068-da605e250493	00000000-0000-0000-0000-000000000001	Water	active	2026-07-26 14:26:20.541603+00	\N	2026-07-26 14:26:20.541603+00	\N
9ce51cbe-3bfd-5f94-b1aa-114b8bb4ae5d	00000000-0000-0000-0000-000000000001	Management charge	active	2026-07-26 14:26:20.541603+00	\N	2026-07-26 14:26:20.541603+00	\N
28b6e168-6b33-5209-9809-20a69b194615	00000000-0000-0000-0000-000000000001	EPOS	active	2026-07-26 14:26:20.541603+00	\N	2026-07-26 14:26:20.541603+00	\N
19d6c279-2321-4daf-aade-11703cd0c23d	00000000-0000-0000-0000-000000000001	Internet	active	2026-08-05 18:44:51.298953+00	\N	2026-08-05 18:44:51.298953+00	\N
\.


--
-- Data for Name: expense_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_transactions (id, organisation_id, branch_id, expense_category_id, vendor, currency, exchange_rate, amount, accrual_date, payment_date, status, notes, created_at, created_by, posted_at, posted_by) FROM stdin;
964661ff-245e-419f-b73e-79120550a6b3	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	ed0347cc-8121-5143-a01a-b606991f2e4b	Test vendor (audit verification)	UZS	\N	1000.00	2026-07-26	\N	posted	\N	2026-07-26 15:31:44.650854+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-07-26 15:32:00.798+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_items (id, organisation_id, name, uzbek_name, category, base_unit_id, purchase_unit_id, purchase_to_base_factor, default_supplier_id, current_cost, last_cost, average_cost, reorder_level, target_stock_level, shelf_life_days, tax_category_id, status, created_at, created_by, updated_at, updated_by, source) FROM stdin;
cac9784a-0427-5c7f-b131-b2cc59063a7d	00000000-0000-0000-0000-000000000001	Durum wraps	\N	food	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
8fedc1ec-9d78-522c-9e79-614434fc94e3	00000000-0000-0000-0000-000000000001	Tombik bread	\N	food	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
f3515c64-1440-5836-b470-5167ea33cf53	00000000-0000-0000-0000-000000000001	Rice	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
ff6547b1-8fd1-5559-8f5c-afd4f4182da7	00000000-0000-0000-0000-000000000001	Fries (frozen)	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
3a91dbaa-7de2-50d9-b3be-96f5341ad306	00000000-0000-0000-0000-000000000001	Soup portions	\N	food	98924926-de56-49c1-9470-95b0d61fe75c	98924926-de56-49c1-9470-95b0d61fe75c	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
3ec1744b-57e4-59ef-807a-7b268587c5d9	00000000-0000-0000-0000-000000000001	Red cabbage	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
3ccdbc7c-e6b6-51ce-a5d6-1c377ebfa566	00000000-0000-0000-0000-000000000001	Pickles	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
270cb383-1890-5207-aaaf-7570977a072a	00000000-0000-0000-0000-000000000001	Turkish yoghurt	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
168b02a9-435d-5d99-acf2-4f72adeb6422	00000000-0000-0000-0000-000000000001	Pepsi / soft drinks	\N	drink	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
68f50cf5-a24c-53b8-bb59-d3135ae6823f	00000000-0000-0000-0000-000000000001	Ayran	\N	drink	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
4a5a961c-b464-5e17-853e-d1ec52ca35cd	00000000-0000-0000-0000-000000000001	Lemonade	\N	drink	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
9f0a3962-fe87-57ff-9d75-83c64c22fb60	00000000-0000-0000-0000-000000000001	Bowls	\N	packaging	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
13f316a9-9bf8-5411-bdda-a6c6201f91d2	00000000-0000-0000-0000-000000000001	Compartment boxes	\N	packaging	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
8f77ad98-f1a3-55ee-b1b1-f376d71b18be	00000000-0000-0000-0000-000000000001	Cups	\N	packaging	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
dd1337ad-2d4c-5dcc-8853-e6113ab9e771	00000000-0000-0000-0000-000000000001	Lids	\N	packaging	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
9bfe704f-701a-5fac-9307-dd7a5c568fc2	00000000-0000-0000-0000-000000000001	Wrapping paper	\N	packaging	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
bbb62efc-8327-535c-b95b-808094579caa	00000000-0000-0000-0000-000000000001	Carry bags	\N	packaging	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
ca00d72e-9eae-5dbb-80cc-40c96c64b076	00000000-0000-0000-0000-000000000001	Napkins	\N	consumable	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
5c22b126-4848-51cb-8283-8abb75147d5e	00000000-0000-0000-0000-000000000001	Fries packaging	\N	packaging	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	10.0000	10.0000	10.0000	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-08-07 13:34:23.817164+00	\N	purchased
07d4d5a5-a179-5945-8547-524986bb5f8a	00000000-0000-0000-0000-000000000001	Lettuce	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	20.0000	20.0000	20.0000	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-08-07 14:53:39.308684+00	\N	purchased
0eba7449-0c0f-56ae-ad09-a1e00a46b678	00000000-0000-0000-0000-000000000001	Burger buns	\N	food	c319e1cf-65c1-4870-910a-78caa45a3281	c319e1cf-65c1-4870-910a-78caa45a3281	1.000000	\N	5.0000	5.0000	5.0000	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-08-07 14:53:39.308684+00	\N	purchased
0d7021a8-a20c-5014-adcb-a7b7bdd06285	00000000-0000-0000-0000-000000000001	Tomato	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	30000.0000	30000.0000	30000.0000	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-08-07 14:59:34.725296+00	\N	purchased
23d3b6de-13af-58eb-b203-48f932ad31c3	00000000-0000-0000-0000-000000000001	Onion	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	150000.0000	150000.0000	60006.0000	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-08-07 14:59:34.725296+00	\N	purchased
3d4ecf4c-780c-5dd2-8a05-05a17528f329	00000000-0000-0000-0000-000000000001	Iskender sauce	\N	food	2c29eb43-be1b-490e-8bb7-382e493be39a	2c29eb43-be1b-490e-8bb7-382e493be39a	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	prepared
35ff904d-548a-5492-b65f-cd76a8b7cca6	00000000-0000-0000-0000-000000000001	TAVUK GOSHT	\N	food	ec077c04-e5a4-4cbf-beff-8c03685d1410	ec077c04-e5a4-4cbf-beff-8c03685d1410	1.000000	\N	45000.0000	45000.0000	45000.0000	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 13:43:05.058785+00	\N	purchased
d2e2b093-54f7-5e6f-b8b7-d97f4f3587c8	00000000-0000-0000-0000-000000000001	Chilli sauce	\N	food	2c29eb43-be1b-490e-8bb7-382e493be39a	2c29eb43-be1b-490e-8bb7-382e493be39a	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	inactive	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	purchased
6eeb056d-9531-515b-8f5c-6178c7de18c6	00000000-0000-0000-0000-000000000001	Garlic sauce	\N	food	1b8af3d3-e7f1-4c23-909f-b8ef51de3e97	1b8af3d3-e7f1-4c23-909f-b8ef51de3e97	1.000000	\N	\N	\N	\N	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N	prepared
\.


--
-- Data for Name: inventory_ledger; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_ledger (id, organisation_id, branch_id, inventory_item_id, transaction_type, quantity_base, cost_basis, source_type, source_id, business_date, created_at, created_by) FROM stdin;
0334abe3-4e31-469b-8e12-be5aba23ac3e	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	35ff904d-548a-5492-b65f-cd76a8b7cca6	purchase_receipt	2.0000	45000.0000	purchase_line	5df12e12-d700-471e-be11-87f001a9c815	2026-07-26	2026-07-26 13:43:05.058785+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
8feed9c6-c5cf-4309-a1a7-90da8dd19cce	00000000-0000-0000-0000-000000000001	a93de0a6-8f06-459c-9256-55cf6ac74cb2	5c22b126-4848-51cb-8283-8abb75147d5e	purchase_receipt	10.0000	10.0000	purchase_line	d1a912c5-aa3d-4dfb-8280-cebc8c2666eb	2026-08-07	2026-08-07 13:34:23.817164+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
0e44ea6f-09f1-4309-9201-681ed64b5dab	00000000-0000-0000-0000-000000000001	a93de0a6-8f06-459c-9256-55cf6ac74cb2	5c22b126-4848-51cb-8283-8abb75147d5e	manual_correction	-10.0000	10.0000	purchase_void	43c233b2-eb4e-4bee-a5f5-f29de97c318c	2026-08-07	2026-08-07 14:19:21.719087+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
bbf618c0-1522-45d7-a60e-a6d3d9d3ed69	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	07d4d5a5-a179-5945-8547-524986bb5f8a	purchase_receipt	2.0000	20.0000	purchase_line	57f308aa-6b76-40a8-8bba-2830723f928f	2026-08-07	2026-08-07 14:53:39.308684+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
8f4daa32-cd93-4e56-9de7-867bd15a5a3a	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	23d3b6de-13af-58eb-b203-48f932ad31c3	purchase_receipt	3.0000	10.0000	purchase_line	41fbd9e0-cb89-4f94-aa25-d87157d1d983	2026-08-07	2026-08-07 14:53:39.308684+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
cc4d3610-e7cd-4a83-9eb0-8986abe1f6e1	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	0eba7449-0c0f-56ae-ad09-a1e00a46b678	purchase_receipt	50.0000	5.0000	purchase_line	37f5c246-72a9-4494-9063-1e88a486f049	2026-08-07	2026-08-07 14:53:39.308684+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
5785ac19-2ebf-437d-b3e1-456ea33ca7a9	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	35ff904d-548a-5492-b65f-cd76a8b7cca6	manual_correction	-2.0000	45000.0000	purchase_void	9ac13900-7693-4687-9cd5-4e6bb05d3185	2026-08-07	2026-08-07 14:54:39.432484+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
02a21b15-383f-4fea-8f3c-0cf5fde102e2	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	0d7021a8-a20c-5014-adcb-a7b7bdd06285	purchase_receipt	3.0000	30000.0000	purchase_line	668b7aa0-1f37-4b0c-9c35-f0e9b83056b2	2026-08-07	2026-08-07 14:59:34.725296+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
a9a9f62f-c992-4fcf-b988-8c4933c2d091	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	23d3b6de-13af-58eb-b203-48f932ad31c3	purchase_receipt	2.0000	150000.0000	purchase_line	a3630534-34bc-4d36-a901-48e0854b2182	2026-08-07	2026-08-07 14:59:34.725296+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
\.


--
-- Data for Name: kpi_targets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kpi_targets (id, organisation_id, branch_id, food_cost_target, labour_cost_target, net_margin_target, is_estimate, effective_from, effective_to, created_at, created_by) FROM stdin;
c6b86cbe-3157-595e-b49f-5e0ccdb55821	00000000-0000-0000-0000-000000000001	\N	30.00	25.00	15.00	t	2026-07-26	2026-08-06	2026-07-26 11:49:00.53192+00	\N
154ba8fd-e32c-4af0-b62a-d1d01c556ba4	00000000-0000-0000-0000-000000000001	\N	30.00	25.00	15.00	t	2026-08-07	\N	2026-08-07 10:12:17.616208+00	\N
\.


--
-- Data for Name: menu_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.menu_categories (id, organisation_id, name, sort_order, status, created_at, created_by, role) FROM stdin;
5c9a6461-6c33-5a77-ad93-c3646047ca62	00000000-0000-0000-0000-000000000001	Deals	2	active	2026-07-26 11:49:00.53192+00	\N	\N
26a98a54-a0e5-5a4c-aaa3-fe6d8b666e20	00000000-0000-0000-0000-000000000001	Core Doner	1	active	2026-07-26 11:49:00.53192+00	\N	core
2c0461f0-2980-5e34-9a85-f7d4890a304d	00000000-0000-0000-0000-000000000001	Sides	3	active	2026-07-26 11:49:00.53192+00	\N	side
cc1466a8-c309-5869-8173-1699574540ff	00000000-0000-0000-0000-000000000001	Sauces	5	active	2026-07-26 17:40:37.428944+00	\N	side
63ea276b-12bf-5316-b035-5041dbb64402	00000000-0000-0000-0000-000000000001	Drinks	4	active	2026-07-26 17:40:37.428944+00	\N	drink
1a2f2fd1-f69e-4912-8307-f62edcad4971	00000000-0000-0000-0000-000000000001	ZZ Test Category (delete me)	0	inactive	2026-08-07 10:44:20.89554+00	\N	\N
\.


--
-- Data for Name: organisations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organisations (id, name, status, created_at, updated_at) FROM stdin;
00000000-0000-0000-0000-000000000001	My Doner	active	2026-07-26 09:39:07.211029+00	2026-07-26 09:39:07.211029+00
\.


--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_methods (id, organisation_id, name, status, created_at, created_by) FROM stdin;
f7b678c4-9707-5e5b-882d-e36f856bcc45	00000000-0000-0000-0000-000000000001	Cash	active	2026-07-26 11:49:00.53192+00	\N
4c41cf75-8c89-54b6-98e5-4d3a833ed4d6	00000000-0000-0000-0000-000000000001	Card / EPOS	active	2026-07-26 11:49:00.53192+00	\N
5c02cea9-aaf2-5f60-8bb1-13a1d76e5540	00000000-0000-0000-0000-000000000001	Delivery platform	active	2026-07-26 11:49:00.53192+00	\N
8f15d37b-452d-517d-8131-7c3cb28834d9	00000000-0000-0000-0000-000000000001	Other	active	2026-07-26 11:49:00.53192+00	\N
\.


--
-- Data for Name: product_prices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_prices (id, organisation_id, branch_id, product_variant_id, price, currency, effective_from, effective_to, created_at, created_by) FROM stdin;
b085d4a5-c67c-58e3-9cd0-bd2d798ccd0a	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	5a07627a-6f29-5d7e-8725-fbc1af4881ff	40000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
ca183b34-c3a0-5103-a466-e46c2563c042	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	516b335c-037e-5a1d-bfa9-88ea31ac4903	49000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
3d10149d-0bc4-592c-a734-b496a3a7ec87	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	80fffe82-c45c-5cac-81fe-33bc417ce741	35000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
a3c987e4-6ca9-5ca0-a21b-c81f5b8a5fa4	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	a5e001fe-0e77-53b7-b422-adb82c7b2737	45000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
18f8c4f3-ec41-54a5-bfa7-3e41ddf9cadb	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	f922c426-c78c-5b89-bfe1-9c5e39dd1ef6	45000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
9e465ef6-63e9-5a8c-bd48-7cbaacdf6c9e	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	92de75ea-84c5-5b7e-949a-c084506b032f	55000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
9e10d538-a31d-52ed-aa17-29fcdc5bbd59	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	72c12c55-a72b-573f-a961-22a16760bc41	40000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
7c8b3907-b98d-5817-9a18-7ea5d65a5f8f	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	bfb9b742-4188-5f93-b7e7-b06ffd64b31b	45000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
03609380-4e63-529b-a86f-0c0c1cfc8f9d	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	7c2389e6-f3ad-54e8-b604-0f0bf2e4d6d8	50000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
8da02d38-9931-5bbe-9a66-73e2f971aeba	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	60e7aed0-43be-5734-a7e1-fb458b234c46	55000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
9fcd5037-933b-5f20-a453-2e15022f908a	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	923ed535-f74b-5d05-a8a3-1c314a1c7ef2	35000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
e8b3fdf6-08e9-5889-a7b2-cd5a77e76379	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	9880294f-dd27-50c1-9064-6744e94cdb58	40000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
eb49bd88-1edf-5567-b73e-85065f3a2234	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	6bae66b0-65d4-513a-aaf8-85c02fa75aef	40000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
bd090e7c-2f44-5621-a38c-47cab5e93235	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	91750655-321c-5178-97e5-d5bfc11a9887	49000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
59764a57-34a5-5de5-aa4c-2982304b7707	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	6fb6c521-dc7a-5cf6-8950-9a303871318c	35000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
61a2a3f8-8af3-5fa2-9490-4d114ca9a343	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	c36d1dfe-26d0-5c78-8e99-4b6f958fee78	189000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
eae4b09d-4d97-509a-a2d7-8d0685400b9c	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	9c295608-570c-5150-916c-21c026c175e0	18000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
c3ca3bf3-e975-539c-91f7-88caa5a8904e	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	45c5f5d7-f184-5605-8ffe-62e5c0a53185	15000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
816722af-2d71-5abe-af45-80c33a8392d9	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	862ad672-3f28-5a2d-bbff-c8c34320a638	19000.00	UZS	2026-07-26	\N	2026-07-26 11:49:00.53192+00	\N
1ea16ef5-c1ad-535a-b90b-db9867959996	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	7bdce91e-f45b-564b-afad-bae0680df4e9	12000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
e1ca3a81-27e9-5ad7-8850-9bbdbacf8840	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	8ddd9963-e44e-53ef-b770-070062074efc	12000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
57ef104f-cbad-5c31-ba13-2ece4c468bbf	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	9639fb2f-9725-504f-87fc-67c505eff81e	12000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
2b8d7654-2b72-5489-950f-80285a3de5eb	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	7d4302c4-5430-5a04-854a-89031881983a	12000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
7426ff9d-6413-5901-8cd3-bd202f353065	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	237564cc-bd3d-5aaf-a295-39b33ab676a2	12000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
57ad0b06-054d-51e3-aa48-63336441fadd	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	9c810feb-f79b-5755-946a-e03e6d354b7b	6100.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
d2a93a4b-5c7e-5fe7-81d2-374cad3c084a	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	9ec6cdfa-9d46-5d04-bbbf-215f1ba882a7	12000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
b7c05b56-a176-540c-8f1f-819fdea220b0	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	e41e80bc-85e3-5c64-80d0-f01b8c7377b5	8000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
270e5ab5-d835-5803-a1ad-de4ec7e9bf5b	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	21d0ff6b-8869-5e31-ab48-2aa0ea1f083c	5000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
013b61a4-7c05-55d8-9e75-ba2f69b340bd	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	809f6c37-b9cf-5195-8725-8139512aca83	30000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
5cfea3eb-a905-538a-b3d6-18df3486d650	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	ebc3070c-8408-557b-95f5-6d8dfdf30173	20000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
80bd57df-fd99-5d39-ab64-114fc1c4596c	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	2d15c473-25d8-5906-957f-22294fe8e0d2	15000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
7a91a32b-67ce-5782-8e0a-58231d8cbb43	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	2a6c7bb7-1452-5367-bc45-75b654296d85	12000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
cf797b03-171a-53eb-ae1a-85cdc48504ba	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	a417f368-c2d4-52ea-9fb4-d3947c683d37	10000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
eeeaf1f6-9fd7-5d63-8362-ff2433b029fa	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	bda3605c-2740-5ba7-8bb8-a02171891870	10000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
164f08c7-6c7d-551d-8099-0ae560d445b0	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	22cd5b54-d856-598b-b855-d912407994db	12000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
0083d483-6bac-5746-aeea-1b3df625c98b	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	93277325-6732-5409-87a7-5b6234a3fb4c	10000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
79f6e127-4c5b-509f-8671-49905a4cfe90	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	39d5cbcf-9346-5f98-bebc-a71631241bd5	6000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
fa685f0d-db17-5d75-af82-6cd5906014ca	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	232d2546-83a3-5394-9ba8-a0d687465513	6000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
19132446-365b-5ba9-aa56-7fb7f184e424	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	fb7dd3f5-dfbf-5935-8ecf-b0fae153f9de	6000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
2dcb0ef9-e200-56c4-84fa-9618670f731d	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	0ffff08e-78be-5171-97c9-09fd9efee8ba	1000.00	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
3db04603-b3b3-59c1-b8b2-a9ce565af502	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	576ca9e9-1b96-5603-a269-26b41b5e8c22	49322.22	UZS	2026-07-26	\N	2026-07-26 17:40:37.428944+00	\N
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_variants (id, product_id, name, sku, availability, status, created_at, created_by, updated_at, updated_by) FROM stdin;
5a07627a-6f29-5d7e-8725-fbc1af4881ff	1859bd16-340f-53b1-9b67-d363665be63d	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
516b335c-037e-5a1d-bfa9-88ea31ac4903	1859bd16-340f-53b1-9b67-d363665be63d	Combo	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
80fffe82-c45c-5cac-81fe-33bc417ce741	ce090423-9939-5bab-a5a0-cb955d5dc548	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
a5e001fe-0e77-53b7-b422-adb82c7b2737	ce090423-9939-5bab-a5a0-cb955d5dc548	Combo	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
f922c426-c78c-5b89-bfe1-9c5e39dd1ef6	dbd59906-e7c9-54d9-8e03-527e756db808	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
92de75ea-84c5-5b7e-949a-c084506b032f	dbd59906-e7c9-54d9-8e03-527e756db808	Combo	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
72c12c55-a72b-573f-a961-22a16760bc41	f01bd25a-742b-54c8-ba00-539220fd3ca8	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
bfb9b742-4188-5f93-b7e7-b06ffd64b31b	f01bd25a-742b-54c8-ba00-539220fd3ca8	Combo	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
7c2389e6-f3ad-54e8-b604-0f0bf2e4d6d8	5664ab54-38aa-5559-bae1-b4ca420796a6	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
60e7aed0-43be-5734-a7e1-fb458b234c46	5664ab54-38aa-5559-bae1-b4ca420796a6	Combo	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
923ed535-f74b-5d05-a8a3-1c314a1c7ef2	4671eff8-49a9-5155-9b47-5ee6b044de8f	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
9880294f-dd27-50c1-9064-6744e94cdb58	4671eff8-49a9-5155-9b47-5ee6b044de8f	Combo	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
6bae66b0-65d4-513a-aaf8-85c02fa75aef	35d81971-76bf-5013-aaf0-7effbd2cfb59	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
91750655-321c-5178-97e5-d5bfc11a9887	35d81971-76bf-5013-aaf0-7effbd2cfb59	Combo	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
6fb6c521-dc7a-5cf6-8950-9a303871318c	e97f5aba-5514-5b75-8e7b-0b9fb3d03fb4	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
c36d1dfe-26d0-5c78-8e99-4b6f958fee78	4c9350f8-5bdd-5c98-b607-29c07a950769	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
9c295608-570c-5150-916c-21c026c175e0	a13c1561-d929-5c6d-8d5c-3026d7db4e7d	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
45c5f5d7-f184-5605-8ffe-62e5c0a53185	1f06d21e-a5c9-5530-b73e-7cf1da8334ba	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
862ad672-3f28-5a2d-bbff-c8c34320a638	d0914d5e-8a63-5404-837a-3f4d44817411	Standard	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
7bdce91e-f45b-564b-afad-bae0680df4e9	e5d63075-e376-52c6-9e14-b6769d1749e5	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
8ddd9963-e44e-53ef-b770-070062074efc	dda56fc3-8426-5d2e-9474-96def10c9be8	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
9639fb2f-9725-504f-87fc-67c505eff81e	9e99b867-bf66-5cb9-bc2f-68e101826f22	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
7d4302c4-5430-5a04-854a-89031881983a	90aa210b-6bdc-5280-8c2a-c7e5a8efb1fb	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
237564cc-bd3d-5aaf-a295-39b33ab676a2	3cbdbeb8-3e1a-5da3-a872-c9f4cd308a6d	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
9c810feb-f79b-5755-946a-e03e6d354b7b	5f198c7d-f6f5-5dc0-9dfa-ef5fe97d81f9	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
9ec6cdfa-9d46-5d04-bbbf-215f1ba882a7	d3b2f0c8-3319-50ee-a928-0955f2e2c3b3	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
e41e80bc-85e3-5c64-80d0-f01b8c7377b5	af83bd28-69a5-5957-a476-7a4aae9a52bb	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
21d0ff6b-8869-5e31-ab48-2aa0ea1f083c	0a73f481-8547-5194-8b0c-62f077f289de	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
809f6c37-b9cf-5195-8725-8139512aca83	6b871369-ebd7-5697-9cf6-5302ae4679e9	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
ebc3070c-8408-557b-95f5-6d8dfdf30173	2e586891-f3e7-5f2d-ae64-4c7585b67596	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
2d15c473-25d8-5906-957f-22294fe8e0d2	a317d4b4-a01a-5982-8837-3eef0962204c	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
2a6c7bb7-1452-5367-bc45-75b654296d85	020e3f12-c233-5e01-a1d7-0dd0d2f2b0a7	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
a417f368-c2d4-52ea-9fb4-d3947c683d37	b1d6de8e-7f9d-5a2f-a3ba-07255a46d99b	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
bda3605c-2740-5ba7-8bb8-a02171891870	d601b88b-98fb-5e73-969c-b3e60d63a658	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
22cd5b54-d856-598b-b855-d912407994db	ffdb8b18-79e8-521e-a475-366cd2afbc71	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
93277325-6732-5409-87a7-5b6234a3fb4c	c8097c7f-1431-539a-9398-b7e600b3eac4	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
aea55635-7b04-54a1-a83c-d4c31b565523	72a7f750-349d-56ac-8564-e5d808f91cba	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
39d5cbcf-9346-5f98-bebc-a71631241bd5	5d999c9a-6b80-5c16-af16-e51ecd064900	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
232d2546-83a3-5394-9ba8-a0d687465513	a2d7833f-bf53-58a2-9e81-173a05aa7c0e	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
fb7dd3f5-dfbf-5935-8ecf-b0fae153f9de	497b3f7a-22da-50f8-b0af-baf5db01e14c	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
0ffff08e-78be-5171-97c9-09fd9efee8ba	5f2e3c59-42ee-557f-9b23-707567829467	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
576ca9e9-1b96-5603-a269-26b41b5e8c22	378ab88b-6d88-58fe-ba38-253652bd9497	Standard	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
2b1ae522-bdb5-43c2-9381-3167b7037792	03fc069d-7919-4e55-9b9c-3f4c79c21288	Standard	\N	\N	active	2026-08-06 14:27:03.920927+00	\N	2026-08-06 14:27:03.920927+00	\N
5077e67c-dc9e-4fb8-98aa-f614cb28bf7f	e7c7b034-1ec6-45c3-8ae5-72881b55b3ff	Standard	\N	\N	inactive	2026-08-07 10:45:22.916626+00	\N	2026-08-07 10:45:22.916626+00	\N
9dfdde1b-cb98-4e58-8a8a-b06d67de1d7a	ed5b258e-83f2-44df-9c44-a22280cb75bd	Standard	\N	\N	active	2026-08-07 10:57:36.274383+00	\N	2026-08-07 10:57:36.274383+00	\N
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, organisation_id, menu_category_id, name, sku, tax_category_id, reporting_category, image_url, status, created_at, created_by, updated_at, updated_by) FROM stdin;
1859bd16-340f-53b1-9b67-d363665be63d	00000000-0000-0000-0000-000000000001	26a98a54-a0e5-5a4c-aaa3-fe6d8b666e20	Durum Doner	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
ce090423-9939-5bab-a5a0-cb955d5dc548	00000000-0000-0000-0000-000000000001	26a98a54-a0e5-5a4c-aaa3-fe6d8b666e20	Tombik Tovuq Doner	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
dbd59906-e7c9-54d9-8e03-527e756db808	00000000-0000-0000-0000-000000000001	26a98a54-a0e5-5a4c-aaa3-fe6d8b666e20	Doner Burger	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
f01bd25a-742b-54c8-ba00-539220fd3ca8	00000000-0000-0000-0000-000000000001	26a98a54-a0e5-5a4c-aaa3-fe6d8b666e20	Doner Boks Pilav Ustu	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
5664ab54-38aa-5559-bae1-b4ca420796a6	00000000-0000-0000-0000-000000000001	26a98a54-a0e5-5a4c-aaa3-fe6d8b666e20	Doner Boks Special	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
4671eff8-49a9-5155-9b47-5ee6b044de8f	00000000-0000-0000-0000-000000000001	26a98a54-a0e5-5a4c-aaa3-fe6d8b666e20	Doner Fit Boks	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
35d81971-76bf-5013-aaf0-7effbd2cfb59	00000000-0000-0000-0000-000000000001	26a98a54-a0e5-5a4c-aaa3-fe6d8b666e20	Doner Iskender Boks	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
e97f5aba-5514-5b75-8e7b-0b9fb3d03fb4	00000000-0000-0000-0000-000000000001	5c9a6461-6c33-5a77-ad93-c3646047ca62	Talaba Deal	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
4c9350f8-5bdd-5c98-b607-29c07a950769	00000000-0000-0000-0000-000000000001	5c9a6461-6c33-5a77-ad93-c3646047ca62	Oilaviy Boks	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
a13c1561-d929-5c6d-8d5c-3026d7db4e7d	00000000-0000-0000-0000-000000000001	2c0461f0-2980-5e34-9a85-f7d4890a304d	Soup	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
1f06d21e-a5c9-5530-b73e-7cf1da8334ba	00000000-0000-0000-0000-000000000001	2c0461f0-2980-5e34-9a85-f7d4890a304d	Fries	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
d0914d5e-8a63-5404-837a-3f4d44817411	00000000-0000-0000-0000-000000000001	2c0461f0-2980-5e34-9a85-f7d4890a304d	Seasonal Salad	\N	\N	\N	\N	active	2026-07-26 11:49:00.53192+00	\N	2026-07-26 11:49:00.53192+00	\N
e5d63075-e376-52c6-9e14-b6769d1749e5	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Coca Cola 0.5	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
dda56fc3-8426-5d2e-9474-96def10c9be8	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Pepsi	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
9e99b867-bf66-5cb9-bc2f-68e101826f22	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Fanta	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
90aa210b-6bdc-5280-8c2a-c7e5a8efb1fb	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Sprite	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
3cbdbeb8-3e1a-5da3-a872-c9f4cd308a6d	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Ayran 0.25	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
5f198c7d-f6f5-5dc0-9dfa-ef5fe97d81f9	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Suv 0.5L	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
d3b2f0c8-3319-50ee-a928-0955f2e2c3b3	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Fuse Tea 0.5L	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
af83bd28-69a5-5957-a476-7a4aae9a52bb	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Suv Gaz 0.5L	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
0a73f481-8547-5194-8b0c-62f077f289de	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Bardak Chay	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
6b871369-ebd7-5697-9cf6-5302ae4679e9	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Caydanlik	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
2e586891-f3e7-5f2d-ae64-4c7585b67596	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Flash 0.45	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
a317d4b4-a01a-5982-8837-3eef0962204c	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Eker Ayran 293ml	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
020e3f12-c233-5e01-a1d7-0dd0d2f2b0a7	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Ays Tea 0.5	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
b1d6de8e-7f9d-5a2f-a3ba-07255a46d99b	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Ayran Stakan	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
d601b88b-98fb-5e73-969c-b3e60d63a658	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Limonat Stakan	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
ffdb8b18-79e8-521e-a475-366cd2afbc71	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Lipton 0.5	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
c8097c7f-1431-539a-9398-b7e600b3eac4	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Limonat Mydoner 0.25	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
72a7f750-349d-56ac-8564-e5d808f91cba	00000000-0000-0000-0000-000000000001	63ea276b-12bf-5316-b035-5041dbb64402	Tarmita Shatoot 320ml	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
5d999c9a-6b80-5c16-af16-e51ecd064900	00000000-0000-0000-0000-000000000001	cc1466a8-c309-5869-8173-1699574540ff	Garlic Sauce (Extra)	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
a2d7833f-bf53-58a2-9e81-173a05aa7c0e	00000000-0000-0000-0000-000000000001	cc1466a8-c309-5869-8173-1699574540ff	Chilli Sauce (Extra)	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
497b3f7a-22da-50f8-b0af-baf5db01e14c	00000000-0000-0000-0000-000000000001	cc1466a8-c309-5869-8173-1699574540ff	Tomato Sauce (Extra)	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
5f2e3c59-42ee-557f-9b23-707567829467	00000000-0000-0000-0000-000000000001	cc1466a8-c309-5869-8173-1699574540ff	Zvachka (Extra)	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
378ab88b-6d88-58fe-ba38-253652bd9497	00000000-0000-0000-0000-000000000001	5c9a6461-6c33-5a77-ad93-c3646047ca62	Ochilish Aksiyasi 1+1 Durum	\N	\N	\N	\N	active	2026-07-26 17:40:37.428944+00	\N	2026-07-26 17:40:37.428944+00	\N
03fc069d-7919-4e55-9b9c-3f4c79c21288	00000000-0000-0000-0000-000000000001	5c9a6461-6c33-5a77-ad93-c3646047ca62	Family Feast	\N	\N	\N	\N	active	2026-08-06 14:27:03.799923+00	\N	2026-08-06 14:27:03.799923+00	\N
e7c7b034-1ec6-45c3-8ae5-72881b55b3ff	00000000-0000-0000-0000-000000000001	1a2f2fd1-f69e-4912-8307-f62edcad4971	ZZ Test Product	\N	\N	\N	\N	inactive	2026-08-07 10:44:46.774443+00	\N	2026-08-07 10:44:46.774443+00	\N
ed5b258e-83f2-44df-9c44-a22280cb75bd	00000000-0000-0000-0000-000000000001	5c9a6461-6c33-5a77-ad93-c3646047ca62	Kids Meal	\N	\N	\N	\N	active	2026-08-07 10:57:36.136645+00	\N	2026-08-07 10:57:36.136645+00	\N
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, organisation_id, full_name, preferred_language, status, created_at, updated_at) FROM stdin;
efe41f66-ad6b-481b-a7ed-b7b9a17481f3	00000000-0000-0000-0000-000000000001	Owner	en	active	2026-07-26 09:52:16.22525+00	2026-07-26 09:52:16.22525+00
db4f6e61-c2f4-4350-a6d2-8e6cbb9843ea	00000000-0000-0000-0000-000000000001	Seoul Admin	en	active	2026-07-26 17:44:52.305314+00	2026-07-26 17:44:52.305314+00
0d4cae11-1083-4757-80f3-efd1e2eba2e3	00000000-0000-0000-0000-000000000001	Farid	en	active	2026-08-05 14:05:01.904227+00	2026-08-05 14:05:01.904227+00
\.


--
-- Data for Name: purchase_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_attachments (id, purchase_header_id, kind, storage_path, captured_at, uploaded_by) FROM stdin;
2a95be7e-d0f6-4dc3-9b2d-03f187a1a676	a14a816e-fdeb-40b9-875b-231efc5587e1	receipt	00000000-0000-0000-0000-000000000001/a14a816e-fdeb-40b9-875b-231efc5587e1/6a797c1c-edc1-4766-bb5b-9479550f1d1f-kickoffstay logo.png	2026-08-07 14:53:05.428899+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
01272030-2ea8-4765-8989-f55c74d380e2	a14a816e-fdeb-40b9-875b-231efc5587e1	goods_photo	00000000-0000-0000-0000-000000000001/a14a816e-fdeb-40b9-875b-231efc5587e1/6548c464-73a1-4960-8561-aab72a9280d5-Turkish Cafe .jpg	2026-08-07 14:53:32.291318+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
3a3f0b4c-8b41-4f52-aebf-b076b9296239	ad748e88-542e-41ca-8f79-4abceff3465e	receipt	00000000-0000-0000-0000-000000000001/ad748e88-542e-41ca-8f79-4abceff3465e/04a95c5e-bbaa-4445-b06a-800e529af92d-kickoffstay logo.png	2026-08-07 14:59:15.985678+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
48feadae-855d-4919-807f-8a6bb3fb936a	ad748e88-542e-41ca-8f79-4abceff3465e	goods_photo	00000000-0000-0000-0000-000000000001/ad748e88-542e-41ca-8f79-4abceff3465e/abe73c73-8938-41df-9f1d-c2d4ef5fc5fc-test.jpg	2026-08-07 14:59:31.470076+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
\.


--
-- Data for Name: purchase_headers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_headers (id, organisation_id, branch_id, supplier_id, invoice_number, invoice_date, receiving_date, currency, exchange_rate, payment_status, due_date, status, notes, created_at, created_by, posted_at, posted_by, voided_at, voided_by, void_reason) FROM stdin;
43c233b2-eb4e-4bee-a5f5-f29de97c318c	00000000-0000-0000-0000-000000000001	a93de0a6-8f06-459c-9256-55cf6ac74cb2	877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd	\N	2026-08-07	2026-08-07	UZS	\N	unpaid	\N	voided	No receipt given, cash purchase at the market	2026-08-07 12:38:21.580397+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 13:34:23.817164+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 14:19:21.719087+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	test purchase
a14a816e-fdeb-40b9-875b-231efc5587e1	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	5a87aeef-e466-41be-97d6-a12c7121c8c7	3	2026-08-07	2026-08-07	UZS	\N	unpaid	\N	posted	\N	2026-08-07 14:50:50.834581+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 14:53:39.308684+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	\N	\N	\N
9ac13900-7693-4687-9cd5-4e6bb05d3185	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	5a87aeef-e466-41be-97d6-a12c7121c8c7	\N	2026-07-26	2026-07-26	UZS	\N	unpaid	\N	voided	\N	2026-07-26 13:41:04.981673+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-07-26 13:43:05.058785+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 14:54:39.432484+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	duplicate
ad748e88-542e-41ca-8f79-4abceff3465e	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd	1	2026-08-07	2026-08-07	UZS	\N	unpaid	\N	posted	\N	2026-08-07 14:56:49.441355+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 14:59:34.725296+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	\N	\N	\N
0106d193-fba0-43d2-af56-555e0fb52364	00000000-0000-0000-0000-000000000001	a93de0a6-8f06-459c-9256-55cf6ac74cb2	5a87aeef-e466-41be-97d6-a12c7121c8c7	\N	2026-08-08	2026-08-08	UZS	\N	unpaid	\N	draft	\N	2026-08-08 09:40:24.392782+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	\N	\N	\N	\N	\N
\.


--
-- Data for Name: purchase_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_lines (id, purchase_header_id, inventory_item_id, quantity, unit_cost, tax_amount, created_at) FROM stdin;
5df12e12-d700-471e-be11-87f001a9c815	9ac13900-7693-4687-9cd5-4e6bb05d3185	35ff904d-548a-5492-b65f-cd76a8b7cca6	2.0000	45000.0000	0.0000	2026-07-26 13:42:35.400679+00
d1a912c5-aa3d-4dfb-8280-cebc8c2666eb	43c233b2-eb4e-4bee-a5f5-f29de97c318c	5c22b126-4848-51cb-8283-8abb75147d5e	10.0000	10.0000	0.0000	2026-08-07 13:33:58.762651+00
57f308aa-6b76-40a8-8bba-2830723f928f	a14a816e-fdeb-40b9-875b-231efc5587e1	07d4d5a5-a179-5945-8547-524986bb5f8a	2.0000	20.0000	0.0000	2026-08-07 14:51:40.201311+00
41fbd9e0-cb89-4f94-aa25-d87157d1d983	a14a816e-fdeb-40b9-875b-231efc5587e1	23d3b6de-13af-58eb-b203-48f932ad31c3	3.0000	10.0000	0.0000	2026-08-07 14:51:54.236709+00
37f5c246-72a9-4494-9063-1e88a486f049	a14a816e-fdeb-40b9-875b-231efc5587e1	0eba7449-0c0f-56ae-ad09-a1e00a46b678	50.0000	5.0000	0.0000	2026-08-07 14:52:45.172482+00
668b7aa0-1f37-4b0c-9c35-f0e9b83056b2	ad748e88-542e-41ca-8f79-4abceff3465e	0d7021a8-a20c-5014-adcb-a7b7bdd06285	3.0000	30000.0000	0.0000	2026-08-07 14:58:25.888687+00
a3630534-34bc-4d36-a901-48e0854b2182	ad748e88-542e-41ca-8f79-4abceff3465e	23d3b6de-13af-58eb-b203-48f932ad31c3	2.0000	150000.0000	0.0000	2026-08-07 14:58:52.096176+00
228aeb53-e420-4bb3-a6b4-1e75c736af5a	0106d193-fba0-43d2-af56-555e0fb52364	35ff904d-548a-5492-b65f-cd76a8b7cca6	20.0000	40000.0000	0.0000	2026-08-08 09:41:16.834883+00
79b80113-6edc-4ce1-a093-769e8f813cc6	0106d193-fba0-43d2-af56-555e0fb52364	f3515c64-1440-5836-b470-5167ea33cf53	5.0000	20000.0000	0.0000	2026-08-08 09:41:33.488463+00
\.


--
-- Data for Name: recipe_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipe_lines (id, recipe_version_id, inventory_item_id, quantity, created_at) FROM stdin;
\.


--
-- Data for Name: recipe_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipe_versions (id, organisation_id, product_variant_id, version_number, status, is_estimate, effective_from, effective_to, created_at, created_by, published_at, published_by, inventory_item_id, batch_yield_quantity) FROM stdin;
e9cabec5-f90b-4a3a-b553-400cc4ee4742	00000000-0000-0000-0000-000000000001	bfb9b742-4188-5f93-b7e7-b06ffd64b31b	1	draft	t	\N	\N	2026-07-26 12:56:56.561221+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	\N	\N	\N	\N
a82a631e-d203-47d6-ade8-22aa0f297fa4	00000000-0000-0000-0000-000000000001	237564cc-bd3d-5aaf-a295-39b33ab676a2	1	draft	t	\N	\N	2026-08-05 19:43:34.550752+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	\N	\N	\N	\N
88e7611c-20d4-492a-9358-dec0fa2e7ab5	00000000-0000-0000-0000-000000000001	\N	1	draft	t	\N	\N	2026-08-08 09:03:18.081842+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	\N	\N	3d4ecf4c-780c-5dd2-8a05-05a17528f329	5.0000
4271f36b-bfca-429a-8c65-58db288e9ed7	00000000-0000-0000-0000-000000000001	\N	1	draft	t	\N	\N	2026-08-10 09:49:47.749446+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	\N	\N	6eeb056d-9531-515b-8f5c-6178c7de18c6	30.0000
\.


--
-- Data for Name: recurring_expense_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recurring_expense_templates (id, organisation_id, branch_id, expense_category_id, name, amount, currency, allocation_method, effective_from, effective_to, created_at, created_by) FROM stdin;
eb483ec1-9ad4-546c-8df0-8eb2d084a331	00000000-0000-0000-0000-000000000001	\N	1b6b19d7-ce2d-5a0b-91dd-1fe3f557e4d4	Staff	1500.00	USD	calendar_day	2026-07-26	\N	2026-07-26 14:26:20.541603+00	\N
5aa773c1-4fde-5940-bf61-0a673f93564f	00000000-0000-0000-0000-000000000001	\N	ccd5b92e-1b7d-58a2-96bd-cbdf480c0aa8	Rent	950.00	USD	calendar_day	2026-07-26	\N	2026-07-26 14:26:20.541603+00	\N
54e606b9-7b38-5f45-bb30-fab92a43c691	00000000-0000-0000-0000-000000000001	\N	ed0347cc-8121-5143-a01a-b606991f2e4b	Electricity	300.00	USD	calendar_day	2026-07-26	\N	2026-07-26 14:26:20.541603+00	\N
fece438f-2a20-5845-a558-0672a2560a57	00000000-0000-0000-0000-000000000001	\N	957d9953-f231-5c3e-8304-7bfc784aaf6b	Rent / property tax	300.00	USD	calendar_day	2026-07-26	\N	2026-07-26 14:26:20.541603+00	\N
2b1efa2b-0594-56ef-88b9-182098429a54	00000000-0000-0000-0000-000000000001	\N	e9d0c830-54ed-5c12-b068-da605e250493	Water	100.00	USD	calendar_day	2026-07-26	\N	2026-07-26 14:26:20.541603+00	\N
9abb5af8-1ccf-5be1-9829-344e9de8e1e2	00000000-0000-0000-0000-000000000001	\N	9ce51cbe-3bfd-5f94-b1aa-114b8bb4ae5d	Seoul management charge	45.00	USD	calendar_day	2026-07-26	\N	2026-07-26 14:26:20.541603+00	\N
20a6b2fb-938e-5799-8614-aa4f62a2b27f	00000000-0000-0000-0000-000000000001	\N	28b6e168-6b33-5209-9809-20a69b194615	EPOS and internet	25.00	USD	calendar_day	2026-07-26	\N	2026-07-26 14:26:20.541603+00	\N
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, key, name, description, created_at) FROM stdin;
b73ad5d5-1487-4871-acb3-c7ffd19510c1	owner	Owner / Super Admin	All branches, all modules, security and financial governance	2026-07-26 09:36:34.431836+00
eb505187-7878-42cb-8a24-1c4b92cca502	branch_admin	Branch Admin / Manager	Full operational access to assigned branch(es)	2026-07-26 09:36:34.431836+00
7df03aea-e67c-43bf-943f-5fcd8006b0c3	finance	Finance / Accountant	Read all financials for authorised branches, manage expense mappings	2026-07-26 09:36:34.431836+00
21ba1f1c-e22b-4aab-ae26-59ed192ce8c7	inventory_manager	Inventory / Kitchen Manager	Ingredients, recipes, stock, waste, receiving	2026-07-26 09:36:34.431836+00
9e9574af-586e-492f-8fef-76ec05edc3a4	cashier	Cashier / Data Entry	Enter sales summaries and cash/card totals for open dates	2026-07-26 09:36:34.431836+00
aeb2f6d4-80f0-464e-b198-2fc8998d65e1	viewer	Viewer	Read-only access to approved dashboards/reports	2026-07-26 09:36:34.431836+00
\.


--
-- Data for Name: shift_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shift_entries (id, organisation_id, branch_id, employee_id, work_date, hours_worked, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: stock_count_headers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_count_headers (id, organisation_id, branch_id, count_date, status, notes, created_at, created_by, posted_at, posted_by) FROM stdin;
f828b07b-ea89-4ae1-92bc-44c035badc08	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	2026-07-26	draft	\N	2026-07-26 17:51:20.194105+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	\N	\N
\.


--
-- Data for Name: stock_count_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_count_lines (id, stock_count_header_id, inventory_item_id, counted_quantity, expected_quantity, reason, created_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, organisation_id, name, contact_name, phone, email, payment_terms, status, notes, created_at, created_by, updated_at, updated_by, type) FROM stdin;
5a87aeef-e466-41be-97d6-a12c7121c8c7	00000000-0000-0000-0000-000000000001	Tavukcu	Ahmad	\N	\N	Cash	active	\N	2026-07-26 13:40:16.650543+00	\N	2026-07-26 13:40:16.650543+00	\N	\N
877bfe1a-5546-4ec3-a8a8-3f85e3ee77dd	00000000-0000-0000-0000-000000000001	Green Valley Market	\N	\N	\N	\N	inactive	\N	2026-08-07 12:37:36.53995+00	\N	2026-08-07 12:37:36.53995+00	\N	market
\.


--
-- Data for Name: tax_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tax_categories (id, organisation_id, name, rate, is_inclusive, status, created_at, created_by, updated_at, updated_by) FROM stdin;
ef5ac790-aa86-4163-ad62-29c61361485c	00000000-0000-0000-0000-000000000001	TAX	20.000	t	active	2026-08-05 18:05:12.790933+00	\N	2026-08-05 18:05:12.790933+00	\N
\.


--
-- Data for Name: unit_conversions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.unit_conversions (id, from_unit_id, to_unit_id, factor) FROM stdin;
0f58fc6f-ffc6-434e-9d9a-3f13f1cf5ce2	1b8af3d3-e7f1-4c23-909f-b8ef51de3e97	ec077c04-e5a4-4cbf-beff-8c03685d1410	0.001000
b81d81ac-729e-46ef-a984-9568890b4067	ec077c04-e5a4-4cbf-beff-8c03685d1410	1b8af3d3-e7f1-4c23-909f-b8ef51de3e97	1000.000000
f3f01331-bd24-4e62-9c70-d3072696fe45	e09f136e-9d0d-4912-83f3-2ecb0d1a5101	2c29eb43-be1b-490e-8bb7-382e493be39a	0.001000
ae8eab85-8b2b-4c82-9416-d2c3b34fb2e8	2c29eb43-be1b-490e-8bb7-382e493be39a	e09f136e-9d0d-4912-83f3-2ecb0d1a5101	1000.000000
\.


--
-- Data for Name: units_of_measure; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.units_of_measure (id, code, name, category) FROM stdin;
1b8af3d3-e7f1-4c23-909f-b8ef51de3e97	g	Gram	mass
ec077c04-e5a4-4cbf-beff-8c03685d1410	kg	Kilogram	mass
e09f136e-9d0d-4912-83f3-2ecb0d1a5101	ml	Millilitre	volume
2c29eb43-be1b-490e-8bb7-382e493be39a	l	Litre	volume
c319e1cf-65c1-4870-910a-78caa45a3281	each	Each	count
98924926-de56-49c1-9470-95b0d61fe75c	portion	Portion	count
\.


--
-- Data for Name: user_branch_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_branch_roles (id, organisation_id, branch_id, profile_id, role_id, created_at, created_by) FROM stdin;
a6875133-2898-4b2a-a388-f5e63669cd19	00000000-0000-0000-0000-000000000001	\N	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	b73ad5d5-1487-4871-acb3-c7ffd19510c1	2026-07-26 09:52:55.02594+00	\N
e641565d-461c-4a54-8f74-373f01cba3b9	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	db4f6e61-c2f4-4350-a6d2-8e6cbb9843ea	eb505187-7878-42cb-8a24-1c4b92cca502	2026-07-26 17:44:53.009751+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
20da0fe3-a1a6-4e4a-80e3-b0b98c8d7b71	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	0d4cae11-1083-4757-80f3-efd1e2eba2e3	eb505187-7878-42cb-8a24-1c4b92cca502	2026-08-05 14:05:02.929233+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
d29e1687-30ce-431e-bcb1-08bc2648d2ae	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	0d4cae11-1083-4757-80f3-efd1e2eba2e3	21ba1f1c-e22b-4aab-ae26-59ed192ce8c7	2026-08-05 19:00:45.908922+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
0b0c993e-1cae-4073-90c3-36c7b6ea052f	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000002	0d4cae11-1083-4757-80f3-efd1e2eba2e3	7df03aea-e67c-43bf-943f-5fcd8006b0c3	2026-08-05 19:01:10.223399+00	efe41f66-ad6b-481b-a7ed-b7b9a17481f3
\.


--
-- Data for Name: waste_reasons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.waste_reasons (id, organisation_id, name, status, created_at, created_by) FROM stdin;
bf2b890c-5227-5733-b1c3-ff794524c66c	00000000-0000-0000-0000-000000000001	Spoilage	active	2026-07-26 11:49:00.53192+00	\N
58072343-89d8-56ff-ab94-65f02158a75c	00000000-0000-0000-0000-000000000001	Overproduction	active	2026-07-26 11:49:00.53192+00	\N
4d68a134-a39b-5dbe-8d35-8131882c85ed	00000000-0000-0000-0000-000000000001	Preparation loss	active	2026-07-26 11:49:00.53192+00	\N
f6b933b0-b408-5a45-bdb9-83012437efcf	00000000-0000-0000-0000-000000000001	Damaged packaging	active	2026-07-26 11:49:00.53192+00	\N
cb63ace2-3c32-51a1-b7db-ebaac975f556	00000000-0000-0000-0000-000000000001	Staff meal	active	2026-07-26 11:49:00.53192+00	\N
7e35acd6-6198-5c72-9f71-b8475b0eda58	00000000-0000-0000-0000-000000000001	Returned order	active	2026-07-26 11:49:00.53192+00	\N
e4cc6c37-1433-585d-8916-c25642abbe26	00000000-0000-0000-0000-000000000001	Other	active	2026-07-26 11:49:00.53192+00	\N
\.


--
-- Data for Name: waste_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.waste_records (id, organisation_id, branch_id, inventory_item_id, quantity_base, waste_reason_id, business_date, notes, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2026-07-26 09:36:22
20211116045059	2026-07-26 09:36:22
20211116050929	2026-07-26 09:36:22
20211116051442	2026-07-26 09:36:22
20211116212300	2026-07-26 09:36:22
20211116213355	2026-07-26 09:36:22
20211116213934	2026-07-26 09:36:22
20211116214523	2026-07-26 09:36:22
20211122062447	2026-07-26 09:36:22
20211124070109	2026-07-26 09:36:22
20211202204204	2026-07-26 09:36:22
20211202204605	2026-07-26 09:36:22
20211210212804	2026-07-26 09:36:22
20211228014915	2026-07-26 09:36:22
20220107221237	2026-07-26 09:36:22
20220228202821	2026-07-26 09:36:22
20220312004840	2026-07-26 09:36:22
20220603231003	2026-07-26 09:36:22
20220603232444	2026-07-26 09:36:22
20220615214548	2026-07-26 09:36:22
20220712093339	2026-07-26 09:36:22
20220908172859	2026-07-26 09:36:22
20220916233421	2026-07-26 09:36:22
20230119133233	2026-07-26 09:36:22
20230128025114	2026-07-26 09:36:22
20230128025212	2026-07-26 09:36:22
20230227211149	2026-07-26 09:36:22
20230228184745	2026-07-26 09:36:22
20230308225145	2026-07-26 09:36:22
20230328144023	2026-07-26 09:36:22
20231018144023	2026-07-26 09:36:22
20231204144023	2026-07-26 09:36:22
20231204144024	2026-07-26 09:36:22
20231204144025	2026-07-26 09:36:22
20240108234812	2026-07-26 09:36:22
20240109165339	2026-07-26 09:36:22
20240227174441	2026-07-26 09:36:22
20240311171622	2026-07-26 09:36:22
20240321100241	2026-07-26 09:36:22
20240401105812	2026-07-26 09:36:22
20240418121054	2026-07-26 09:36:22
20240523004032	2026-07-26 09:36:22
20240618124746	2026-07-26 09:36:22
20240801235015	2026-07-26 09:36:22
20240805133720	2026-07-26 09:36:22
20240827160934	2026-07-26 09:36:22
20240919163303	2026-07-26 09:36:22
20240919163305	2026-07-26 09:36:22
20241019105805	2026-07-26 09:36:22
20241030150047	2026-07-26 09:36:22
20241108114728	2026-07-26 09:36:22
20241121104152	2026-07-26 09:36:22
20241130184212	2026-07-26 09:36:22
20241220035512	2026-07-26 09:36:22
20241220123912	2026-07-26 09:36:22
20241224161212	2026-07-26 09:36:22
20250107150512	2026-07-26 09:36:22
20250110162412	2026-07-26 09:36:22
20250123174212	2026-07-26 09:36:22
20250128220012	2026-07-26 09:36:22
20250506224012	2026-07-26 09:36:22
20250523164012	2026-07-26 09:36:22
20250714121412	2026-07-26 09:36:22
20250905041441	2026-07-26 09:36:22
20251103001201	2026-07-26 09:36:22
20251120212548	2026-07-26 09:36:22
20251120215549	2026-07-26 09:36:22
20260218120000	2026-07-26 09:36:22
20260326120000	2026-07-26 09:36:22
20260514120000	2026-07-26 09:36:22
20260527120000	2026-07-26 09:36:22
20260528120000	2026-07-26 09:36:22
20260603120000	2026-07-26 09:36:22
20260605120000	2026-07-26 09:36:22
20260606110000	2026-07-26 09:36:22
20260616120000	2026-07-26 09:36:22
20260624120000	2026-07-26 09:36:22
20260626120000	2026-07-26 09:36:22
20260706120000	2026-07-26 09:36:22
20260707120000	2026-07-26 09:36:22
20260709120000	2026-07-26 09:36:22
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: supabase_realtime_admin
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at, action_filter, selected_columns) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type, versioning_status) FROM stdin;
purchase-attachments	purchase-attachments	\N	2026-08-07 12:33:09.23316+00	2026-08-07 12:33:09.23316+00	f	f	\N	\N	\N	STANDARD	DISABLED
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets_analytics (name, type, format, created_at, updated_at, id, deleted_at) FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets_vectors (id, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2026-07-26 09:36:32.568838
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2026-07-26 09:36:32.58178
2	storage-schema	f6a1fa2c93cbcd16d4e487b362e45fca157a8dbd	2026-07-26 09:36:32.58743
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2026-07-26 09:36:32.608468
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2026-07-26 09:36:32.624215
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2026-07-26 09:36:32.63109
6	change-column-name-in-get-size	ded78e2f1b5d7e616117897e6443a925965b30d2	2026-07-26 09:36:32.637921
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2026-07-26 09:36:32.645611
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2026-07-26 09:36:32.653287
9	fix-search-function	af597a1b590c70519b464a4ab3be54490712796b	2026-07-26 09:36:32.659476
10	search-files-search-function	b595f05e92f7e91211af1bbfe9c6a13bb3391e16	2026-07-26 09:36:32.665159
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2026-07-26 09:36:32.670834
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2026-07-26 09:36:32.678095
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2026-07-26 09:36:32.684284
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2026-07-26 09:36:32.691199
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2026-07-26 09:36:32.746547
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2026-07-26 09:36:32.752052
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2026-07-26 09:36:32.757479
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2026-07-26 09:36:32.761902
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2026-07-26 09:36:32.770458
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2026-07-26 09:36:32.776377
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2026-07-26 09:36:32.785268
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2026-07-26 09:36:32.814236
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2026-07-26 09:36:32.83548
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2026-07-26 09:36:32.841363
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2026-07-26 09:36:32.847263
26	objects-prefixes	215cabcb7f78121892a5a2037a09fedf9a1ae322	2026-07-26 09:36:32.851931
27	search-v2	859ba38092ac96eb3964d83bf53ccc0b141663a6	2026-07-26 09:36:32.857499
28	object-bucket-name-sorting	c73a2b5b5d4041e39705814fd3a1b95502d38ce4	2026-07-26 09:36:32.861624
29	create-prefixes	ad2c1207f76703d11a9f9007f821620017a66c21	2026-07-26 09:36:32.866265
30	update-object-levels	2be814ff05c8252fdfdc7cfb4b7f5c7e17f0bed6	2026-07-26 09:36:32.871316
31	objects-level-index	b40367c14c3440ec75f19bbce2d71e914ddd3da0	2026-07-26 09:36:32.875292
32	backward-compatible-index-on-objects	e0c37182b0f7aee3efd823298fb3c76f1042c0f7	2026-07-26 09:36:32.880173
33	backward-compatible-index-on-prefixes	b480e99ed951e0900f033ec4eb34b5bdcb4e3d49	2026-07-26 09:36:32.886528
34	optimize-search-function-v1	ca80a3dc7bfef894df17108785ce29a7fc8ee456	2026-07-26 09:36:32.89072
35	add-insert-trigger-prefixes	458fe0ffd07ec53f5e3ce9df51bfdf4861929ccc	2026-07-26 09:36:32.89536
36	optimise-existing-functions	6ae5fca6af5c55abe95369cd4f93985d1814ca8f	2026-07-26 09:36:32.89966
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2026-07-26 09:36:32.903749
38	iceberg-catalog-flag-on-buckets	02716b81ceec9705aed84aa1501657095b32e5c5	2026-07-26 09:36:32.909291
39	add-search-v2-sort-support	6706c5f2928846abee18461279799ad12b279b78	2026-07-26 09:36:32.920317
40	fix-prefix-race-conditions-optimized	7ad69982ae2d372b21f48fc4829ae9752c518f6b	2026-07-26 09:36:32.925729
41	add-object-level-update-trigger	07fcf1a22165849b7a029deed059ffcde08d1ae0	2026-07-26 09:36:32.929794
42	rollback-prefix-triggers	771479077764adc09e2ea2043eb627503c034cd4	2026-07-26 09:36:32.933649
43	fix-object-level	84b35d6caca9d937478ad8a797491f38b8c2979f	2026-07-26 09:36:32.93757
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2026-07-26 09:36:32.941529
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2026-07-26 09:36:32.946483
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2026-07-26 09:36:32.959589
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2026-07-26 09:36:32.964703
48	iceberg-catalog-ids	e0e8b460c609b9999ccd0df9ad14294613eed939	2026-07-26 09:36:32.969568
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2026-07-26 09:36:32.988606
50	search-v2-optimised	6323ac4f850aa14e7387eb32102869578b5bd478	2026-07-26 09:36:32.993564
51	index-backward-compatible-search	2ee395d433f76e38bcd3856debaf6e0e5b674011	2026-07-26 09:36:33.010778
52	drop-not-used-indexes-and-functions	5cc44c8696749ac11dd0dc37f2a3802075f3a171	2026-07-26 09:36:33.012883
53	drop-index-lower-name	d0cb18777d9e2a98ebe0bc5cc7a42e57ebe41854	2026-07-26 09:36:33.023597
54	drop-index-object-level	6289e048b1472da17c31a7eba1ded625a6457e67	2026-07-26 09:36:33.026571
55	prevent-direct-deletes	262a4798d5e0f2e7c8970232e03ce8be695d5819	2026-07-26 09:36:33.029481
56	fix-optimized-search-function	b823ed1e418101032fa01374edc9a436e54e3ed4	2026-07-26 09:36:33.037216
57	s3-multipart-uploads-metadata	f127886e00d1b374fadbc7c6b31e09336aad5287	2026-07-26 09:36:33.0444
58	operation-ergonomics	00ca5d483b3fe0d522133d9002ccc5df98365120	2026-07-26 09:36:33.049286
59	drop-unused-functions	38456f13e39691c2bbb4b5151d0d1cdbabd4a8c4	2026-07-26 09:36:33.055216
60	optimize-existing-functions-again	db35e1c91a9201e59f4fef8d972c2f277d68b157	2026-07-26 09:36:33.060312
61	mark-filename-immutable	fe0096517ae9d60aaec1d110172ba9036dc66bb7	2026-08-22 11:57:25.703342
62	object-versioning-core	0b855f00ff3be0bfca91efee02a9858912491a9a	2026-08-22 11:57:25.711278
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata, archived_at, is_delete_marker, is_versioned) FROM stdin;
accf13ac-d429-4abd-9282-b05ad3bf3b70	purchase-attachments	00000000-0000-0000-0000-000000000001/a14a816e-fdeb-40b9-875b-231efc5587e1/6a797c1c-edc1-4766-bb5b-9479550f1d1f-kickoffstay logo.png	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 14:53:04.382456+00	2026-08-07 14:53:04.382456+00	2026-08-07 14:53:04.382456+00	{"eTag": "\\"3b6effd7513d6c87af6adf9bdbd9fe4e\\"", "size": 5201, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-08-07T14:53:05.000Z", "contentLength": 5201, "httpStatusCode": 200}	46a42d21-5ca3-451f-8517-f1107a6890ca	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	{}	\N	f	f
6962183d-00cf-4eea-81ba-80f7381ddb97	purchase-attachments	00000000-0000-0000-0000-000000000001/a14a816e-fdeb-40b9-875b-231efc5587e1/6548c464-73a1-4960-8561-aab72a9280d5-Turkish Cafe .jpg	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 14:53:30.288144+00	2026-08-07 14:53:30.288144+00	2026-08-07 14:53:30.288144+00	{"eTag": "\\"bafd78b4a8a683ae1396dadfc6cd8897\\"", "size": 197590, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-08-07T14:53:31.000Z", "contentLength": 197590, "httpStatusCode": 200}	e0233607-7d41-429d-a1aa-6e02ecd6fce9	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	{}	\N	f	f
92855c62-7bb3-43a0-afb6-ea852e4edac0	purchase-attachments	00000000-0000-0000-0000-000000000001/ad748e88-542e-41ca-8f79-4abceff3465e/04a95c5e-bbaa-4445-b06a-800e529af92d-kickoffstay logo.png	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 14:59:15.07022+00	2026-08-07 14:59:15.07022+00	2026-08-07 14:59:15.07022+00	{"eTag": "\\"3b6effd7513d6c87af6adf9bdbd9fe4e\\"", "size": 5201, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-08-07T14:59:15.000Z", "contentLength": 5201, "httpStatusCode": 200}	e5520a8b-0bec-4dd4-b2a1-d50b828c396c	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	{}	\N	f	f
bba1d4ea-bced-4ecd-9f69-050d67441fd0	purchase-attachments	00000000-0000-0000-0000-000000000001/ad748e88-542e-41ca-8f79-4abceff3465e/abe73c73-8938-41df-9f1d-c2d4ef5fc5fc-test.jpg	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	2026-08-07 14:59:30.438627+00	2026-08-07 14:59:30.438627+00	2026-08-07 14:59:30.438627+00	{"eTag": "\\"40b34fbba5bf7ffd1ce870d9a3d81093\\"", "size": 17372, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-08-07T14:59:31.000Z", "contentLength": 17372, "httpStatusCode": 200}	2505a1ca-52ae-49ff-9f89-58bb43fa8b5a	efe41f66-ad6b-481b-a7ed-b7b9a17481f3	{}	\N	f	f
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata, metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.vector_indexes (id, name, bucket_id, data_type, dimension, distance_metric, metadata_configuration, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: postgres
--

COPY supabase_migrations.schema_migrations (version, statements, name) FROM stdin;
20260726000001	{"-- Phase 0 / Sprint 1: organisations, branches, profiles, roles, user_branch_roles.\n-- RLS is enabled on every table with no default-allow policy: access is denied\n-- unless a policy below explicitly grants it (default-deny per spec section 4/12).\n\ncreate extension if not exists \\"pgcrypto\\"","-- ---------------------------------------------------------------------------\n-- organisations\n-- ---------------------------------------------------------------------------\ncreate table public.organisations (\n  id uuid primary key default gen_random_uuid(),\n  name text not null,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n)","-- ---------------------------------------------------------------------------\n-- branches\n-- ---------------------------------------------------------------------------\ncreate table public.branches (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  name text not null,\n  address text,\n  timezone text not null default 'Asia/Tashkent',\n  opening_hours jsonb,\n  reporting_currency text not null default 'UZS',\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n  created_by uuid,\n  updated_by uuid\n)","create index branches_organisation_id_idx on public.branches (organisation_id)","-- ---------------------------------------------------------------------------\n-- profiles (one row per auth.users row, created by trigger on signup/invite)\n-- ---------------------------------------------------------------------------\ncreate table public.profiles (\n  id uuid primary key references auth.users (id) on delete cascade,\n  organisation_id uuid not null references public.organisations (id) on delete restrict,\n  full_name text not null,\n  preferred_language text not null default 'en',\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n)","create index profiles_organisation_id_idx on public.profiles (organisation_id)","-- ---------------------------------------------------------------------------\n-- roles (lookup table; keys are stable identifiers referenced from code)\n-- ---------------------------------------------------------------------------\ncreate table public.roles (\n  id uuid primary key default gen_random_uuid(),\n  key text not null unique,\n  name text not null,\n  description text,\n  created_at timestamptz not null default now()\n)","insert into public.roles (key, name, description) values\n  ('owner', 'Owner / Super Admin', 'All branches, all modules, security and financial governance'),\n  ('branch_admin', 'Branch Admin / Manager', 'Full operational access to assigned branch(es)'),\n  ('finance', 'Finance / Accountant', 'Read all financials for authorised branches, manage expense mappings'),\n  ('inventory_manager', 'Inventory / Kitchen Manager', 'Ingredients, recipes, stock, waste, receiving'),\n  ('cashier', 'Cashier / Data Entry', 'Enter sales summaries and cash/card totals for open dates'),\n  ('viewer', 'Viewer', 'Read-only access to approved dashboards/reports')","-- ---------------------------------------------------------------------------\n-- user_branch_roles\n-- branch_id = null means the grant applies to every branch in the organisation\n-- (used for the Owner role). Otherwise the grant is scoped to one branch.\n-- ---------------------------------------------------------------------------\ncreate table public.user_branch_roles (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid references public.branches (id) on delete cascade,\n  profile_id uuid not null references public.profiles (id) on delete cascade,\n  role_id uuid not null references public.roles (id) on delete restrict,\n  created_at timestamptz not null default now(),\n  created_by uuid\n)","create unique index user_branch_roles_unique_grant\n  on public.user_branch_roles (\n    profile_id,\n    organisation_id,\n    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),\n    role_id\n  )","create index user_branch_roles_profile_id_idx on public.user_branch_roles (profile_id)","create index user_branch_roles_branch_id_idx on public.user_branch_roles (branch_id)","-- ---------------------------------------------------------------------------\n-- Helper functions (security definer so policies below can consult them\n-- without recursing back into the RLS-protected tables they query).\n-- ---------------------------------------------------------------------------\ncreate or replace function public.current_organisation_id()\nreturns uuid\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $$\n  select organisation_id from public.profiles where id = auth.uid();\n$$","create or replace function public.current_user_has_role(p_role_keys text[], p_branch_id uuid default null)\nreturns boolean\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $$\n  select exists (\n    select 1\n    from public.user_branch_roles ubr\n    join public.roles r on r.id = ubr.role_id\n    where ubr.profile_id = auth.uid()\n      and r.key = any (p_role_keys)\n      and (\n        p_branch_id is null\n        or ubr.branch_id is null\n        or ubr.branch_id = p_branch_id\n      )\n  );\n$$","create or replace function public.current_user_accessible_branch_ids()\nreturns setof uuid\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $$\n  select b.id\n  from public.branches b\n  where b.organisation_id = public.current_organisation_id()\n    and (\n      exists (\n        select 1 from public.user_branch_roles ubr\n        where ubr.profile_id = auth.uid() and ubr.branch_id is null\n      )\n      or exists (\n        select 1 from public.user_branch_roles ubr\n        where ubr.profile_id = auth.uid() and ubr.branch_id = b.id\n      )\n    );\n$$","grant execute on function public.current_organisation_id() to authenticated","grant execute on function public.current_user_has_role(text[], uuid) to authenticated","grant execute on function public.current_user_accessible_branch_ids() to authenticated","-- ---------------------------------------------------------------------------\n-- Auto-create a profile when a user is invited/signs up. organisation_id,\n-- full_name and preferred_language come from auth metadata set at invite time.\n-- ---------------------------------------------------------------------------\ncreate or replace function public.handle_new_auth_user()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\nbegin\n  insert into public.profiles (id, organisation_id, full_name, preferred_language)\n  values (\n    new.id,\n    (new.raw_user_meta_data ->> 'organisation_id')::uuid,\n    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),\n    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en')\n  );\n  return new;\nend;\n$$","create trigger on_auth_user_created\n  after insert on auth.users\n  for each row execute function public.handle_new_auth_user()","-- ---------------------------------------------------------------------------\n-- Row Level Security\n-- ---------------------------------------------------------------------------\nalter table public.organisations enable row level security","alter table public.branches enable row level security","alter table public.profiles enable row level security","alter table public.roles enable row level security","alter table public.user_branch_roles enable row level security","-- organisations: members can read their own organisation; only Owner can update it.\ncreate policy organisations_select_own on public.organisations\n  for select to authenticated\n  using (id = public.current_organisation_id())","create policy organisations_update_owner on public.organisations\n  for update to authenticated\n  using (id = public.current_organisation_id() and public.current_user_has_role(array['owner']))\n  with check (id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","-- branches: readable if the branch is accessible to the current user;\n-- only Owner can create/update/delete branches.\ncreate policy branches_select_accessible on public.branches\n  for select to authenticated\n  using (id in (select public.current_user_accessible_branch_ids()))","create policy branches_insert_owner on public.branches\n  for insert to authenticated\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","create policy branches_update_owner on public.branches\n  for update to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","-- profiles: a user can always read/update their own profile;\n-- Owner can read every profile in their organisation.\ncreate policy profiles_select_self on public.profiles\n  for select to authenticated\n  using (id = auth.uid())","create policy profiles_select_owner on public.profiles\n  for select to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","create policy profiles_update_self on public.profiles\n  for update to authenticated\n  using (id = auth.uid())\n  with check (id = auth.uid())","create policy profiles_update_owner on public.profiles\n  for update to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","-- roles: readable lookup table for every authenticated user; no client writes.\ncreate policy roles_select_authenticated on public.roles\n  for select to authenticated\n  using (true)","-- user_branch_roles: a user can see their own grants; Owner can see/manage\n-- every grant in their organisation.\ncreate policy user_branch_roles_select_self on public.user_branch_roles\n  for select to authenticated\n  using (profile_id = auth.uid())","create policy user_branch_roles_select_owner on public.user_branch_roles\n  for select to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","create policy user_branch_roles_insert_owner on public.user_branch_roles\n  for insert to authenticated\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","create policy user_branch_roles_update_owner on public.user_branch_roles\n  for update to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","create policy user_branch_roles_delete_owner on public.user_branch_roles\n  for delete to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))"}	identity_and_tenancy
20260726120000	{"-- Sprint 2: Master Data (spec section 21) — Settings, currencies/exchange\n-- rates, units of measure, menu products/variants/prices, ingredients and\n-- suppliers. RLS follows the same default-deny pattern as Phase 0, reusing\n-- current_organisation_id() / current_user_has_role() / branch helpers.\n\ncreate extension if not exists \\"btree_gist\\"","-- ---------------------------------------------------------------------------\n-- Global reference data (not organisation-scoped: currency codes and\n-- physical units of measure are universal facts, not business data).\n-- ---------------------------------------------------------------------------\ncreate table public.currencies (\n  code text primary key,\n  name text not null,\n  symbol text not null,\n  minor_unit smallint not null default 2\n)","insert into public.currencies (code, name, symbol, minor_unit) values\n  ('USD', 'US Dollar', '$', 2),\n  ('UZS', 'Uzbekistani so''m', 'so''m', 0)","create table public.units_of_measure (\n  id uuid primary key default gen_random_uuid(),\n  code text not null unique,\n  name text not null,\n  category text not null check (category in ('mass', 'volume', 'count'))\n)","insert into public.units_of_measure (code, name, category) values\n  ('g', 'Gram', 'mass'),\n  ('kg', 'Kilogram', 'mass'),\n  ('ml', 'Millilitre', 'volume'),\n  ('l', 'Litre', 'volume'),\n  ('each', 'Each', 'count'),\n  ('portion', 'Portion', 'count')","create table public.unit_conversions (\n  id uuid primary key default gen_random_uuid(),\n  from_unit_id uuid not null references public.units_of_measure (id),\n  to_unit_id uuid not null references public.units_of_measure (id),\n  factor numeric(18, 6) not null check (factor > 0),\n  unique (from_unit_id, to_unit_id)\n)","insert into public.unit_conversions (from_unit_id, to_unit_id, factor)\nselect g.id, kg.id, 0.001 from public.units_of_measure g, public.units_of_measure kg\nwhere g.code = 'g' and kg.code = 'kg'\nunion all\nselect kg.id, g.id, 1000 from public.units_of_measure kg, public.units_of_measure g\nwhere kg.code = 'kg' and g.code = 'g'\nunion all\nselect ml.id, l.id, 0.001 from public.units_of_measure ml, public.units_of_measure l\nwhere ml.code = 'ml' and l.code = 'l'\nunion all\nselect l.id, ml.id, 1000 from public.units_of_measure l, public.units_of_measure ml\nwhere l.code = 'l' and ml.code = 'ml'","-- ---------------------------------------------------------------------------\n-- Settings (organisation-scoped)\n-- ---------------------------------------------------------------------------\ncreate table public.app_settings (\n  organisation_id uuid primary key references public.organisations (id) on delete cascade,\n  base_currency text not null references public.currencies (code) default 'UZS',\n  trading_days jsonb not null default '[1,2,3,4,5,6,7]',\n  financial_month_start_day smallint not null default 1 check (financial_month_start_day between 1 and 28),\n  updated_at timestamptz not null default now(),\n  updated_by uuid\n)","create table public.exchange_rates (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  from_currency text not null references public.currencies (code),\n  to_currency text not null references public.currencies (code),\n  rate numeric(18, 6) not null check (rate > 0),\n  effective_from date not null,\n  effective_to date,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  check (effective_to is null or effective_to >= effective_from),\n  exclude using gist (\n    organisation_id with =,\n    from_currency with =,\n    to_currency with =,\n    daterange(effective_from, effective_to, '[]') with &&\n  )\n)","create table public.tax_categories (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  name text not null,\n  rate numeric(6, 3) not null default 0,\n  is_inclusive boolean not null default true,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  updated_at timestamptz not null default now(),\n  updated_by uuid\n)","create table public.expense_categories (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  name text not null,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  updated_at timestamptz not null default now(),\n  updated_by uuid\n)","create table public.payment_methods (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  name text not null,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  created_by uuid\n)","create table public.waste_reasons (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  name text not null,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  created_by uuid\n)","create table public.kpi_targets (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid references public.branches (id) on delete cascade,\n  food_cost_target numeric(5, 2),\n  labour_cost_target numeric(5, 2),\n  net_margin_target numeric(5, 2),\n  is_estimate boolean not null default true,\n  effective_from date not null,\n  effective_to date,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  check (effective_to is null or effective_to >= effective_from),\n  exclude using gist (\n    organisation_id with =,\n    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,\n    daterange(effective_from, effective_to, '[]') with &&\n  )\n)","-- ---------------------------------------------------------------------------\n-- Suppliers (created before inventory_items, which references it)\n-- ---------------------------------------------------------------------------\ncreate table public.suppliers (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  name text not null,\n  contact_name text,\n  phone text,\n  email text,\n  payment_terms text,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  notes text,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  updated_at timestamptz not null default now(),\n  updated_by uuid\n)","create index suppliers_organisation_id_idx on public.suppliers (organisation_id)","-- ---------------------------------------------------------------------------\n-- Ingredient and packaging master\n-- ---------------------------------------------------------------------------\ncreate table public.inventory_items (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  name text not null,\n  uzbek_name text,\n  category text not null check (category in ('food', 'drink', 'packaging', 'consumable')),\n  base_unit_id uuid not null references public.units_of_measure (id),\n  purchase_unit_id uuid not null references public.units_of_measure (id),\n  purchase_to_base_factor numeric(18, 6) not null default 1 check (purchase_to_base_factor > 0),\n  default_supplier_id uuid references public.suppliers (id),\n  -- Costs are populated by purchase postings (Sprint 4) — never guessed here.\n  current_cost numeric(14, 4),\n  last_cost numeric(14, 4),\n  average_cost numeric(14, 4),\n  reorder_level numeric(14, 3),\n  target_stock_level numeric(14, 3),\n  shelf_life_days int,\n  tax_category_id uuid references public.tax_categories (id),\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  updated_at timestamptz not null default now(),\n  updated_by uuid\n)","create index inventory_items_organisation_id_idx on public.inventory_items (organisation_id)","-- ---------------------------------------------------------------------------\n-- Menu: categories, products, variants, effective-dated prices, bundles\n-- ---------------------------------------------------------------------------\ncreate table public.menu_categories (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  name text not null,\n  sort_order int not null default 0,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  created_by uuid\n)","create table public.products (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  menu_category_id uuid references public.menu_categories (id),\n  name text not null,\n  sku text,\n  tax_category_id uuid references public.tax_categories (id),\n  reporting_category text,\n  image_url text,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  updated_at timestamptz not null default now(),\n  updated_by uuid\n)","create index products_organisation_id_idx on public.products (organisation_id)","create table public.product_variants (\n  id uuid primary key default gen_random_uuid(),\n  product_id uuid not null references public.products (id) on delete cascade,\n  name text not null,\n  sku text,\n  availability jsonb,\n  status text not null default 'active' check (status in ('active', 'inactive')),\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  updated_at timestamptz not null default now(),\n  updated_by uuid\n)","create index product_variants_product_id_idx on public.product_variants (product_id)","create table public.product_prices (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  product_variant_id uuid not null references public.product_variants (id) on delete cascade,\n  price numeric(14, 2) not null check (price >= 0),\n  currency text not null references public.currencies (code) default 'UZS',\n  effective_from date not null,\n  effective_to date,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  check (effective_to is null or effective_to >= effective_from),\n  exclude using gist (\n    product_variant_id with =,\n    branch_id with =,\n    daterange(effective_from, effective_to, '[]') with &&\n  )\n)","create index product_prices_variant_branch_idx on public.product_prices (product_variant_id, branch_id)","create table public.bundle_components (\n  id uuid primary key default gen_random_uuid(),\n  bundle_variant_id uuid not null references public.product_variants (id) on delete cascade,\n  component_type text not null check (component_type in ('product_variant', 'ingredient')),\n  component_product_variant_id uuid references public.product_variants (id),\n  component_inventory_item_id uuid references public.inventory_items (id),\n  quantity numeric(10, 3) not null default 1 check (quantity > 0),\n  created_at timestamptz not null default now(),\n  check (\n    (component_type = 'product_variant' and component_product_variant_id is not null and component_inventory_item_id is null)\n    or\n    (component_type = 'ingredient' and component_inventory_item_id is not null and component_product_variant_id is null)\n  )\n)","create index bundle_components_bundle_variant_id_idx on public.bundle_components (bundle_variant_id)","-- ---------------------------------------------------------------------------\n-- Row Level Security\n-- ---------------------------------------------------------------------------\nalter table public.currencies enable row level security","alter table public.units_of_measure enable row level security","alter table public.unit_conversions enable row level security","alter table public.app_settings enable row level security","alter table public.exchange_rates enable row level security","alter table public.tax_categories enable row level security","alter table public.expense_categories enable row level security","alter table public.payment_methods enable row level security","alter table public.waste_reasons enable row level security","alter table public.kpi_targets enable row level security","alter table public.suppliers enable row level security","alter table public.inventory_items enable row level security","alter table public.menu_categories enable row level security","alter table public.products enable row level security","alter table public.product_variants enable row level security","alter table public.product_prices enable row level security","alter table public.bundle_components enable row level security","-- Global lookups: readable by any authenticated user, writable only via\n-- migrations/service role (no write policy).\ncreate policy currencies_select on public.currencies for select to authenticated using (true)","create policy units_of_measure_select on public.units_of_measure for select to authenticated using (true)","create policy unit_conversions_select on public.unit_conversions for select to authenticated using (true)","-- app_settings: org members read; Owner writes.\ncreate policy app_settings_select on public.app_settings\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy app_settings_upsert_owner on public.app_settings\n  for insert to authenticated with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","create policy app_settings_update_owner on public.app_settings\n  for update to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","-- exchange_rates: org members read; Owner writes (spec 4.1).\ncreate policy exchange_rates_select on public.exchange_rates\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy exchange_rates_insert_owner on public.exchange_rates\n  for insert to authenticated with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","create policy exchange_rates_update_owner on public.exchange_rates\n  for update to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","create policy exchange_rates_delete_owner on public.exchange_rates\n  for delete to authenticated using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","-- tax_categories / expense_categories: org members read; Owner or Finance write (spec 4.1, 4.3).\ncreate policy tax_categories_select on public.tax_categories\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy tax_categories_write on public.tax_categories\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'finance']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'finance']))","create policy expense_categories_select on public.expense_categories\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy expense_categories_write on public.expense_categories\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'finance']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'finance']))","-- payment_methods / waste_reasons: org members read; Owner or Branch Admin write (operational settings).\ncreate policy payment_methods_select on public.payment_methods\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy payment_methods_write on public.payment_methods\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))","create policy waste_reasons_select on public.waste_reasons\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy waste_reasons_write on public.waste_reasons\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))","-- kpi_targets: org members read; Owner writes (financial governance).\ncreate policy kpi_targets_select on public.kpi_targets\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy kpi_targets_write on public.kpi_targets\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner']))","-- suppliers / inventory_items: org members read; Owner, Branch Admin or\n-- Inventory Manager write (spec 4.2, 4.4).\ncreate policy suppliers_select on public.suppliers\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy suppliers_write on public.suppliers\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))","create policy inventory_items_select on public.inventory_items\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy inventory_items_write on public.inventory_items\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))","-- menu_categories / products / product_variants: org members read; Owner or\n-- Branch Admin write (spec 4.2).\ncreate policy menu_categories_select on public.menu_categories\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy menu_categories_write on public.menu_categories\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))","create policy products_select on public.products\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy products_write on public.products\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))","create policy product_variants_select on public.product_variants\n  for select to authenticated using (\n    product_id in (select id from public.products where organisation_id = public.current_organisation_id())\n  )","create policy product_variants_write on public.product_variants\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin'])\n    and product_id in (select id from public.products where organisation_id = public.current_organisation_id())\n  )\n  with check (\n    public.current_user_has_role(array['owner', 'branch_admin'])\n    and product_id in (select id from public.products where organisation_id = public.current_organisation_id())\n  )","-- product_prices: branch-aware read; Owner or Branch Admin write, scoped to\n-- branches they can access.\ncreate policy product_prices_select on public.product_prices\n  for select to authenticated using (branch_id in (select public.current_user_accessible_branch_ids()))","create policy product_prices_write on public.product_prices\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin'], branch_id)\n    and branch_id in (select public.current_user_accessible_branch_ids())\n  )\n  with check (\n    organisation_id = public.current_organisation_id()\n    and public.current_user_has_role(array['owner', 'branch_admin'], branch_id)\n    and branch_id in (select public.current_user_accessible_branch_ids())\n  )","-- bundle_components: follows the bundle's own product organisation scope.\ncreate policy bundle_components_select on public.bundle_components\n  for select to authenticated using (\n    bundle_variant_id in (\n      select pv.id from public.product_variants pv\n      join public.products p on p.id = pv.product_id\n      where p.organisation_id = public.current_organisation_id()\n    )\n  )","create policy bundle_components_write on public.bundle_components\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin'])\n    and bundle_variant_id in (\n      select pv.id from public.product_variants pv\n      join public.products p on p.id = pv.product_id\n      where p.organisation_id = public.current_organisation_id()\n    )\n  )\n  with check (\n    public.current_user_has_role(array['owner', 'branch_admin'])\n    and bundle_variant_id in (\n      select pv.id from public.product_variants pv\n      join public.products p on p.id = pv.product_id\n      where p.organisation_id = public.current_organisation_id()\n    )\n  )"}	sprint2_master_data
20260726140000	{"-- Sprint 3: Recipe / Bill of Materials engine (spec section 5.6) and the\n-- data needed for cost/profitability calculations (spec section 11).\n--\n-- Deliberately out of scope here: bundle/deal composition\n-- (public.bundle_components, added in Sprint 2) — combo variants and deals\n-- get their own full recipe_lines instead of referencing another variant's\n-- recipe, since recipe_lines only models ingredient quantities. Populating\n-- bundle_components is a separate pass; see docs/DECISIONS.md.\n\ncreate table public.recipe_versions (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  product_variant_id uuid not null references public.product_variants (id) on delete cascade,\n  version_number int not null,\n  status text not null default 'draft' check (status in ('draft', 'published')),\n  is_estimate boolean not null default true,\n  effective_from date,\n  effective_to date,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  published_at timestamptz,\n  published_by uuid,\n  check (\n    (status = 'draft' and effective_from is null)\n    or\n    (status = 'published' and effective_from is not null)\n  ),\n  check (effective_to is null or (effective_from is not null and effective_to >= effective_from)),\n  unique (product_variant_id, version_number),\n  -- Only published versions occupy a date range; drafts don't conflict with\n  -- anything since they're not yet in effect (spec 5.6: \\"publish action\n  -- freezes version for historical reporting\\").\n  exclude using gist (\n    product_variant_id with =,\n    daterange(effective_from, effective_to, '[]') with &&\n  ) where (status = 'published')\n)","create index recipe_versions_product_variant_id_idx on public.recipe_versions (product_variant_id)","create table public.recipe_lines (\n  id uuid primary key default gen_random_uuid(),\n  recipe_version_id uuid not null references public.recipe_versions (id) on delete cascade,\n  inventory_item_id uuid not null references public.inventory_items (id),\n  -- Quantity is always expressed in the ingredient's own base unit\n  -- (inventory_items.base_unit_id) — see docs/DECISIONS.md for why\n  -- recipe_lines doesn't carry its own unit and do generic conversion.\n  quantity numeric(14, 4) not null check (quantity > 0),\n  created_at timestamptz not null default now(),\n  unique (recipe_version_id, inventory_item_id)\n)","create index recipe_lines_recipe_version_id_idx on public.recipe_lines (recipe_version_id)","alter table public.recipe_versions enable row level security","alter table public.recipe_lines enable row level security","-- recipe_versions: org members read; Owner, Branch Admin or Inventory\n-- Manager write (spec 4.2, 4.4).\ncreate policy recipe_versions_select on public.recipe_versions\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy recipe_versions_write on public.recipe_versions\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))","-- recipe_lines: follows the parent recipe_version's organisation scope.\ncreate policy recipe_lines_select on public.recipe_lines\n  for select to authenticated using (\n    recipe_version_id in (\n      select id from public.recipe_versions where organisation_id = public.current_organisation_id()\n    )\n  )","create policy recipe_lines_write on public.recipe_lines\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager'])\n    and recipe_version_id in (\n      select id from public.recipe_versions where organisation_id = public.current_organisation_id()\n    )\n  )\n  with check (\n    public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager'])\n    and recipe_version_id in (\n      select id from public.recipe_versions where organisation_id = public.current_organisation_id()\n    )\n  )"}	sprint3_recipes
20260726150000	{"-- Sprint 4: Purchasing and Inventory (spec sections 5.7, 5.9, 5.10, and the\n-- Inventory Ledger Rules in section 10).\n--\n-- Core design: public.inventory_ledger is the single append-only source of\n-- truth for stock (rule 1). Nothing ever UPDATEs or DELETEs a ledger row —\n-- there is deliberately no update/delete RLS policy for it, for ANY role,\n-- not even Owner. Corrections are new reversing rows (rule 4).\n--\n-- Posting (purchases, waste, stock counts) happens through SECURITY INVOKER\n-- Postgres functions rather than multiple separate client calls, so a\n-- header + its ledger rows are created in one transaction (rule 2) and\n-- RLS still applies using the calling user's own privileges — the function\n-- adds atomicity and the weighted-average cost calculation, it does not\n-- bypass any permission check.\n--\n-- Costing: weighted average, computed across all branches combined (spec\n-- section 10 recommends \\"by branch/item\\", but Phase 1 ships one branch, so\n-- this is numerically identical for now — revisit when Phase 3 multi-branch\n-- lands; see docs/DECISIONS.md).\n--\n-- Deliberately not built in this pass: invoice attachment upload (needs a\n-- Supabase Storage bucket + signed URLs, tracked separately in\n-- docs/ROADMAP.md) and branch transfers (schema-ready via the transaction\n-- type below, no UI yet — not part of spec's Sprint 4 delivery list).\n\ncreate table public.purchase_headers (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  supplier_id uuid not null references public.suppliers (id),\n  invoice_number text,\n  invoice_date date not null,\n  receiving_date date not null,\n  currency text not null references public.currencies (code) default 'UZS',\n  exchange_rate numeric(18, 6),\n  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partially_paid', 'paid')),\n  due_date date,\n  status text not null default 'draft' check (status in ('draft', 'posted', 'voided')),\n  notes text,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  posted_at timestamptz,\n  posted_by uuid,\n  voided_at timestamptz,\n  voided_by uuid,\n  void_reason text,\n  check (currency = 'UZS' or exchange_rate is not null)\n)","create index purchase_headers_organisation_id_idx on public.purchase_headers (organisation_id)","create index purchase_headers_branch_id_idx on public.purchase_headers (branch_id)","create table public.purchase_lines (\n  id uuid primary key default gen_random_uuid(),\n  purchase_header_id uuid not null references public.purchase_headers (id) on delete cascade,\n  inventory_item_id uuid not null references public.inventory_items (id),\n  -- Quantity/unit_cost are in the ingredient's own purchase_unit_id\n  -- (set on inventory_items in Sprint 2) — see docs/DECISIONS.md for why\n  -- there's no per-line unit override, same reasoning as recipe_lines.\n  quantity numeric(14, 4) not null check (quantity > 0),\n  unit_cost numeric(14, 4) not null check (unit_cost >= 0),\n  tax_amount numeric(14, 4) not null default 0 check (tax_amount >= 0),\n  line_total numeric(16, 4) generated always as (quantity * unit_cost + tax_amount) stored,\n  created_at timestamptz not null default now()\n)","create index purchase_lines_purchase_header_id_idx on public.purchase_lines (purchase_header_id)","create table public.inventory_ledger (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  inventory_item_id uuid not null references public.inventory_items (id),\n  transaction_type text not null check (transaction_type in (\n    'opening_balance', 'purchase_receipt', 'sale_consumption', 'waste',\n    'count_adjustment', 'supplier_return', 'transfer_in', 'transfer_out',\n    'manual_correction'\n  )),\n  -- Positive = stock increase, negative = stock decrease, always in the\n  -- ingredient's base unit (rule 6).\n  quantity_base numeric(14, 4) not null,\n  cost_basis numeric(14, 4) not null,\n  source_type text not null,\n  source_id uuid not null,\n  business_date date not null,\n  created_at timestamptz not null default now(),\n  created_by uuid\n)","create index inventory_ledger_item_branch_idx on public.inventory_ledger (inventory_item_id, branch_id)","create index inventory_ledger_business_date_idx on public.inventory_ledger (business_date)","create index inventory_ledger_source_idx on public.inventory_ledger (source_type, source_id)","create table public.waste_records (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  inventory_item_id uuid not null references public.inventory_items (id),\n  quantity_base numeric(14, 4) not null check (quantity_base > 0),\n  waste_reason_id uuid not null references public.waste_reasons (id),\n  business_date date not null,\n  notes text,\n  created_at timestamptz not null default now(),\n  created_by uuid\n)","create index waste_records_organisation_id_idx on public.waste_records (organisation_id)","create table public.stock_count_headers (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  count_date date not null,\n  status text not null default 'draft' check (status in ('draft', 'posted')),\n  notes text,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  posted_at timestamptz,\n  posted_by uuid\n)","create index stock_count_headers_organisation_id_idx on public.stock_count_headers (organisation_id)","create table public.stock_count_lines (\n  id uuid primary key default gen_random_uuid(),\n  stock_count_header_id uuid not null references public.stock_count_headers (id) on delete cascade,\n  inventory_item_id uuid not null references public.inventory_items (id),\n  counted_quantity numeric(14, 4) not null check (counted_quantity >= 0),\n  -- Snapshotted from the ledger balance at count-draft time so the\n  -- variance shown to the counter doesn't shift under them while counting.\n  expected_quantity numeric(14, 4) not null,\n  reason text,\n  created_at timestamptz not null default now(),\n  unique (stock_count_header_id, inventory_item_id)\n)","create index stock_count_lines_header_id_idx on public.stock_count_lines (stock_count_header_id)","-- ---------------------------------------------------------------------------\n-- Posting functions. SECURITY INVOKER (the default) so every statement\n-- inside still runs under the calling user's RLS — these add atomicity and\n-- calculation, not elevated privilege.\n-- ---------------------------------------------------------------------------\n\ncreate or replace function public.post_purchase(p_purchase_header_id uuid)\nreturns void\nlanguage plpgsql\nsecurity invoker\nset search_path = public\nas $$\ndeclare\n  v_header public.purchase_headers%rowtype;\n  v_line public.purchase_lines%rowtype;\n  v_purchase_to_base numeric;\n  v_base_qty numeric;\n  v_base_unit_cost numeric;\n  v_qty_on_hand numeric;\n  v_old_avg_cost numeric;\n  v_new_avg_cost numeric;\nbegin\n  select * into v_header from public.purchase_headers where id = p_purchase_header_id;\n  if not found then\n    raise exception 'Purchase not found';\n  end if;\n  if v_header.status <> 'draft' then\n    raise exception 'Only draft purchases can be posted';\n  end if;\n\n  for v_line in select * from public.purchase_lines where purchase_header_id = p_purchase_header_id loop\n    select purchase_to_base_factor, average_cost\n      into v_purchase_to_base, v_old_avg_cost\n      from public.inventory_items where id = v_line.inventory_item_id;\n\n    v_base_qty := v_line.quantity * coalesce(v_purchase_to_base, 1);\n    v_base_unit_cost := (v_line.unit_cost * coalesce(v_header.exchange_rate, 1)) / coalesce(v_purchase_to_base, 1);\n\n    select coalesce(sum(quantity_base), 0) into v_qty_on_hand\n      from public.inventory_ledger where inventory_item_id = v_line.inventory_item_id;\n\n    if v_qty_on_hand + v_base_qty > 0 then\n      v_new_avg_cost := (v_qty_on_hand * coalesce(v_old_avg_cost, 0) + v_base_qty * v_base_unit_cost)\n        / (v_qty_on_hand + v_base_qty);\n    else\n      v_new_avg_cost := v_base_unit_cost;\n    end if;\n\n    insert into public.inventory_ledger (\n      organisation_id, branch_id, inventory_item_id, transaction_type,\n      quantity_base, cost_basis, source_type, source_id, business_date, created_by\n    ) values (\n      v_header.organisation_id, v_header.branch_id, v_line.inventory_item_id, 'purchase_receipt',\n      v_base_qty, v_base_unit_cost, 'purchase_line', v_line.id, v_header.receiving_date, auth.uid()\n    );\n\n    update public.inventory_items\n      set average_cost = v_new_avg_cost,\n          current_cost = v_base_unit_cost,\n          last_cost = v_base_unit_cost,\n          updated_at = now()\n      where id = v_line.inventory_item_id;\n  end loop;\n\n  update public.purchase_headers\n    set status = 'posted', posted_at = now(), posted_by = auth.uid()\n    where id = p_purchase_header_id;\nend;\n$$","grant execute on function public.post_purchase(uuid) to authenticated","create or replace function public.record_waste(\n  p_branch_id uuid,\n  p_inventory_item_id uuid,\n  p_quantity_base numeric,\n  p_waste_reason_id uuid,\n  p_business_date date,\n  p_notes text\n)\nreturns uuid\nlanguage plpgsql\nsecurity invoker\nset search_path = public\nas $$\ndeclare\n  v_organisation_id uuid;\n  v_cost numeric;\n  v_waste_id uuid;\nbegin\n  select public.current_organisation_id() into v_organisation_id;\n\n  select average_cost into v_cost from public.inventory_items where id = p_inventory_item_id;\n\n  insert into public.waste_records (\n    organisation_id, branch_id, inventory_item_id, quantity_base,\n    waste_reason_id, business_date, notes, created_by\n  ) values (\n    v_organisation_id, p_branch_id, p_inventory_item_id, p_quantity_base,\n    p_waste_reason_id, p_business_date, p_notes, auth.uid()\n  ) returning id into v_waste_id;\n\n  insert into public.inventory_ledger (\n    organisation_id, branch_id, inventory_item_id, transaction_type,\n    quantity_base, cost_basis, source_type, source_id, business_date, created_by\n  ) values (\n    v_organisation_id, p_branch_id, p_inventory_item_id, 'waste',\n    -abs(p_quantity_base), coalesce(v_cost, 0), 'waste_record', v_waste_id, p_business_date, auth.uid()\n  );\n\n  return v_waste_id;\nend;\n$$","grant execute on function public.record_waste(uuid, uuid, numeric, uuid, date, text) to authenticated","create or replace function public.post_stock_count(p_stock_count_header_id uuid)\nreturns void\nlanguage plpgsql\nsecurity invoker\nset search_path = public\nas $$\ndeclare\n  v_header public.stock_count_headers%rowtype;\n  v_line public.stock_count_lines%rowtype;\n  v_variance numeric;\n  v_cost numeric;\nbegin\n  select * into v_header from public.stock_count_headers where id = p_stock_count_header_id;\n  if not found then\n    raise exception 'Stock count not found';\n  end if;\n  if v_header.status <> 'draft' then\n    raise exception 'Only draft stock counts can be posted';\n  end if;\n\n  for v_line in select * from public.stock_count_lines where stock_count_header_id = p_stock_count_header_id loop\n    v_variance := v_line.counted_quantity - v_line.expected_quantity;\n    if v_variance <> 0 then\n      select average_cost into v_cost from public.inventory_items where id = v_line.inventory_item_id;\n\n      insert into public.inventory_ledger (\n        organisation_id, branch_id, inventory_item_id, transaction_type,\n        quantity_base, cost_basis, source_type, source_id, business_date, created_by\n      ) values (\n        v_header.organisation_id, v_header.branch_id, v_line.inventory_item_id, 'count_adjustment',\n        v_variance, coalesce(v_cost, 0), 'stock_count_line', v_line.id, v_header.count_date, auth.uid()\n      );\n    end if;\n  end loop;\n\n  update public.stock_count_headers\n    set status = 'posted', posted_at = now(), posted_by = auth.uid()\n    where id = p_stock_count_header_id;\nend;\n$$","grant execute on function public.post_stock_count(uuid) to authenticated","-- ---------------------------------------------------------------------------\n-- Row Level Security\n-- ---------------------------------------------------------------------------\nalter table public.purchase_headers enable row level security","alter table public.purchase_lines enable row level security","alter table public.inventory_ledger enable row level security","alter table public.waste_records enable row level security","alter table public.stock_count_headers enable row level security","alter table public.stock_count_lines enable row level security","-- purchase_headers/lines: org members read; Owner, Branch Admin or\n-- Inventory Manager write (spec 4.2, 4.4). Posted headers can still be\n-- updated by this policy (e.g. payment_status) — only the posting function\n-- enforces \\"draft only\\" for the status transition itself.\ncreate policy purchase_headers_select on public.purchase_headers\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy purchase_headers_write on public.purchase_headers\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))","create policy purchase_lines_select on public.purchase_lines\n  for select to authenticated using (\n    purchase_header_id in (select id from public.purchase_headers where organisation_id = public.current_organisation_id())\n  )","create policy purchase_lines_write on public.purchase_lines\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager'])\n    and purchase_header_id in (select id from public.purchase_headers where organisation_id = public.current_organisation_id())\n  )\n  with check (\n    public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager'])\n    and purchase_header_id in (select id from public.purchase_headers where organisation_id = public.current_organisation_id())\n  )","-- inventory_ledger: org members read; INSERT only (via the posting\n-- functions above) for Owner/Branch Admin/Inventory Manager. No update or\n-- delete policy exists for ANY role — the ledger is immutable once written.\ncreate policy inventory_ledger_select on public.inventory_ledger\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy inventory_ledger_insert on public.inventory_ledger\n  for insert to authenticated\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))","-- waste_records: org members read; Owner/Branch Admin/Inventory Manager\n-- insert via record_waste(). No update/delete — waste is corrected with a\n-- new (possibly negative-offsetting) record, not an edit.\ncreate policy waste_records_select on public.waste_records\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy waste_records_insert on public.waste_records\n  for insert to authenticated\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))","-- stock_count_headers/lines: same write roles. Lines can be freely\n-- edited while the header is still draft (counting is iterative); once\n-- posted, only the ledger rows it produced are immutable.\ncreate policy stock_count_headers_select on public.stock_count_headers\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy stock_count_headers_write on public.stock_count_headers\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager']))","create policy stock_count_lines_select on public.stock_count_lines\n  for select to authenticated using (\n    stock_count_header_id in (select id from public.stock_count_headers where organisation_id = public.current_organisation_id())\n  )","create policy stock_count_lines_write on public.stock_count_lines\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager'])\n    and stock_count_header_id in (select id from public.stock_count_headers where organisation_id = public.current_organisation_id())\n  )\n  with check (\n    public.current_user_has_role(array['owner', 'branch_admin', 'inventory_manager'])\n    and stock_count_header_id in (select id from public.stock_count_headers where organisation_id = public.current_organisation_id())\n  )"}	sprint4_purchasing_inventory
20260726150001	{"-- Stock-on-hand aggregate, used by Current Stock, Low-stock Alerts, and as\n-- context inside Waste/Counts. security_invoker = true is required (PG15+)\n-- so PostgREST queries against this view apply the CALLING user's RLS on\n-- inventory_ledger/inventory_items — without it, a view runs with its\n-- owner's privileges and would silently bypass row-level security.\ncreate view public.inventory_stock_on_hand\nwith (security_invoker = true)\nas\nselect\n  l.organisation_id,\n  l.branch_id,\n  l.inventory_item_id,\n  i.name as inventory_item_name,\n  i.category,\n  u.code as base_unit_code,\n  i.reorder_level,\n  i.target_stock_level,\n  i.average_cost,\n  sum(l.quantity_base) as quantity_on_hand,\n  sum(l.quantity_base) * coalesce(i.average_cost, 0) as stock_value\nfrom public.inventory_ledger l\njoin public.inventory_items i on i.id = l.inventory_item_id\njoin public.units_of_measure u on u.id = i.base_unit_id\ngroup by\n  l.organisation_id, l.branch_id, l.inventory_item_id, i.name, i.category,\n  u.code, i.reorder_level, i.target_stock_level, i.average_cost","grant select on public.inventory_stock_on_hand to authenticated"}	stock_on_hand_view
20260726160000	{"-- Sprint 5: Sales and Cash (spec sections 5.8, 5.13).\n--\n-- Same architectural patterns as Sprint 4: an append-only ledger consumer\n-- (posting sales writes sale_consumption rows to the existing\n-- inventory_ledger), SECURITY INVOKER functions for atomic posting, and\n-- derived numbers (revenue, expected cash, variances) computed on read in\n-- lib/ code rather than stored — see docs/DECISIONS.md.\n--\n-- Role note: unlike Sprint 4, spec section 4.5 gives the Cashier role\n-- \\"enter sales summaries and daily cash/card figures\\" — so Cashier can\n-- create AND post a daily sales entry (submitting their own numbers), but\n-- closing a business day (locking it) is Branch Admin/Owner (spec 4.2), and\n-- reopening a closed day is Owner-only (spec 5.13: \\"owner-approved\n-- reopening\\"). Those two narrower transitions get an explicit role check\n-- inside their functions, since the RLS write policy on daily_sales_headers\n-- is intentionally broad (Owner/Branch Admin/Cashier) to let a cashier\n-- create and post their own draft.\n\ncreate table public.daily_sales_headers (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  business_date date not null,\n  status text not null default 'draft' check (status in ('draft', 'posted', 'closed')),\n  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),\n  refund_amount numeric(14, 2) not null default 0 check (refund_amount >= 0),\n  orders_count int,\n  notes text,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  posted_at timestamptz,\n  posted_by uuid,\n  closed_at timestamptz,\n  closed_by uuid,\n  reopened_at timestamptz,\n  reopened_by uuid,\n  reopen_reason text,\n  unique (branch_id, business_date)\n)","create index daily_sales_headers_organisation_id_idx on public.daily_sales_headers (organisation_id)","create table public.daily_sales_lines (\n  id uuid primary key default gen_random_uuid(),\n  daily_sales_header_id uuid not null references public.daily_sales_headers (id) on delete cascade,\n  product_variant_id uuid not null references public.product_variants (id),\n  quantity_sold numeric(10, 2) not null check (quantity_sold > 0),\n  -- Null until posting computes it from the effective price, unless the\n  -- entrant overrides it (e.g. for a discounted/complimentary sale), in\n  -- which case override_reason is required — spec 5.8's \\"audit reason\\".\n  revenue_override numeric(14, 2),\n  override_reason text,\n  revenue numeric(14, 2),\n  created_at timestamptz not null default now(),\n  check (revenue_override is null or override_reason is not null),\n  unique (daily_sales_header_id, product_variant_id)\n)","create index daily_sales_lines_header_id_idx on public.daily_sales_lines (daily_sales_header_id)","create table public.daily_payment_totals (\n  id uuid primary key default gen_random_uuid(),\n  daily_sales_header_id uuid not null references public.daily_sales_headers (id) on delete cascade,\n  payment_method_id uuid not null references public.payment_methods (id),\n  amount numeric(14, 2) not null default 0 check (amount >= 0),\n  unique (daily_sales_header_id, payment_method_id)\n)","create index daily_payment_totals_header_id_idx on public.daily_payment_totals (daily_sales_header_id)","create table public.cash_reconciliations (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  business_date date not null,\n  opening_cash numeric(14, 2) not null default 0,\n  cash_expenses numeric(14, 2) not null default 0 check (cash_expenses >= 0),\n  cash_deposits numeric(14, 2) not null default 0 check (cash_deposits >= 0),\n  cash_withdrawals numeric(14, 2) not null default 0 check (cash_withdrawals >= 0),\n  actual_closing_cash numeric(14, 2),\n  card_expected numeric(14, 2),\n  card_actual numeric(14, 2),\n  status text not null default 'draft' check (status in ('draft', 'signed_off')),\n  notes text,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  signed_off_at timestamptz,\n  signed_off_by uuid,\n  unique (branch_id, business_date)\n)","create index cash_reconciliations_organisation_id_idx on public.cash_reconciliations (organisation_id)","-- ---------------------------------------------------------------------------\n-- Posting / status-transition functions\n-- ---------------------------------------------------------------------------\n\ncreate or replace function public.post_daily_sales(p_daily_sales_header_id uuid)\nreturns void\nlanguage plpgsql\nsecurity invoker\nset search_path = public\nas $$\ndeclare\n  v_header public.daily_sales_headers%rowtype;\n  v_line public.daily_sales_lines%rowtype;\n  v_price numeric;\n  v_recipe_version_id uuid;\n  v_recipe_line record;\nbegin\n  select * into v_header from public.daily_sales_headers where id = p_daily_sales_header_id;\n  if not found then\n    raise exception 'Daily sales entry not found';\n  end if;\n  if v_header.status <> 'draft' then\n    raise exception 'Only a draft daily sales entry can be posted';\n  end if;\n\n  for v_line in select * from public.daily_sales_lines where daily_sales_header_id = p_daily_sales_header_id loop\n    if v_line.revenue_override is not null then\n      v_price := v_line.revenue_override / v_line.quantity_sold;\n    else\n      select price into v_price\n        from public.product_prices\n        where product_variant_id = v_line.product_variant_id\n          and branch_id = v_header.branch_id\n          and effective_from <= v_header.business_date\n          and (effective_to is null or effective_to >= v_header.business_date)\n        order by effective_from desc\n        limit 1;\n    end if;\n\n    if v_price is null then\n      raise exception 'No effective price found for a sold variant — set one in Menu > Prices first';\n    end if;\n\n    update public.daily_sales_lines\n      set revenue = coalesce(v_line.revenue_override, v_price * v_line.quantity_sold)\n      where id = v_line.id;\n\n    -- Theoretical stock consumption from the variant's currently published\n    -- recipe. A variant with no published recipe is still sold (revenue\n    -- above is unaffected) but consumes no ledger stock — same \\"sellable\n    -- before its composition is modeled\\" stance as Sprint 2/3.\n    select id into v_recipe_version_id\n      from public.recipe_versions\n      where product_variant_id = v_line.product_variant_id and status = 'published' and effective_to is null;\n\n    if v_recipe_version_id is not null then\n      for v_recipe_line in\n        select rl.inventory_item_id, rl.quantity, coalesce(ii.average_cost, 0) as cost\n        from public.recipe_lines rl\n        join public.inventory_items ii on ii.id = rl.inventory_item_id\n        where rl.recipe_version_id = v_recipe_version_id\n      loop\n        insert into public.inventory_ledger (\n          organisation_id, branch_id, inventory_item_id, transaction_type,\n          quantity_base, cost_basis, source_type, source_id, business_date, created_by\n        ) values (\n          v_header.organisation_id, v_header.branch_id, v_recipe_line.inventory_item_id, 'sale_consumption',\n          -(v_recipe_line.quantity * v_line.quantity_sold), v_recipe_line.cost,\n          'daily_sales_line', v_line.id, v_header.business_date, auth.uid()\n        );\n      end loop;\n    end if;\n  end loop;\n\n  update public.daily_sales_headers\n    set status = 'posted', posted_at = now(), posted_by = auth.uid()\n    where id = p_daily_sales_header_id;\nend;\n$$","grant execute on function public.post_daily_sales(uuid) to authenticated","create or replace function public.close_daily_sales(p_daily_sales_header_id uuid)\nreturns void\nlanguage plpgsql\nsecurity invoker\nset search_path = public\nas $$\nbegin\n  if not public.current_user_has_role(array['owner', 'branch_admin']) then\n    raise exception 'Only an Owner or Branch Admin can close a business day';\n  end if;\n\n  update public.daily_sales_headers\n    set status = 'closed', closed_at = now(), closed_by = auth.uid()\n    where id = p_daily_sales_header_id and status = 'posted';\n\n  if not found then\n    raise exception 'Only a posted daily sales entry can be closed';\n  end if;\nend;\n$$","grant execute on function public.close_daily_sales(uuid) to authenticated","create or replace function public.reopen_daily_sales(p_daily_sales_header_id uuid, p_reason text)\nreturns void\nlanguage plpgsql\nsecurity invoker\nset search_path = public\nas $$\nbegin\n  if not public.current_user_has_role(array['owner']) then\n    raise exception 'Only an Owner can reopen a closed business day';\n  end if;\n  if p_reason is null or length(trim(p_reason)) = 0 then\n    raise exception 'A reason is required to reopen a closed day';\n  end if;\n\n  update public.daily_sales_headers\n    set status = 'posted', reopened_at = now(), reopened_by = auth.uid(), reopen_reason = p_reason\n    where id = p_daily_sales_header_id and status = 'closed';\n\n  if not found then\n    raise exception 'Only a closed daily sales entry can be reopened';\n  end if;\nend;\n$$","grant execute on function public.reopen_daily_sales(uuid, text) to authenticated","-- ---------------------------------------------------------------------------\n-- Row Level Security\n-- ---------------------------------------------------------------------------\nalter table public.daily_sales_headers enable row level security","alter table public.daily_sales_lines enable row level security","alter table public.daily_payment_totals enable row level security","alter table public.cash_reconciliations enable row level security","create policy daily_sales_headers_select on public.daily_sales_headers\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy daily_sales_headers_write on public.daily_sales_headers\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'cashier']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'cashier']))","create policy daily_sales_lines_select on public.daily_sales_lines\n  for select to authenticated using (\n    daily_sales_header_id in (select id from public.daily_sales_headers where organisation_id = public.current_organisation_id())\n  )","create policy daily_sales_lines_write on public.daily_sales_lines\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin', 'cashier'])\n    and daily_sales_header_id in (select id from public.daily_sales_headers where organisation_id = public.current_organisation_id())\n  )\n  with check (\n    public.current_user_has_role(array['owner', 'branch_admin', 'cashier'])\n    and daily_sales_header_id in (select id from public.daily_sales_headers where organisation_id = public.current_organisation_id())\n  )","create policy daily_payment_totals_select on public.daily_payment_totals\n  for select to authenticated using (\n    daily_sales_header_id in (select id from public.daily_sales_headers where organisation_id = public.current_organisation_id())\n  )","create policy daily_payment_totals_write on public.daily_payment_totals\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin', 'cashier'])\n    and daily_sales_header_id in (select id from public.daily_sales_headers where organisation_id = public.current_organisation_id())\n  )\n  with check (\n    public.current_user_has_role(array['owner', 'branch_admin', 'cashier'])\n    and daily_sales_header_id in (select id from public.daily_sales_headers where organisation_id = public.current_organisation_id())\n  )","create policy cash_reconciliations_select on public.cash_reconciliations\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy cash_reconciliations_write on public.cash_reconciliations\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'cashier']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'cashier']))"}	sprint5_sales_cash
20260726170000	{"-- Sprint 6: Staff/Labour cost (spec 5.11 — required to feed P&L's \\"Labour\n-- cost\\" line even though the spec's own section 21 sprint plan never\n-- explicitly assigns Staff to a sprint) and Expenses/Fixed Costs (5.12).\n--\n-- Pay rate confidentiality (spec 5.11: \\"Confidential pay fields restricted\n-- by role\\") is handled by giving employee_pay_rates a narrower SELECT\n-- policy than employees/shift_entries — pay amounts are Owner/Branch\n-- Admin/Finance only, but an employee's name and hours worked are visible\n-- more broadly (needed for e.g. a labour hours report without exposing\n-- rates).\n\ncreate table public.employees (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  name text not null,\n  role_title text,\n  employment_status text not null default 'active' check (employment_status in ('active', 'inactive')),\n  pay_type text not null check (pay_type in ('hourly', 'monthly')),\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  updated_at timestamptz not null default now(),\n  updated_by uuid\n)","create index employees_organisation_id_idx on public.employees (organisation_id)","create table public.employee_pay_rates (\n  id uuid primary key default gen_random_uuid(),\n  employee_id uuid not null references public.employees (id) on delete cascade,\n  -- Hourly rate per hour, or monthly salary, depending on employees.pay_type.\n  pay_rate numeric(14, 2) not null check (pay_rate >= 0),\n  currency text not null references public.currencies (code) default 'UZS',\n  effective_from date not null,\n  effective_to date,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  check (effective_to is null or effective_to >= effective_from),\n  exclude using gist (\n    employee_id with =,\n    daterange(effective_from, effective_to, '[]') with &&\n  )\n)","create index employee_pay_rates_employee_id_idx on public.employee_pay_rates (employee_id)","create table public.shift_entries (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  employee_id uuid not null references public.employees (id) on delete cascade,\n  work_date date not null,\n  hours_worked numeric(5, 2) not null check (hours_worked > 0 and hours_worked <= 24),\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  unique (employee_id, work_date)\n)","create index shift_entries_organisation_id_idx on public.shift_entries (organisation_id)","create table public.recurring_expense_templates (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  -- null branch_id = organisation-wide (matches the confirmed $3,220 costs,\n  -- which apply to the business as a whole, not one branch specifically).\n  branch_id uuid references public.branches (id) on delete cascade,\n  expense_category_id uuid not null references public.expense_categories (id),\n  name text not null,\n  amount numeric(14, 2) not null check (amount >= 0),\n  currency text not null references public.currencies (code) default 'USD',\n  allocation_method text not null default 'calendar_day' check (allocation_method in ('calendar_day', 'trading_day', 'actual_transaction')),\n  effective_from date not null,\n  effective_to date,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  check (effective_to is null or effective_to >= effective_from),\n  exclude using gist (\n    organisation_id with =,\n    expense_category_id with =,\n    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,\n    daterange(effective_from, effective_to, '[]') with &&\n  )\n)","create index recurring_expense_templates_organisation_id_idx on public.recurring_expense_templates (organisation_id)","create table public.expense_transactions (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid not null references public.branches (id) on delete cascade,\n  expense_category_id uuid not null references public.expense_categories (id),\n  vendor text,\n  currency text not null references public.currencies (code) default 'UZS',\n  exchange_rate numeric(18, 6),\n  amount numeric(14, 2) not null check (amount >= 0),\n  accrual_date date not null,\n  payment_date date,\n  status text not null default 'draft' check (status in ('draft', 'posted')),\n  notes text,\n  created_at timestamptz not null default now(),\n  created_by uuid,\n  posted_at timestamptz,\n  posted_by uuid,\n  check (currency = 'UZS' or exchange_rate is not null)\n)","create index expense_transactions_organisation_id_idx on public.expense_transactions (organisation_id)","-- ---------------------------------------------------------------------------\n-- Row Level Security\n-- ---------------------------------------------------------------------------\nalter table public.employees enable row level security","alter table public.employee_pay_rates enable row level security","alter table public.shift_entries enable row level security","alter table public.recurring_expense_templates enable row level security","alter table public.expense_transactions enable row level security","create policy employees_select on public.employees\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy employees_write on public.employees\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))","-- Confidential: only Owner/Branch Admin/Finance can even read pay rates.\ncreate policy employee_pay_rates_select on public.employee_pay_rates\n  for select to authenticated using (\n    public.current_user_has_role(array['owner', 'branch_admin', 'finance'])\n    and employee_id in (select id from public.employees where organisation_id = public.current_organisation_id())\n  )","create policy employee_pay_rates_write on public.employee_pay_rates\n  for all to authenticated\n  using (\n    public.current_user_has_role(array['owner', 'branch_admin'])\n    and employee_id in (select id from public.employees where organisation_id = public.current_organisation_id())\n  )\n  with check (\n    public.current_user_has_role(array['owner', 'branch_admin'])\n    and employee_id in (select id from public.employees where organisation_id = public.current_organisation_id())\n  )","create policy shift_entries_select on public.shift_entries\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy shift_entries_write on public.shift_entries\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin']))","create policy recurring_expense_templates_select on public.recurring_expense_templates\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy recurring_expense_templates_write on public.recurring_expense_templates\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'finance']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'finance']))","create policy expense_transactions_select on public.expense_transactions\n  for select to authenticated using (organisation_id = public.current_organisation_id())","create policy expense_transactions_write on public.expense_transactions\n  for all to authenticated\n  using (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'finance']))\n  with check (organisation_id = public.current_organisation_id() and public.current_user_has_role(array['owner', 'branch_admin', 'finance']))"}	sprint6_staff_finance
20260726180000	{"-- Sprint 7: audit log (spec section 5.18). Captures material changes —\n-- purchases, sales postings/closes/reopens, waste, stock counts, expense\n-- postings, pay rate changes, fixed-cost templates, recipe publishing, and\n-- price changes — as an immutable before/after trail.\n--\n-- Design: one generic trigger function attached to each audited table,\n-- rather than hand-written logging calls inside every posting function.\n-- A full-row jsonb diff already captures \\"reason\\" fields (void_reason,\n-- reopen_reason, override_reason) for free, since those are ordinary\n-- columns on the audited row — no per-action bespoke code needed to\n-- satisfy spec 5.18's \\"reason for override/reopening/reversal\\".\n--\n-- organisation_id is taken from the acting user's own session\n-- (current_organisation_id()), not from the row, so this works uniformly\n-- even for tables like employee_pay_rates that have no organisation_id\n-- column of their own.\n\ncreate table public.audit_logs (\n  id uuid primary key default gen_random_uuid(),\n  organisation_id uuid not null references public.organisations (id) on delete cascade,\n  branch_id uuid references public.branches (id) on delete set null,\n  actor_id uuid references public.profiles (id) on delete set null,\n  entity_table text not null,\n  entity_id uuid,\n  action text not null check (action in ('insert', 'update', 'delete')),\n  before_data jsonb,\n  after_data jsonb,\n  reason text,\n  created_at timestamptz not null default now()\n);","create index audit_logs_organisation_id_idx on public.audit_logs (organisation_id, created_at desc);","create index audit_logs_entity_idx on public.audit_logs (entity_table, entity_id);","alter table public.audit_logs enable row level security;","-- Read: owner/branch_admin/finance — the same set that can already see\n-- financial detail elsewhere (spec 4.1, 4.3). No insert/update/delete\n-- policy exists for any role: the only way a row is created is via\n-- log_audit_event() below, which is security definer and bypasses RLS by\n-- design. Audit records must not be editable by normal users (spec 5.18).\ncreate policy audit_logs_select on public.audit_logs\n  for select to authenticated\n  using (\n    organisation_id = public.current_organisation_id()\n    and public.current_user_has_role(array['owner', 'branch_admin', 'finance'])\n  );","create or replace function public.log_audit_event()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  v_row record;","v_reason text;","begin\n  v_row := coalesce(new, old);","v_reason := coalesce(\n    to_jsonb(v_row) ->> 'void_reason',\n    to_jsonb(v_row) ->> 'reopen_reason',\n    to_jsonb(v_row) ->> 'override_reason',\n    to_jsonb(v_row) ->> 'reason'\n  );","insert into public.audit_logs (\n    organisation_id, branch_id, actor_id, entity_table, entity_id, action, before_data, after_data, reason\n  ) values (\n    public.current_organisation_id(),\n    (to_jsonb(v_row) ->> 'branch_id')::uuid,\n    auth.uid(),\n    tg_table_name,\n    (to_jsonb(v_row) ->> 'id')::uuid,\n    lower(tg_op),\n    case when tg_op in ('update', 'delete') then to_jsonb(old) else null end,\n    case when tg_op in ('update', 'insert') then to_jsonb(new) else null end,\n    v_reason\n  );","return v_row;",end;,$$;,"-- Material tables per spec 5.18 — real money, overrides, reopenings, and\n-- reversals. Lower-stakes master data (suppliers, categories, waste\n-- reasons, etc.) is deliberately not instrumented; see docs/DECISIONS.md.\ncreate trigger audit_purchase_headers\n  after insert or update on public.purchase_headers\n  for each row execute function public.log_audit_event();","create trigger audit_daily_sales_headers\n  after insert or update on public.daily_sales_headers\n  for each row execute function public.log_audit_event();","create trigger audit_waste_records\n  after insert on public.waste_records\n  for each row execute function public.log_audit_event();","create trigger audit_stock_count_headers\n  after insert or update on public.stock_count_headers\n  for each row execute function public.log_audit_event();","create trigger audit_cash_reconciliations\n  after insert or update on public.cash_reconciliations\n  for each row execute function public.log_audit_event();","create trigger audit_expense_transactions\n  after insert or update on public.expense_transactions\n  for each row execute function public.log_audit_event();","create trigger audit_employee_pay_rates\n  after insert on public.employee_pay_rates\n  for each row execute function public.log_audit_event();","create trigger audit_recurring_expense_templates\n  after insert or update on public.recurring_expense_templates\n  for each row execute function public.log_audit_event();","create trigger audit_recipe_versions\n  after insert or update on public.recipe_versions\n  for each row execute function public.log_audit_event();","create trigger audit_product_prices\n  after insert on public.product_prices\n  for each row execute function public.log_audit_event();"}	sprint7_audit_log
20260726180001	{"-- Delta on 20260726180000: capture the actor's name at insert time rather\n-- than relying on a live join to profiles, which branch_admin/finance\n-- can't read for other users under the existing profiles RLS policy.\nalter table public.audit_logs add column if not exists actor_name text;","create or replace function public.log_audit_event()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  v_row record;","v_reason text;","begin\n  v_row := coalesce(new, old);","v_reason := coalesce(\n    to_jsonb(v_row) ->> 'void_reason',\n    to_jsonb(v_row) ->> 'reopen_reason',\n    to_jsonb(v_row) ->> 'override_reason',\n    to_jsonb(v_row) ->> 'reason'\n  );","insert into public.audit_logs (\n    organisation_id, branch_id, actor_id, actor_name, entity_table, entity_id, action, before_data, after_data, reason\n  ) values (\n    public.current_organisation_id(),\n    (to_jsonb(v_row) ->> 'branch_id')::uuid,\n    auth.uid(),\n    (select full_name from public.profiles where id = auth.uid()),\n    tg_table_name,\n    (to_jsonb(v_row) ->> 'id')::uuid,\n    lower(tg_op),\n    case when tg_op in ('update', 'delete') then to_jsonb(old) else null end,\n    case when tg_op in ('update', 'insert') then to_jsonb(new) else null end,\n    v_reason\n  );","return v_row;",end;,$$;}	audit_logs_actor_name
20260726180002	{"-- Bug fix: tg_op is 'INSERT'/'UPDATE'/'DELETE' (uppercase) in a trigger\n-- body, but log_audit_event()'s CASE expressions compared it against\n-- lowercase 'insert'/'update'/'delete', so before_data/after_data were\n-- always NULL regardless of action — found via live verification (posted\n-- a real test expense and saw an empty diff in the Audit log UI).\n-- action still stores lower(tg_op) for display, which was already correct.\ncreate or replace function public.log_audit_event()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  v_row record;","v_reason text;","begin\n  v_row := coalesce(new, old);","v_reason := coalesce(\n    to_jsonb(v_row) ->> 'void_reason',\n    to_jsonb(v_row) ->> 'reopen_reason',\n    to_jsonb(v_row) ->> 'override_reason',\n    to_jsonb(v_row) ->> 'reason'\n  );","insert into public.audit_logs (\n    organisation_id, branch_id, actor_id, actor_name, entity_table, entity_id, action, before_data, after_data, reason\n  ) values (\n    public.current_organisation_id(),\n    (to_jsonb(v_row) ->> 'branch_id')::uuid,\n    auth.uid(),\n    (select full_name from public.profiles where id = auth.uid()),\n    tg_table_name,\n    (to_jsonb(v_row) ->> 'id')::uuid,\n    lower(tg_op),\n    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,\n    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end,\n    v_reason\n  );","return v_row;",end;,$$;}	fix_audit_trigger_op_case
20260726180003	{"-- Bug fix, found while re-running seed.sql: log_audit_event() sourced\n-- organisation_id exclusively from current_organisation_id(), which reads\n-- auth.uid() — null for any connection that isn't an authenticated\n-- Supabase session (a seed script connected directly to Postgres, a future\n-- service-role batch job). That made every audited insert/update fail\n-- outside the web app, even though most audited tables (all but\n-- employee_pay_rates) already carry their own organisation_id column.\n--\n-- Fix: prefer the row's own organisation_id when the table has one, and\n-- only fall back to current_organisation_id() for tables that don't.\ncreate or replace function public.log_audit_event()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  v_row record;","v_reason text;","v_organisation_id uuid;","begin\n  v_row := coalesce(new, old);","v_reason := coalesce(\n    to_jsonb(v_row) ->> 'void_reason',\n    to_jsonb(v_row) ->> 'reopen_reason',\n    to_jsonb(v_row) ->> 'override_reason',\n    to_jsonb(v_row) ->> 'reason'\n  );","v_organisation_id := (to_jsonb(v_row) ->> 'organisation_id')::uuid;","if v_organisation_id is null then\n    v_organisation_id := public.current_organisation_id();","end if;","insert into public.audit_logs (\n    organisation_id, branch_id, actor_id, actor_name, entity_table, entity_id, action, before_data, after_data, reason\n  ) values (\n    v_organisation_id,\n    (to_jsonb(v_row) ->> 'branch_id')::uuid,\n    auth.uid(),\n    (select full_name from public.profiles where id = auth.uid()),\n    tg_table_name,\n    (to_jsonb(v_row) ->> 'id')::uuid,\n    lower(tg_op),\n    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,\n    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end,\n    v_reason\n  );","return v_row;",end;,$$;}	fix_audit_organisation_id_source
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 70, true);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: supabase_realtime_admin
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (organisation_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: bundle_components bundle_components_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bundle_components
    ADD CONSTRAINT bundle_components_pkey PRIMARY KEY (id);


--
-- Name: cash_flow_adjustments cash_flow_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_flow_adjustments
    ADD CONSTRAINT cash_flow_adjustments_pkey PRIMARY KEY (id);


--
-- Name: cash_reconciliations cash_reconciliations_branch_id_business_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_reconciliations
    ADD CONSTRAINT cash_reconciliations_branch_id_business_date_key UNIQUE (branch_id, business_date);


--
-- Name: cash_reconciliations cash_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_reconciliations
    ADD CONSTRAINT cash_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (code);


--
-- Name: daily_payment_totals daily_payment_totals_daily_sales_header_id_payment_method_i_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_payment_totals
    ADD CONSTRAINT daily_payment_totals_daily_sales_header_id_payment_method_i_key UNIQUE (daily_sales_header_id, payment_method_id);


--
-- Name: daily_payment_totals daily_payment_totals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_payment_totals
    ADD CONSTRAINT daily_payment_totals_pkey PRIMARY KEY (id);


--
-- Name: daily_sales_headers daily_sales_headers_branch_id_business_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_headers
    ADD CONSTRAINT daily_sales_headers_branch_id_business_date_key UNIQUE (branch_id, business_date);


--
-- Name: daily_sales_headers daily_sales_headers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_headers
    ADD CONSTRAINT daily_sales_headers_pkey PRIMARY KEY (id);


--
-- Name: daily_sales_lines daily_sales_lines_daily_sales_header_id_product_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_lines
    ADD CONSTRAINT daily_sales_lines_daily_sales_header_id_product_variant_id_key UNIQUE (daily_sales_header_id, product_variant_id);


--
-- Name: daily_sales_lines daily_sales_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_lines
    ADD CONSTRAINT daily_sales_lines_pkey PRIMARY KEY (id);


--
-- Name: employee_pay_rates employee_pay_rates_employee_id_daterange_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_pay_rates
    ADD CONSTRAINT employee_pay_rates_employee_id_daterange_excl EXCLUDE USING gist (employee_id WITH =, daterange(effective_from, effective_to, '[]'::text) WITH &&);


--
-- Name: employee_pay_rates employee_pay_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_pay_rates
    ADD CONSTRAINT employee_pay_rates_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_organisation_id_from_currency_to_currency_d_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_organisation_id_from_currency_to_currency_d_excl EXCLUDE USING gist (organisation_id WITH =, from_currency WITH =, to_currency WITH =, daterange(effective_from, effective_to, '[]'::text) WITH &&);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expense_transactions expense_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_transactions
    ADD CONSTRAINT expense_transactions_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_ledger inventory_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_pkey PRIMARY KEY (id);


--
-- Name: kpi_targets kpi_targets_organisation_id_coalesce_daterange_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_targets
    ADD CONSTRAINT kpi_targets_organisation_id_coalesce_daterange_excl EXCLUDE USING gist (organisation_id WITH =, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, daterange(effective_from, effective_to, '[]'::text) WITH &&);


--
-- Name: kpi_targets kpi_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_targets
    ADD CONSTRAINT kpi_targets_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: organisations organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: product_prices product_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_pkey PRIMARY KEY (id);


--
-- Name: product_prices product_prices_product_variant_id_branch_id_daterange_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_product_variant_id_branch_id_daterange_excl EXCLUDE USING gist (product_variant_id WITH =, branch_id WITH =, daterange(effective_from, effective_to, '[]'::text) WITH &&);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: purchase_attachments purchase_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_attachments
    ADD CONSTRAINT purchase_attachments_pkey PRIMARY KEY (id);


--
-- Name: purchase_headers purchase_headers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_headers
    ADD CONSTRAINT purchase_headers_pkey PRIMARY KEY (id);


--
-- Name: purchase_lines purchase_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_lines
    ADD CONSTRAINT purchase_lines_pkey PRIMARY KEY (id);


--
-- Name: recipe_lines recipe_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_lines
    ADD CONSTRAINT recipe_lines_pkey PRIMARY KEY (id);


--
-- Name: recipe_lines recipe_lines_recipe_version_id_inventory_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_lines
    ADD CONSTRAINT recipe_lines_recipe_version_id_inventory_item_id_key UNIQUE (recipe_version_id, inventory_item_id);


--
-- Name: recipe_versions recipe_versions_item_daterange_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_versions
    ADD CONSTRAINT recipe_versions_item_daterange_excl EXCLUDE USING gist (inventory_item_id WITH =, daterange(effective_from, effective_to, '[]'::text) WITH &&) WHERE (((status = 'published'::text) AND (inventory_item_id IS NOT NULL)));


--
-- Name: recipe_versions recipe_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_versions
    ADD CONSTRAINT recipe_versions_pkey PRIMARY KEY (id);


--
-- Name: recipe_versions recipe_versions_variant_daterange_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_versions
    ADD CONSTRAINT recipe_versions_variant_daterange_excl EXCLUDE USING gist (product_variant_id WITH =, daterange(effective_from, effective_to, '[]'::text) WITH &&) WHERE (((status = 'published'::text) AND (product_variant_id IS NOT NULL)));


--
-- Name: recurring_expense_templates recurring_expense_templates_organisation_id_expense_catego_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_expense_templates
    ADD CONSTRAINT recurring_expense_templates_organisation_id_expense_catego_excl EXCLUDE USING gist (organisation_id WITH =, expense_category_id WITH =, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, daterange(effective_from, effective_to, '[]'::text) WITH &&);


--
-- Name: recurring_expense_templates recurring_expense_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_expense_templates
    ADD CONSTRAINT recurring_expense_templates_pkey PRIMARY KEY (id);


--
-- Name: roles roles_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_key_key UNIQUE (key);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: shift_entries shift_entries_employee_id_work_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_entries
    ADD CONSTRAINT shift_entries_employee_id_work_date_key UNIQUE (employee_id, work_date);


--
-- Name: shift_entries shift_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_entries
    ADD CONSTRAINT shift_entries_pkey PRIMARY KEY (id);


--
-- Name: stock_count_headers stock_count_headers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_headers
    ADD CONSTRAINT stock_count_headers_pkey PRIMARY KEY (id);


--
-- Name: stock_count_lines stock_count_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_lines
    ADD CONSTRAINT stock_count_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_count_lines stock_count_lines_stock_count_header_id_inventory_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_lines
    ADD CONSTRAINT stock_count_lines_stock_count_header_id_inventory_item_id_key UNIQUE (stock_count_header_id, inventory_item_id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tax_categories tax_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_categories
    ADD CONSTRAINT tax_categories_pkey PRIMARY KEY (id);


--
-- Name: unit_conversions unit_conversions_from_unit_id_to_unit_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_conversions
    ADD CONSTRAINT unit_conversions_from_unit_id_to_unit_id_key UNIQUE (from_unit_id, to_unit_id);


--
-- Name: unit_conversions unit_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_conversions
    ADD CONSTRAINT unit_conversions_pkey PRIMARY KEY (id);


--
-- Name: units_of_measure units_of_measure_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units_of_measure
    ADD CONSTRAINT units_of_measure_code_key UNIQUE (code);


--
-- Name: units_of_measure units_of_measure_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units_of_measure
    ADD CONSTRAINT units_of_measure_pkey PRIMARY KEY (id);


--
-- Name: user_branch_roles user_branch_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_branch_roles
    ADD CONSTRAINT user_branch_roles_pkey PRIMARY KEY (id);


--
-- Name: waste_reasons waste_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waste_reasons
    ADD CONSTRAINT waste_reasons_pkey PRIMARY KEY (id);


--
-- Name: waste_records waste_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_pkey PRIMARY KEY (id);


--
-- Name: messages messages_payload_exclusive; Type: CHECK CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages
    ADD CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL))) NOT VALID;


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_users_email ON auth.users USING btree (email);


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text))) WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: audit_logs_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity_table, entity_id);


--
-- Name: audit_logs_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_organisation_id_idx ON public.audit_logs USING btree (organisation_id, created_at DESC);


--
-- Name: branches_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branches_organisation_id_idx ON public.branches USING btree (organisation_id);


--
-- Name: bundle_components_bundle_variant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bundle_components_bundle_variant_id_idx ON public.bundle_components USING btree (bundle_variant_id);


--
-- Name: cash_flow_adjustments_branch_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_flow_adjustments_branch_date_idx ON public.cash_flow_adjustments USING btree (branch_id, adjustment_date);


--
-- Name: cash_flow_adjustments_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_flow_adjustments_organisation_id_idx ON public.cash_flow_adjustments USING btree (organisation_id);


--
-- Name: cash_reconciliations_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_reconciliations_organisation_id_idx ON public.cash_reconciliations USING btree (organisation_id);


--
-- Name: daily_payment_totals_header_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_payment_totals_header_id_idx ON public.daily_payment_totals USING btree (daily_sales_header_id);


--
-- Name: daily_sales_headers_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_sales_headers_organisation_id_idx ON public.daily_sales_headers USING btree (organisation_id);


--
-- Name: daily_sales_lines_header_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_sales_lines_header_id_idx ON public.daily_sales_lines USING btree (daily_sales_header_id);


--
-- Name: employee_pay_rates_employee_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employee_pay_rates_employee_id_idx ON public.employee_pay_rates USING btree (employee_id);


--
-- Name: employees_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employees_organisation_id_idx ON public.employees USING btree (organisation_id);


--
-- Name: expense_transactions_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX expense_transactions_organisation_id_idx ON public.expense_transactions USING btree (organisation_id);


--
-- Name: inventory_items_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_items_organisation_id_idx ON public.inventory_items USING btree (organisation_id);


--
-- Name: inventory_ledger_business_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_ledger_business_date_idx ON public.inventory_ledger USING btree (business_date);


--
-- Name: inventory_ledger_item_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_ledger_item_branch_idx ON public.inventory_ledger USING btree (inventory_item_id, branch_id);


--
-- Name: inventory_ledger_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_ledger_source_idx ON public.inventory_ledger USING btree (source_type, source_id);


--
-- Name: product_prices_variant_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_prices_variant_branch_idx ON public.product_prices USING btree (product_variant_id, branch_id);


--
-- Name: product_variants_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_variants_product_id_idx ON public.product_variants USING btree (product_id);


--
-- Name: products_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_organisation_id_idx ON public.products USING btree (organisation_id);


--
-- Name: profiles_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX profiles_organisation_id_idx ON public.profiles USING btree (organisation_id);


--
-- Name: purchase_attachments_purchase_header_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_attachments_purchase_header_id_idx ON public.purchase_attachments USING btree (purchase_header_id);


--
-- Name: purchase_headers_branch_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_headers_branch_id_idx ON public.purchase_headers USING btree (branch_id);


--
-- Name: purchase_headers_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_headers_organisation_id_idx ON public.purchase_headers USING btree (organisation_id);


--
-- Name: purchase_lines_purchase_header_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_lines_purchase_header_id_idx ON public.purchase_lines USING btree (purchase_header_id);


--
-- Name: recipe_lines_recipe_version_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recipe_lines_recipe_version_id_idx ON public.recipe_lines USING btree (recipe_version_id);


--
-- Name: recipe_versions_item_version_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX recipe_versions_item_version_uidx ON public.recipe_versions USING btree (inventory_item_id, version_number) WHERE (inventory_item_id IS NOT NULL);


--
-- Name: recipe_versions_product_variant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recipe_versions_product_variant_id_idx ON public.recipe_versions USING btree (product_variant_id);


--
-- Name: recipe_versions_variant_version_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX recipe_versions_variant_version_uidx ON public.recipe_versions USING btree (product_variant_id, version_number) WHERE (product_variant_id IS NOT NULL);


--
-- Name: recurring_expense_templates_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recurring_expense_templates_organisation_id_idx ON public.recurring_expense_templates USING btree (organisation_id);


--
-- Name: shift_entries_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shift_entries_organisation_id_idx ON public.shift_entries USING btree (organisation_id);


--
-- Name: stock_count_headers_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_count_headers_organisation_id_idx ON public.stock_count_headers USING btree (organisation_id);


--
-- Name: stock_count_lines_header_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_count_lines_header_id_idx ON public.stock_count_lines USING btree (stock_count_header_id);


--
-- Name: suppliers_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX suppliers_organisation_id_idx ON public.suppliers USING btree (organisation_id);


--
-- Name: user_branch_roles_branch_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_branch_roles_branch_id_idx ON public.user_branch_roles USING btree (branch_id);


--
-- Name: user_branch_roles_profile_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_branch_roles_profile_id_idx ON public.user_branch_roles USING btree (profile_id);


--
-- Name: user_branch_roles_unique_grant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_branch_roles_unique_grant ON public.user_branch_roles USING btree (profile_id, organisation_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), role_id);


--
-- Name: waste_records_organisation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX waste_records_organisation_id_idx ON public.waste_records USING btree (organisation_id);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_selec; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_selec ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter, COALESCE(selected_columns, '{}'::text[]));


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


--
-- Name: cash_reconciliations audit_cash_reconciliations; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_cash_reconciliations AFTER INSERT OR UPDATE ON public.cash_reconciliations FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: daily_sales_headers audit_daily_sales_headers; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_daily_sales_headers AFTER INSERT OR UPDATE ON public.daily_sales_headers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: employee_pay_rates audit_employee_pay_rates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_employee_pay_rates AFTER INSERT ON public.employee_pay_rates FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: expense_transactions audit_expense_transactions; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_expense_transactions AFTER INSERT OR UPDATE ON public.expense_transactions FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: product_prices audit_product_prices; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_product_prices AFTER INSERT ON public.product_prices FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: purchase_headers audit_purchase_headers; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_purchase_headers AFTER INSERT OR UPDATE ON public.purchase_headers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: recipe_versions audit_recipe_versions; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_recipe_versions AFTER INSERT OR UPDATE ON public.recipe_versions FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: recurring_expense_templates audit_recurring_expense_templates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_recurring_expense_templates AFTER INSERT OR UPDATE ON public.recurring_expense_templates FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: stock_count_headers audit_stock_count_headers; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_stock_count_headers AFTER INSERT OR UPDATE ON public.stock_count_headers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: waste_records audit_waste_records; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_waste_records AFTER INSERT ON public.waste_records FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: app_settings app_settings_base_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_base_currency_fkey FOREIGN KEY (base_currency) REFERENCES public.currencies(code);


--
-- Name: app_settings app_settings_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: branches branches_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: bundle_components bundle_components_bundle_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bundle_components
    ADD CONSTRAINT bundle_components_bundle_variant_id_fkey FOREIGN KEY (bundle_variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: bundle_components bundle_components_component_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bundle_components
    ADD CONSTRAINT bundle_components_component_inventory_item_id_fkey FOREIGN KEY (component_inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: bundle_components bundle_components_component_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bundle_components
    ADD CONSTRAINT bundle_components_component_product_variant_id_fkey FOREIGN KEY (component_product_variant_id) REFERENCES public.product_variants(id);


--
-- Name: cash_flow_adjustments cash_flow_adjustments_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_flow_adjustments
    ADD CONSTRAINT cash_flow_adjustments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: cash_flow_adjustments cash_flow_adjustments_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_flow_adjustments
    ADD CONSTRAINT cash_flow_adjustments_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: cash_reconciliations cash_reconciliations_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_reconciliations
    ADD CONSTRAINT cash_reconciliations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: cash_reconciliations cash_reconciliations_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_reconciliations
    ADD CONSTRAINT cash_reconciliations_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: daily_payment_totals daily_payment_totals_daily_sales_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_payment_totals
    ADD CONSTRAINT daily_payment_totals_daily_sales_header_id_fkey FOREIGN KEY (daily_sales_header_id) REFERENCES public.daily_sales_headers(id) ON DELETE CASCADE;


--
-- Name: daily_payment_totals daily_payment_totals_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_payment_totals
    ADD CONSTRAINT daily_payment_totals_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- Name: daily_sales_headers daily_sales_headers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_headers
    ADD CONSTRAINT daily_sales_headers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: daily_sales_headers daily_sales_headers_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_headers
    ADD CONSTRAINT daily_sales_headers_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: daily_sales_lines daily_sales_lines_daily_sales_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_lines
    ADD CONSTRAINT daily_sales_lines_daily_sales_header_id_fkey FOREIGN KEY (daily_sales_header_id) REFERENCES public.daily_sales_headers(id) ON DELETE CASCADE;


--
-- Name: daily_sales_lines daily_sales_lines_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_lines
    ADD CONSTRAINT daily_sales_lines_product_variant_id_fkey FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(id);


--
-- Name: employee_pay_rates employee_pay_rates_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_pay_rates
    ADD CONSTRAINT employee_pay_rates_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(code);


--
-- Name: employee_pay_rates employee_pay_rates_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_pay_rates
    ADD CONSTRAINT employee_pay_rates_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: employees employees_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: exchange_rates exchange_rates_from_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_from_currency_fkey FOREIGN KEY (from_currency) REFERENCES public.currencies(code);


--
-- Name: exchange_rates exchange_rates_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: exchange_rates exchange_rates_to_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_to_currency_fkey FOREIGN KEY (to_currency) REFERENCES public.currencies(code);


--
-- Name: expense_categories expense_categories_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: expense_transactions expense_transactions_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_transactions
    ADD CONSTRAINT expense_transactions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: expense_transactions expense_transactions_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_transactions
    ADD CONSTRAINT expense_transactions_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(code);


--
-- Name: expense_transactions expense_transactions_expense_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_transactions
    ADD CONSTRAINT expense_transactions_expense_category_id_fkey FOREIGN KEY (expense_category_id) REFERENCES public.expense_categories(id);


--
-- Name: expense_transactions expense_transactions_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_transactions
    ADD CONSTRAINT expense_transactions_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_base_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_base_unit_id_fkey FOREIGN KEY (base_unit_id) REFERENCES public.units_of_measure(id);


--
-- Name: inventory_items inventory_items_default_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_default_supplier_id_fkey FOREIGN KEY (default_supplier_id) REFERENCES public.suppliers(id);


--
-- Name: inventory_items inventory_items_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_purchase_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_purchase_unit_id_fkey FOREIGN KEY (purchase_unit_id) REFERENCES public.units_of_measure(id);


--
-- Name: inventory_items inventory_items_tax_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_tax_category_id_fkey FOREIGN KEY (tax_category_id) REFERENCES public.tax_categories(id);


--
-- Name: inventory_ledger inventory_ledger_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: inventory_ledger inventory_ledger_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: inventory_ledger inventory_ledger_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: kpi_targets kpi_targets_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_targets
    ADD CONSTRAINT kpi_targets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: kpi_targets kpi_targets_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_targets
    ADD CONSTRAINT kpi_targets_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: menu_categories menu_categories_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: product_prices product_prices_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: product_prices product_prices_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(code);


--
-- Name: product_prices product_prices_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: product_prices product_prices_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_product_variant_id_fkey FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_menu_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_menu_category_id_fkey FOREIGN KEY (menu_category_id) REFERENCES public.menu_categories(id);


--
-- Name: products products_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: products products_tax_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tax_category_id_fkey FOREIGN KEY (tax_category_id) REFERENCES public.tax_categories(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE RESTRICT;


--
-- Name: purchase_attachments purchase_attachments_purchase_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_attachments
    ADD CONSTRAINT purchase_attachments_purchase_header_id_fkey FOREIGN KEY (purchase_header_id) REFERENCES public.purchase_headers(id) ON DELETE CASCADE;


--
-- Name: purchase_headers purchase_headers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_headers
    ADD CONSTRAINT purchase_headers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: purchase_headers purchase_headers_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_headers
    ADD CONSTRAINT purchase_headers_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(code);


--
-- Name: purchase_headers purchase_headers_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_headers
    ADD CONSTRAINT purchase_headers_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: purchase_headers purchase_headers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_headers
    ADD CONSTRAINT purchase_headers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_lines purchase_lines_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_lines
    ADD CONSTRAINT purchase_lines_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: purchase_lines purchase_lines_purchase_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_lines
    ADD CONSTRAINT purchase_lines_purchase_header_id_fkey FOREIGN KEY (purchase_header_id) REFERENCES public.purchase_headers(id) ON DELETE CASCADE;


--
-- Name: recipe_lines recipe_lines_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_lines
    ADD CONSTRAINT recipe_lines_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: recipe_lines recipe_lines_recipe_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_lines
    ADD CONSTRAINT recipe_lines_recipe_version_id_fkey FOREIGN KEY (recipe_version_id) REFERENCES public.recipe_versions(id) ON DELETE CASCADE;


--
-- Name: recipe_versions recipe_versions_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_versions
    ADD CONSTRAINT recipe_versions_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: recipe_versions recipe_versions_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_versions
    ADD CONSTRAINT recipe_versions_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: recipe_versions recipe_versions_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_versions
    ADD CONSTRAINT recipe_versions_product_variant_id_fkey FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: recurring_expense_templates recurring_expense_templates_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_expense_templates
    ADD CONSTRAINT recurring_expense_templates_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: recurring_expense_templates recurring_expense_templates_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_expense_templates
    ADD CONSTRAINT recurring_expense_templates_currency_fkey FOREIGN KEY (currency) REFERENCES public.currencies(code);


--
-- Name: recurring_expense_templates recurring_expense_templates_expense_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_expense_templates
    ADD CONSTRAINT recurring_expense_templates_expense_category_id_fkey FOREIGN KEY (expense_category_id) REFERENCES public.expense_categories(id);


--
-- Name: recurring_expense_templates recurring_expense_templates_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_expense_templates
    ADD CONSTRAINT recurring_expense_templates_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: shift_entries shift_entries_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_entries
    ADD CONSTRAINT shift_entries_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: shift_entries shift_entries_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_entries
    ADD CONSTRAINT shift_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: shift_entries shift_entries_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_entries
    ADD CONSTRAINT shift_entries_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: stock_count_headers stock_count_headers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_headers
    ADD CONSTRAINT stock_count_headers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: stock_count_headers stock_count_headers_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_headers
    ADD CONSTRAINT stock_count_headers_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: stock_count_lines stock_count_lines_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_lines
    ADD CONSTRAINT stock_count_lines_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: stock_count_lines stock_count_lines_stock_count_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_count_lines
    ADD CONSTRAINT stock_count_lines_stock_count_header_id_fkey FOREIGN KEY (stock_count_header_id) REFERENCES public.stock_count_headers(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: tax_categories tax_categories_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_categories
    ADD CONSTRAINT tax_categories_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: unit_conversions unit_conversions_from_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_conversions
    ADD CONSTRAINT unit_conversions_from_unit_id_fkey FOREIGN KEY (from_unit_id) REFERENCES public.units_of_measure(id);


--
-- Name: unit_conversions unit_conversions_to_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_conversions
    ADD CONSTRAINT unit_conversions_to_unit_id_fkey FOREIGN KEY (to_unit_id) REFERENCES public.units_of_measure(id);


--
-- Name: user_branch_roles user_branch_roles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_branch_roles
    ADD CONSTRAINT user_branch_roles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: user_branch_roles user_branch_roles_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_branch_roles
    ADD CONSTRAINT user_branch_roles_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: user_branch_roles user_branch_roles_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_branch_roles
    ADD CONSTRAINT user_branch_roles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_branch_roles user_branch_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_branch_roles
    ADD CONSTRAINT user_branch_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: waste_reasons waste_reasons_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waste_reasons
    ADD CONSTRAINT waste_reasons_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: waste_records waste_records_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: waste_records waste_records_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: waste_records waste_records_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: waste_records waste_records_waste_reason_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waste_records
    ADD CONSTRAINT waste_records_waste_reason_id_fkey FOREIGN KEY (waste_reason_id) REFERENCES public.waste_reasons(id);


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings app_settings_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_settings_select ON public.app_settings FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: app_settings app_settings_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_settings_update_owner ON public.app_settings FOR UPDATE TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: app_settings app_settings_upsert_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_settings_upsert_owner ON public.app_settings FOR INSERT TO authenticated WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'finance'::text])));


--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: branches branches_insert_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY branches_insert_owner ON public.branches FOR INSERT TO authenticated WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: branches branches_select_accessible; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY branches_select_accessible ON public.branches FOR SELECT TO authenticated USING ((id IN ( SELECT public.current_user_accessible_branch_ids() AS current_user_accessible_branch_ids)));


--
-- Name: branches branches_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY branches_update_owner ON public.branches FOR UPDATE TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: bundle_components; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bundle_components ENABLE ROW LEVEL SECURITY;

--
-- Name: bundle_components bundle_components_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bundle_components_select ON public.bundle_components FOR SELECT TO authenticated USING ((bundle_variant_id IN ( SELECT pv.id
   FROM (public.product_variants pv
     JOIN public.products p ON ((p.id = pv.product_id)))
  WHERE (p.organisation_id = public.current_organisation_id()))));


--
-- Name: bundle_components bundle_components_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bundle_components_write ON public.bundle_components TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]) AND (bundle_variant_id IN ( SELECT pv.id
   FROM (public.product_variants pv
     JOIN public.products p ON ((p.id = pv.product_id)))
  WHERE (p.organisation_id = public.current_organisation_id()))))) WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]) AND (bundle_variant_id IN ( SELECT pv.id
   FROM (public.product_variants pv
     JOIN public.products p ON ((p.id = pv.product_id)))
  WHERE (p.organisation_id = public.current_organisation_id())))));


--
-- Name: cash_flow_adjustments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cash_flow_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_flow_adjustments cash_flow_adjustments_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cash_flow_adjustments_select ON public.cash_flow_adjustments FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: cash_flow_adjustments cash_flow_adjustments_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cash_flow_adjustments_write ON public.cash_flow_adjustments TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'finance'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'finance'::text])));


--
-- Name: cash_reconciliations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_reconciliations cash_reconciliations_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cash_reconciliations_select ON public.cash_reconciliations FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: cash_reconciliations cash_reconciliations_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cash_reconciliations_write ON public.cash_reconciliations TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'cashier'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'cashier'::text])));


--
-- Name: currencies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

--
-- Name: currencies currencies_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY currencies_select ON public.currencies FOR SELECT TO authenticated USING (true);


--
-- Name: daily_payment_totals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_payment_totals ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_payment_totals daily_payment_totals_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_payment_totals_select ON public.daily_payment_totals FOR SELECT TO authenticated USING ((daily_sales_header_id IN ( SELECT daily_sales_headers.id
   FROM public.daily_sales_headers
  WHERE (daily_sales_headers.organisation_id = public.current_organisation_id()))));


--
-- Name: daily_payment_totals daily_payment_totals_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_payment_totals_write ON public.daily_payment_totals TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'cashier'::text]) AND (daily_sales_header_id IN ( SELECT daily_sales_headers.id
   FROM public.daily_sales_headers
  WHERE (daily_sales_headers.organisation_id = public.current_organisation_id()))))) WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'cashier'::text]) AND (daily_sales_header_id IN ( SELECT daily_sales_headers.id
   FROM public.daily_sales_headers
  WHERE (daily_sales_headers.organisation_id = public.current_organisation_id())))));


--
-- Name: daily_sales_headers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_sales_headers ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_sales_headers daily_sales_headers_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_sales_headers_select ON public.daily_sales_headers FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: daily_sales_headers daily_sales_headers_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_sales_headers_write ON public.daily_sales_headers TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'cashier'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'cashier'::text])));


--
-- Name: daily_sales_lines; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_sales_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_sales_lines daily_sales_lines_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_sales_lines_select ON public.daily_sales_lines FOR SELECT TO authenticated USING ((daily_sales_header_id IN ( SELECT daily_sales_headers.id
   FROM public.daily_sales_headers
  WHERE (daily_sales_headers.organisation_id = public.current_organisation_id()))));


--
-- Name: daily_sales_lines daily_sales_lines_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_sales_lines_write ON public.daily_sales_lines TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'cashier'::text]) AND (daily_sales_header_id IN ( SELECT daily_sales_headers.id
   FROM public.daily_sales_headers
  WHERE (daily_sales_headers.organisation_id = public.current_organisation_id()))))) WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'cashier'::text]) AND (daily_sales_header_id IN ( SELECT daily_sales_headers.id
   FROM public.daily_sales_headers
  WHERE (daily_sales_headers.organisation_id = public.current_organisation_id())))));


--
-- Name: employee_pay_rates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employee_pay_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_pay_rates employee_pay_rates_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_pay_rates_select ON public.employee_pay_rates FOR SELECT TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'finance'::text]) AND (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.organisation_id = public.current_organisation_id())))));


--
-- Name: employee_pay_rates employee_pay_rates_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employee_pay_rates_write ON public.employee_pay_rates TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]) AND (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.organisation_id = public.current_organisation_id()))))) WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]) AND (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.organisation_id = public.current_organisation_id())))));


--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: employees employees_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employees_select ON public.employees FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: employees employees_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY employees_write ON public.employees TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text])));


--
-- Name: exchange_rates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_rates exchange_rates_delete_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY exchange_rates_delete_owner ON public.exchange_rates FOR DELETE TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: exchange_rates exchange_rates_insert_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY exchange_rates_insert_owner ON public.exchange_rates FOR INSERT TO authenticated WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: exchange_rates exchange_rates_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY exchange_rates_select ON public.exchange_rates FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: exchange_rates exchange_rates_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY exchange_rates_update_owner ON public.exchange_rates FOR UPDATE TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: expense_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_categories expense_categories_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY expense_categories_select ON public.expense_categories FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: expense_categories expense_categories_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY expense_categories_write ON public.expense_categories TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'finance'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'finance'::text])));


--
-- Name: expense_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_transactions expense_transactions_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY expense_transactions_select ON public.expense_transactions FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: expense_transactions expense_transactions_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY expense_transactions_write ON public.expense_transactions TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'finance'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'finance'::text])));


--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items inventory_items_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inventory_items_select ON public.inventory_items FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: inventory_items inventory_items_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inventory_items_write ON public.inventory_items TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text])));


--
-- Name: inventory_ledger; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_ledger inventory_ledger_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inventory_ledger_insert ON public.inventory_ledger FOR INSERT TO authenticated WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text])));


--
-- Name: inventory_ledger inventory_ledger_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inventory_ledger_select ON public.inventory_ledger FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: kpi_targets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_targets kpi_targets_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kpi_targets_select ON public.kpi_targets FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: kpi_targets kpi_targets_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kpi_targets_write ON public.kpi_targets TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: menu_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_categories menu_categories_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY menu_categories_select ON public.menu_categories FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: menu_categories menu_categories_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY menu_categories_write ON public.menu_categories TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text])));


--
-- Name: organisations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

--
-- Name: organisations organisations_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY organisations_select_own ON public.organisations FOR SELECT TO authenticated USING ((id = public.current_organisation_id()));


--
-- Name: organisations organisations_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY organisations_update_owner ON public.organisations FOR UPDATE TO authenticated USING (((id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text]))) WITH CHECK (((id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods payment_methods_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payment_methods_select ON public.payment_methods FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: payment_methods payment_methods_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payment_methods_write ON public.payment_methods TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text])));


--
-- Name: product_prices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: product_prices product_prices_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY product_prices_select ON public.product_prices FOR SELECT TO authenticated USING ((branch_id IN ( SELECT public.current_user_accessible_branch_ids() AS current_user_accessible_branch_ids)));


--
-- Name: product_prices product_prices_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY product_prices_write ON public.product_prices TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text], branch_id) AND (branch_id IN ( SELECT public.current_user_accessible_branch_ids() AS current_user_accessible_branch_ids)))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text], branch_id) AND (branch_id IN ( SELECT public.current_user_accessible_branch_ids() AS current_user_accessible_branch_ids))));


--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants product_variants_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY product_variants_select ON public.product_variants FOR SELECT TO authenticated USING ((product_id IN ( SELECT products.id
   FROM public.products
  WHERE (products.organisation_id = public.current_organisation_id()))));


--
-- Name: product_variants product_variants_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY product_variants_write ON public.product_variants TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]) AND (product_id IN ( SELECT products.id
   FROM public.products
  WHERE (products.organisation_id = public.current_organisation_id()))))) WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]) AND (product_id IN ( SELECT products.id
   FROM public.products
  WHERE (products.organisation_id = public.current_organisation_id())))));


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: products products_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY products_write ON public.products TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text])));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_owner ON public.profiles FOR SELECT TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: profiles profiles_select_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_self ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles profiles_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update_owner ON public.profiles FOR UPDATE TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: profiles profiles_update_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: purchase_attachments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_attachments purchase_attachments_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_attachments_delete ON public.purchase_attachments FOR DELETE TO authenticated USING (((purchase_header_id IN ( SELECT purchase_headers.id
   FROM public.purchase_headers
  WHERE (purchase_headers.organisation_id = public.current_organisation_id()))) AND ((uploaded_by = auth.uid()) OR public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]))));


--
-- Name: purchase_attachments purchase_attachments_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_attachments_insert ON public.purchase_attachments FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text, 'cashier'::text]) AND (purchase_header_id IN ( SELECT purchase_headers.id
   FROM public.purchase_headers
  WHERE (purchase_headers.organisation_id = public.current_organisation_id())))));


--
-- Name: purchase_attachments purchase_attachments_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_attachments_select ON public.purchase_attachments FOR SELECT TO authenticated USING ((purchase_header_id IN ( SELECT purchase_headers.id
   FROM public.purchase_headers
  WHERE (purchase_headers.organisation_id = public.current_organisation_id()))));


--
-- Name: purchase_headers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_headers ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_headers purchase_headers_insert_capture; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_headers_insert_capture ON public.purchase_headers FOR INSERT TO authenticated WITH CHECK (((organisation_id = public.current_organisation_id()) AND (status = 'draft'::text) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text, 'cashier'::text])));


--
-- Name: purchase_headers purchase_headers_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_headers_select ON public.purchase_headers FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: purchase_headers purchase_headers_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_headers_write ON public.purchase_headers TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text])));


--
-- Name: purchase_lines; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_lines purchase_lines_delete_capture; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_lines_delete_capture ON public.purchase_lines FOR DELETE TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text, 'cashier'::text]) AND (purchase_header_id IN ( SELECT purchase_headers.id
   FROM public.purchase_headers
  WHERE ((purchase_headers.organisation_id = public.current_organisation_id()) AND (purchase_headers.status = 'draft'::text))))));


--
-- Name: purchase_lines purchase_lines_insert_capture; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_lines_insert_capture ON public.purchase_lines FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text, 'cashier'::text]) AND (purchase_header_id IN ( SELECT purchase_headers.id
   FROM public.purchase_headers
  WHERE ((purchase_headers.organisation_id = public.current_organisation_id()) AND (purchase_headers.status = 'draft'::text))))));


--
-- Name: purchase_lines purchase_lines_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_lines_select ON public.purchase_lines FOR SELECT TO authenticated USING ((purchase_header_id IN ( SELECT purchase_headers.id
   FROM public.purchase_headers
  WHERE (purchase_headers.organisation_id = public.current_organisation_id()))));


--
-- Name: purchase_lines purchase_lines_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY purchase_lines_write ON public.purchase_lines TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]) AND (purchase_header_id IN ( SELECT purchase_headers.id
   FROM public.purchase_headers
  WHERE (purchase_headers.organisation_id = public.current_organisation_id()))))) WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]) AND (purchase_header_id IN ( SELECT purchase_headers.id
   FROM public.purchase_headers
  WHERE (purchase_headers.organisation_id = public.current_organisation_id())))));


--
-- Name: recipe_lines; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.recipe_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_lines recipe_lines_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recipe_lines_select ON public.recipe_lines FOR SELECT TO authenticated USING ((recipe_version_id IN ( SELECT recipe_versions.id
   FROM public.recipe_versions
  WHERE (recipe_versions.organisation_id = public.current_organisation_id()))));


--
-- Name: recipe_lines recipe_lines_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recipe_lines_write ON public.recipe_lines TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]) AND (recipe_version_id IN ( SELECT recipe_versions.id
   FROM public.recipe_versions
  WHERE (recipe_versions.organisation_id = public.current_organisation_id()))))) WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]) AND (recipe_version_id IN ( SELECT recipe_versions.id
   FROM public.recipe_versions
  WHERE (recipe_versions.organisation_id = public.current_organisation_id())))));


--
-- Name: recipe_versions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_versions recipe_versions_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recipe_versions_select ON public.recipe_versions FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: recipe_versions recipe_versions_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recipe_versions_write ON public.recipe_versions TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text])));


--
-- Name: recurring_expense_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.recurring_expense_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_expense_templates recurring_expense_templates_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recurring_expense_templates_select ON public.recurring_expense_templates FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: recurring_expense_templates recurring_expense_templates_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recurring_expense_templates_write ON public.recurring_expense_templates TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'finance'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'finance'::text])));


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: shift_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.shift_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_entries shift_entries_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shift_entries_select ON public.shift_entries FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: shift_entries shift_entries_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shift_entries_write ON public.shift_entries TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text])));


--
-- Name: stock_count_headers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_count_headers ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_count_headers stock_count_headers_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY stock_count_headers_select ON public.stock_count_headers FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: stock_count_headers stock_count_headers_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY stock_count_headers_write ON public.stock_count_headers TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text])));


--
-- Name: stock_count_lines; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_count_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_count_lines stock_count_lines_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY stock_count_lines_select ON public.stock_count_lines FOR SELECT TO authenticated USING ((stock_count_header_id IN ( SELECT stock_count_headers.id
   FROM public.stock_count_headers
  WHERE (stock_count_headers.organisation_id = public.current_organisation_id()))));


--
-- Name: stock_count_lines stock_count_lines_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY stock_count_lines_write ON public.stock_count_lines TO authenticated USING ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]) AND (stock_count_header_id IN ( SELECT stock_count_headers.id
   FROM public.stock_count_headers
  WHERE (stock_count_headers.organisation_id = public.current_organisation_id()))))) WITH CHECK ((public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]) AND (stock_count_header_id IN ( SELECT stock_count_headers.id
   FROM public.stock_count_headers
  WHERE (stock_count_headers.organisation_id = public.current_organisation_id())))));


--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: suppliers suppliers_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY suppliers_write ON public.suppliers TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text])));


--
-- Name: tax_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_categories tax_categories_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tax_categories_select ON public.tax_categories FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: tax_categories tax_categories_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tax_categories_write ON public.tax_categories TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'finance'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'finance'::text])));


--
-- Name: unit_conversions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_conversions unit_conversions_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY unit_conversions_select ON public.unit_conversions FOR SELECT TO authenticated USING (true);


--
-- Name: units_of_measure; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;

--
-- Name: units_of_measure units_of_measure_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY units_of_measure_select ON public.units_of_measure FOR SELECT TO authenticated USING (true);


--
-- Name: user_branch_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_branch_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_branch_roles user_branch_roles_delete_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_branch_roles_delete_owner ON public.user_branch_roles FOR DELETE TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: user_branch_roles user_branch_roles_insert_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_branch_roles_insert_owner ON public.user_branch_roles FOR INSERT TO authenticated WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: user_branch_roles user_branch_roles_select_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_branch_roles_select_owner ON public.user_branch_roles FOR SELECT TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: user_branch_roles user_branch_roles_select_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_branch_roles_select_self ON public.user_branch_roles FOR SELECT TO authenticated USING ((profile_id = auth.uid()));


--
-- Name: user_branch_roles user_branch_roles_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_branch_roles_update_owner ON public.user_branch_roles FOR UPDATE TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text])));


--
-- Name: waste_reasons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.waste_reasons ENABLE ROW LEVEL SECURITY;

--
-- Name: waste_reasons waste_reasons_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY waste_reasons_select ON public.waste_reasons FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: waste_reasons waste_reasons_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY waste_reasons_write ON public.waste_reasons TO authenticated USING (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text]))) WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text])));


--
-- Name: waste_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.waste_records ENABLE ROW LEVEL SECURITY;

--
-- Name: waste_records waste_records_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY waste_records_insert ON public.waste_records FOR INSERT TO authenticated WITH CHECK (((organisation_id = public.current_organisation_id()) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text])));


--
-- Name: waste_records waste_records_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY waste_records_select ON public.waste_records FOR SELECT TO authenticated USING ((organisation_id = public.current_organisation_id()));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: objects purchase_attachments_storage_delete; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY purchase_attachments_storage_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'purchase-attachments'::text) AND ((storage.foldername(name))[1] = (public.current_organisation_id())::text) AND ((owner = auth.uid()) OR public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text]))));


--
-- Name: objects purchase_attachments_storage_insert; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY purchase_attachments_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'purchase-attachments'::text) AND ((storage.foldername(name))[1] = (public.current_organisation_id())::text) AND public.current_user_has_role(ARRAY['owner'::text, 'branch_admin'::text, 'inventory_manager'::text, 'cashier'::text])));


--
-- Name: objects purchase_attachments_storage_select; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY purchase_attachments_storage_select ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'purchase-attachments'::text) AND ((storage.foldername(name))[1] = (public.current_organisation_id())::text)));


--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin WITH GRANT OPTION;
GRANT USAGE ON SCHEMA realtime TO authenticated;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION gbtreekey16_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey16_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey16_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey16_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey16_in(cstring) TO service_role;


--
-- Name: FUNCTION gbtreekey16_out(public.gbtreekey16); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey16_out(public.gbtreekey16) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey16_out(public.gbtreekey16) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey16_out(public.gbtreekey16) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey16_out(public.gbtreekey16) TO service_role;


--
-- Name: FUNCTION gbtreekey2_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey2_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey2_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey2_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey2_in(cstring) TO service_role;


--
-- Name: FUNCTION gbtreekey2_out(public.gbtreekey2); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey2_out(public.gbtreekey2) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey2_out(public.gbtreekey2) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey2_out(public.gbtreekey2) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey2_out(public.gbtreekey2) TO service_role;


--
-- Name: FUNCTION gbtreekey32_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey32_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey32_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey32_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey32_in(cstring) TO service_role;


--
-- Name: FUNCTION gbtreekey32_out(public.gbtreekey32); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey32_out(public.gbtreekey32) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey32_out(public.gbtreekey32) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey32_out(public.gbtreekey32) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey32_out(public.gbtreekey32) TO service_role;


--
-- Name: FUNCTION gbtreekey4_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey4_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey4_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey4_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey4_in(cstring) TO service_role;


--
-- Name: FUNCTION gbtreekey4_out(public.gbtreekey4); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey4_out(public.gbtreekey4) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey4_out(public.gbtreekey4) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey4_out(public.gbtreekey4) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey4_out(public.gbtreekey4) TO service_role;


--
-- Name: FUNCTION gbtreekey8_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey8_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey8_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey8_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey8_in(cstring) TO service_role;


--
-- Name: FUNCTION gbtreekey8_out(public.gbtreekey8); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey8_out(public.gbtreekey8) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey8_out(public.gbtreekey8) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey8_out(public.gbtreekey8) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey8_out(public.gbtreekey8) TO service_role;


--
-- Name: FUNCTION gbtreekey_var_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey_var_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey_var_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey_var_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey_var_in(cstring) TO service_role;


--
-- Name: FUNCTION gbtreekey_var_out(public.gbtreekey_var); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbtreekey_var_out(public.gbtreekey_var) TO postgres;
GRANT ALL ON FUNCTION public.gbtreekey_var_out(public.gbtreekey_var) TO anon;
GRANT ALL ON FUNCTION public.gbtreekey_var_out(public.gbtreekey_var) TO authenticated;
GRANT ALL ON FUNCTION public.gbtreekey_var_out(public.gbtreekey_var) TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: supabase_admin
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- Name: FUNCTION cash_dist(money, money); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.cash_dist(money, money) TO postgres;
GRANT ALL ON FUNCTION public.cash_dist(money, money) TO anon;
GRANT ALL ON FUNCTION public.cash_dist(money, money) TO authenticated;
GRANT ALL ON FUNCTION public.cash_dist(money, money) TO service_role;


--
-- Name: FUNCTION close_daily_sales(p_daily_sales_header_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.close_daily_sales(p_daily_sales_header_id uuid) TO anon;
GRANT ALL ON FUNCTION public.close_daily_sales(p_daily_sales_header_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.close_daily_sales(p_daily_sales_header_id uuid) TO service_role;


--
-- Name: FUNCTION current_organisation_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_organisation_id() TO anon;
GRANT ALL ON FUNCTION public.current_organisation_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_organisation_id() TO service_role;


--
-- Name: FUNCTION current_user_accessible_branch_ids(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_user_accessible_branch_ids() TO anon;
GRANT ALL ON FUNCTION public.current_user_accessible_branch_ids() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_accessible_branch_ids() TO service_role;


--
-- Name: FUNCTION current_user_has_role(p_role_keys text[], p_branch_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_user_has_role(p_role_keys text[], p_branch_id uuid) TO anon;
GRANT ALL ON FUNCTION public.current_user_has_role(p_role_keys text[], p_branch_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.current_user_has_role(p_role_keys text[], p_branch_id uuid) TO service_role;


--
-- Name: FUNCTION date_dist(date, date); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.date_dist(date, date) TO postgres;
GRANT ALL ON FUNCTION public.date_dist(date, date) TO anon;
GRANT ALL ON FUNCTION public.date_dist(date, date) TO authenticated;
GRANT ALL ON FUNCTION public.date_dist(date, date) TO service_role;


--
-- Name: FUNCTION float4_dist(real, real); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.float4_dist(real, real) TO postgres;
GRANT ALL ON FUNCTION public.float4_dist(real, real) TO anon;
GRANT ALL ON FUNCTION public.float4_dist(real, real) TO authenticated;
GRANT ALL ON FUNCTION public.float4_dist(real, real) TO service_role;


--
-- Name: FUNCTION float8_dist(double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.float8_dist(double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.float8_dist(double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.float8_dist(double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.float8_dist(double precision, double precision) TO service_role;


--
-- Name: FUNCTION gbt_bit_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bit_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bit_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bit_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bit_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_bit_consistent(internal, bit, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bit_consistent(internal, bit, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bit_consistent(internal, bit, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bit_consistent(internal, bit, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bit_consistent(internal, bit, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_bit_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bit_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bit_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bit_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bit_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_bit_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bit_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bit_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bit_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bit_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_bit_same(public.gbtreekey_var, public.gbtreekey_var, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bit_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bit_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bit_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bit_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO service_role;


--
-- Name: FUNCTION gbt_bit_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bit_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bit_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bit_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bit_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_bool_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bool_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bool_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bool_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bool_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_bool_consistent(internal, boolean, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bool_consistent(internal, boolean, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bool_consistent(internal, boolean, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bool_consistent(internal, boolean, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bool_consistent(internal, boolean, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_bool_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bool_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bool_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bool_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bool_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_bool_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bool_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bool_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bool_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bool_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_bool_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bool_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bool_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bool_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bool_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_bool_same(public.gbtreekey2, public.gbtreekey2, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bool_same(public.gbtreekey2, public.gbtreekey2, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bool_same(public.gbtreekey2, public.gbtreekey2, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bool_same(public.gbtreekey2, public.gbtreekey2, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bool_same(public.gbtreekey2, public.gbtreekey2, internal) TO service_role;


--
-- Name: FUNCTION gbt_bool_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bool_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bool_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bool_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bool_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_bpchar_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bpchar_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bpchar_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bpchar_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bpchar_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_bpchar_consistent(internal, character, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bpchar_consistent(internal, character, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bpchar_consistent(internal, character, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bpchar_consistent(internal, character, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bpchar_consistent(internal, character, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_bytea_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bytea_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bytea_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bytea_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bytea_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_bytea_consistent(internal, bytea, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bytea_consistent(internal, bytea, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bytea_consistent(internal, bytea, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bytea_consistent(internal, bytea, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bytea_consistent(internal, bytea, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_bytea_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bytea_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bytea_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bytea_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bytea_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_bytea_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bytea_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bytea_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bytea_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bytea_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_bytea_same(public.gbtreekey_var, public.gbtreekey_var, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bytea_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bytea_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bytea_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bytea_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO service_role;


--
-- Name: FUNCTION gbt_bytea_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_bytea_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_bytea_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_bytea_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_bytea_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_cash_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_cash_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_cash_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_cash_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_cash_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_cash_consistent(internal, money, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_cash_consistent(internal, money, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_cash_consistent(internal, money, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_cash_consistent(internal, money, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_cash_consistent(internal, money, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_cash_distance(internal, money, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_cash_distance(internal, money, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_cash_distance(internal, money, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_cash_distance(internal, money, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_cash_distance(internal, money, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_cash_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_cash_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_cash_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_cash_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_cash_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_cash_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_cash_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_cash_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_cash_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_cash_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_cash_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_cash_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_cash_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_cash_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_cash_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_cash_same(public.gbtreekey16, public.gbtreekey16, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_cash_same(public.gbtreekey16, public.gbtreekey16, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_cash_same(public.gbtreekey16, public.gbtreekey16, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_cash_same(public.gbtreekey16, public.gbtreekey16, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_cash_same(public.gbtreekey16, public.gbtreekey16, internal) TO service_role;


--
-- Name: FUNCTION gbt_cash_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_cash_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_cash_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_cash_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_cash_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_date_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_date_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_date_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_date_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_date_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_date_consistent(internal, date, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_date_consistent(internal, date, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_date_consistent(internal, date, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_date_consistent(internal, date, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_date_consistent(internal, date, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_date_distance(internal, date, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_date_distance(internal, date, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_date_distance(internal, date, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_date_distance(internal, date, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_date_distance(internal, date, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_date_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_date_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_date_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_date_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_date_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_date_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_date_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_date_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_date_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_date_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_date_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_date_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_date_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_date_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_date_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_date_same(public.gbtreekey8, public.gbtreekey8, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_date_same(public.gbtreekey8, public.gbtreekey8, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_date_same(public.gbtreekey8, public.gbtreekey8, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_date_same(public.gbtreekey8, public.gbtreekey8, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_date_same(public.gbtreekey8, public.gbtreekey8, internal) TO service_role;


--
-- Name: FUNCTION gbt_date_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_date_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_date_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_date_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_date_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_decompress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_decompress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_decompress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_decompress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_decompress(internal) TO service_role;


--
-- Name: FUNCTION gbt_enum_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_enum_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_enum_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_enum_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_enum_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_enum_consistent(internal, anyenum, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_enum_consistent(internal, anyenum, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_enum_consistent(internal, anyenum, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_enum_consistent(internal, anyenum, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_enum_consistent(internal, anyenum, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_enum_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_enum_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_enum_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_enum_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_enum_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_enum_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_enum_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_enum_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_enum_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_enum_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_enum_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_enum_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_enum_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_enum_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_enum_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_enum_same(public.gbtreekey8, public.gbtreekey8, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_enum_same(public.gbtreekey8, public.gbtreekey8, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_enum_same(public.gbtreekey8, public.gbtreekey8, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_enum_same(public.gbtreekey8, public.gbtreekey8, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_enum_same(public.gbtreekey8, public.gbtreekey8, internal) TO service_role;


--
-- Name: FUNCTION gbt_enum_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_enum_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_enum_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_enum_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_enum_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_float4_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float4_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float4_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float4_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float4_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_float4_consistent(internal, real, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float4_consistent(internal, real, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float4_consistent(internal, real, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float4_consistent(internal, real, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float4_consistent(internal, real, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_float4_distance(internal, real, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float4_distance(internal, real, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float4_distance(internal, real, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float4_distance(internal, real, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float4_distance(internal, real, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_float4_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float4_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float4_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float4_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float4_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_float4_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float4_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float4_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float4_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float4_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_float4_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float4_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float4_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float4_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float4_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_float4_same(public.gbtreekey8, public.gbtreekey8, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float4_same(public.gbtreekey8, public.gbtreekey8, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float4_same(public.gbtreekey8, public.gbtreekey8, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float4_same(public.gbtreekey8, public.gbtreekey8, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float4_same(public.gbtreekey8, public.gbtreekey8, internal) TO service_role;


--
-- Name: FUNCTION gbt_float4_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float4_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float4_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float4_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float4_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_float8_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float8_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float8_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float8_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float8_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_float8_consistent(internal, double precision, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float8_consistent(internal, double precision, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float8_consistent(internal, double precision, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float8_consistent(internal, double precision, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float8_consistent(internal, double precision, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_float8_distance(internal, double precision, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float8_distance(internal, double precision, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float8_distance(internal, double precision, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float8_distance(internal, double precision, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float8_distance(internal, double precision, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_float8_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float8_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float8_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float8_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float8_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_float8_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float8_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float8_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float8_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float8_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_float8_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float8_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float8_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float8_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float8_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_float8_same(public.gbtreekey16, public.gbtreekey16, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float8_same(public.gbtreekey16, public.gbtreekey16, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float8_same(public.gbtreekey16, public.gbtreekey16, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float8_same(public.gbtreekey16, public.gbtreekey16, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float8_same(public.gbtreekey16, public.gbtreekey16, internal) TO service_role;


--
-- Name: FUNCTION gbt_float8_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_float8_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_float8_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_float8_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_float8_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_inet_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_inet_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_inet_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_inet_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_inet_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_inet_consistent(internal, inet, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_inet_consistent(internal, inet, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_inet_consistent(internal, inet, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_inet_consistent(internal, inet, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_inet_consistent(internal, inet, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_inet_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_inet_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_inet_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_inet_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_inet_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_inet_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_inet_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_inet_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_inet_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_inet_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_inet_same(public.gbtreekey16, public.gbtreekey16, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_inet_same(public.gbtreekey16, public.gbtreekey16, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_inet_same(public.gbtreekey16, public.gbtreekey16, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_inet_same(public.gbtreekey16, public.gbtreekey16, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_inet_same(public.gbtreekey16, public.gbtreekey16, internal) TO service_role;


--
-- Name: FUNCTION gbt_inet_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_inet_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_inet_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_inet_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_inet_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int2_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int2_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int2_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int2_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int2_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_int2_consistent(internal, smallint, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int2_consistent(internal, smallint, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int2_consistent(internal, smallint, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int2_consistent(internal, smallint, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int2_consistent(internal, smallint, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_int2_distance(internal, smallint, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int2_distance(internal, smallint, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int2_distance(internal, smallint, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int2_distance(internal, smallint, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int2_distance(internal, smallint, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_int2_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int2_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int2_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int2_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int2_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_int2_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int2_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int2_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int2_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int2_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int2_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int2_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int2_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int2_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int2_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int2_same(public.gbtreekey4, public.gbtreekey4, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int2_same(public.gbtreekey4, public.gbtreekey4, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int2_same(public.gbtreekey4, public.gbtreekey4, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int2_same(public.gbtreekey4, public.gbtreekey4, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int2_same(public.gbtreekey4, public.gbtreekey4, internal) TO service_role;


--
-- Name: FUNCTION gbt_int2_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int2_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int2_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int2_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int2_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int4_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int4_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int4_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int4_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int4_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_int4_consistent(internal, integer, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int4_consistent(internal, integer, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int4_consistent(internal, integer, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int4_consistent(internal, integer, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int4_consistent(internal, integer, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_int4_distance(internal, integer, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int4_distance(internal, integer, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int4_distance(internal, integer, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int4_distance(internal, integer, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int4_distance(internal, integer, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_int4_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int4_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int4_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int4_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int4_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_int4_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int4_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int4_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int4_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int4_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int4_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int4_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int4_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int4_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int4_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int4_same(public.gbtreekey8, public.gbtreekey8, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int4_same(public.gbtreekey8, public.gbtreekey8, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int4_same(public.gbtreekey8, public.gbtreekey8, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int4_same(public.gbtreekey8, public.gbtreekey8, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int4_same(public.gbtreekey8, public.gbtreekey8, internal) TO service_role;


--
-- Name: FUNCTION gbt_int4_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int4_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int4_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int4_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int4_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int8_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int8_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int8_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int8_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int8_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_int8_consistent(internal, bigint, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int8_consistent(internal, bigint, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int8_consistent(internal, bigint, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int8_consistent(internal, bigint, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int8_consistent(internal, bigint, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_int8_distance(internal, bigint, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int8_distance(internal, bigint, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int8_distance(internal, bigint, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int8_distance(internal, bigint, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int8_distance(internal, bigint, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_int8_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int8_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int8_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int8_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int8_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_int8_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int8_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int8_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int8_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int8_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int8_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int8_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int8_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int8_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int8_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_int8_same(public.gbtreekey16, public.gbtreekey16, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int8_same(public.gbtreekey16, public.gbtreekey16, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int8_same(public.gbtreekey16, public.gbtreekey16, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int8_same(public.gbtreekey16, public.gbtreekey16, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int8_same(public.gbtreekey16, public.gbtreekey16, internal) TO service_role;


--
-- Name: FUNCTION gbt_int8_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_int8_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_int8_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_int8_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_int8_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_consistent(internal, interval, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_consistent(internal, interval, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_consistent(internal, interval, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_consistent(internal, interval, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_consistent(internal, interval, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_decompress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_decompress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_decompress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_decompress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_decompress(internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_distance(internal, interval, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_distance(internal, interval, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_distance(internal, interval, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_distance(internal, interval, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_distance(internal, interval, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_same(public.gbtreekey32, public.gbtreekey32, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_same(public.gbtreekey32, public.gbtreekey32, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_same(public.gbtreekey32, public.gbtreekey32, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_same(public.gbtreekey32, public.gbtreekey32, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_same(public.gbtreekey32, public.gbtreekey32, internal) TO service_role;


--
-- Name: FUNCTION gbt_intv_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_intv_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_intv_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_intv_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_intv_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad8_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad8_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad8_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad8_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad8_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_macad8_consistent(internal, macaddr8, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad8_consistent(internal, macaddr8, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad8_consistent(internal, macaddr8, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad8_consistent(internal, macaddr8, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad8_consistent(internal, macaddr8, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad8_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad8_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad8_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad8_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad8_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_macad8_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad8_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad8_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad8_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad8_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad8_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad8_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad8_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad8_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad8_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad8_same(public.gbtreekey16, public.gbtreekey16, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad8_same(public.gbtreekey16, public.gbtreekey16, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad8_same(public.gbtreekey16, public.gbtreekey16, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad8_same(public.gbtreekey16, public.gbtreekey16, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad8_same(public.gbtreekey16, public.gbtreekey16, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad8_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad8_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad8_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad8_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad8_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_macad_consistent(internal, macaddr, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad_consistent(internal, macaddr, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad_consistent(internal, macaddr, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad_consistent(internal, macaddr, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad_consistent(internal, macaddr, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_macad_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad_same(public.gbtreekey16, public.gbtreekey16, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad_same(public.gbtreekey16, public.gbtreekey16, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad_same(public.gbtreekey16, public.gbtreekey16, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad_same(public.gbtreekey16, public.gbtreekey16, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad_same(public.gbtreekey16, public.gbtreekey16, internal) TO service_role;


--
-- Name: FUNCTION gbt_macad_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_macad_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_macad_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_macad_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_macad_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_numeric_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_numeric_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_numeric_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_numeric_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_numeric_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_numeric_consistent(internal, numeric, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_numeric_consistent(internal, numeric, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_numeric_consistent(internal, numeric, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_numeric_consistent(internal, numeric, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_numeric_consistent(internal, numeric, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_numeric_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_numeric_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_numeric_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_numeric_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_numeric_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_numeric_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_numeric_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_numeric_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_numeric_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_numeric_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_numeric_same(public.gbtreekey_var, public.gbtreekey_var, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_numeric_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_numeric_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_numeric_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_numeric_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO service_role;


--
-- Name: FUNCTION gbt_numeric_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_numeric_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_numeric_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_numeric_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_numeric_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_oid_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_oid_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_oid_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_oid_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_oid_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_oid_consistent(internal, oid, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_oid_consistent(internal, oid, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_oid_consistent(internal, oid, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_oid_consistent(internal, oid, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_oid_consistent(internal, oid, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_oid_distance(internal, oid, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_oid_distance(internal, oid, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_oid_distance(internal, oid, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_oid_distance(internal, oid, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_oid_distance(internal, oid, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_oid_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_oid_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_oid_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_oid_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_oid_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_oid_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_oid_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_oid_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_oid_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_oid_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_oid_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_oid_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_oid_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_oid_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_oid_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_oid_same(public.gbtreekey8, public.gbtreekey8, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_oid_same(public.gbtreekey8, public.gbtreekey8, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_oid_same(public.gbtreekey8, public.gbtreekey8, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_oid_same(public.gbtreekey8, public.gbtreekey8, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_oid_same(public.gbtreekey8, public.gbtreekey8, internal) TO service_role;


--
-- Name: FUNCTION gbt_oid_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_oid_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_oid_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_oid_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_oid_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_text_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_text_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_text_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_text_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_text_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_text_consistent(internal, text, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_text_consistent(internal, text, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_text_consistent(internal, text, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_text_consistent(internal, text, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_text_consistent(internal, text, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_text_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_text_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_text_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_text_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_text_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_text_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_text_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_text_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_text_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_text_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_text_same(public.gbtreekey_var, public.gbtreekey_var, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_text_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_text_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_text_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_text_same(public.gbtreekey_var, public.gbtreekey_var, internal) TO service_role;


--
-- Name: FUNCTION gbt_text_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_text_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_text_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_text_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_text_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_time_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_time_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_time_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_time_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_time_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_time_consistent(internal, time without time zone, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_time_consistent(internal, time without time zone, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_time_consistent(internal, time without time zone, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_time_consistent(internal, time without time zone, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_time_consistent(internal, time without time zone, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_time_distance(internal, time without time zone, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_time_distance(internal, time without time zone, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_time_distance(internal, time without time zone, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_time_distance(internal, time without time zone, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_time_distance(internal, time without time zone, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_time_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_time_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_time_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_time_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_time_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_time_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_time_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_time_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_time_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_time_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_time_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_time_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_time_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_time_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_time_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_time_same(public.gbtreekey16, public.gbtreekey16, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_time_same(public.gbtreekey16, public.gbtreekey16, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_time_same(public.gbtreekey16, public.gbtreekey16, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_time_same(public.gbtreekey16, public.gbtreekey16, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_time_same(public.gbtreekey16, public.gbtreekey16, internal) TO service_role;


--
-- Name: FUNCTION gbt_time_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_time_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_time_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_time_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_time_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_timetz_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_timetz_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_timetz_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_timetz_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_timetz_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_timetz_consistent(internal, time with time zone, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_timetz_consistent(internal, time with time zone, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_timetz_consistent(internal, time with time zone, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_timetz_consistent(internal, time with time zone, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_timetz_consistent(internal, time with time zone, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_ts_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_ts_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_ts_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_ts_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_ts_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_ts_consistent(internal, timestamp without time zone, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_ts_consistent(internal, timestamp without time zone, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_ts_consistent(internal, timestamp without time zone, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_ts_consistent(internal, timestamp without time zone, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_ts_consistent(internal, timestamp without time zone, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_ts_distance(internal, timestamp without time zone, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_ts_distance(internal, timestamp without time zone, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_ts_distance(internal, timestamp without time zone, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_ts_distance(internal, timestamp without time zone, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_ts_distance(internal, timestamp without time zone, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_ts_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_ts_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_ts_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_ts_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_ts_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_ts_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_ts_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_ts_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_ts_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_ts_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_ts_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_ts_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_ts_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_ts_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_ts_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_ts_same(public.gbtreekey16, public.gbtreekey16, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_ts_same(public.gbtreekey16, public.gbtreekey16, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_ts_same(public.gbtreekey16, public.gbtreekey16, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_ts_same(public.gbtreekey16, public.gbtreekey16, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_ts_same(public.gbtreekey16, public.gbtreekey16, internal) TO service_role;


--
-- Name: FUNCTION gbt_ts_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_ts_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_ts_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_ts_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_ts_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_tstz_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_tstz_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_tstz_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_tstz_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_tstz_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_tstz_consistent(internal, timestamp with time zone, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_tstz_consistent(internal, timestamp with time zone, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_tstz_consistent(internal, timestamp with time zone, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_tstz_consistent(internal, timestamp with time zone, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_tstz_consistent(internal, timestamp with time zone, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_tstz_distance(internal, timestamp with time zone, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_tstz_distance(internal, timestamp with time zone, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_tstz_distance(internal, timestamp with time zone, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_tstz_distance(internal, timestamp with time zone, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_tstz_distance(internal, timestamp with time zone, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_uuid_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_uuid_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_uuid_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_uuid_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_uuid_compress(internal) TO service_role;


--
-- Name: FUNCTION gbt_uuid_consistent(internal, uuid, smallint, oid, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_uuid_consistent(internal, uuid, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_uuid_consistent(internal, uuid, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_uuid_consistent(internal, uuid, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_uuid_consistent(internal, uuid, smallint, oid, internal) TO service_role;


--
-- Name: FUNCTION gbt_uuid_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_uuid_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_uuid_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_uuid_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_uuid_fetch(internal) TO service_role;


--
-- Name: FUNCTION gbt_uuid_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_uuid_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_uuid_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_uuid_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_uuid_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_uuid_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_uuid_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_uuid_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_uuid_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_uuid_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_uuid_same(public.gbtreekey32, public.gbtreekey32, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_uuid_same(public.gbtreekey32, public.gbtreekey32, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_uuid_same(public.gbtreekey32, public.gbtreekey32, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_uuid_same(public.gbtreekey32, public.gbtreekey32, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_uuid_same(public.gbtreekey32, public.gbtreekey32, internal) TO service_role;


--
-- Name: FUNCTION gbt_uuid_union(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_uuid_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_uuid_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_uuid_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_uuid_union(internal, internal) TO service_role;


--
-- Name: FUNCTION gbt_var_decompress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_var_decompress(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_var_decompress(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_var_decompress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_var_decompress(internal) TO service_role;


--
-- Name: FUNCTION gbt_var_fetch(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gbt_var_fetch(internal) TO postgres;
GRANT ALL ON FUNCTION public.gbt_var_fetch(internal) TO anon;
GRANT ALL ON FUNCTION public.gbt_var_fetch(internal) TO authenticated;
GRANT ALL ON FUNCTION public.gbt_var_fetch(internal) TO service_role;


--
-- Name: FUNCTION handle_new_auth_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_auth_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_auth_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_auth_user() TO service_role;


--
-- Name: FUNCTION int2_dist(smallint, smallint); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.int2_dist(smallint, smallint) TO postgres;
GRANT ALL ON FUNCTION public.int2_dist(smallint, smallint) TO anon;
GRANT ALL ON FUNCTION public.int2_dist(smallint, smallint) TO authenticated;
GRANT ALL ON FUNCTION public.int2_dist(smallint, smallint) TO service_role;


--
-- Name: FUNCTION int4_dist(integer, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.int4_dist(integer, integer) TO postgres;
GRANT ALL ON FUNCTION public.int4_dist(integer, integer) TO anon;
GRANT ALL ON FUNCTION public.int4_dist(integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.int4_dist(integer, integer) TO service_role;


--
-- Name: FUNCTION int8_dist(bigint, bigint); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.int8_dist(bigint, bigint) TO postgres;
GRANT ALL ON FUNCTION public.int8_dist(bigint, bigint) TO anon;
GRANT ALL ON FUNCTION public.int8_dist(bigint, bigint) TO authenticated;
GRANT ALL ON FUNCTION public.int8_dist(bigint, bigint) TO service_role;


--
-- Name: FUNCTION interval_dist(interval, interval); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.interval_dist(interval, interval) TO postgres;
GRANT ALL ON FUNCTION public.interval_dist(interval, interval) TO anon;
GRANT ALL ON FUNCTION public.interval_dist(interval, interval) TO authenticated;
GRANT ALL ON FUNCTION public.interval_dist(interval, interval) TO service_role;


--
-- Name: FUNCTION log_audit_event(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_audit_event() TO anon;
GRANT ALL ON FUNCTION public.log_audit_event() TO authenticated;
GRANT ALL ON FUNCTION public.log_audit_event() TO service_role;


--
-- Name: FUNCTION oid_dist(oid, oid); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.oid_dist(oid, oid) TO postgres;
GRANT ALL ON FUNCTION public.oid_dist(oid, oid) TO anon;
GRANT ALL ON FUNCTION public.oid_dist(oid, oid) TO authenticated;
GRANT ALL ON FUNCTION public.oid_dist(oid, oid) TO service_role;


--
-- Name: FUNCTION post_daily_sales(p_daily_sales_header_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.post_daily_sales(p_daily_sales_header_id uuid) TO anon;
GRANT ALL ON FUNCTION public.post_daily_sales(p_daily_sales_header_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_daily_sales(p_daily_sales_header_id uuid) TO service_role;


--
-- Name: FUNCTION post_opening_balance(p_branch_id uuid, p_inventory_item_id uuid, p_quantity numeric, p_unit_cost numeric, p_business_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.post_opening_balance(p_branch_id uuid, p_inventory_item_id uuid, p_quantity numeric, p_unit_cost numeric, p_business_date date) TO anon;
GRANT ALL ON FUNCTION public.post_opening_balance(p_branch_id uuid, p_inventory_item_id uuid, p_quantity numeric, p_unit_cost numeric, p_business_date date) TO authenticated;
GRANT ALL ON FUNCTION public.post_opening_balance(p_branch_id uuid, p_inventory_item_id uuid, p_quantity numeric, p_unit_cost numeric, p_business_date date) TO service_role;


--
-- Name: FUNCTION post_production(p_inventory_item_id uuid, p_branch_id uuid, p_actual_yield_quantity numeric, p_business_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.post_production(p_inventory_item_id uuid, p_branch_id uuid, p_actual_yield_quantity numeric, p_business_date date) TO anon;
GRANT ALL ON FUNCTION public.post_production(p_inventory_item_id uuid, p_branch_id uuid, p_actual_yield_quantity numeric, p_business_date date) TO authenticated;
GRANT ALL ON FUNCTION public.post_production(p_inventory_item_id uuid, p_branch_id uuid, p_actual_yield_quantity numeric, p_business_date date) TO service_role;


--
-- Name: FUNCTION post_purchase(p_purchase_header_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.post_purchase(p_purchase_header_id uuid) TO anon;
GRANT ALL ON FUNCTION public.post_purchase(p_purchase_header_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_purchase(p_purchase_header_id uuid) TO service_role;


--
-- Name: FUNCTION post_stock_count(p_stock_count_header_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.post_stock_count(p_stock_count_header_id uuid) TO anon;
GRANT ALL ON FUNCTION public.post_stock_count(p_stock_count_header_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_stock_count(p_stock_count_header_id uuid) TO service_role;


--
-- Name: FUNCTION record_waste(p_branch_id uuid, p_inventory_item_id uuid, p_quantity_base numeric, p_waste_reason_id uuid, p_business_date date, p_notes text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.record_waste(p_branch_id uuid, p_inventory_item_id uuid, p_quantity_base numeric, p_waste_reason_id uuid, p_business_date date, p_notes text) TO anon;
GRANT ALL ON FUNCTION public.record_waste(p_branch_id uuid, p_inventory_item_id uuid, p_quantity_base numeric, p_waste_reason_id uuid, p_business_date date, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.record_waste(p_branch_id uuid, p_inventory_item_id uuid, p_quantity_base numeric, p_waste_reason_id uuid, p_business_date date, p_notes text) TO service_role;


--
-- Name: FUNCTION reopen_daily_sales(p_daily_sales_header_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reopen_daily_sales(p_daily_sales_header_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reopen_daily_sales(p_daily_sales_header_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reopen_daily_sales(p_daily_sales_header_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION time_dist(time without time zone, time without time zone); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.time_dist(time without time zone, time without time zone) TO postgres;
GRANT ALL ON FUNCTION public.time_dist(time without time zone, time without time zone) TO anon;
GRANT ALL ON FUNCTION public.time_dist(time without time zone, time without time zone) TO authenticated;
GRANT ALL ON FUNCTION public.time_dist(time without time zone, time without time zone) TO service_role;


--
-- Name: FUNCTION ts_dist(timestamp without time zone, timestamp without time zone); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.ts_dist(timestamp without time zone, timestamp without time zone) TO postgres;
GRANT ALL ON FUNCTION public.ts_dist(timestamp without time zone, timestamp without time zone) TO anon;
GRANT ALL ON FUNCTION public.ts_dist(timestamp without time zone, timestamp without time zone) TO authenticated;
GRANT ALL ON FUNCTION public.ts_dist(timestamp without time zone, timestamp without time zone) TO service_role;


--
-- Name: FUNCTION tstz_dist(timestamp with time zone, timestamp with time zone); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.tstz_dist(timestamp with time zone, timestamp with time zone) TO postgres;
GRANT ALL ON FUNCTION public.tstz_dist(timestamp with time zone, timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.tstz_dist(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.tstz_dist(timestamp with time zone, timestamp with time zone) TO service_role;


--
-- Name: FUNCTION void_purchase(p_purchase_header_id uuid, p_void_reason text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.void_purchase(p_purchase_header_id uuid, p_void_reason text) TO anon;
GRANT ALL ON FUNCTION public.void_purchase(p_purchase_header_id uuid, p_void_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.void_purchase(p_purchase_header_id uuid, p_void_reason text) TO service_role;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO service_role;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION send_binary(payload bytea, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION wal2json_escape_identifier(name text); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.wal2json_escape_identifier(name text) TO postgres;
GRANT ALL ON FUNCTION realtime.wal2json_escape_identifier(name text) TO dashboard_user;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE webauthn_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_challenges TO postgres;
GRANT ALL ON TABLE auth.webauthn_challenges TO dashboard_user;


--
-- Name: TABLE webauthn_credentials; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_credentials TO postgres;
GRANT ALL ON TABLE auth.webauthn_credentials TO dashboard_user;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- Name: TABLE app_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_settings TO anon;
GRANT ALL ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE branches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.branches TO anon;
GRANT ALL ON TABLE public.branches TO authenticated;
GRANT ALL ON TABLE public.branches TO service_role;


--
-- Name: TABLE bundle_components; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bundle_components TO anon;
GRANT ALL ON TABLE public.bundle_components TO authenticated;
GRANT ALL ON TABLE public.bundle_components TO service_role;


--
-- Name: TABLE cash_flow_adjustments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cash_flow_adjustments TO anon;
GRANT ALL ON TABLE public.cash_flow_adjustments TO authenticated;
GRANT ALL ON TABLE public.cash_flow_adjustments TO service_role;


--
-- Name: TABLE cash_reconciliations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cash_reconciliations TO anon;
GRANT ALL ON TABLE public.cash_reconciliations TO authenticated;
GRANT ALL ON TABLE public.cash_reconciliations TO service_role;


--
-- Name: TABLE currencies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.currencies TO anon;
GRANT ALL ON TABLE public.currencies TO authenticated;
GRANT ALL ON TABLE public.currencies TO service_role;


--
-- Name: TABLE daily_payment_totals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_payment_totals TO anon;
GRANT ALL ON TABLE public.daily_payment_totals TO authenticated;
GRANT ALL ON TABLE public.daily_payment_totals TO service_role;


--
-- Name: TABLE daily_sales_headers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_sales_headers TO anon;
GRANT ALL ON TABLE public.daily_sales_headers TO authenticated;
GRANT ALL ON TABLE public.daily_sales_headers TO service_role;


--
-- Name: TABLE daily_sales_lines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_sales_lines TO anon;
GRANT ALL ON TABLE public.daily_sales_lines TO authenticated;
GRANT ALL ON TABLE public.daily_sales_lines TO service_role;


--
-- Name: TABLE employee_pay_rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employee_pay_rates TO anon;
GRANT ALL ON TABLE public.employee_pay_rates TO authenticated;
GRANT ALL ON TABLE public.employee_pay_rates TO service_role;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employees TO anon;
GRANT ALL ON TABLE public.employees TO authenticated;
GRANT ALL ON TABLE public.employees TO service_role;


--
-- Name: TABLE exchange_rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exchange_rates TO anon;
GRANT ALL ON TABLE public.exchange_rates TO authenticated;
GRANT ALL ON TABLE public.exchange_rates TO service_role;


--
-- Name: TABLE expense_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expense_categories TO anon;
GRANT ALL ON TABLE public.expense_categories TO authenticated;
GRANT ALL ON TABLE public.expense_categories TO service_role;


--
-- Name: TABLE expense_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expense_transactions TO anon;
GRANT ALL ON TABLE public.expense_transactions TO authenticated;
GRANT ALL ON TABLE public.expense_transactions TO service_role;


--
-- Name: TABLE inventory_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory_items TO anon;
GRANT ALL ON TABLE public.inventory_items TO authenticated;
GRANT ALL ON TABLE public.inventory_items TO service_role;


--
-- Name: TABLE inventory_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory_ledger TO anon;
GRANT ALL ON TABLE public.inventory_ledger TO authenticated;
GRANT ALL ON TABLE public.inventory_ledger TO service_role;


--
-- Name: TABLE units_of_measure; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.units_of_measure TO anon;
GRANT ALL ON TABLE public.units_of_measure TO authenticated;
GRANT ALL ON TABLE public.units_of_measure TO service_role;


--
-- Name: TABLE inventory_stock_on_hand; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory_stock_on_hand TO anon;
GRANT ALL ON TABLE public.inventory_stock_on_hand TO authenticated;
GRANT ALL ON TABLE public.inventory_stock_on_hand TO service_role;


--
-- Name: TABLE kpi_targets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kpi_targets TO anon;
GRANT ALL ON TABLE public.kpi_targets TO authenticated;
GRANT ALL ON TABLE public.kpi_targets TO service_role;


--
-- Name: TABLE menu_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.menu_categories TO anon;
GRANT ALL ON TABLE public.menu_categories TO authenticated;
GRANT ALL ON TABLE public.menu_categories TO service_role;


--
-- Name: TABLE organisations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organisations TO anon;
GRANT ALL ON TABLE public.organisations TO authenticated;
GRANT ALL ON TABLE public.organisations TO service_role;


--
-- Name: TABLE payment_methods; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_methods TO anon;
GRANT ALL ON TABLE public.payment_methods TO authenticated;
GRANT ALL ON TABLE public.payment_methods TO service_role;


--
-- Name: TABLE product_prices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_prices TO anon;
GRANT ALL ON TABLE public.product_prices TO authenticated;
GRANT ALL ON TABLE public.product_prices TO service_role;


--
-- Name: TABLE product_variants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_variants TO anon;
GRANT ALL ON TABLE public.product_variants TO authenticated;
GRANT ALL ON TABLE public.product_variants TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE purchase_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_attachments TO anon;
GRANT ALL ON TABLE public.purchase_attachments TO authenticated;
GRANT ALL ON TABLE public.purchase_attachments TO service_role;


--
-- Name: TABLE purchase_headers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_headers TO anon;
GRANT ALL ON TABLE public.purchase_headers TO authenticated;
GRANT ALL ON TABLE public.purchase_headers TO service_role;


--
-- Name: TABLE purchase_lines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_lines TO anon;
GRANT ALL ON TABLE public.purchase_lines TO authenticated;
GRANT ALL ON TABLE public.purchase_lines TO service_role;


--
-- Name: TABLE recipe_lines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recipe_lines TO anon;
GRANT ALL ON TABLE public.recipe_lines TO authenticated;
GRANT ALL ON TABLE public.recipe_lines TO service_role;


--
-- Name: TABLE recipe_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recipe_versions TO anon;
GRANT ALL ON TABLE public.recipe_versions TO authenticated;
GRANT ALL ON TABLE public.recipe_versions TO service_role;


--
-- Name: TABLE recurring_expense_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recurring_expense_templates TO anon;
GRANT ALL ON TABLE public.recurring_expense_templates TO authenticated;
GRANT ALL ON TABLE public.recurring_expense_templates TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE shift_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shift_entries TO anon;
GRANT ALL ON TABLE public.shift_entries TO authenticated;
GRANT ALL ON TABLE public.shift_entries TO service_role;


--
-- Name: TABLE stock_count_headers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_count_headers TO anon;
GRANT ALL ON TABLE public.stock_count_headers TO authenticated;
GRANT ALL ON TABLE public.stock_count_headers TO service_role;


--
-- Name: TABLE stock_count_lines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_count_lines TO anon;
GRANT ALL ON TABLE public.stock_count_lines TO authenticated;
GRANT ALL ON TABLE public.stock_count_lines TO service_role;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;


--
-- Name: TABLE tax_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tax_categories TO anon;
GRANT ALL ON TABLE public.tax_categories TO authenticated;
GRANT ALL ON TABLE public.tax_categories TO service_role;


--
-- Name: TABLE unit_conversions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.unit_conversions TO anon;
GRANT ALL ON TABLE public.unit_conversions TO authenticated;
GRANT ALL ON TABLE public.unit_conversions TO service_role;


--
-- Name: TABLE user_branch_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_branch_roles TO anon;
GRANT ALL ON TABLE public.user_branch_roles TO authenticated;
GRANT ALL ON TABLE public.user_branch_roles TO service_role;


--
-- Name: TABLE waste_reasons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.waste_reasons TO anon;
GRANT ALL ON TABLE public.waste_reasons TO authenticated;
GRANT ALL ON TABLE public.waste_reasons TO service_role;


--
-- Name: TABLE waste_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.waste_records TO anon;
GRANT ALL ON TABLE public.waste_records TO authenticated;
GRANT ALL ON TABLE public.waste_records TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;
GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;

--
-- PostgreSQL database dump complete
--

\unrestrict hdfli0DTtJLXf4osRZfd4WXNM9JlCfZnjmLbbECTy80mlJqfhfRFDCtOE3kf2ag

