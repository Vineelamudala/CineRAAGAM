#!/bin/sh
# Backs up the game data and audio files every BACKUP_INTERVAL_HOURS (default 24),
# keeping BACKUP_RETENTION_DAYS (default 14) days of backups in /backups:
#   db-<UTC time>.dump        data of the auth, public and storage schemas (pg_dump custom format)
#   storage-<UTC time>.tar.gz the uploaded audio files
# The schema itself is recreated from supabase/migrations on restore (see restore.sh).
# Copy /backups (./deploy/backups on the host) off the server regularly!
set -eu

export PGPASSWORD="$POSTGRES_PASSWORD"
INTERVAL=$(( ${BACKUP_INTERVAL_HOURS:-24} * 3600 ))
RETENTION=${BACKUP_RETENTION_DAYS:-14}

backup_once() {
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  echo "backup: starting $stamp"
  pg_dump -h db -U supabase_admin -d postgres --format=custom --data-only \
    --schema=public --schema=auth --schema=storage \
    --exclude-table=auth.schema_migrations --exclude-table=storage.migrations \
    --file="/backups/db-$stamp.dump.partial"
  mv "/backups/db-$stamp.dump.partial" "/backups/db-$stamp.dump"
  tar -czf "/backups/storage-$stamp.tar.gz.partial" -C /storage .
  mv "/backups/storage-$stamp.tar.gz.partial" "/backups/storage-$stamp.tar.gz"
  find /backups -maxdepth 1 \( -name 'db-*.dump' -o -name 'storage-*.tar.gz' \) -mtime +"$RETENTION" -delete
  echo "backup: done $stamp ($(du -h "/backups/db-$stamp.dump" | cut -f1) db, $(du -h "/backups/storage-$stamp.tar.gz" | cut -f1) audio)"
}

until pg_isready -h db -U postgres -q; do sleep 2; done
sleep 30 # let migrations finish on first start

if [ "${1:-}" = "--once" ]; then
  backup_once
  exit 0
fi

while true; do
  backup_once || echo "backup: FAILED (will retry next interval)"
  sleep "$INTERVAL"
done
