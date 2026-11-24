-- Admin access: 2-step verification enforcement and player moderation.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, aud, role, is_anonymous, raw_app_meta_data) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', false, '{"role":"admin"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', true, '{}');
update public.profiles set display_name = 'Rude Name' where id = 'bbbbbbbb-0000-0000-0000-0000000000b2';

-- ---- admin without 2-step verification ----
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":false,"aal":"aal1","app_metadata":{"role":"admin"}}', true);
set local role authenticated;
select ok(private.is_admin(), 'an admin without 2-step verification is an admin at aal1');
reset role;

-- An unverified (half-finished) enrolment does not lock the admin out.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('f0000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'pending', 'totp', 'unverified', now(), now());
set local role authenticated;
select ok(private.is_admin(), 'an unverified authenticator does not change anything');
reset role;

-- ---- admin with verified 2-step verification ----
update auth.mfa_factors set status = 'verified' where id = 'f0000000-0000-0000-0000-0000000000f1';
set local role authenticated;
select ok(not private.is_admin(), 'with a verified authenticator, a password-only (aal1) session is NOT admin');
select is_empty($$ select 1 from public.daily_challenges $$, '...and cannot read answers');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":false,"aal":"aal2","app_metadata":{"role":"admin"}}', true);
set local role authenticated;
select ok(private.is_admin(), 'after entering the authenticator code (aal2) the admin has full access');

-- ---- moderation ----
select isnt_empty($$ select 1 from public.profiles where id = 'bbbbbbbb-0000-0000-0000-0000000000b2' $$, 'admins can see all players');
update public.profiles set is_hidden = true where id = 'bbbbbbbb-0000-0000-0000-0000000000b2';
select throws_ok($$ update public.profiles set display_name = 'Renamed' where id = 'bbbbbbbb-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'admins hide names; they cannot rewrite them');
reset role;
select is((select is_hidden from public.profiles where id = 'bbbbbbbb-0000-0000-0000-0000000000b2'), true, 'admins can hide a player');

-- ---- a played challenge cannot have its answer or clues changed ----
delete from public.guesses; delete from public.plays; delete from public.daily_challenges;
insert into public.movies (id, title) values
  ('d0000000-0000-0000-0000-0000000000d1', 'Answer'), ('d0000000-0000-0000-0000-0000000000d2', 'Other');
insert into public.clips (id, movie_id, storage_path, kind, duration_ms) values
  ('e0000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-0000000000d1', 'a1111111-1111-4111-8111-111111111111.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-0000000000e2', 'd0000000-0000-0000-0000-0000000000d1', 'a2222222-2222-4222-8222-222222222222.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-0000000000e3', 'd0000000-0000-0000-0000-0000000000d1', 'a3333333-3333-4333-8333-333333333333.webm', 'bgm', 8000),
  ('e0000000-0000-0000-0000-0000000000e4', 'd0000000-0000-0000-0000-0000000000d1', 'a4444444-4444-4444-8444-444444444444.webm', 'bgm', 8000);
insert into public.daily_challenges (id, challenge_date, movie_id, hard_clip_id, medium_clip_id, easy_clip_id, status)
values ('c0000000-0000-0000-0000-0000000000c1', '2030-01-01', 'd0000000-0000-0000-0000-0000000000d1',
        'e0000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-0000000000e2', 'e0000000-0000-0000-0000-0000000000e3', 'published');

select lives_ok($$ update public.daily_challenges set hard_clip_id = 'e0000000-0000-0000-0000-0000000000e4'
  where id = 'c0000000-0000-0000-0000-0000000000c1' $$, 'an unplayed challenge can still be edited');

insert into public.plays (user_id, challenge_id, challenge_date, mode)
values ('bbbbbbbb-0000-0000-0000-0000000000b2', 'c0000000-0000-0000-0000-0000000000c1', '2030-01-01', 'daily');

select throws_ok($$ update public.daily_challenges set hard_clip_id = 'e0000000-0000-0000-0000-0000000000e1'
  where id = 'c0000000-0000-0000-0000-0000000000c1' $$, '23514', 'challenge_already_played', 'a played challenge’s clues are locked');
select throws_ok($$ update public.daily_challenges set challenge_date = '2030-01-02'
  where id = 'c0000000-0000-0000-0000-0000000000c1' $$, '23514', 'challenge_already_played', 'a played challenge’s date is locked');
select lives_ok($$ update public.daily_challenges set status = 'draft'
  where id = 'c0000000-0000-0000-0000-0000000000c1' $$, 'a played challenge can still be (un)published');
select throws_ok($$ delete from public.daily_challenges where id = 'c0000000-0000-0000-0000-0000000000c1' $$,
  '23503', null, 'a played challenge cannot be deleted');

select * from finish();
rollback;
