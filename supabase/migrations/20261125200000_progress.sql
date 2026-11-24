-- =====================================================================
-- Phase 4: streaks, statistics, history and leaderboards
--
-- Only official daily plays count (mode = 'daily', finished). Time Travel
-- never counts. Streaks are measured in *published challenge days*, so a
-- day the admin left empty never breaks anyone's streak. Today's challenge
-- doesn't break a streak until it is lost (or the day ends unsolved).
-- =====================================================================

-- Published challenges up to today, numbered in date order.
create function private.published_days()
returns table (challenge_id uuid, challenge_date date, idx bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select id, challenge_date, row_number() over (order by challenge_date)
  from public.daily_challenges
  where status = 'published' and challenge_date <= private.ist_today()
$$;

-- Current and best streak for a player.
create function private.streaks(p_user uuid)
returns table (current_streak int, best_streak int)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (select * from private.published_days()),
  wins as (
    select d.idx from days d
    join public.plays p on p.challenge_id = d.challenge_id
    where p.user_id = p_user and p.mode = 'daily' and p.status = 'won'
  ),
  islands as (
    select idx, idx - row_number() over (order by idx) as grp from wins
  ),
  runs as (
    select min(idx) as first_idx, max(idx) as last_idx, count(*)::int as len from islands group by grp
  ),
  latest as (
    select d.idx, d.challenge_date,
           (select p.status from public.plays p
            where p.challenge_id = d.challenge_id and p.user_id = p_user and p.mode = 'daily') as status
    from days d order by d.idx desc limit 1
  ),
  -- The streak may end on the latest day (if won) or on the day before it
  -- (if the latest day is today and not yet finished).
  anchor as (
    select case
      when l.status = 'won' then l.idx
      when l.challenge_date = private.ist_today() and coalesce(l.status::text, 'playing') = 'playing' then l.idx - 1
      else null
    end as idx
    from latest l
  )
  select
    coalesce((select r.len from runs r, anchor a where r.last_idx = a.idx), 0),
    coalesce((select max(len) from runs), 0)
$$;

-- Monday of the current IST week / first day of the current IST month.
create function private.period_start(p_period text)
returns date
language sql
stable
set search_path = ''
as $$
  select case p_period
    when 'week' then date_trunc('week', private.ist_today()::timestamp)::date
    when 'month' then date_trunc('month', private.ist_today()::timestamp)::date
    else null
  end
$$;

-- ---------------------------------------------------------------------
-- My statistics
-- ---------------------------------------------------------------------
create function public.get_my_stats()
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
  v_week_rank int;
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

  v_week_rank := (public.get_leaderboard('week', 1) -> 'me' ->> 'rank')::int;

  return jsonb_build_object(
    'current_streak', v_streak.current_streak,
    'best_streak', v_streak.best_streak,
    'played', v_counts.played,
    'won', v_counts.won,
    'win_rate', case when v_counts.played > 0 then round(100.0 * v_counts.won / v_counts.played)::int end,
    'total_points', v_counts.points,
    'week_points', v_counts.week_points,
    'week_rank', v_week_rank,
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

-- ---------------------------------------------------------------------
-- Leaderboards: 'week' (from Monday 00:00 IST), 'month', 'all'.
-- Ranked by points, then days solved, then who reached the total first.
-- Only named, visible, non-admin players with points; daily plays only.
-- ---------------------------------------------------------------------
create function public.get_leaderboard(p_period text default 'week', p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_from date;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_period not in ('week', 'month', 'all') then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  v_from := private.period_start(p_period);

  with scores as (
    select p.user_id,
           sum(p.points)::int as points,
           count(*)::int as solved,
           max(p.finished_at) as reached_at
    from public.plays p
    where p.mode = 'daily' and p.status = 'won'
      and (v_from is null or p.challenge_date >= v_from)
      and p.challenge_date <= private.ist_today()
    group by p.user_id
  ),
  eligible as (
    select s.*, pr.display_name
    from scores s
    join public.profiles pr on pr.id = s.user_id
    join auth.users u on u.id = s.user_id
    where pr.display_name is not null
      and not pr.is_hidden
      and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
  ),
  ranked as (
    select e.*, rank() over (order by points desc, solved desc, reached_at asc) as rank
    from eligible e
  )
  select jsonb_build_object(
    'period', p_period,
    'from', v_from,
    'to', private.ist_today(),
    'total', (select count(*) from ranked),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', r.rank, 'name', r.display_name, 'points', r.points,
               'solved', r.solved, 'is_me', r.user_id = v_uid
             ) order by r.rank, r.reached_at)
      from (select * from ranked order by rank, reached_at limit least(greatest(p_limit, 1), 100)) r
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object('rank', r.rank, 'name', r.display_name, 'points', r.points, 'solved', r.solved)
      from ranked r where r.user_id = v_uid
    )
  ) into v_result;
  return v_result;
end
$$;

-- ---------------------------------------------------------------------
-- My history: every published day since I started playing (newest first),
-- with my result. Movie titles only for finished games.
-- ---------------------------------------------------------------------
create function public.get_my_history(p_limit int default 30, p_offset int default 0)
returns jsonb
language plpgsql
stable
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

revoke execute on function public.get_my_stats() from public, anon;
revoke execute on function public.get_leaderboard(text, int) from public, anon;
revoke execute on function public.get_my_history(int, int) from public, anon;
grant execute on function public.get_my_stats() to authenticated;
grant execute on function public.get_leaderboard(text, int) to authenticated;
grant execute on function public.get_my_history(int, int) to authenticated;

-- Leaderboard aggregation index (daily wins by date).
create index plays_daily_wins_idx on public.plays (challenge_date, user_id) where mode = 'daily' and status = 'won';
