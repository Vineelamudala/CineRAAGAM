-- Admins merge a duplicate movie into the right one (admin page "Merge into this movie").
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.guesses;
delete from public.plays;
delete from public.daily_challenges;

insert into auth.users (id, aud, role, is_anonymous, raw_app_meta_data) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', false, '{"role":"admin"}'),
  ('c3333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', true, '{}');

insert into public.movies (id, title, release_year, aliases, wikidata_id, imdb_id) values
  -- the answer (has the clips and today's challenge)
  ('d0000000-0000-0000-0000-0000000000a1', 'Baahubali: The Conclusion', 2017, '{"Baahubali 2"}', null, null),
  -- a Wikidata duplicate under a different name (not a mere spelling variant)
  ('d0000000-0000-0000-0000-0000000000a2', 'Baahubali 2: The Conclusion', 2017, '{"BB2"}', 'Q90000011', 'tt9000011'),
  -- a hand-added duplicate without ids
  ('d0000000-0000-0000-0000-0000000000a3', 'Bahubali Conclusion', 2017, '{}', null, null),
  -- a movie that has its own clips
  ('d0000000-0000-0000-0000-0000000000a4', 'Has Clips', 2017, '{}', null, null);
insert into public.movie_cast (movie_id, person_name, billing_order) values
  ('d0000000-0000-0000-0000-0000000000a2', 'Prabhas', 1);
insert into public.clips (id, movie_id, storage_path, kind, duration_ms) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000a1', '11111111-1111-4111-8111-111111111111.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000a1', '22222222-2222-4222-8222-222222222222.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-0000000000a1', '33333333-3333-4333-8333-333333333333.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-0000000000a4', '44444444-4444-4444-8444-444444444444.webm', 'bgm', 8000);
insert into public.daily_challenges (id, challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id, status)
values ('c0000000-0000-0000-0000-000000000001', private.ist_today(), 'd0000000-0000-0000-0000-0000000000a1',
        'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'published');

-- Player C picked the duplicate on clue 2 (marked wrong), then skipped clue 3 and lost.
insert into public.plays (id, user_id, challenge_id, challenge_date, mode, status, current_clue, points, finished_at) values
  ('f0000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-000000000001',
   private.ist_today(), 'daily', 'lost', 3, 0, now());
insert into public.guesses (play_id, clue_number, movie_id, is_correct) values
  ('f0000000-0000-0000-0000-000000000001', 1, null, false),
  ('f0000000-0000-0000-0000-000000000001', 2, 'd0000000-0000-0000-0000-0000000000a2', false),
  ('f0000000-0000-0000-0000-000000000001', 3, null, false);

-- ---------- players cannot merge ----------
select set_config('request.jwt.claims', '{"sub":"c3333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$ select public.admin_merge_movie('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000a1') $$,
  '42501', 'not_admin', 'players cannot merge movies');
reset role;
set local role anon;
select throws_ok($$ select public.admin_merge_movie('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'logged-out visitors cannot call it at all');
reset role;

-- ---------- admin ----------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":false,"aal":"aal1","app_metadata":{"role":"admin"}}', true);
set local role authenticated;

select throws_ok($$ select public.admin_merge_movie('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000a1') $$,
  '22023', 'same_movie', 'a movie cannot be merged into itself');
select throws_ok($$ select public.admin_merge_movie('d0000000-0000-0000-0000-0000000000a4', 'd0000000-0000-0000-0000-0000000000a1') $$,
  '23503', 'duplicate_has_clips', 'a movie with its own clips is not merged away');

select is(public.admin_merge_movie('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000a1') ->> 'plays_corrected', '1',
  'merging the Wikidata duplicate re-scores the player who picked it');
reset role;

select is((select array[array_to_string(aliases, ','), coalesce(imdb_id, '-'), coalesce(wikidata_id, '-')]
             from public.movies where id = 'd0000000-0000-0000-0000-0000000000a1'),
  array['Baahubali 2,Baahubali 2: The Conclusion,BB2', 'tt9000011', 'Q90000011'],
  'the kept movie gains the other names and the IMDb/Wikidata ids');
select ok(not exists (select 1 from public.movies where id = 'd0000000-0000-0000-0000-0000000000a2'),
  'the duplicate is removed (its Wikidata id moved to the kept movie)');
select is((select person_name from public.movie_cast where movie_id = 'd0000000-0000-0000-0000-0000000000a1'), 'Prabhas',
  'its cast moves to the kept movie');
select is((select array[status::text, solved_on_clue::text, points::text] from public.plays where id = 'f0000000-0000-0000-0000-000000000001'),
  array['won', '2', '2'], 'the player now has a win on clue 2 with 2 points');
select is((select count(*)::int from public.guesses where play_id = 'f0000000-0000-0000-0000-000000000001'), 2,
  'the skip after the winning clue is removed');
select is((select movie_id::text from public.guesses where play_id = 'f0000000-0000-0000-0000-000000000001' and clue_number = 2),
  'd0000000-0000-0000-0000-0000000000a1', 'the guess now points at the kept movie');

-- A hand-added duplicate (no ids) is simply deleted.
set local role authenticated;
select is(public.admin_merge_movie('d0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-0000000000a1') ->> 'deleted', 'true',
  'a hand-added duplicate is deleted');
reset role;
select ok((select 'Bahubali Conclusion' = any(aliases) from public.movies where id = 'd0000000-0000-0000-0000-0000000000a1'),
  'its title is kept as another name');

-- A duplicate whose Wikidata id cannot move (the kept movie has one) stays hidden, so imports don't re-add it.
insert into public.movies (id, title, release_year, wikidata_id) values
  ('d0000000-0000-0000-0000-0000000000a5', 'Baahubali Two', 2017, 'Q90000012');
set local role authenticated;
select is(public.admin_merge_movie('d0000000-0000-0000-0000-0000000000a5', 'd0000000-0000-0000-0000-0000000000a1') ->> 'deleted', 'false',
  'a duplicate that still holds its own Wikidata id is hidden instead of deleted');
reset role;
select is((select array[is_active::text, wikidata_id] from public.movies where id = 'd0000000-0000-0000-0000-0000000000a5'),
  array['false', 'Q90000012'], 'hidden from players, Wikidata id remembered');

select * from finish();
rollback;
