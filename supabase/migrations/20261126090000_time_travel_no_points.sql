-- =====================================================================
-- Time Travel gives no points (owner's rule). Only official daily games
-- (played on their own IST date) earn 3 / 2 / 1 / 0 points.
-- Enforced by the CHECK constraint, so no code path can store points for
-- a Time Travel game.
-- =====================================================================

alter table public.plays drop constraint plays_points_rule;

update public.plays set points = 0 where mode = 'time_travel';

alter table public.plays add constraint plays_points_rule check (
  points = case
    when mode = 'time_travel' then 0
    else case solved_on_clue when 1 then 3 when 2 then 2 when 3 then 1 else 0 end
  end
);

-- Same as before, except a Time Travel win stores 0 points.
create or replace function public.submit_guess(p_date date, p_clue int, p_movie_id uuid default null)
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
        points = case
          when v_play.mode = 'time_travel' then 0
          else case v_play.current_clue when 1 then 3 when 2 then 2 else 1 end
        end,
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
