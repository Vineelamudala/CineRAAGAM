-- Who can see and change movies, cast, clips and daily challenges (answers).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from a clean slate (inside this transaction, rolled back at the end),
-- so existing local data such as seeded challenges cannot affect the results.
delete from public.guesses;
delete from public.plays;
delete from public.daily_challenges;

insert into auth.users (id, aud, role, is_anonymous, raw_app_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', false, '{"provider":"email","role":"admin"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated', true, '{}'),
  -- an anonymous user that somehow carries an admin claim must NOT be treated as admin
  ('cccccccc-0000-0000-0000-000000000003', 'authenticated', 'authenticated', true, '{"role":"admin"}');

-- ---- admin ----
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false,"app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select ok(private.is_admin(), 'admin is recognised');
select lives_ok($$ insert into public.movies (id, title, release_year) values
  ('d0000000-0000-0000-0000-000000000001', 'Jersey', 2019),
  ('d0000000-0000-0000-0000-000000000002', 'Hidden Movie', 2000) $$, 'admin can add movies');
select lives_ok($$ update public.movies set is_active = false where id = 'd0000000-0000-0000-0000-000000000002' $$,
  'admin can deactivate a movie');
select lives_ok($$ insert into public.movie_cast (movie_id, person_name, billing_order) values
  ('d0000000-0000-0000-0000-000000000001', 'Nani', 1) $$, 'admin can add cast');
select lives_ok($$ insert into public.clips (id, movie_id, storage_path, kind, duration_ms) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '0f8fad5b-d9cb-469f-a165-70867728950e.mp3', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '7c9e6679-7425-40de-944b-e07fc1f90ae7.mp3', 'bgm', 12000),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', '16fd2706-8baf-433b-82eb-8c7fada847da.mp3', 'song_interlude', 15000) $$,
  'admin can add clips');
select lives_ok($$ insert into public.daily_challenges (challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id, status) values
  ('2026-12-01', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'published') $$,
  'admin can schedule a daily challenge');
select is((select count(*) from public.daily_challenges), 1::bigint, 'admin can read challenges');
reset role;

-- ---- anonymous player ----
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select ok(not private.is_admin(), 'a player is not an admin');
select is_empty($$ select 1 from public.daily_challenges $$, 'players cannot see daily challenges (answers)');
select is_empty($$ select 1 from public.clips $$, 'players cannot see clips');
select is_empty($$ select 1 from public.movie_cast $$, 'players cannot see cast before the reveal');
select results_eq($$ select title from public.movies where id::text like 'd0000000%' $$, array['Jersey'],
  'players see active movies only');
select throws_ok($$ insert into public.movies (title) values ('Spam') $$, '42501', null, 'players cannot add movies');
select throws_ok($$ insert into public.daily_challenges (challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id)
  values ('2026-12-02', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
          'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'players cannot create challenges');
update public.movies set title = 'Defaced';           -- RLS: affects no rows
delete from public.movies;                            -- RLS: affects no rows
reset role;
select is((select title from public.movies where id = 'd0000000-0000-0000-0000-000000000001'), 'Jersey',
  'players cannot edit or delete movies');

-- ---- anonymous user with a forged admin claim ----
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true,"app_metadata":{"role":"admin"}}', true);
set local role authenticated;
select ok(not private.is_admin(), 'anonymous users are never admins, even with an admin claim');
select is_empty($$ select 1 from public.daily_challenges $$, 'forged admin claim does not reveal answers');
reset role;

-- ---- signed-out visitor ----
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select isnt_empty($$ select 1 from public.movies $$, 'signed-out visitors can read the catalogue');
select throws_ok($$ select 1 from public.daily_challenges $$, '42501', null, 'signed-out visitors cannot query challenges');
reset role;

select * from finish();
rollback;
