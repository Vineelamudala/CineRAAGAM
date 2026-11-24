-- =====================================================================
-- Phase 2: server-side game logic
--
-- Players never see daily_challenges directly. These SECURITY DEFINER
-- functions are the only way to read a challenge or make a guess, and
-- they return only what the rules allow:
--   * no future or draft challenges
--   * a clue's audio path only once that clue is unlocked
--   * the answer and cast only after the game is finished
-- Midnight rule: a daily game must be finished on its IST date. After
-- midnight an unfinished daily play becomes a Time Travel play (0 points
-- for leaderboards and streaks, but the player may still finish it).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admins with 2-step verification enrolled must have used it (aal2).
-- ---------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
     and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (
         select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
       )
     )
$$;

-- Challenge number shown to players (#1, #2, ...): position among published days.
create function private.challenge_number(p_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.daily_challenges
  where status = 'published' and challenge_date <= p_date
$$;

-- A published challenge that is not in the future, or null.
create function private.playable_challenge(p_date date)
returns public.daily_challenges
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from public.daily_challenges c
  where c.challenge_date = p_date
    and c.status = 'published'
    and p_date <= private.ist_today()
$$;

-- Midnight rule (applied lazily whenever the player interacts).
create function private.expire_daily_plays(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.plays
  set mode = 'time_travel'
  where user_id = p_user
    and mode = 'daily'
    and status = 'playing'
    and challenge_date < private.ist_today()
$$;

-- Is clue n of this challenge unlocked for the user? (Clue 1 always is.)
create function private.clue_unlocked(p_clue int, p_play public.plays)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_clue = 1
      or (p_play.id is not null and (p_play.status <> 'playing' or p_play.current_clue >= p_clue))
$$;

-- Everything the player may know about a challenge, as JSON.
create function private.challenge_state(p_challenge public.daily_challenges, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_play public.plays;
  v_finished boolean;
  v_clips jsonb;
  v_reveal jsonb;
begin
  select * into v_play from public.plays
  where user_id = p_user and challenge_id = p_challenge.id;
  v_finished := v_play.id is not null and v_play.status <> 'playing';

  select jsonb_agg(jsonb_build_object(
           'clue', x.clue,
           'difficulty', x.difficulty,
           'kind', k.kind,
           'duration_ms', k.duration_ms,
           'path', case when private.clue_unlocked(x.clue, v_play) then k.storage_path end
         ) order by x.clue)
  into v_clips
  from (values (1, 'hard', p_challenge.hard_clip_id),
               (2, 'medium', p_challenge.medium_clip_id),
               (3, 'easy', p_challenge.easy_clip_id)) as x(clue, difficulty, clip_id)
  join public.clips k on k.id = x.clip_id;

  if v_finished then
    select jsonb_build_object(
             'title', m.title,
             'year', m.release_year,
             'cast', coalesce((
               select jsonb_agg(c.person_name order by c.billing_order, c.person_name)
               from (select person_name, billing_order from public.movie_cast
                     where movie_id = m.id order by billing_order, person_name limit 5) c
             ), '[]'::jsonb))
    into v_reveal
    from public.movies m where m.id = p_challenge.movie_id;
  end if;

  return jsonb_build_object(
    'date', p_challenge.challenge_date,
    'number', private.challenge_number(p_challenge.challenge_date),
    'is_today', p_challenge.challenge_date = private.ist_today(),
    'clips', v_clips,
    'play', case when v_play.id is null then null else jsonb_build_object(
      'mode', v_play.mode,
      'status', v_play.status,
      'current_clue', v_play.current_clue,
      'solved_on_clue', v_play.solved_on_clue,
      'points', v_play.points,
      'started_at', v_play.started_at,
      'finished_at', v_play.finished_at
    ) end,
    'guesses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'clue', g.clue_number,
               'result', case when g.movie_id is null then 'skipped' when g.is_correct then 'correct' else 'wrong' end,
               'movie_title', m.title
             ) order by g.clue_number)
      from public.guesses g left join public.movies m on m.id = g.movie_id
      where g.play_id = v_play.id
    ), '[]'::jsonb),
    'reveal', v_reveal
  );
end
$$;

-- ---------------------------------------------------------------------
-- Player API
-- ---------------------------------------------------------------------

-- Today's (or a past day's) challenge with the caller's progress; null if none.
create function public.get_challenge(p_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge public.daily_challenges;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform private.expire_daily_plays(v_uid);
  v_challenge := private.playable_challenge(coalesce(p_date, private.ist_today()));
  if v_challenge.id is null then
    return null;
  end if;
  return private.challenge_state(v_challenge, v_uid);
end
$$;

-- Guess (p_movie_id) or skip (p_movie_id = null) the given clue.
-- Idempotent: a repeated or stale submission changes nothing and returns the state.
create function public.submit_guess(p_date date, p_clue int, p_movie_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_challenge public.daily_challenges;
  v_play public.plays;
  v_correct boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_challenge := private.playable_challenge(p_date);
  if v_challenge.id is null then
    raise exception 'challenge_not_found' using errcode = 'P0002';
  end if;

  perform private.expire_daily_plays(v_uid);

  insert into public.plays (user_id, challenge_id, challenge_date, mode)
  values (v_uid, v_challenge.id, v_challenge.challenge_date,
          case when v_challenge.challenge_date = private.ist_today()
               then 'daily'::public.play_mode else 'time_travel'::public.play_mode end)
  on conflict (user_id, challenge_id) do nothing;

  -- Row lock serialises concurrent submissions from the same player.
  select * into v_play from public.plays
  where user_id = v_uid and challenge_id = v_challenge.id
  for update;

  if v_play.status <> 'playing' or p_clue is distinct from v_play.current_clue then
    return private.challenge_state(v_challenge, v_uid);
  end if;

  if p_movie_id is not null and not exists (
       select 1 from public.movies where id = p_movie_id and is_active) then
    raise exception 'unknown_movie' using errcode = '22023';
  end if;

  v_correct := p_movie_id is not null and p_movie_id = v_challenge.movie_id;

  insert into public.guesses (play_id, clue_number, movie_id, is_correct)
  values (v_play.id, v_play.current_clue, p_movie_id, v_correct);

  if v_correct then
    update public.plays
    set status = 'won',
        solved_on_clue = v_play.current_clue,
        points = case v_play.current_clue when 1 then 3 when 2 then 2 else 1 end,
        finished_at = now()
    where id = v_play.id;
  elsif v_play.current_clue >= 3 then
    update public.plays set status = 'lost', finished_at = now() where id = v_play.id;
  else
    update public.plays set current_clue = v_play.current_clue + 1 where id = v_play.id;
  end if;

  return private.challenge_state(v_challenge, v_uid);
end
$$;

-- Past published challenges with the caller's result (for Time Travel).
create function public.list_past_challenges(p_limit int default 60, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', c.challenge_date,
             'number', private.challenge_number(c.challenge_date),
             'status', p.status,
             'mode', p.mode,
             'points', p.points
           ) order by c.challenge_date desc)
    from (
      select * from public.daily_challenges
      where status = 'published' and challenge_date < private.ist_today()
      order by challenge_date desc
      limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
    ) c
    left join public.plays p on p.challenge_id = c.id and p.user_id = v_uid
  ), '[]'::jsonb);
end
$$;

revoke execute on function public.get_challenge(date) from public, anon;
revoke execute on function public.submit_guess(date, int, uuid) from public, anon;
revoke execute on function public.list_past_challenges(int, int) from public, anon;
grant execute on function public.get_challenge(date) to authenticated;
grant execute on function public.submit_guess(date, int, uuid) to authenticated;
grant execute on function public.list_past_challenges(int, int) to authenticated;

-- ---------------------------------------------------------------------
-- Audio access: players may read (and therefore sign URLs for) a clip
-- only when that clue is unlocked for them. Enforced by Storage RLS, so
-- the web app never needs the secret key to serve audio.
-- ---------------------------------------------------------------------
create function private.can_read_clip(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1
    from public.daily_challenges c
    join public.clips k on k.storage_path = p_object_name
    left join public.plays p on p.challenge_id = c.id and p.user_id = auth.uid()
    where c.status = 'published'
      and c.challenge_date <= private.ist_today()
      and (
        k.id = c.hard_clip_id
        or (k.id = c.medium_clip_id and private.clue_unlocked(2, p))
        or (k.id = c.easy_clip_id and private.clue_unlocked(3, p))
      )
  )
$$;
grant execute on function private.can_read_clip(text) to authenticated;

create policy clips_bucket_player_read on storage.objects for select to authenticated
  using (bucket_id = 'clips' and (select auth.uid()) is not null and private.can_read_clip(name));
