-- Streaks, statistics, leaderboards and history.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Clean slate inside this transaction (rolled back at the end).
delete from public.guesses;
delete from public.plays;
delete from public.daily_challenges;

create temporary table d as select private.ist_today() as t;
grant select on d to authenticated;

-- Players: A, B, C, H, I are normal named players; D only time-travels;
-- E is hidden; F has no name; G is an admin.
insert into auth.users (id, aud, role, is_anonymous, raw_app_meta_data) values
  ('a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', true, '{}'),
  ('b0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', true, '{}'),
  ('c0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', true, '{}'),
  ('d0000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', true, '{}'),
  ('e0000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', true, '{}'),
  ('f0000000-0000-0000-0000-00000000000f', 'authenticated', 'authenticated', true, '{}'),
  ('90000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', false, '{"role":"admin"}'),
  ('80000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', true, '{}'),
  ('70000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', true, '{}');
update public.profiles set display_name = v.n from (values
  ('a0000000-0000-0000-0000-00000000000a'::uuid, 'Alice'), ('b0000000-0000-0000-0000-00000000000b', 'Bob'),
  ('c0000000-0000-0000-0000-00000000000c', 'Cara'), ('d0000000-0000-0000-0000-00000000000d', 'Dev'),
  ('e0000000-0000-0000-0000-00000000000e', 'Eve'), ('90000000-0000-0000-0000-000000000009', 'Admin'),
  ('80000000-0000-0000-0000-000000000008', 'Hari'), ('70000000-0000-0000-0000-000000000007', 'Indu')) v(id, n)
where profiles.id = v.id;
update public.profiles set is_hidden = true where id = 'e0000000-0000-0000-0000-00000000000e';

insert into public.movies (id, title, release_year) values ('11111111-0000-0000-0000-000000000001', 'Answer Movie', 2020);
insert into public.clips (id, movie_id, storage_path, kind, duration_ms) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'b1111111-1111-4111-8111-111111111111.webm', 'bgm', 8000),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'b2222222-2222-4222-8222-222222222222.webm', 'bgm', 8000),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'b3333333-3333-4333-8333-333333333333.webm', 'bgm', 8000);

-- Published days: T-6, T-5, T-4, (no challenge on T-3), T-2, T-1, T.  Plus a draft on T-3? no.
insert into public.daily_challenges (challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id, status)
select d.t + o, '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
       '22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', 'published'
from d, unnest(array[-6, -5, -4, -2, -1, 0]) o;

-- Helpers to record finished plays (as table owner).
create function pg_temp.won(u uuid, o int, clue int, at timestamptz default now(), m public.play_mode default 'daily')
returns void language sql as $$
  insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, finished_at)
  select u, c.id, c.challenge_date, m, 'won', clue, clue,
         case when m = 'time_travel' then 0 else case clue when 1 then 3 when 2 then 2 else 1 end end, at
  from public.daily_challenges c, d where c.challenge_date = d.t + o
$$;
create function pg_temp.lost(u uuid, o int) returns void language sql as $$
  insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, points, finished_at)
  select u, c.id, c.challenge_date, 'daily', 'lost', 3, 0, now()
  from public.daily_challenges c, d where c.challenge_date = d.t + o
$$;

-- Alice: solved every published day except today (not played yet) — 15 pts.
select pg_temp.won('a0000000-0000-0000-0000-00000000000a', o, 1) from unnest(array[-6, -5, -4, -2, -1]) o;
-- Bob: won, won, LOST, won, won, won(today) — 3+3+1+1+2 = 10 pts.
select pg_temp.won('b0000000-0000-0000-0000-00000000000b', -6, 1), pg_temp.won('b0000000-0000-0000-0000-00000000000b', -5, 1);
select pg_temp.lost('b0000000-0000-0000-0000-00000000000b', -4);
select pg_temp.won('b0000000-0000-0000-0000-00000000000b', -2, 3), pg_temp.won('b0000000-0000-0000-0000-00000000000b', -1, 3);
select pg_temp.won('b0000000-0000-0000-0000-00000000000b', 0, 2);
-- Hari: 3 pts from 2 solves. Indu and Cara: 3 pts from 1 solve; Indu got there first.
select pg_temp.won('80000000-0000-0000-0000-000000000008', -2, 2), pg_temp.won('80000000-0000-0000-0000-000000000008', -1, 3);
select pg_temp.won('70000000-0000-0000-0000-000000000007', -1, 1, now() - interval '2 hours');
select pg_temp.won('c0000000-0000-0000-0000-00000000000c', -1, 1, now() - interval '1 hour');
select pg_temp.lost('c0000000-0000-0000-0000-00000000000c', 0);
-- Dev: only time travel; Eve (hidden), Fred (no name), Admin: lots of points.
select pg_temp.won('d0000000-0000-0000-0000-00000000000d', o, 1, now(), 'time_travel') from unnest(array[-6, -5, -4]) o;
select pg_temp.won(u, o, 1) from unnest(array['e0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-00000000000f',
  '90000000-0000-0000-0000-000000000009']::uuid[]) u, unnest(array[-6, -5, -4, -2, -1, 0]) o;

-- ---------- streaks ----------
select is((select current_streak from private.streaks('a0000000-0000-0000-0000-00000000000a')), 5,
  'a missing challenge day (no show) does not break the streak; today not played yet keeps it');
select is((select best_streak from private.streaks('a0000000-0000-0000-0000-00000000000a')), 5, 'best streak = 5');
select is((select current_streak from private.streaks('b0000000-0000-0000-0000-00000000000b')), 3, 'a lost day resets the streak');
select is((select best_streak from private.streaks('b0000000-0000-0000-0000-00000000000b')), 3, 'best streak is the longest run');
select is((select current_streak from private.streaks('c0000000-0000-0000-0000-00000000000c')), 0, 'losing today ends the streak');
select is((select best_streak from private.streaks('c0000000-0000-0000-0000-00000000000c')), 1, '...but the best streak remains');
select is((select current_streak from private.streaks('d0000000-0000-0000-0000-00000000000d')), 0, 'time travel never counts for streaks');

-- Alice starts today but hasn't finished: still 5.
insert into public.plays (user_id, challenge_id, challenge_date, mode)
select 'a0000000-0000-0000-0000-00000000000a', c.id, c.challenge_date, 'daily' from public.daily_challenges c, d where c.challenge_date = d.t;
select is((select current_streak from private.streaks('a0000000-0000-0000-0000-00000000000a')), 5, 'a game in progress today keeps the streak');

-- ---------- leaderboard (as Cara) ----------
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select results_eq(
  $$ select r ->> 'name' from jsonb_array_elements(public.get_leaderboard('all') -> 'rows') r $$,
  array['Alice', 'Bob', 'Hari', 'Indu', 'Cara'],
  'all-time: points, then days solved, then who got there first; hidden, unnamed, admin and time-travel players excluded');
select results_eq(
  $$ select (r ->> 'rank')::int from jsonb_array_elements(public.get_leaderboard('all') -> 'rows') r $$,
  array[1, 2, 3, 4, 5], 'ranks are 1..5');
select is((public.get_leaderboard('all') -> 'rows' -> 0 ->> 'points')::int, 15, 'Alice has 15 points');
select is((public.get_leaderboard('all') -> 'rows' -> 1 ->> 'solved')::int, 5, 'Bob solved 5 days');
select is(public.get_leaderboard('all', 2) -> 'me' ->> 'rank', '5', 'my rank is shown even outside the top rows');
select is(jsonb_array_length(public.get_leaderboard('all', 2) -> 'rows'), 2, 'the row limit is respected');
select is((public.get_leaderboard('all') -> 'rows' -> 4 ->> 'is_me')::boolean, true, 'my row is flagged');
select is((public.get_leaderboard('all') ->> 'total')::int, 5, 'total ranked players');

select is((public.get_leaderboard('week') -> 'rows' -> 0 ->> 'name') is not null
          or jsonb_array_length(public.get_leaderboard('week') -> 'rows') = 0, true, 'weekly board works');
select is(
  coalesce((select (r ->> 'points')::int from jsonb_array_elements(public.get_leaderboard('week') -> 'rows') r where r ->> 'name' = 'Alice'), 0),
  (select count(*)::int * 3 from unnest(array[-6, -5, -4, -2, -1]) o, d where d.t + o >= date_trunc('week', d.t::timestamp)::date),
  'weekly points count only days since Monday (IST)');
select is(
  coalesce((select (r ->> 'points')::int from jsonb_array_elements(public.get_leaderboard('month') -> 'rows') r where r ->> 'name' = 'Alice'), 0),
  (select count(*)::int * 3 from unnest(array[-6, -5, -4, -2, -1]) o, d where d.t + o >= date_trunc('month', d.t::timestamp)::date),
  'monthly points count only days since the 1st (IST)');
select throws_ok($$ select public.get_leaderboard('year') $$, '22023', 'invalid_period', 'unknown periods are rejected');

-- ---------- my stats (as Bob) ----------
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select is((public.get_my_stats() ->> 'played')::int, 6, 'played counts finished daily games');
select is((public.get_my_stats() ->> 'won')::int, 5, 'won');
select is((public.get_my_stats() ->> 'win_rate')::int, 83, 'win rate is rounded');
select is((public.get_my_stats() ->> 'total_points')::int, 10, 'total points');
select is(public.get_my_stats() -> 'distribution', '{"1": 2, "2": 1, "3": 2, "missed": 1}'::jsonb, 'solved-on-clue distribution');
select is((public.get_my_stats() ->> 'current_streak')::int, 3, 'current streak in stats');
select is(jsonb_array_length(public.get_my_stats() -> 'week'), 7, 'the week strip has 7 days');
select is((select count(*)::int from jsonb_array_elements(public.get_my_stats() -> 'week') w where (w ->> 'is_today')::boolean), 1,
  'exactly one day is today');

-- ---------- history (as Alice) ----------
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select is(jsonb_array_length(public.get_my_history()), 6, 'history lists every published day since I started');
select is(public.get_my_history() -> 0 ->> 'date', (select t::text from d), 'newest first');
select is(public.get_my_history() -> 0 ->> 'title', null, 'an unfinished game does not reveal the movie in history');
select is(public.get_my_history() -> 1 ->> 'title', 'Answer Movie', 'finished games show the movie');
select is((public.get_my_history() -> 1 ->> 'points')::int, 3, 'and the points earned');
reset role;

-- ---------- signed-out ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select public.get_leaderboard('all') $$, '42501', null, 'signed-out visitors cannot read leaderboards');
select throws_ok($$ select public.get_my_stats() $$, '42501', null, 'signed-out visitors have no stats');
reset role;

select * from finish();
rollback;
