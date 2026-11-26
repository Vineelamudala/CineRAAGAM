#!/bin/sh
# Applies supabase/migrations/*.sql in filename order, exactly once each.
# Each migration and its bookkeeping row run in one transaction, so a failed
# migration leaves nothing half-applied. Uses the same tracking table as the
# Supabase CLI (supabase_migrations.schema_migrations).
set -eu

export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL="psql -h db -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X"

echo "migrate: waiting for the database…"
until pg_isready -h db -U postgres -q; do sleep 2; done

# Auth and Storage create their own schemas on start-up; our migrations need them.
for t in auth.users storage.buckets storage.objects; do
  until [ "$($PSQL -tAc "select to_regclass('$t') is not null")" = "t" ]; do
    echo "migrate: waiting for $t…"; sleep 2
  done
done

$PSQL -c "create schema if not exists supabase_migrations;
          create table if not exists supabase_migrations.schema_migrations (
            version text primary key, statements text[], name text)"

applied=0
for f in $(ls /migrations/*.sql | sort); do
  file=$(basename "$f" .sql)
  version=${file%%_*}
  name=${file#*_}
  if [ "$($PSQL -tAc "select count(*) from supabase_migrations.schema_migrations where version = '$version'")" = "1" ]; then
    continue
  fi
  echo "migrate: applying $file"
  { cat "$f"; printf "\ninsert into supabase_migrations.schema_migrations (version, name) values ('%s', '%s');\n" "$version" "$name"; } \
    | $PSQL --single-transaction -f -
  applied=$((applied + 1))
done
echo "migrate: done ($applied new migration(s))"
