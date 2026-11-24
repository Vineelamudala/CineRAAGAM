-- =====================================================================
-- Phase 3: admin safety rails
-- Once anyone has played a challenge, its date, movie and clues must not
-- change (that would silently change people's results). Status can still
-- be changed. Deleting is already blocked by the plays foreign key.
-- =====================================================================
create function private.guard_played_challenge()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.challenge_date, new.movie_id, new.hard_clip_id, new.medium_clip_id, new.easy_clip_id)
     is distinct from
     (old.challenge_date, old.movie_id, old.hard_clip_id, old.medium_clip_id, old.easy_clip_id)
     and exists (select 1 from public.plays where challenge_id = old.id) then
    raise exception 'challenge_already_played' using errcode = '23514',
      hint = 'Players have already played this challenge; only its status can change.';
  end if;
  return new;
end
$$;

create trigger daily_challenges_guard_played
  before update on public.daily_challenges
  for each row execute function private.guard_played_challenge();
