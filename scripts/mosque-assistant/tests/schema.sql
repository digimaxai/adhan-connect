-- ONLY run against an empty disposable database. No production connections.
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create table public.users(id uuid primary key,role text);
create table public.profiles(id uuid primary key);
create table public.mosques(id uuid primary key default gen_random_uuid(),name text,address_line1 text,address_line2 text,city text,postcode text,country text,time_zone text default 'Europe/London',updated_at timestamptz default now());
create table public.prayer_schedule_imports(id uuid primary key default gen_random_uuid(),mosque_id uuid,source_type text,source_label text,import_mode text,status text,coverage_start_date date,coverage_end_date date,total_rows integer,valid_rows integer,initiated_by uuid references profiles(id),metadata jsonb,published_at timestamptz);
create table public.prayer_times(id uuid primary key default gen_random_uuid(),mosque_id uuid,date date,fajr_adhan_time timestamptz,fajr_iqama_time timestamptz,dhuhr_adhan_time timestamptz,dhuhr_iqama_time timestamptz,asr_adhan_time timestamptz,asr_iqama_time timestamptz,maghrib_adhan_time timestamptz,maghrib_iqama_time timestamptz,isha_adhan_time timestamptz,isha_iqama_time timestamptz,source_type text,generated_method text,overrides_exist boolean,import_id uuid,created_by uuid,updated_by uuid,updated_at timestamptz default now(),unique(mosque_id,date));
create table public.prayer_schedule_import_rows(id uuid primary key default gen_random_uuid(),import_id uuid,mosque_id uuid,date date,action text,previous_row jsonb,published_row jsonb);
-- Operational dependencies checked by assistant approval; real-schema integration
-- tests use build-compatibility-fixture.py instead of these minimal tables.
create table public.streams(mosque_id uuid,is_live boolean);
create table public.adhans(mosque_id uuid,status text);
create table public.staff_rota(mosque_id uuid,date date,duty_date date,prayer_name text,prayer text,adhan_time timestamptz,iqama_time timestamptz);
create table public.notification_events(mosque_id uuid,prayer text,kind text,data jsonb);
