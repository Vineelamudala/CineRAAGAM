-- Baseline security invariants: RLS everywhere, nothing exposed by accident.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is_empty(
  $$ select tablename::text from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'every table in public has Row Level Security enabled'
);

-- Anonymous (not signed in) visitors may only read the movie catalogue.
select ok(has_table_privilege('anon', 'public.movies', 'select'), 'anon can read movies (autocomplete)');
select ok(not has_table_privilege('anon', 'public.daily_challenges', 'select'), 'anon cannot read daily_challenges (answers)');
select ok(not has_table_privilege('anon', 'public.clips', 'select'), 'anon cannot read clips');
select ok(not has_table_privilege('anon', 'public.movie_cast', 'select'), 'anon cannot read cast');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon cannot read profiles');
select ok(not has_table_privilege('anon', 'public.plays', 'select'), 'anon cannot read plays');
select ok(not has_table_privilege('anon', 'public.guesses', 'select'), 'anon cannot read guesses');
select ok(not has_table_privilege('anon', 'public.movies', 'insert'), 'anon cannot write movies');

-- Players can never write game state directly (only via server functions).
select ok(not has_table_privilege('authenticated', 'public.plays', 'insert'), 'players cannot insert plays');
select ok(not has_table_privilege('authenticated', 'public.plays', 'update'), 'players cannot update plays');
select ok(not has_table_privilege('authenticated', 'public.plays', 'delete'), 'players cannot delete plays');
select ok(not has_table_privilege('authenticated', 'public.guesses', 'insert'), 'players cannot insert guesses');
select ok(not has_table_privilege('authenticated', 'public.guesses', 'update'), 'players cannot update guesses');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'players cannot insert profiles');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update'),
  'players cannot update display_name directly (must use set_display_name)');

-- No function in public is callable without signing in.
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute any public function'
);
select ok(has_function_privilege('authenticated', 'public.set_display_name(text)', 'execute'),
  'players can call set_display_name');
select ok(not has_function_privilege('authenticated', 'private.before_user_created(jsonb)', 'execute'),
  'players cannot call the auth hook');
select ok(has_function_privilege('supabase_auth_admin', 'private.before_user_created(jsonb)', 'execute'),
  'auth server can call the auth hook');

-- Audio bucket is private.
select is((select public from storage.buckets where id = 'clips'), false, 'clips bucket is private');
select is((select file_size_limit from storage.buckets where id = 'clips'), 5242880::bigint, 'clips bucket limits file size to 5 MB');

select * from finish();
rollback;
