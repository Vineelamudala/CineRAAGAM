'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MovieOption } from '@/lib/search/movies';
import type { ClueNumber } from './rules';

/** Shape returned by public.get_challenge / public.submit_guess (see game_functions migration). */
export type ChallengeState = {
  date: string; // YYYY-MM-DD (IST)
  number: number;
  is_today: boolean;
  clips: {
    clue: ClueNumber;
    difficulty: 'hard' | 'medium' | 'easy';
    kind: 'bgm' | 'song_interlude';
    duration_ms: number;
    /** Storage path, present only once the clue is unlocked. */
    path: string | null;
  }[];
  play: null | {
    mode: 'daily' | 'time_travel';
    status: 'playing' | 'won' | 'lost';
    current_clue: ClueNumber;
    solved_on_clue: ClueNumber | null;
    points: number;
    started_at: string;
    finished_at: string | null;
  };
  guesses: { clue: ClueNumber; result: 'correct' | 'wrong' | 'skipped'; movie_title: string | null }[];
  reveal: null | { title: string; year: number | null; cast: string[] };
};

export type PastChallenge = {
  date: string;
  number: number;
  status: 'playing' | 'won' | 'lost' | null;
  mode: 'daily' | 'time_travel' | null;
  points: number | null;
};

export type MyStats = {
  current_streak: number;
  best_streak: number;
  played: number;
  won: number;
  win_rate: number | null;
  total_points: number;
  week_points: number;
  week_rank: number | null;
  distribution: { '1': number; '2': number; '3': number; missed: number };
  week: { date: string; is_today: boolean; has_challenge: boolean; status: 'playing' | 'won' | 'lost' | null }[];
};

export type LeaderboardPeriod = 'week' | 'month' | 'all';
export type Leaderboard = {
  period: LeaderboardPeriod;
  from: string | null;
  to: string;
  total: number;
  rows: { rank: number; name: string; points: number; solved: number; is_me: boolean }[];
  me: { rank: number; name: string; points: number; solved: number } | null;
};

export type HistoryEntry = {
  date: string;
  number: number;
  status: 'playing' | 'won' | 'lost' | null;
  mode: 'daily' | 'time_travel' | null;
  points: number | null;
  solved_on_clue: number | null;
  clues_used: number;
  title: string | null;
  year: number | null;
};

export class GameApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

function fail(error: { message: string; code?: string }): never {
  throw new GameApiError(error.message, error.code);
}

export async function getChallenge(supabase: SupabaseClient, date?: string): Promise<ChallengeState | null> {
  const { data, error } = await supabase.rpc('get_challenge', date ? { p_date: date } : {});
  if (error) fail(error);
  return (data as ChallengeState | null) ?? null;
}

/** movieId = null skips the clue. Safe to retry: the server ignores duplicates. */
export async function submitGuess(supabase: SupabaseClient, date: string, clue: number, movieId: string | null): Promise<ChallengeState> {
  const { data, error } = await supabase.rpc('submit_guess', { p_date: date, p_clue: clue, p_movie_id: movieId });
  if (error) fail(error);
  return data as ChallengeState;
}

export async function listPastChallenges(supabase: SupabaseClient, limit = 60, offset = 0): Promise<PastChallenge[]> {
  const { data, error } = await supabase.rpc('list_past_challenges', { p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return (data as PastChallenge[]) ?? [];
}

export async function getMyStats(supabase: SupabaseClient): Promise<MyStats> {
  const { data, error } = await supabase.rpc('get_my_stats');
  if (error) fail(error);
  return data as MyStats;
}

export async function getLeaderboard(supabase: SupabaseClient, period: LeaderboardPeriod, limit = 50): Promise<Leaderboard> {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_period: period, p_limit: limit });
  if (error) fail(error);
  return data as Leaderboard;
}

export async function getMyHistory(supabase: SupabaseClient, limit = 30, offset = 0): Promise<HistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_my_history', { p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return (data as HistoryEntry[]) ?? [];
}

/** Short-lived URL for an unlocked clue (Storage RLS refuses locked clues). */
export async function signClipUrl(supabase: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('clips').createSignedUrl(path, 60 * 30);
  if (error || !data) throw new GameApiError(error?.message ?? 'Could not load audio');
  return data.signedUrl;
}

// The catalogue rarely changes during a visit: fetch it once per page load.
let catalogPromise: Promise<MovieOption[]> | null = null;

/** All active movies for autocomplete (paged: the API returns at most 1000 rows per request). */
export function fetchCatalog(supabase: SupabaseClient): Promise<MovieOption[]> {
  catalogPromise ??= (async () => {
    const pageSize = 1000;
    const all: MovieOption[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('movies')
        .select('id, title, release_year, aliases')
        .eq('is_active', true)
        .order('title')
        .range(from, from + pageSize - 1);
      if (error) {
        catalogPromise = null;
        fail(error);
      }
      for (const m of data ?? []) {
        all.push({ id: m.id, title: m.title, year: m.release_year ?? undefined, aliases: m.aliases ?? [] });
      }
      if (!data || data.length < pageSize) break;
    }
    return all;
  })();
  return catalogPromise;
}
