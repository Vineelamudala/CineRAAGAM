-- Server-side game rules: guessing, points, unlocking, reveal, midnight rule.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from a clean slate (inside this transaction, rolled back at the end),
-- so existing local data such as seeded challenges cannot affect the results.
delete from public.guesses;
delete from public.plays;
delete from public.daily_challenges;

-- ---------- fixtures (as table owner) ----------
insert into auth.users (id, aud, role, is_anonymous) values
  ('a1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', true),
  ('b2222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', true);

insert into public.movies (id, title, release_year, is_active) values
  ('d0000000-0000-0000-0000-00000000000a', 'Secret Answer Movie', 2019, true),
  ('d0000000-0000-0000-0000-00000000000b', 'Decoy Movie', 2018, true),
  ('d0000000-0000-0000-0000-00000000000c', 'Retired Movie', 2001, false);
insert into public.movie_cast (movie_id, person_name, billing_order) values
  ('d0000000-0000-0000-0000-00000000000a', 'Lead Actor', 1),
  ('d0000000-0000-0000-0000-00000000000a', 'Lead Actress', 2);
insert into public.clips (id, movie_id, storage_path, kind, duration_ms) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000a', '22222222-2222-4222-8222-222222222222.webm', 'song_interlude', 12000),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-00000000000a', '33333333-3333-4333-8333-333333333333.webm', 'bgm', 15000);

create temporary table d as select private.ist_today() as today;
grant select on d to authenticated, anon;

insert into public.daily_challenges (challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id, status)
select dt, 'd0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001',
       'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', st::public.challenge_status
from d, (values (0, 'published'), (-1, 'published'), (-2, 'published'), (1, 'published'), (-3, 'draft')) v(off, st),
     lateral (select d.today + v.off as dt) x;

-- ---------- player A ----------
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select ok(public.get_challenge() is not null, 'today''s challenge is available');
select is(public.get_challenge() ->> 'date', (select today::text from d), 'get_challenge() defaults to today (IST)');
select is(public.get_challenge() -> 'play', 'null'::jsonb, 'no play exists before the first guess');
select ok(public.get_challenge() -> 'clips' -> 0 ->> 'path' is not null, 'clue 1 audio is unlocked from the start');
select ok(public.get_challenge() -> 'clips' -> 1 ->> 'path' is null, 'clue 2 audio is locked at the start');
select ok(public.get_challenge() -> 'clips' -> 2 ->> 'path' is null, 'clue 3 audio is locked at the start');
select is(public.get_challenge() -> 'reveal', 'null'::jsonb, 'nothing is revealed before the game ends');
select ok(public.get_challenge()::text not like '%Secret Answer Movie%'
      and public.get_challenge()::text not like '%d0000000-0000-0000-0000-00000000000a%',
  'the answer (title or id) never appears in an unfinished game');

select is(public.get_challenge((select today + 1 from d)), null, 'future challenges are invisible');
select is(public.get_challenge((select today - 3 from d)), null, 'draft challenges are invisible');
select throws_ok($$ select public.submit_guess((select today + 1 from d), 1, null) $$, 'P0002', 'challenge_not_found',
  'cannot play a future challenge');

select ok(private.can_read_clip('11111111-1111-4111-8111-111111111111.webm'), 'clue 1 file is readable');
select ok(not private.can_read_clip('22222222-2222-4222-8222-222222222222.webm'), 'clue 2 file is NOT readable yet');

-- wrong guess on clue 1
select is((public.submit_guess((select today from d), 1, 'd0000000-0000-0000-0000-00000000000b') -> 'play' ->> 'current_clue')::int, 2,
  'a wrong guess unlocks clue 2');
select is(public.get_challenge() -> 'play' ->> 'mode', 'daily', 'playing today''s challenge today is a daily play');
select is(public.get_challenge() -> 'guesses' -> 0 ->> 'result', 'wrong', 'the wrong guess is recorded');
select is(public.get_challenge() -> 'guesses' -> 0 ->> 'movie_title', 'Decoy Movie', 'the player sees what they guessed');
select ok(public.get_challenge() -> 'clips' -> 1 ->> 'path' is not null, 'clue 2 audio path is now given');
select ok(private.can_read_clip('22222222-2222-4222-8222-222222222222.webm'), 'clue 2 file is now readable');
select ok(not private.can_read_clip('33333333-3333-4333-8333-333333333333.webm'), 'clue 3 file is still locked');

-- duplicate / stale submission for clue 1 changes nothing (even if correct)
select is((public.submit_guess((select today from d), 1, 'd0000000-0000-0000-0000-00000000000a') -> 'play' ->> 'current_clue')::int, 2,
  'a repeated submission for an old clue is ignored');
select is(public.get_challenge() -> 'play' ->> 'status', 'playing', 'the game is still in progress');
select is(jsonb_array_length(public.get_challenge() -> 'guesses'), 1, 'still exactly one guess recorded');

select throws_ok($$ select public.submit_guess((select today from d), 2, gen_random_uuid()) $$, '22023', 'unknown_movie',
  'guesses must be real movies');
select throws_ok($$ select public.submit_guess((select today from d), 2, 'd0000000-0000-0000-0000-00000000000c') $$, '22023', 'unknown_movie',
  'retired movies cannot be guessed');

-- skip clue 2, solve on clue 3
select is((public.submit_guess((select today from d), 2, null) -> 'play' ->> 'current_clue')::int, 3, 'a skip unlocks clue 3');
select is(public.get_challenge() -> 'guesses' -> 1 ->> 'result', 'skipped', 'the skip is recorded');
select is(public.submit_guess((select today from d), 3, 'd0000000-0000-0000-0000-00000000000a') -> 'play' ->> 'status', 'won',
  'a correct guess wins');
select is((public.get_challenge() -> 'play' ->> 'points')::int, 1, 'solving on clue 3 earns 1 point');
select is(public.get_challenge() -> 'reveal' ->> 'title', 'Secret Answer Movie', 'the movie is revealed after the game');
select is(public.get_challenge() -> 'reveal' -> 'cast', '["Lead Actor", "Lead Actress"]'::jsonb, 'main cast is revealed in billing order');
select ok(public.get_challenge() -> 'clips' -> 2 ->> 'path' is not null, 'all clues can be replayed after the game');
select is(public.submit_guess((select today from d), 3, 'd0000000-0000-0000-0000-00000000000b') -> 'play' ->> 'status', 'won',
  'nothing changes after the game is finished');

-- past day = time travel
select is(public.submit_guess((select today - 1 from d), 1, 'd0000000-0000-0000-0000-00000000000a') -> 'play' ->> 'mode', 'time_travel',
  'playing a past day is a time-travel play');
select is((public.get_challenge((select today - 1 from d)) -> 'play' ->> 'points')::int, 0,
  'solving a past day on clue 1 in Time Travel gives NO points');
select is(public.get_challenge((select today - 1 from d)) -> 'play' ->> 'status', 'won',
  '...but it is still recorded as solved');

reset role;

-- ---------- player B ----------
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select is(public.get_challenge() -> 'play', 'null'::jsonb, 'players cannot see each other''s progress');
select ok(not private.can_read_clip('22222222-2222-4222-8222-222222222222.webm'), 'another player''s unlocks do not apply to me');
select is((public.submit_guess((select today from d), 1, 'd0000000-0000-0000-0000-00000000000a') -> 'play' ->> 'points')::int, 3,
  'solving on clue 1 earns 3 points');
reset role;

-- ---------- midnight rule ----------
insert into public.plays (user_id, challenge_id, challenge_date, mode)
select 'b2222222-2222-2222-2222-222222222222', c.id, c.challenge_date, 'daily'
from public.daily_challenges c, d where c.challenge_date = d.today - 2;

set local role authenticated;
select is(public.get_challenge((select today - 2 from d)) -> 'play' ->> 'mode', 'time_travel',
  'an unfinished daily play becomes time travel after midnight IST');
select is((public.submit_guess((select today - 2 from d), 1, 'd0000000-0000-0000-0000-00000000000a') -> 'play' ->> 'status'), 'won',
  '...and can still be finished for fun');
select is((select count(*) from public.plays where mode = 'daily' and challenge_date < (select today from d)), 0::bigint,
  'no unfinished past daily plays remain for this player');

-- ---------- time travel list ----------
select is(jsonb_array_length(public.list_past_challenges()), 2, 'only published past days are listed (not today, future or drafts)');
select is(public.list_past_challenges() -> 0 ->> 'date', (select (today - 1)::text from d), 'newest past day first');
select is(public.list_past_challenges() -> 1 ->> 'status', 'won', 'the list shows my result for each day');
reset role;

-- ---------- signed-out visitors ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select public.get_challenge() $$, '42501', null, 'signed-out visitors cannot read challenges');
select throws_ok($$ select public.submit_guess(current_date, 1, null) $$, '42501', null, 'signed-out visitors cannot guess');
reset role;

-- ---------- numbering ----------
select is(private.challenge_number((select today from d)), 3, 'challenge numbers count published days up to the date');

select * from finish();
rollback;
