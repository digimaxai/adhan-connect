"""Rehearse, apply, or verify the prayer adjustment migration on staging."""
import argparse
import json
from pathlib import Path
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[2]
STAGING_REF = 'zhrucqghrqkjyzmupdyy'
NAME = '20260911000000_mosque_prayer_time_adjustments'

def build_sql(mode):
    version, label = NAME.split('_', 1)
    migration = (ROOT / 'supabase/migrations' / f'{NAME}.sql').read_text()
    chunks = ['BEGIN;', "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '30s';"]
    if mode != 'verify':
        chunks.append(f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '{version}') THEN RAISE EXCEPTION 'Migration already recorded'; END IF; END $$;")
        chunks.append(migration)
    chunks += ['SAVEPOINT verification;', (ROOT / 'scripts/prayer-adjustments/verify.sql').read_text(), 'ROLLBACK TO SAVEPOINT verification;']
    if mode == 'apply':
        escaped = migration.replace("'", "''")
        chunks += [f"INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('{version}','{label}',ARRAY['{escaped}']);", "NOTIFY pgrst, 'reload schema';", 'COMMIT;']
    else:
        chunks.append('ROLLBACK;')
    chunks.append(f"SELECT '{mode} passed' AS result;")
    return '\n'.join(chunks)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['rehearse', 'apply', 'verify'])
    args = parser.parse_args()
    token = (Path.home() / '.supabase/access-token').read_text().strip()
    request = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{STAGING_REF}/database/query',
        data=json.dumps({'query': build_sql(args.mode)}).encode(),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'User-Agent': 'Codex/1.0'},
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            print(response.read().decode())
    except urllib.error.HTTPError as error:
        print(error.read().decode())
        raise
