-- =====================================================================
-- 1. get_my_stats(): adds the player's rank this week and all time (with
--    the number of ranked players), and why there is no rank if there is
--    none. Existing fields are unchanged.
-- 2. admin_day_report(): for admins, who played on a day and what they
--    guessed, clue by clue.
-- =====================================================================

create or replace function public.get_my_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := private.ist_today();
  v_week_start date := private.period_start('week');
  v_streak record;
  v_counts record;
  v_week jsonb;
  v_all jsonb;
  v_profile record;
  v_rank_note text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_streak from private.streaks(v_uid);

  select
    count(*) filter (where status in ('won', 'lost'))::int as played,
    count(*) filter (where status = 'won')::int as won,
    coalesce(sum(points) filter (where status = 'won'), 0)::int as points,
    count(*) filter (where solved_on_clue = 1)::int as on1,
    count(*) filter (where solved_on_clue = 2)::int as on2,
    count(*) filter (where solved_on_clue = 3)::int as on3,
    count(*) filter (where status = 'lost')::int as lost,
    coalesce(sum(points) filter (where challenge_date >= v_week_start), 0)::int as week_points
  into v_counts
  from public.plays
  where user_id = v_uid and mode = 'daily';

  v_week := public.get_leaderboard('week', 1);
  v_all := public.get_leaderboard('all', 1);

  -- Why this player has no rank (null when ranked).
  select pr.display_name, pr.is_hidden, coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin' as is_admin
    into v_profile
    from public.profiles pr join auth.users u on u.id = pr.id
   where pr.id = v_uid;
  v_rank_note := case
    when v_profile.is_admin then 'admin'
    when v_profile.display_name is null then 'no_name'
    when v_profile.is_hidden then 'hidden'
    when v_all -> 'me' = 'null'::jsonb or v_all -> 'me' is null then 'no_points'
  end;

  return jsonb_build_object(
    'current_streak', v_streak.current_streak,
    'best_streak', v_streak.best_streak,
    'played', v_counts.played,
    'won', v_counts.won,
    'win_rate', case when v_counts.played > 0 then round(100.0 * v_counts.won / v_counts.played)::int end,
    'total_points', v_counts.points,
    'week_points', v_counts.week_points,
    'week_rank', (v_week -> 'me' ->> 'rank')::int,
    'week_ranked', (v_week ->> 'total')::int,
    'all_rank', (v_all -> 'me' ->> 'rank')::int,
    'all_ranked', (v_all ->> 'total')::int,
    'rank_note', v_rank_note,
    'distribution', jsonb_build_object('1', v_counts.on1, '2', v_counts.on2, '3', v_counts.on3, 'missed', v_counts.lost),
    'week', (
      select jsonb_agg(jsonb_build_object(
               'date', d::date,
               'is_today', d::date = v_today,
               'has_challenge', c.id is not null,
               'status', p.status
             ) order by d)
      from generate_series(v_week_start, v_week_start + 6, interval '1 day') d
      left join public.daily_challenges c on c.challenge_date = d::date and c.status = 'published' and d::date <= v_today
      left join public.plays p on p.challenge_id = c.id and p.user_id = v_uid and p.mode = 'daily'
    )
  );
end
$$;

-- Who played the challenge of a day (default: today, IST) and what they guessed.
-- Admins only. Players are identified by display name, or a short id when unnamed.
create function public.admin_day_report(p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_date date := coalesce(p_date, private.ist_today());
  v_challenge record;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select c.id, m.title, m.release_year into v_challenge
    from public.daily_challenges c join public.movies m on m.id = c.movie_id
   where c.challenge_date = v_date;

  return jsonb_build_object(
    'date', v_date,
    'challenge', case when v_challenge.id is null then null
                      else jsonb_build_object('title', v_challenge.title, 'year', v_challenge.release_year) end,
    'totals', (
      select jsonb_build_object(
        'players', count(*),
        'won', count(*) filter (where p.status = 'won'),
        'lost', count(*) filter (where p.status = 'lost'),
        'playing', count(*) filter (where p.status = 'playing'),
        'on1', count(*) filter (where p.solved_on_clue = 1),
        'on2', count(*) filter (where p.solved_on_clue = 2),
        'on3', count(*) filter (where p.solved_on_clue = 3),
        'time_travel', count(*) filter (where p.mode = 'time_travel'))
      from public.plays p where p.challenge_id = v_challenge.id
    ),
    'plays', coalesce((
      select jsonb_agg(jsonb_build_object(
               'player', coalesce(pr.display_name, 'Guest ' || left(p.user_id::text, 6)),
               'named', pr.display_name is not null,
               'is_admin', coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin',
               'mode', p.mode,
               'status', p.status,
               'points', p.points,
               'solved_on_clue', p.solved_on_clue,
               'started_at', p.started_at,
               'finished_at', p.finished_at,
               'guesses', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'clue', g.clue_number,
                          'result', case when g.movie_id is null then 'skipped' when g.is_correct then 'correct' else 'wrong' end,
                          'movie', m.title,
                          'year', m.release_year
                        ) order by g.clue_number)
                 from public.guesses g left join public.movies m on m.id = g.movie_id
                 where g.play_id = p.id), '[]'::jsonb)
             ) order by p.started_at, p.id)
      from public.plays p
      join public.profiles pr on pr.id = p.user_id
      join auth.users u on u.id = p.user_id
      where p.challenge_id = v_challenge.id
    ), '[]'::jsonb)
  );
end
$$;

revoke execute on function public.admin_day_report(date) from public, anon;
grant execute on function public.admin_day_report(date) to authenticated;
