-- Security invariants for any Cineraagam database (local, self-hosted or Supabase Cloud).
-- Every line should report "none" / "false" except "anon can SELECT: movies".
select 'tables without RLS: ' || coalesce(string_agg(tablename, ','), 'none') as check
  from pg_tables where schemaname = 'public' and not rowsecurity
union all
select 'public functions anon can run: ' || coalesce(string_agg(p.proname, ','), 'none')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
union all
select 'anon can SELECT: ' || coalesce(string_agg(c.relname, ',' order by c.relname), 'none')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select')
union all
select 'anon can WRITE: ' || coalesce(string_agg(c.relname, ','), 'none')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))
union all
select 'players can write game tables: ' || coalesce(string_agg(c.relname, ','), 'none')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('plays', 'guesses', 'profiles')
    and (has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'delete'))
union all
select 'clips bucket public: ' || coalesce((select public::text from storage.buckets where id = 'clips'), 'BUCKET MISSING')
union all
select 'auth hook callable by players: ' || has_function_privilege('authenticated', 'private.before_user_created(jsonb)', 'execute')::text
union all
select 'auth hook callable by auth server: ' || has_function_privilege('supabase_auth_admin', 'private.before_user_created(jsonb)', 'execute')::text;
