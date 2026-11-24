-- =====================================================================
-- Cineraagam core schema
--
-- Security model
--   * Players are Supabase *anonymous* users. Admins are operator-created
--     users with app_metadata.role = 'admin' (users cannot edit app_metadata).
--   * Every table has Row Level Security. Nothing is exposed without an
--     explicit GRANT (config: api.auto_expose_new_tables = false).
--   * Answers (daily_challenges), clips and cast are admin-only. Players
--     get them through SECURITY DEFINER functions (Phase 2) that only
--     return what the game rules allow.
--   * Players never write game tables directly; points are enforced by
--     CHECK constraints so even a buggy function cannot store wrong points.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Functions are not executable unless granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- True when the caller is a (non-anonymous) admin.
create function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
     and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- Today's date in India Standard Time (daily challenges roll over at 00:00 IST).
create function private.ist_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;
grant execute on function private.ist_today() to authenticated, service_role;

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.clip_kind as enum ('bgm', 'song_interlude');
create type public.challenge_status as enum ('draft', 'published');
create type public.play_mode as enum ('daily', 'time_travel');
create type public.play_status as enum ('playing', 'won', 'lost');

-- ---------------------------------------------------------------------
-- Profiles (one per auth user; players choose a display name)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Moderation: hidden players are left out of public leaderboards.
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- MUST match lib/player/displayName.ts
  constraint profiles_display_name_format check (
    display_name is null or (
      char_length(display_name) between 2 and 20
      and display_name = btrim(display_name)
      and display_name !~ '\s{2,}'
      and display_name ~ '^[A-Za-z0-9 _.ఀ-౿-]+$'
    )
  )
);
comment on table public.profiles is 'Player profile. id = auth.users.id (anonymous identity).';

-- Names are unique ignoring case ("Ravi" and "ravi" cannot both exist).
create unique index profiles_display_name_ci_key on public.profiles (lower(display_name)) where display_name is not null;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Create a profile row whenever an auth user is created.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- Movie catalogue (public: used for autocomplete, includes many
-- non-answer movies so suggestions never hint at the answer)
-- ---------------------------------------------------------------------
create table public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  release_year smallint check (release_year between 1930 and 2100),
  aliases text[] not null default '{}',
  wikidata_id text unique check (wikidata_id ~ '^Q[0-9]+$'),
  imdb_id text unique check (imdb_id ~ '^tt[0-9]+$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index movies_title_lower_idx on public.movies (lower(title));
create trigger movies_touch before update on public.movies
  for each row execute function private.touch_updated_at();

-- Main cast, revealed only after a game ends (admin-only table).
create table public.movie_cast (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies (id) on delete cascade,
  person_name text not null check (char_length(btrim(person_name)) between 1 and 120),
  billing_order smallint not null default 0 check (billing_order >= 0),
  unique (movie_id, person_name)
);
create index movie_cast_movie_idx on public.movie_cast (movie_id, billing_order);

-- ---------------------------------------------------------------------
-- Audio clips (admin-only). Files live in the private 'clips' bucket under
-- opaque names so a file name can never reveal the movie.
-- ---------------------------------------------------------------------
create table public.clips (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies (id) on delete restrict,
  storage_path text not null unique
    check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|ogg|opus|m4a|webm)$'),
  kind public.clip_kind not null,
  duration_ms integer not null check (duration_ms between 5000 and 20000),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  -- lets daily_challenges prove each clip belongs to the challenge's movie
  unique (id, movie_id)
);
create index clips_movie_idx on public.clips (movie_id);

-- ---------------------------------------------------------------------
-- Daily challenges (admin-only; this is where the answer lives)
-- Clue 1 = hard (3 pts), clue 2 = medium (2 pts), clue 3 = easy (1 pt).
-- ---------------------------------------------------------------------
create table public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null unique,
  movie_id uuid not null references public.movies (id) on delete restrict,
  hard_clip_id uuid not null,
  medium_clip_id uuid not null,
  easy_clip_id uuid not null,
  status public.challenge_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hard_clip_id, movie_id) references public.clips (id, movie_id) on delete restrict,
  foreign key (medium_clip_id, movie_id) references public.clips (id, movie_id) on delete restrict,
  foreign key (easy_clip_id, movie_id) references public.clips (id, movie_id) on delete restrict,
  constraint daily_challenges_distinct_clips check (
    hard_clip_id <> medium_clip_id and hard_clip_id <> easy_clip_id and medium_clip_id <> easy_clip_id
  )
);
create index daily_challenges_movie_idx on public.daily_challenges (movie_id);
create trigger daily_challenges_touch before update on public.daily_challenges
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Plays and guesses (written only by server functions, Phase 2)
-- ---------------------------------------------------------------------
create table public.plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.daily_challenges (id) on delete restrict,
  -- Denormalised from the challenge for fast streak / leaderboard queries.
  challenge_date date not null,
  -- 'daily' counts for streaks and leaderboards; 'time_travel' never does.
  mode public.play_mode not null,
  status public.play_status not null default 'playing',
  current_clue smallint not null default 1 check (current_clue between 1 and 3),
  solved_on_clue smallint check (solved_on_clue between 1 and 3),
  points smallint not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- One play per player per challenge (prevents replays / duplicate rows).
  unique (user_id, challenge_id),
  constraint plays_won_iff_solved check ((status = 'won') = (solved_on_clue is not null)),
  constraint plays_solved_on_current check (solved_on_clue is null or solved_on_clue = current_clue),
  -- The points rule lives in the database: 3 / 2 / 1 / 0.
  constraint plays_points_rule check (
    points = case solved_on_clue when 1 then 3 when 2 then 2 when 3 then 1 else 0 end
  ),
  constraint plays_finished_iff_done check ((status = 'playing') = (finished_at is null))
);
create index plays_user_date_idx on public.plays (user_id, challenge_date);
create index plays_daily_board_idx on public.plays (challenge_date, user_id) where mode = 'daily';
create index plays_challenge_idx on public.plays (challenge_id);

create table public.guesses (
  id bigint generated always as identity primary key,
  play_id uuid not null references public.plays (id) on delete cascade,
  clue_number smallint not null check (clue_number between 1 and 3),
  movie_id uuid references public.movies (id) on delete restrict, -- null = skipped
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  -- One guess per clue (also blocks duplicate submissions).
  unique (play_id, clue_number),
  constraint guesses_skip_not_correct check (movie_id is not null or not is_correct)
);
create index guesses_movie_idx on public.guesses (movie_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.movie_cast enable row level security;
alter table public.clips enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.plays enable row level security;
alter table public.guesses enable row level security;

-- profiles: players see only their own row; admins see all. No direct writes
-- (display names go through set_display_name()).
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- movies: everyone can read active movies; admins manage.
create policy movies_read on public.movies for select to anon, authenticated
  using (is_active or (select private.is_admin()));
create policy movies_admin_insert on public.movies for insert to authenticated
  with check ((select private.is_admin()));
create policy movies_admin_update on public.movies for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy movies_admin_delete on public.movies for delete to authenticated
  using ((select private.is_admin()));

-- admin-only tables
create policy movie_cast_admin_all on public.movie_cast for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy clips_admin_all on public.clips for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy daily_challenges_admin_all on public.daily_challenges for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- plays / guesses: read own; admins read all; no direct writes.
create policy plays_select_own on public.plays for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy guesses_select_own on public.guesses for select to authenticated
  using (
    exists (select 1 from public.plays p where p.id = play_id and p.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

-- ---------------------------------------------------------------------
-- Grants (explicit; RLS still applies to every row)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.movies to anon, authenticated;
grant insert, update, delete on public.movies to authenticated;
grant select, insert, update, delete on public.movie_cast, public.clips, public.daily_challenges to authenticated;
grant select on public.profiles, public.plays, public.guesses to authenticated;
grant update (is_hidden) on public.profiles to authenticated; -- admin moderation (RLS-gated)

grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------
-- set_display_name: validate + save the caller's display name
-- ---------------------------------------------------------------------
create function public.set_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_name := regexp_replace(btrim(normalize(coalesce(p_name, ''), NFC)), '\s+', ' ', 'g');

  if char_length(v_name) not between 2 and 20
     or v_name !~ '^[A-Za-z0-9 _.ఀ-౿-]+$' then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  begin
    insert into public.profiles (id, display_name) values (v_uid, v_name)
    on conflict (id) do update set display_name = excluded.display_name;
  exception when unique_violation then
    raise exception 'display_name_taken' using errcode = '23505';
  end;

  return v_name;
end
$$;
revoke execute on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;

-- ---------------------------------------------------------------------
-- Auth hook: only anonymous players and operator-created admins may be
-- created. Blocks e-mail/phone self sign-ups through the public API.
-- ---------------------------------------------------------------------
create function private.before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce((event -> 'user' ->> 'is_anonymous')::boolean, false) then
    return '{}'::jsonb;
  end if;
  if (event -> 'user' -> 'app_metadata' ->> 'role') = 'admin' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Sign-ups are disabled. Cineraagam players do not need an account.'
  ));
end
$$;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function private.before_user_created(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: private bucket for audio clips (admins only; players receive
-- short-lived signed URLs from the server for unlocked clues, Phase 2)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clips', 'clips', false, 5242880,
        array['audio/mpeg', 'audio/ogg', 'audio/opus', 'audio/mp4', 'audio/webm'])
on conflict (id) do nothing;

create policy clips_bucket_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'clips' and (select private.is_admin()))
  with check (bucket_id = 'clips' and (select private.is_admin()));
