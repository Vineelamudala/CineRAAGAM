-- Player ranks in get_my_stats() and the admin "who played" report.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.guesses;
delete from public.plays;
delete from public.daily_challenges;

insert into auth.users (id, aud, role, is_anonymous, raw_app_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', true, '{}'),   -- named, 3 pts
  ('b2222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', true, '{}'),   -- named, 2 pts
  ('c3333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', true, '{}'),   -- unnamed, played
  ('d4444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', true, '{}'),   -- named, never played
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', false, '{"role":"admin"}');
update public.profiles set display_name = 'Asha' where id = 'a1111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'Bala' where id = 'b2222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'Dev' where id = 'd4444444-4444-4444-4444-444444444444';
update public.profiles set display_name = 'Boss' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';

insert into public.movies (id, title, release_year) values
  ('d0000000-0000-0000-0000-0000000000a1', 'Answer Film', 2016),
  ('d0000000-0000-0000-0000-0000000000b1', 'Wrong Film', 2015);
insert into public.clips (id, movie_id, storage_path, kind, duration_ms) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000a1', '11111111-1111-4111-8111-111111111111.mp3', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000a1', '22222222-2222-4222-8222-222222222222.mp3', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-0000000000a1', '33333333-3333-4333-8333-333333333333.mp3', 'bgm', 8000);
insert into public.daily_challenges (id, challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id, status)
values ('c0000000-0000-0000-0000-000000000001', private.ist_today(), 'd0000000-0000-0000-0000-0000000000a1',
        'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'published');

insert into public.plays (id, user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, started_at, finished_at) values
  ('f0000000-0000-0000-0000-00000000000a', 'a1111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001', private.ist_today(), 'daily', 'won', 1, 1, 3, now() - interval '200 minutes', now() - interval '3 hours'),
  ('f0000000-0000-0000-0000-00000000000b', 'b2222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000001', private.ist_today(), 'daily', 'won', 2, 2, 2, now() - interval '140 minutes', now() - interval '2 hours'),
  ('f0000000-0000-0000-0000-00000000000c', 'c3333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-000000000001', private.ist_today(), 'daily', 'won', 1, 1, 3, now() - interval '80 minutes', now() - interval '1 hour'),
  ('f0000000-0000-0000-0000-0000000000ad', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000001', private.ist_today(), 'daily', 'won', 1, 1, 3, now() - interval '5 minutes', now());
insert into public.guesses (play_id, clue_number, movie_id, is_correct) values
  ('f0000000-0000-0000-0000-00000000000a', 1, 'd0000000-0000-0000-0000-0000000000a1', true),
  ('f0000000-0000-0000-0000-00000000000b', 1, 'd0000000-0000-0000-0000-0000000000b1', false),
  ('f0000000-0000-0000-0000-00000000000b', 2, 'd0000000-0000-0000-0000-0000000000a1', true),
  ('f0000000-0000-0000-0000-00000000000c', 1, 'd0000000-0000-0000-0000-0000000000a1', true),
  ('f0000000-0000-0000-0000-0000000000ad', 1, 'd0000000-0000-0000-0000-0000000000a1', true);

set local role authenticated;
create temporary table me_as (who text, stats jsonb) on commit drop;

-- ---------- ranks ----------
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}', true);
select is((public.get_my_stats() ->> 'week_rank')::int, 1, 'the top player is #1 this week');
select is((public.get_my_stats() ->> 'week_ranked')::int, 2, 'out of 2 ranked players (unnamed and admin are not ranked)');
select is((public.get_my_stats() ->> 'all_rank')::int, 1, 'and #1 all time');
select is((public.get_my_stats() ->> 'all_ranked')::int, 2, 'out of 2 all time');
select is(public.get_my_stats() -> 'rank_note', 'null'::jsonb, 'a ranked player has no rank note');
select ok(public.get_my_stats() ? 'distribution' and public.get_my_stats() ? 'week' and public.get_my_stats() ? 'current_streak',
  'existing stats fields are still returned');

select set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":true}', true);
select is((public.get_my_stats() ->> 'week_rank')::int, 2, 'the second player is #2');

select set_config('request.jwt.claims', '{"sub":"c3333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);
select is(public.get_my_stats() ->> 'rank_note', 'no_name', 'an unnamed player is told to add a name');
select is(public.get_my_stats() -> 'week_rank', 'null'::jsonb, 'and has no rank');

select set_config('request.jwt.claims', '{"sub":"d4444444-4444-4444-4444-444444444444","role":"authenticated","is_anonymous":true}', true);
select is(public.get_my_stats() ->> 'rank_note', 'no_points', 'a named player without wins is told to solve a day');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":false,"aal":"aal1","app_metadata":{"role":"admin"}}', true);
select is(public.get_my_stats() ->> 'rank_note', 'admin', 'the admin account is told admin games are not ranked');

-- ---------- admin day report ----------
select is((public.admin_day_report() -> 'challenge' ->> 'title'), 'Answer Film', 'the report shows the day''s movie');
select is((public.admin_day_report() -> 'totals' ->> 'players')::int, 4, 'every player of the day is listed');
select is((public.admin_day_report() -> 'totals' ->> 'on2')::int, 1, 'with how many solved on each clue');
select is(public.admin_day_report() -> 'plays' -> 1 -> 'guesses',
  '[{"clue": 1, "year": 2015, "movie": "Wrong Film", "result": "wrong"}, {"clue": 2, "year": 2016, "movie": "Answer Film", "result": "correct"}]'::jsonb,
  'and what each player guessed on each clue');
select ok((public.admin_day_report() -> 'plays' -> 2 ->> 'player') like 'Guest c33333',
  'unnamed players appear as Guest + a short id');
select is((public.admin_day_report(private.ist_today() + 30) -> 'totals' ->> 'players')::int, 0, 'a day without a challenge is empty');

select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}', true);
select throws_ok($$ select public.admin_day_report() $$, '42501', 'not_admin', 'players cannot see the report');
reset role;
set local role anon;
select throws_ok($$ select public.admin_day_report() $$, '42501', null, 'logged-out visitors cannot call it');
reset role;

select * from finish();
rollback;
