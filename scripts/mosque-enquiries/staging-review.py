"""Rehearse, apply, or verify only the reviewed enquiry migration on staging."""
import argparse
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
STAGING_REF = 'zhrucqghrqkjyzmupdyy'
NAMES = ['20260910000000_mosque_enquiries']

def build_sql(mode):
    chunks = ['BEGIN;', "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '30s';"]
    if mode != 'verify':
        versions = ','.join("'" + name.split('_', 1)[0] + "'" for name in NAMES)
        chunks.append(f"""DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN ({versions})) THEN
            RAISE EXCEPTION 'Reviewed migrations already recorded; inspect history and use verify';
          END IF;
        END $$;""")
        chunks.extend((ROOT / 'supabase/migrations' / (name + '.sql')).read_text() for name in NAMES)
    chunks.append('SAVEPOINT review_fixtures;')
    chunks.append((ROOT / 'scripts/mosque-enquiries/verify.sql').read_text())
    chunks.append('ROLLBACK TO SAVEPOINT review_fixtures;')
    if mode == 'apply':
        for name in NAMES:
            version, label = name.split('_', 1)
            statement = (ROOT / 'supabase/migrations' / (name + '.sql')).read_text().replace("'", "''")
            chunks.append(f"INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES ('{version}', '{label}', ARRAY['{statement}']);")
        chunks.append("NOTIFY pgrst, 'reload schema';")
        chunks.append('COMMIT;')
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
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'User-Agent': 'SupabaseCLI/2.0'},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        print(response.read().decode())
