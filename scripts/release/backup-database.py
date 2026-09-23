#!/usr/bin/env python3
"""Read-only Supabase exports to a private directory outside the repository.

This does not restore, reset, link, deploy, or run migrations. Auth/Storage
schema files are recovery evidence, not scripts to apply blindly to managed
schemas. Raw subprocess output stays in private logs because exports may
contain passwords, signing material, or scheduled-job credentials.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone

PROJECTS = {
    "staging": "zhrucqghrqkjyzmupdyy",
    "production": "yecbsezhwvpdkuzmmziv",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("environment", choices=PROJECTS)
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    os.umask(0o077)
    root = Path(args.destination).expanduser().resolve()
    repository = Path(__file__).resolve().parents[2]
    if root == repository or repository in root.parents:
        raise SystemExit("Backups must be outside the repository.")
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    root.chmod(0o700)
    env = dict(os.environ, CI="1")
    exports = [
        ("roles.sql", ["--role-only"]),
        ("schema.sql", []),
        ("data.sql", ["--data-only", "--use-copy", "--exclude", "storage.buckets_vectors,storage.vector_indexes"]),
        ("managed-schema.sql", ["--schema", "auth,storage", "--keep-comments"]),
        ("migration-history-schema.sql", ["--schema", "supabase_migrations"]),
        ("migration-history-data.sql", ["--schema", "supabase_migrations", "--data-only", "--use-copy"]),
    ]
    if args.environment == "staging":
        exports.append(("cron-data.sql", ["--schema", "cron", "--data-only", "--use-copy"]))
    manifest = {
        "environment": args.environment,
        "projectRef": PROJECTS[args.environment],
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "status": "in_progress",
        "restoreVerified": False,
        "snapshotNote": "Each export has its own snapshot; final cutover requires write quiescence and a fresh export.",
        "files": [],
    }
    manifest_path = root / "database-export-manifest.json"
    if manifest_path.exists():
        raise SystemExit("Existing export manifest found; use a new destination to preserve it.")
    def save():
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        manifest_path.chmod(0o600)
    save()
    for filename, options in exports:
        destination = root / filename
        partial = root / (filename + ".partial")
        log = root / (filename + ".log")
        command = ["supabase", "db", "dump", "--linked", "--project-ref", PROJECTS[args.environment], *options, "--file", str(partial)]
        print(args.environment, "exporting", filename, flush=True)
        try:
            with log.open("wb") as output:
                process = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=output, stderr=output, env=env, timeout=240)
            if process.returncode != 0 or not partial.exists() or partial.stat().st_size == 0:
                manifest.update(status="failed", failedExport=filename, returnCode=process.returncode)
                save()
                text = log.read_text(errors="replace")
                reasons = [label for label in ["password authentication failed", "connection refused", "permission denied", "could not connect", "no password supplied", "initialising login role", "failed to inspect docker image", "pull access denied", "timed out"] if label in text.lower()]
                print("Export failed; private log retained. Indicators:", reasons, flush=True)
                raise SystemExit(1)
            partial.chmod(0o600)
            partial.rename(destination)
            manifest["files"].append({"name": filename, "bytes": destination.stat().st_size, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()})
            save()
            print(args.environment, "saved", filename, destination.stat().st_size, "bytes", flush=True)
        except subprocess.TimeoutExpired:
            manifest.update(status="failed", failedExport=filename, reason="timeout")
            save()
            raise SystemExit("Export timed out; private files retained.")
    manifest.update(status="exports_complete_restore_unverified", completedAt=datetime.now(timezone.utc).isoformat())
    save()
    print(args.environment, "exports finished; restoration and Storage verification still required", flush=True)


if __name__ == "__main__":
    main()
