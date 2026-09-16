"""Rehearse, apply or verify only the services migration on staging."""
import argparse, json, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
REF = 'zhrucqghrqkjyzmupdyy'
NAME = '20260916000100_services_and_external_appeals'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('mode',choices=['rehearse','apply','verify'])
args=parser.parse_args()
migration=(ROOT/'supabase/migrations'/f'{NAME}.sql').read_text()
verification=(ROOT/'scripts/services/verify.sql').read_text()
version,label=NAME.split('_',1)
parts=['BEGIN;',"SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '30s';"]
if args.mode!='verify':
 parts += [f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='{version}') THEN RAISE EXCEPTION 'Already applied'; END IF; END $$;",migration]
parts += ['SAVEPOINT verify;',verification,'ROLLBACK TO SAVEPOINT verify;']
if args.mode=='apply':
 escaped=migration.replace("'","''")
 parts += [f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('{version}','{label}',ARRAY['{escaped}']);", "NOTIFY pgrst, 'reload schema';",'COMMIT;']
else: parts += ['ROLLBACK;']
parts += [f"SELECT '{args.mode} passed' AS result;"]
token=(Path.home()/'.supabase/access-token').read_text().strip()
request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{REF}/database/query',data=json.dumps({'query':'\n'.join(parts)}).encode(),headers={'Authorization':f'Bearer {token}','Content-Type':'application/json','User-Agent':'Codex/1.0'})
try:
 with urllib.request.urlopen(request,timeout=45) as response: print(response.read().decode())
except urllib.error.HTTPError as error:
 print(error.read().decode()); raise SystemExit(1)
