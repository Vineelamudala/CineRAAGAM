-- Spelling variants of the same film: matching key, grading and merging duplicates.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.guesses;
delete from public.plays;
delete from public.daily_challenges;
-- Hide any imported catalogue (rolled back at the end) so only the fixtures below are active.
update public.movies set is_active = false;

-- ---------- the spelling key ----------
select is(private.spelling_key('Sarrainodu'), private.spelling_key('Sarainodu'), 'doubled letters count once');
select is(private.spelling_key('Athidhi'), private.spelling_key('Athidi'), 'th/dh written as t/d');
select is(private.spelling_key('Andarivaadu'), private.spelling_key('Andarivadu'), 'aa written as a');
select is(private.spelling_key('Aadavaallu Meeku Johaarlu'), private.spelling_key('Aadavallu Meeku Joharlu'), 'several variants at once');
select is(private.spelling_key('Veera'), private.spelling_key('Vira'), 'ee written as i');
select is(private.spelling_key('Vishwa'), private.spelling_key('Vishva'), 'w written as v');
select is(private.spelling_key('R.R.R.'), 'r', 'punctuation and case are ignored');
select isnt(private.spelling_key('Baahubali 2'), private.spelling_key('Baahubali'), 'numbers still tell films apart');
select isnt(private.spelling_key('118'), private.spelling_key('1134'), 'numeric titles stay distinct');
-- Same rule as the browser search (lib/search/movies.ts spellingKey):
select is(private.spelling_key('Aadavaallu Meeku Johaarlu'), 'adavalumikujoharlu', 'matches the TypeScript spellingKey output');

-- ---------- fixtures ----------
insert into auth.users (id, aud, role, is_anonymous) values
  ('a1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', true),
  ('b2222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', true),
  ('c3333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', true);

insert into public.movies (id, title, release_year, aliases, wikidata_id, imdb_id) values
  -- answer (hand-added, no ids) and its Wikidata duplicate
  ('d0000000-0000-0000-0000-0000000000a1', 'Sarrainodu', 2016, '{}', null, null),
  ('d0000000-0000-0000-0000-0000000000a2', 'Sarainodu', 2016, '{}', 'Q90000001', 'tt9000001'),
  -- same spelling key, different year: a different film
  ('d0000000-0000-0000-0000-0000000000a3', 'Sarainodu', 1999, '{}', null, null),
  -- an unrelated pair of duplicates, both from Wikidata
  ('d0000000-0000-0000-0000-0000000000b1', 'Athidhi', 2007, '{}', 'Q90000002', 'tt9000002'),
  ('d0000000-0000-0000-0000-0000000000b2', 'Athidi', 2007, '{"Atithi"}', 'Q90000003', null),
  ('d0000000-0000-0000-0000-0000000000c1', 'Decoy Movie', 2018, '{}', null, null);
insert into public.clips (id, movie_id, storage_path, kind, duration_ms) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000a1', '11111111-1111-4111-8111-111111111111.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000a1', '22222222-2222-4222-8222-222222222222.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-0000000000a1', '33333333-3333-4333-8333-333333333333.webm', 'bgm', 8000);
insert into public.daily_challenges (challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id, status)
values (private.ist_today(), 'd0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'published');

select ok(private.same_film_name('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000a1'),
  'Sarainodu (2016) is the same film as Sarrainodu (2016)');
select ok(not private.same_film_name('d0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-0000000000a1'),
  'a same-name film from another year is NOT the same film');
select ok(not private.same_film_name('d0000000-0000-0000-0000-0000000000c1', 'd0000000-0000-0000-0000-0000000000a1'),
  'an unrelated film is not a match');

-- ---------- grading: picking the other spelling wins ----------
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select is(public.submit_guess(private.ist_today(), 1, 'd0000000-0000-0000-0000-0000000000a2') -> 'play' ->> 'status', 'won',
  'picking the other spelling of the answer counts as correct');
select is((public.get_challenge() -> 'play' ->> 'points')::int, 3, 'and earns the full points for that clue');

select set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":true}', true);
select is((public.submit_guess(private.ist_today(), 1, 'd0000000-0000-0000-0000-0000000000a3') -> 'play' ->> 'current_clue')::int, 2,
  'the same name from a different year is still a wrong guess');
reset role;

-- ---------- merging duplicates ----------
set local role authenticated;
select throws_ok($$ select public.merge_spelling_duplicates() $$, '42501', null, 'players cannot run the merge tool');
reset role;

select is((public.merge_spelling_duplicates() ->> 'groups')::int, 2, 'dry run finds the two duplicate groups');
select ok((select is_active from public.movies where id = 'd0000000-0000-0000-0000-0000000000a2'), 'a dry run changes nothing');

select is((public.merge_spelling_duplicates(true) ->> 'groups')::int, 2, 'apply merges both groups');

select is((select array[is_active::text, coalesce(imdb_id, '-'), coalesce(wikidata_id, '-'), array_to_string(aliases, ',')]
             from public.movies where id = 'd0000000-0000-0000-0000-0000000000a1'),
  array['true', 'tt9000001', 'Q90000001', 'Sarainodu'],
  'the entry used by the challenge is kept, gains the other spelling as an alias and its IMDb/Wikidata ids');
select ok(not (select is_active from public.movies where id = 'd0000000-0000-0000-0000-0000000000a2'), 'the duplicate is hidden');
select ok((select is_active from public.movies where id = 'd0000000-0000-0000-0000-0000000000a3'), 'the 1999 film is untouched');
select is((select array[is_active::text, array_to_string(aliases, ',')] from public.movies where id = 'd0000000-0000-0000-0000-0000000000b1'),
  array['true', 'Athidi,Atithi'], 'the entry with an IMDb id is kept and collects the other names');
select ok(not (select is_active from public.movies where id = 'd0000000-0000-0000-0000-0000000000b2'), 'its duplicate is hidden');
select is((public.merge_spelling_duplicates() ->> 'groups')::int, 0, 'running it again finds nothing left to merge');

-- ---------- old wrong guesses on a spelling variant are corrected ----------
-- Simulate a play graded before the fix: player C picked the other spelling on clue 1 and lost.
update public.movies set is_active = true where id = 'd0000000-0000-0000-0000-0000000000a2';
insert into public.plays (id, user_id, challenge_id, challenge_date, mode, status, current_clue, points, finished_at)
select 'f0000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', id, challenge_date, 'daily', 'lost', 3, 0, now()
  from public.daily_challenges;
insert into public.guesses (play_id, clue_number, movie_id, is_correct) values
  ('f0000000-0000-0000-0000-000000000001', 1, 'd0000000-0000-0000-0000-0000000000a2', false),
  ('f0000000-0000-0000-0000-000000000001', 2, 'd0000000-0000-0000-0000-0000000000a2', false),
  ('f0000000-0000-0000-0000-000000000001', 3, null, false);

select is(private.regrade_spelling_variant_guesses(), 1, 'the correction finds exactly that one play');

select is((select array[status::text, solved_on_clue::text, points::text] from public.plays where id = 'f0000000-0000-0000-0000-000000000001'),
  array['won', '1', '3'], 'the earlier wrong-but-right guess now wins with full points');
select is((select count(*)::int from public.guesses where play_id = 'f0000000-0000-0000-0000-000000000001'), 1,
  'guesses after the winning clue are removed');
select is(private.regrade_spelling_variant_guesses(), 0, 'running the correction again changes nothing');
select is((select array[status::text, points::text] from public.plays
             where user_id = 'a1111111-1111-1111-1111-111111111111'), array['won', '3'],
  'plays that were already right are left alone');

select * from finish();
rollback;
