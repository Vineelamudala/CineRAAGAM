-- History rows now include each clue's result ('correct' | 'wrong' | 'skipped'),
-- so the Statistics page can draw one circle per clue. Otherwise unchanged
-- (still VOLATILE: it applies the midnight rule before reading).
create or replace function public.get_my_history(p_limit int default 30, p_offset int default 0)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_since date;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform private.expire_daily_plays(v_uid);
  -- From the first day I played (or joined), whichever is earlier.
  select least(
           (select min(challenge_date) from public.plays where user_id = v_uid),
           (select (created_at at time zone 'Asia/Kolkata')::date from public.profiles where id = v_uid))
  into v_since;

  return coalesce((
    select jsonb_agg(item order by (item ->> 'date') desc)
    from (
      select jsonb_build_object(
        'date', d.challenge_date,
        'number', d.idx,
        'status', p.status,
        'mode', p.mode,
        'points', p.points,
        'solved_on_clue', p.solved_on_clue,
        'clues_used', (select count(*) from public.guesses g where g.play_id = p.id),
        'results', coalesce((
          select jsonb_agg(case when g.movie_id is null then 'skipped' when g.is_correct then 'correct' else 'wrong' end
                           order by g.clue_number)
          from public.guesses g where g.play_id = p.id
        ), '[]'::jsonb),
        'title', case when p.status in ('won', 'lost') then m.title end,
        'year', case when p.status in ('won', 'lost') then m.release_year end
      ) as item
      from private.published_days() d
      join public.daily_challenges c on c.id = d.challenge_id
      left join public.plays p on p.challenge_id = d.challenge_id and p.user_id = v_uid
      left join public.movies m on m.id = c.movie_id
      where d.challenge_date >= coalesce(v_since, private.ist_today())
      order by d.challenge_date desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
    ) x
  ), '[]'::jsonb);
end
$$;
