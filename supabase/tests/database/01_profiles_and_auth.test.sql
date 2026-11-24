-- Anonymous players, profiles and display names.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Two anonymous players.
insert into auth.users (id, aud, role, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', true),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', true);

select is((select count(*) from public.profiles where id in
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2::bigint,
  'a profile is created automatically for every new auth user');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), null,
  'new players start without a display name');

-- ---- as player A ----
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select is(public.set_display_name('  Ravi   Teja '), 'Ravi Teja', 'set_display_name trims and collapses spaces');
select is((select display_name from public.profiles where id = auth.uid()), 'Ravi Teja', 'display name is saved');
select is(public.set_display_name('రవి తేజ'), 'రవి తేజ', 'Telugu names are allowed');
select is(public.set_display_name('Ravi Teja'), 'Ravi Teja', 'a player can change their name');

select throws_ok($$ select public.set_display_name('a') $$, '22023', 'invalid_display_name', 'too-short names are rejected');
select throws_ok($$ select public.set_display_name('x123456789x123456789x') $$, '22023', 'invalid_display_name', 'too-long names are rejected');
select throws_ok($$ select public.set_display_name('<script>') $$, '22023', 'invalid_display_name', 'markup is rejected');
select throws_ok($$ select public.set_display_name('Ravi 🎵') $$, '22023', 'invalid_display_name', 'emoji are rejected');
select throws_ok($$ select public.set_display_name(null) $$, '22023', 'invalid_display_name', 'null is rejected');

select throws_ok($$ update public.profiles set display_name = 'Hacker' $$, '42501', null,
  'direct display_name updates are not permitted');
update public.profiles set is_hidden = true; -- RLS: only admins may moderate; affects no rows
select is((select count(*) from public.profiles), 1::bigint, 'a player sees only their own profile');

reset role;
select is((select is_hidden from public.profiles where id = '11111111-1111-1111-1111-111111111111'), false,
  'players cannot un/hide themselves (moderation is admin-only)');

-- ---- as player B ----
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select throws_ok($$ select public.set_display_name('ravi TEJA') $$, '23505', 'display_name_taken',
  'names are unique ignoring case');
select is(public.set_display_name('Ravi Teja 2'), 'Ravi Teja 2', 'a different name works');
select is_empty($$ select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  'player B cannot read player A''s profile');

reset role;

-- ---- not signed in ----
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select public.set_display_name('Someone') $$, '42501', null, 'signed-out visitors cannot set names');
reset role;

-- ---- auth hook: who may be created ----
select is(private.before_user_created('{"user":{"is_anonymous":true}}'), '{}'::jsonb, 'hook allows anonymous players');
select is(private.before_user_created('{"user":{"is_anonymous":false,"app_metadata":{"role":"admin"}}}'), '{}'::jsonb,
  'hook allows operator-created admins');
select is((private.before_user_created('{"user":{"is_anonymous":false,"email":"x@example.com","app_metadata":{"provider":"email"}}}')
  -> 'error' ->> 'http_code')::int, 403, 'hook rejects e-mail self sign-ups');

select * from finish();
rollback;
