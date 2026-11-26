-- =====================================================================
-- Spelling variants of the same film ("Sarrainodu" / "Sarainodu").
--
-- 1. private.spelling_key(): one key per film name that ignores the usual
--    differences when Telugu titles are written in English. MUST stay
--    identical to spellingKey() in lib/search/movies.ts.
-- 2. submit_guess(): picking a spelling variant of the answer (same key,
--    same release year) counts as correct.
-- 3. public.merge_spelling_duplicates(): merges active same-film duplicates
--    into one entry (other spellings become aliases, extras are hidden).
--    Operator tool: service role only.
-- 4. Corrects plays that were marked wrong because a player picked a
--    spelling variant of the answer before this fix.
-- =====================================================================

create function private.spelling_key(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(            -- doubled letters count once
           replace(replace(          -- ee → i, oo → u
             replace(                -- w → v
               regexp_replace(       -- th → t, dh → d, bh → b, sh → s …
                 regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]', '', 'g'),
                 '([bcdgjkpst])h', '\1', 'g'),
               'w', 'v'),
             'ee', 'i'), 'oo', 'u'),
           '(.)\1+', '\1', 'g')
$$;

-- True when the guessed movie is the answer under another spelling:
-- same release year, and its title matches the answer's title or an alias.
create function private.same_film_name(p_guess uuid, p_answer uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.movies g, public.movies a
     where g.id = p_guess and a.id = p_answer
       and g.release_year is not null and g.release_year = a.release_year
       and private.spelling_key(g.title) <> ''
       and private.spelling_key(g.title) in (
             select private.spelling_key(n) from unnest(array_prepend(a.title, a.aliases)) n)
  )
$$;

-- Same as before, except a spelling variant of the answer counts as correct.
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

  v_correct := p_movie_id is not null and (
    p_movie_id = v_challenge.movie_id
    or private.same_film_name(p_movie_id, v_challenge.movie_id));

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

-- Merge active movies that are the same film under different spellings
-- (same spelling key AND same release year). Per group, the kept entry is:
-- the one with clips or a challenge, else one with an IMDb id, else one with
-- a Wikidata id, else the oldest. Other titles become its aliases, IMDb /
-- Wikidata ids and cast move over when it lacks them, and the extras are
-- hidden (is_active = false; past guesses still point at them). Groups where
-- more than one entry has clips/challenges are left alone and reported.
-- With p_apply = false (default) it only reports what it would do.
create function public.merge_spelling_duplicates(p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  v_keep public.movies;
  v_other public.movies;
  v_used int;
  v_merged jsonb := '[]';
  v_skipped jsonb := '[]';
begin
  for g in
    select private.spelling_key(title) as k, release_year as y, array_agg(id order by title) as ids
      from public.movies
     where is_active and release_year is not null and private.spelling_key(title) <> ''
     group by 1, 2
    having count(*) > 1
     order by 1, 2
  loop
    select count(*) into v_used from unnest(g.ids) i
     where exists (select 1 from public.clips c where c.movie_id = i)
        or exists (select 1 from public.daily_challenges d where d.movie_id = i);
    if v_used > 1 then
      v_skipped := v_skipped || jsonb_build_object('year', g.y,
        'titles', (select jsonb_agg(title order by title) from public.movies where id = any(g.ids)));
      continue;
    end if;

    select m.* into v_keep from public.movies m
     where m.id = any(g.ids)
     order by (exists (select 1 from public.clips c where c.movie_id = m.id)
               or exists (select 1 from public.daily_challenges d where d.movie_id = m.id)) desc,
              (m.imdb_id is not null) desc, (m.wikidata_id is not null) desc, m.created_at, m.id
     limit 1;

    v_merged := v_merged || jsonb_build_object('year', g.y, 'kept', v_keep.title,
      'merged', (select jsonb_agg(title order by title) from public.movies where id = any(g.ids) and id <> v_keep.id));

    if p_apply then
      for v_other in select * from public.movies where id = any(g.ids) and id <> v_keep.id loop
        update public.movies k
           set aliases = coalesce((
                 select array_agg(n order by n) from (
                   select distinct on (lower(n)) n
                     from unnest(k.aliases || v_other.title || v_other.aliases) n
                    where lower(n) <> lower(k.title)
                 ) d), '{}')
         where k.id = v_keep.id
         returning * into v_keep;

        if v_keep.imdb_id is null and v_other.imdb_id is not null then
          update public.movies set imdb_id = null where id = v_other.id;
          update public.movies set imdb_id = v_other.imdb_id where id = v_keep.id returning * into v_keep;
        end if;
        if v_keep.wikidata_id is null and v_other.wikidata_id is not null then
          update public.movies set wikidata_id = null where id = v_other.id;
          update public.movies set wikidata_id = v_other.wikidata_id where id = v_keep.id returning * into v_keep;
        end if;

        insert into public.movie_cast (movie_id, person_name, billing_order)
        select v_keep.id, person_name, billing_order from public.movie_cast where movie_id = v_other.id
        on conflict (movie_id, person_name) do nothing;

        update public.movies set is_active = false where id = v_other.id;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('applied', p_apply, 'groups', jsonb_array_length(v_merged),
                            'merged', v_merged, 'skipped', v_skipped);
end
$$;

revoke execute on function private.spelling_key(text) from public, anon, authenticated;
revoke execute on function private.same_film_name(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.merge_spelling_duplicates(boolean) from public, anon, authenticated;
grant execute on function public.merge_spelling_duplicates(boolean) to service_role;
-- submit_guess keeps its grants (create or replace preserves them).

-- ---------------------------------------------------------------------
-- Correct earlier plays: a wrong guess that was really the answer under
-- another spelling becomes the winning guess. Later guesses in that play
-- are removed (the game would have ended there) and points follow the
-- normal rule (Time Travel stays 0).
-- ---------------------------------------------------------------------
create function private.regrade_spelling_variant_guesses()
returns int
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select distinct on (g.play_id) g.play_id, g.id as guess_id, g.clue_number
      from public.guesses g
      join public.plays p on p.id = g.play_id
      join public.daily_challenges d on d.id = p.challenge_id
     where not g.is_correct
       and g.movie_id is not null
       and g.movie_id <> d.movie_id
       and private.same_film_name(g.movie_id, d.movie_id)
       and (p.status <> 'won' or p.solved_on_clue > g.clue_number)
     order by g.play_id, g.clue_number
  loop
    -- Later guesses in this play would never have happened (incl. a later "correct" one).
    delete from public.guesses where play_id = r.play_id and clue_number > r.clue_number;
    update public.guesses set is_correct = true where id = r.guess_id;
    update public.plays p
       set status = 'won',
           current_clue = r.clue_number,
           solved_on_clue = r.clue_number,
           points = case when p.mode = 'time_travel' then 0
                         else case r.clue_number when 1 then 3 when 2 then 2 else 1 end end,
           finished_at = coalesce(p.finished_at, now())
     where p.id = r.play_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;
revoke execute on function private.regrade_spelling_variant_guesses() from public, anon, authenticated;

select private.regrade_spelling_variant_guesses();
