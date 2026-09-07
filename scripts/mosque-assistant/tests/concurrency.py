"""Exercise an edit racing assistant approval in a DISPOSABLE compatibility DB."""
import json, subprocess, sys, time
name=sys.argv[1]
if not name.startswith('assistant_compatibility'): raise SystemExit('Disposable compatibility database required')
base=['psql','-X','-h','/tmp','-p','55439','-d',name,'-v','ON_ERROR_STOP=1','-Atq']
def sql(query):
 p=subprocess.run(base+['-c',query],capture_output=True,text=True,timeout=10)
 if p.returncode: raise RuntimeError(p.stderr)
 return p.stdout.strip().splitlines()[-1] if p.stdout.strip() else ''
m='40000000-0000-0000-0000-000000000001';owner='30000000-0000-0000-0000-000000000001'
d=sql("select ((clock_timestamp() at time zone 'UTC')::date+4)::text")
rows=json.dumps([dict(date=d,fajr='05:15',dhuhr='12:00',asr='15:00',maghrib='18:00',isha='20:00')])
review=json.dumps(dict(websiteConfirmed=True,timeZone='UTC',profile={},table=dict(source_url='https://example.org/timetable')))
sql(f"delete from mosque_assistant_jobs where mosque_id='{m}' and month='{d[:7]}'; delete from prayer_times where mosque_id='{m}' and date='{d}'")
sql(f"insert into prayer_times(mosque_id,date,fajr_adhan_time) values('{m}','{d}','{d} 05:00+00')")
sql(f"select enqueue_mosque_assistant('{owner}','{d[:7]}',array['{m}'::uuid])")
j=sql(f"update mosque_assistant_jobs set status='review' where mosque_id='{m}' and month='{d[:7]}' and status='queued' returning id")
sql(f"""create function public.compat_pause_insert() returns trigger language plpgsql as $$ begin
 if new.mosque_id='{m}' and new.date='{d}' then perform pg_advisory_xact_lock(615091701); end if; return new; end $$;
 create trigger compat_pause_insert before insert on prayer_times for each row execute function compat_pause_insert();""")
locker=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
publisher=None
try:
 locker.stdin.write("select pg_advisory_lock(615091701);\nselect 'locked';\n");locker.stdin.flush()
 while locker.stdout.readline().strip()!='locked':
  if locker.poll() is not None: raise RuntimeError('Lock holder exited')
 publisher=subprocess.Popen(base+['-c',f"set application_name='assistant_compat_publish'; select publish_mosque_assistant('{owner}','{j}','{review}'::jsonb,'{rows}'::jsonb)"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 deadline=time.monotonic()+10
 while sql("select count(*) from pg_stat_activity where application_name='assistant_compat_publish' and wait_event='advisory'")!='1':
  if publisher.poll() is not None: raise RuntimeError(publisher.communicate()[1])
  if time.monotonic()>deadline: raise RuntimeError('Publication did not reach the controlled race point')
  time.sleep(.05)
 # An existing timetable update is not blocked by a whole-table prayer lock.
 sql(f"set statement_timeout='500ms'; update prayer_times set fajr_adhan_time='{d} 05:20+00',source_type='manual' where mosque_id='{m}' and date='{d}'")
 locker.stdin.write("select pg_advisory_unlock(615091701);\n\\q\n");locker.stdin.flush();locker.wait(timeout=5)
 stdout,stderr=publisher.communicate(timeout=10)
 assert publisher.returncode!=0 and 'changed since this scan' in stderr,stderr
 assert sql(f"select to_char(fajr_adhan_time at time zone 'UTC','HH24:MI') from prayer_times where mosque_id='{m}' and date='{d}'")=='05:20'
 assert sql(f"select status from mosque_assistant_jobs where id='{j}'")=='review'
 print('PASS: concurrent manual edit proceeds, assistant aborts atomically, newer time and review draft preserved')
finally:
 if locker.poll() is None: locker.kill();locker.wait()
 if publisher is not None and publisher.poll() is None: publisher.kill();publisher.wait()
 sql('drop trigger compat_pause_insert on prayer_times; drop function compat_pause_insert()')
