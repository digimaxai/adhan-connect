"""Build an isolated operational schema fixture from a schema-only staging dump.
No connections or data copies. Only selected DDL is copied; the only table-type
substitution is unused mosques.location_geog -> text (no local PostGIS needed).
Auth identity functions are local test stubs. Network dispatch triggers excluded.
"""
import re, sys, hashlib, json
from pathlib import Path
source = Path(sys.argv[1]).read_text()
out = Path(sys.argv[2])
tables = ['users','profiles','mosques','mosque_admins','muezzins','staff_rota','streams','adhans','mosque_live_stream_upstream_states','prayer_times','prayer_schedule_imports','prayer_schedule_import_rows','notification_events','notification_preferences','muezzin_cover_requests','subscriptions']
functions = ['start_live_broadcast_v1','end_live_broadcast_v1','enqueue_due_adhan_reminders_v1','enqueue_live_adhan_notification_v1','set_updated_at','enforce_mosque_local_admin_policy_updates','is_main_admin','is_local_admin_for_mosque','is_active_muezzin_for_mosque','is_mosque_admin_for','is_active_mosque']
parts = ["-- DISPOSABLE DATABASE ONLY. Derived from staging DDL; no staging data.", "do $$ begin create role anon; exception when duplicate_object then null; end $$;", "do $$ begin create role authenticated; exception when duplicate_object then null; end $$;", "do $$ begin create role service_role; exception when duplicate_object then null; end $$;", "create schema auth; create table auth.users(id uuid primary key);", "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;", "create function auth.role() returns text language sql stable as $$ select current_user::text $$;", "grant usage on schema auth to anon,authenticated,service_role;"]
parts.append('create extension if not exists pg_trgm;')
parts += re.findall(r'CREATE TYPE "public"\."[^"]+" AS ENUM \([\s\S]*?\n\);',source)
for name in tables:
 match = re.search(r'CREATE TABLE IF NOT EXISTS "public"\."'+name+r'" \([\s\S]*?\n\);',source)
 if not match: raise ValueError('Missing table '+name)
 parts.append(match[0].replace('"public"."geography"(Point,4326)','text'))
for stmt in re.findall(r'ALTER TABLE ONLY "public"\."[^"]+"[\s\S]*?;',source):
 name=re.search(r'ALTER TABLE ONLY "public"\."([^"]+)"',stmt)[1]
 if name not in tables: continue
 refs=re.findall(r'REFERENCES "public"\."([^"]+)"',stmt)
 if all(ref in tables for ref in refs): parts.append(stmt)
for stmt in re.findall(r'CREATE (?:UNIQUE )?INDEX [^;]+;',source):
 if any('ON "public"."'+name+'"' in stmt for name in tables) and 'gist' not in stmt and 'location_geog' not in stmt: parts.append(stmt)
parts.append(re.search(r'CREATE OR REPLACE VIEW "public"\."live_adhan_admins"[\s\S]*?;',source)[0])
function_hashes={}
for name in functions:
 matches=list(re.finditer(r'CREATE OR REPLACE FUNCTION "public"\."'+name+r'"[\s\S]*?AS (\$[^$\s]*\$)[\s\S]*?\1;',source))
 if not matches: raise ValueError('Missing function '+name)
 for i,match in enumerate(matches):
  parts.append(match[0]);function_hashes[f'{name}/{i}']=hashlib.sha256(match[0].encode()).hexdigest()
for stmt in re.findall(r'CREATE OR REPLACE TRIGGER [^;]+;',source):
 if any('ON "public"."'+name+'"' in stmt for name in tables) and any('FUNCTION "public"."'+name+'"' in stmt for name in functions):parts.append(stmt)
# Private profile helper is sourced from its checked-in migration (outside public dump).
parts.append('\n'.join(Path('supabase/migrations/20260319220000_fix_supabase_security_warnings.sql').read_text().splitlines()[13:62]))
for stmt in re.findall(r'CREATE POLICY [\s\S]*?;',source):
 if any('ON "public"."'+name+'"' in stmt for name in tables): parts.append(stmt)
for stmt in re.findall(r'(?:ALTER TABLE "public"\."[^;]+? ENABLE ROW LEVEL SECURITY|GRANT [^;]+|REVOKE [^;]+);',source):
 if any('TABLE "public"."'+name+'"' in stmt for name in tables+['live_adhan_admins']) or any('FUNCTION "public"."'+name+'"' in stmt for name in functions): parts.append(stmt)
parts += ['create publication supabase_realtime;', 'alter publication supabase_realtime add table public.prayer_times,public.mosques,public.streams,public.adhans;']
out.write_text('\n\n'.join(parts)+'\n')
print(json.dumps({'tables':len(tables),'functions':len(functions),'fixture':str(out),'schema_sha256':hashlib.sha256(source.encode()).hexdigest(),'function_sha256':function_hashes},indent=2))
