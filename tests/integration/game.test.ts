import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, istDate, seedDevChallenges } from '../../scripts/dev-seed.mjs';

/** The real game API + Storage access rules, end to end, against the local stack. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

type State = {
  date: string;
  clips: { clue: number; path: string | null }[];
  play: { status: string; current_clue: number; points: number; mode: string } | null;
  reveal: { title: string; cast: string[] } | null;
};

async function newPlayer(): Promise<SupabaseClient> {
  const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

let answerTitle: string;
let answerId: string;
let decoyId: string;
let allPaths: string[];

beforeAll(async () => {
  const db = adminClient();
  await seedDevChallenges(db);
  const { data } = await db.from('daily_challenges')
    .select('movie_id, movies(title), hard:clips!daily_challenges_hard_clip_id_movie_id_fkey(storage_path), medium:clips!daily_challenges_medium_clip_id_movie_id_fkey(storage_path), easy:clips!daily_challenges_easy_clip_id_movie_id_fkey(storage_path)')
    .eq('challenge_date', istDate(0)).single();
  answerId = data!.movie_id;
  answerTitle = (data as unknown as { movies: { title: string } }).movies.title;
  const d = data as unknown as Record<'hard' | 'medium' | 'easy', { storage_path: string }>;
  allPaths = [d.hard.storage_path, d.medium.storage_path, d.easy.storage_path];
  const { data: decoy } = await db.from('movies').select('id').neq('id', answerId).eq('is_active', true).limit(1).single();
  decoyId = decoy!.id;
});

describe('playing today’s challenge through the API', () => {
  it('only clue 1 audio is available at the start, and the answer is hidden', async () => {
    const player = await newPlayer();
    const { data, error } = await player.rpc('get_challenge');
    expect(error).toBeNull();
    const state = data as State;
    expect(state.clips.map(c => c.path !== null)).toEqual([true, false, false]);
    expect(JSON.stringify(state)).not.toContain(answerTitle);
    expect(JSON.stringify(state)).not.toContain(answerId);

    // Storage enforces the same rule: clue 1 can be signed and downloaded...
    const signed = await player.storage.from('clips').createSignedUrl(allPaths[0], 60);
    expect(signed.error).toBeNull();
    const res = await fetch(signed.data!.signedUrl);
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    // ...but locked clues cannot, even by guessing the file name.
    for (const path of allPaths.slice(1)) {
      const locked = await player.storage.from('clips').createSignedUrl(path, 60);
      expect(locked.error, path).not.toBeNull();
      const direct = await player.storage.from('clips').download(path);
      expect(direct.error, path).not.toBeNull();
    }
  });

  it('a wrong guess unlocks clue 2 audio (and only clue 2)', async () => {
    const player = await newPlayer();
    const { data } = await player.rpc('submit_guess', { p_date: istDate(0), p_clue: 1, p_movie_id: decoyId });
    expect((data as State).play!.current_clue).toBe(2);
    expect((await player.storage.from('clips').createSignedUrl(allPaths[1], 60)).error).toBeNull();
    expect((await player.storage.from('clips').createSignedUrl(allPaths[2], 60)).error).not.toBeNull();
  });

  it('solving on clue 1 gives 3 points and reveals the movie', async () => {
    const player = await newPlayer();
    const { data } = await player.rpc('submit_guess', { p_date: istDate(0), p_clue: 1, p_movie_id: answerId });
    const state = data as State;
    expect(state.play).toMatchObject({ status: 'won', points: 3, mode: 'daily' });
    expect(state.reveal!.title).toBe(answerTitle);
    expect(state.reveal!.cast.length).toBeGreaterThan(0);
  });

  it('parallel double submissions record only one guess', async () => {
    const player = await newPlayer();
    const results = await Promise.all([
      player.rpc('submit_guess', { p_date: istDate(0), p_clue: 1, p_movie_id: decoyId }),
      player.rpc('submit_guess', { p_date: istDate(0), p_clue: 1, p_movie_id: decoyId }),
    ]);
    results.forEach(r => expect(r.error).toBeNull());
    const { data } = await player.rpc('get_challenge');
    expect((data as State & { guesses: unknown[] }).guesses).toHaveLength(1);
    expect((data as State).play!.current_clue).toBe(2);
  });

  it('tomorrow’s challenge is invisible and its audio unreadable', async () => {
    const player = await newPlayer();
    const { data } = await player.rpc('get_challenge', { p_date: istDate(1) });
    expect(data).toBeNull();
    const { data: past } = await player.rpc('list_past_challenges');
    expect((past as { date: string }[]).some(p => p.date >= istDate(0))).toBe(false);
  });

  it('stats, leaderboard and history work through the API (incl. read-only rules)', async () => {
    const player = await newPlayer();
    await player.rpc('set_display_name', { p_name: `Api ${Math.random().toString(36).slice(2, 7)}` });
    await player.rpc('submit_guess', { p_date: istDate(0), p_clue: 1, p_movie_id: answerId });

    const stats = await player.rpc('get_my_stats');
    expect(stats.error).toBeNull();
    expect(stats.data).toMatchObject({ current_streak: 1, played: 1, won: 1, total_points: 3 });

    for (const period of ['week', 'month', 'all']) {
      const board = await player.rpc('get_leaderboard', { p_period: period });
      expect(board.error, period).toBeNull();
      expect(board.data.me, period).toMatchObject({ points: 3 });
    }

    const history = await player.rpc('get_my_history');
    expect(history.error).toBeNull();
    expect(history.data[0]).toMatchObject({ date: istDate(0), status: 'won', points: 3, title: answerTitle });
  });

  it('past days are playable as time travel', async () => {
    const player = await newPlayer();
    const { data, error } = await player.rpc('submit_guess', { p_date: istDate(-1), p_clue: 1, p_movie_id: null });
    expect(error).toBeNull();
    expect((data as State).play!.mode).toBe('time_travel');
  });
});
