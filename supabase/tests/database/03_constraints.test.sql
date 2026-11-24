-- Data integrity rules enforced by the database itself (run as table owner).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from a clean slate (inside this transaction, rolled back at the end),
-- so existing local data such as seeded challenges cannot affect the results.
delete from public.guesses;
delete from public.plays;
delete from public.daily_challenges;

insert into auth.users (id, aud, role, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', true);
insert into public.movies (id, title) values
  ('d0000000-0000-0000-0000-000000000001', 'Jersey'),
  ('d0000000-0000-0000-0000-000000000002', 'RRR');
insert into public.clips (id, movie_id, storage_path, kind, duration_ms) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '0f8fad5b-d9cb-469f-a165-70867728950e.mp3', 'bgm', 5000),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '7c9e6679-7425-40de-944b-e07fc1f90ae7.mp3', 'bgm', 20000),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', '16fd2706-8baf-433b-82eb-8c7fada847da.ogg', 'song_interlude', 9000),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', '886313e1-3b8a-5372-9b90-0c9aee199e5d.mp3', 'bgm', 9000);

-- ---- clips ----
select throws_ok($$ insert into public.clips (movie_id, storage_path, kind, duration_ms)
  values ('d0000000-0000-0000-0000-000000000001', 'a3bb189e-8bf9-3888-9912-ace4e6543002.mp3', 'bgm', 4999) $$,
  '23514', null, 'clips shorter than 5 seconds are rejected');
select throws_ok($$ insert into public.clips (movie_id, storage_path, kind, duration_ms)
  values ('d0000000-0000-0000-0000-000000000001', 'a3bb189e-8bf9-3888-9912-ace4e6543002.mp3', 'bgm', 20001) $$,
  '23514', null, 'clips longer than 20 seconds are rejected');
select throws_ok($$ insert into public.clips (movie_id, storage_path, kind, duration_ms)
  values ('d0000000-0000-0000-0000-000000000001', 'jersey-bgm-1.mp3', 'bgm', 8000) $$,
  '23514', null, 'clip file names must be opaque UUIDs (cannot reveal the movie)');

-- ---- daily challenges ----
select lives_ok($$ insert into public.daily_challenges (id, challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id)
  values ('f0000000-0000-0000-0000-000000000001', '2026-12-01', 'd0000000-0000-0000-0000-000000000001',
          'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003') $$,
  'a valid challenge is accepted');
select throws_ok($$ insert into public.daily_challenges (challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id)
  values ('2026-12-02', 'd0000000-0000-0000-0000-000000000001',
          'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004') $$,
  '23503', null, 'every clue clip must belong to the challenge movie');
select throws_ok($$ insert into public.daily_challenges (challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id)
  values ('2026-12-02', 'd0000000-0000-0000-0000-000000000001',
          'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003') $$,
  '23514', null, 'the three clues must be different clips');
select throws_ok($$ insert into public.daily_challenges (challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id)
  values ('2026-12-01', 'd0000000-0000-0000-0000-000000000001',
          'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003') $$,
  '23505', null, 'only one challenge per date');
select throws_ok($$ delete from public.clips where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '23503', null, 'a clip used by a challenge cannot be deleted');

-- ---- plays: the points rule lives in the database ----
select lives_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, finished_at)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily', 'won', 2, 2, 2, now()) $$,
  'solved on clue 2 with 2 points is accepted');
delete from public.plays;
select lives_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, finished_at)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily', 'won', 1, 1, 3, now()) $$,
  'solved on clue 1 with 3 points is accepted');
delete from public.plays;
select lives_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, finished_at)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily', 'won', 3, 3, 1, now()) $$,
  'solved on clue 3 with 1 point is accepted');
delete from public.plays;
select lives_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, finished_at)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily', 'lost', 3, null, 0, now()) $$,
  'not solved with 0 points is accepted');
delete from public.plays;

select throws_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, finished_at)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily', 'won', 1, 1, 2, now()) $$,
  '23514', null, 'solved on clue 1 must be exactly 3 points');
select throws_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, finished_at)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily', 'lost', 3, null, 1, now()) $$,
  '23514', null, 'an unsolved game must be 0 points');
select throws_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily', 'won', 1, 1, 3) $$,
  '23514', null, 'a finished game must have finished_at');
select throws_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode, status, current_clue, solved_on_clue, points, finished_at)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily', 'won', 3, 1, 3, now()) $$,
  '23514', null, 'solved_on_clue must equal the clue being played');

-- ---- one play per player per challenge; one guess per clue ----
insert into public.plays (id, user_id, challenge_id, challenge_date, mode)
  values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'daily');
select throws_ok($$ insert into public.plays (user_id, challenge_id, challenge_date, mode)
  values ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', '2026-12-01', 'time_travel') $$,
  '23505', null, 'a player can play each challenge only once');

insert into public.guesses (play_id, clue_number, movie_id, is_correct)
  values ('a0000000-0000-0000-0000-000000000001', 1, 'd0000000-0000-0000-0000-000000000002', false);
select throws_ok($$ insert into public.guesses (play_id, clue_number, movie_id, is_correct)
  values ('a0000000-0000-0000-0000-000000000001', 1, 'd0000000-0000-0000-0000-000000000001', true) $$,
  '23505', null, 'only one guess per clue (duplicate submissions rejected)');
select throws_ok($$ insert into public.guesses (play_id, clue_number, movie_id, is_correct)
  values ('a0000000-0000-0000-0000-000000000001', 2, null, true) $$,
  '23514', null, 'a skip can never be correct');
select throws_ok($$ insert into public.guesses (play_id, clue_number, movie_id, is_correct)
  values ('a0000000-0000-0000-0000-000000000001', 4, null, false) $$,
  '23514', null, 'there are only three clues');

-- ---- profiles ----
select throws_ok($$ update public.profiles set display_name = ' padded ' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'the database rejects badly formatted names even from privileged code');

select * from finish();
rollback;
