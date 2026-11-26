#!/bin/sh
# Restores a backup made by backup.sh into a running stack whose schema is
# already up to date (the migrate service has run). Replaces ALL game data.
#
#   docker compose run --rm restore <stamp>
#   (stamp = the part after "db-" in ./backups/db-<stamp>.dump)
set -eu

STAMP="${1:?usage: restore.sh <stamp>, e.g. 20261201T033000Z}"
DUMP="/backups/db-$STAMP.dump"
FILES="/backups/storage-$STAMP.tar.gz"
[ -f "$DUMP" ] || { echo "restore: $DUMP not found"; exit 1; }
[ -f "$FILES" ] || { echo "restore: $FILES not found"; exit 1; }

export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL="psql -h db -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -X"

echo "restore: clearing current data (auth, public, storage)…"
$PSQL <<'SQL'
do $$
declare t text;
begin
  for t in
    select format('%I.%I', schemaname, tablename) from pg_tables
    where schemaname in ('auth', 'public', 'storage')
      and (schemaname, tablename) not in (('auth', 'schema_migrations'), ('storage', 'migrations'))
  loop
    execute 'truncate table ' || t || ' cascade';
  end loop;
end $$;
SQL

echo "restore: loading $DUMP…"
pg_restore -h db -U supabase_admin -d postgres --data-only --disable-triggers --single-transaction --exit-on-error "$DUMP"

echo "restore: restoring audio files…"
find /storage -mindepth 1 -delete
tar -xzf "$FILES" -C /storage

echo "restore: done. Restart the stack: docker compose restart"
