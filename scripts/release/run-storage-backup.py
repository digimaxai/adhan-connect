#!/usr/bin/env python3
"""Inject the existing EAS environment without displaying credentials."""
import argparse,os,shlex,subprocess
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('environment',choices=['preview','production'])
parser.add_argument('--destination',required=True)
args=parser.parse_args()
script=Path(__file__).with_name('backup-storage.mjs').resolve()
command=shlex.join(['node',str(script),args.environment,str(Path(args.destination).resolve())])
result=subprocess.run(['eas','env:exec',args.environment,command,'--non-interactive'],env=dict(os.environ,EXPO_NO_DOTENV='1',CI='1'),capture_output=True,text=True)
for line in result.stdout.splitlines():
    if line.startswith(('BACKUP_RESULT ','BACKUP_ERROR ')):print(line)
if result.returncode:
    print('Storage backup failed, exit',result.returncode)
    for reason in ['ENOTFOUND','not logged in','not authorized','existing backup manifest','project mismatch']:
        if reason.lower() in (result.stdout+result.stderr).lower():print('Reason:',reason)
raise SystemExit(result.returncode)
