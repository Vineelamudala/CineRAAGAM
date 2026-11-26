-- =====================================================================
-- Admins can merge a duplicate movie into the right one from the admin
-- page ("Merge into this movie"), even when players already guessed it.
-- =====================================================================

-- The correction now also covers guesses that point at the answer itself
-- but were stored as wrong (happens after a duplicate is merged into it).
create or replace function private.regrade_spelling_variant_guesses()
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
       and (g.movie_id = d.movie_id or private.same_film_name(g.movie_id, d.movie_id))
       and (p.status <> 'won' or p.solved_on_clue > g.clue_number)
     order by g.play_id, g.clue_number
  loop
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

-- Merge p_duplicate into p_keep (admins only):
--  * the duplicate's title and other names become other names of the kept movie;
--  * its IMDb / Wikidata ids move over when the kept movie has none;
--  * its cast moves over; players' guesses of it now point at the kept movie
--    (and are re-scored if that makes them correct);
--  * the duplicate is deleted, or, if it still holds a Wikidata id (so a
--    future catalogue import recognises it), kept hidden from players.
-- Refuses if the duplicate has clips or a challenge (move those first).
create function public.admin_merge_movie(p_duplicate uuid, p_keep uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.movies;
  k public.movies;
  v_guesses int;
  v_regraded int;
  v_deleted boolean;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_duplicate = p_keep then
    raise exception 'same_movie' using errcode = '22023';
  end if;
  select * into d from public.movies where id = p_duplicate for update;
  select * into k from public.movies where id = p_keep for update;
  if d.id is null or k.id is null then
    raise exception 'movie_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.clips where movie_id = d.id)
     or exists (select 1 from public.daily_challenges where movie_id = d.id) then
    raise exception 'duplicate_has_clips' using errcode = '23503',
      hint = 'Delete or move the duplicate''s clips and challenges first.';
  end if;

  update public.movies m
     set aliases = coalesce((
           select array_agg(n order by n) from (
             select distinct on (lower(n)) n
               from unnest(m.aliases || d.title || d.aliases) n
              where lower(n) <> lower(m.title)
           ) x), '{}')
   where m.id = k.id
   returning * into k;

  if k.imdb_id is null and d.imdb_id is not null then
    update public.movies set imdb_id = null where id = d.id;
    update public.movies set imdb_id = d.imdb_id where id = k.id;
    d.imdb_id := null;
  end if;
  if k.wikidata_id is null and d.wikidata_id is not null then
    update public.movies set wikidata_id = null where id = d.id;
    update public.movies set wikidata_id = d.wikidata_id where id = k.id;
    d.wikidata_id := null;
  end if;

  insert into public.movie_cast (movie_id, person_name, billing_order)
  select k.id, person_name, billing_order from public.movie_cast where movie_id = d.id
  on conflict (movie_id, person_name) do nothing;

  update public.guesses set movie_id = k.id where movie_id = d.id;
  get diagnostics v_guesses = row_count;
  v_regraded := private.regrade_spelling_variant_guesses();

  v_deleted := d.wikidata_id is null;
  if v_deleted then
    delete from public.movies where id = d.id;
  else
    update public.movies set is_active = false, aliases = '{}' where id = d.id;
  end if;

  return jsonb_build_object('kept', k.title, 'removed', d.title, 'deleted', v_deleted,
                            'guesses_moved', v_guesses, 'plays_corrected', v_regraded);
end
$$;

revoke execute on function public.admin_merge_movie(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_movie(uuid, uuid) to authenticated;
