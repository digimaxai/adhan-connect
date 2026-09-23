"""Staging-only concurrency test. Inserts tagged test messages and removes only those rows."""
import concurrent.futures
import json
from pathlib import Path
import urllib.request
import uuid

REF = 'zhrucqghrqkjyzmupdyy'
token = (Path.home() / '.supabase/access-token').read_text().strip()

def query(sql):
    request = urllib.request.Request(f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps({'query': sql}).encode(),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'User-Agent': 'SupabaseCLI/2.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)

marker = 'codex-concurrency-' + str(uuid.uuid4())
pair = query("""SELECT m.id AS mosque, u.id AS listener
    FROM public.mosques m CROSS JOIN auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.mosque_messages x WHERE x.mosque_id=m.id AND x.listener_id=u.id)
    LIMIT 1""")[0]
mosque = str(uuid.UUID(pair['mosque']))
listener = str(uuid.UUID(pair['listener']))
sql = f"""DO $$ BEGIN
    PERFORM public.send_mosque_message('{mosque}', '{listener}', '{listener}', 'listener', '{marker}');
    PERFORM set_config('review.accepted', 'true', true);
  EXCEPTION WHEN SQLSTATE 'P0429' THEN PERFORM set_config('review.accepted', 'false', true);
  END $$;
  SELECT current_setting('review.accepted') AS accepted;"""
try:
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: query(sql), range(8)))
    accepted = sum(result[0]['accepted'] == 'true' for result in results)
    assert accepted == 5, f'Expected 5 accepted concurrent sends, got {accepted}'
    print('Eight concurrent staging sends: five accepted, three rate-limited.')
finally:
    query(f"DELETE FROM public.mosque_messages WHERE mosque_id='{mosque}' AND listener_id='{listener}' AND body='{marker}';")
    remaining = query(f"SELECT count(*) AS n FROM public.mosque_messages WHERE body='{marker}';")[0]['n']
    assert remaining == 0, 'Test fixture cleanup failed'
    print('All concurrency test messages removed.')
