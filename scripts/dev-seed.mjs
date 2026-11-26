// LOCAL DEVELOPMENT / TEST ONLY.
// Schedules published challenges for today and a few past days (and one future
// day) using the synthetic clips in e2e/fixtures. Existing challenges on those
// dates are left untouched. Requires the local stack and .env.local.
// Usage: node scripts/dev-seed.mjs
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const IST_OFFSET_MS = 5.5 * 3600 * 1000;
export const istDate = (offsetDays = 0) =>
  new Date(Date.now() + IST_OFFSET_MS + offsetDays * 86400000).toISOString().slice(0, 10);

const PLAN = [
  { offset: 0, title: 'Jersey', cast: ['Nani', 'Shraddha Srinath', 'Sathyaraj'] },
  { offset: -1, title: 'Magadheera', cast: ['Ram Charan', 'Kajal Aggarwal', 'Dev Gill'] },
  { offset: -2, title: 'Eega', cast: ['Sudeepa', 'Nani', 'Samantha'] },
  { offset: -3, title: 'Mahanati', cast: ['Keerthy Suresh', 'Dulquer Salmaan', 'Samantha'] },
  { offset: 1, title: 'RRR', cast: ['N. T. Rama Rao Jr.', 'Ram Charan', 'Alia Bhatt'] }, // future: must stay hidden
];

export function adminClient() {
  try { process.loadEnvFile('.env.local'); } catch { /* env may already be set */ }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY (run npm run env:local)');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureMovie(db, title, cast) {
  let { data: movie } = await db.from('movies').select('id').eq('title', title).limit(1).maybeSingle();
  if (!movie) {
    const res = await db.from('movies').insert({ title }).select('id').single();
    if (res.error) throw res.error;
    movie = res.data;
  }
  for (const [i, person_name] of cast.entries()) {
    await db.from('movie_cast').upsert({ movie_id: movie.id, person_name, billing_order: i + 1 }, { onConflict: 'movie_id,person_name' });
  }
  return movie.id;
}

async function uploadClip(db, movieId, n) {
  // MP3, like the clips the admin uploader produces.
  const storage_path = `${randomUUID()}.mp3`;
  const bytes = readFileSync(`e2e/fixtures/clue-${n}.mp3`);
  const up = await db.storage.from('clips').upload(storage_path, bytes, { contentType: 'audio/mpeg' });
  if (up.error) throw up.error;
  const { data, error } = await db.from('clips')
    .insert({ movie_id: movieId, storage_path, kind: n === 2 ? 'song_interlude' : 'bgm', duration_ms: 6000 })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

/** Ensures the planned challenges exist. Returns [{ date, title }]. */
export async function seedDevChallenges(db = adminClient()) {
  const out = [];
  for (const p of PLAN) {
    const date = istDate(p.offset);
    const { data: existing } = await db.from('daily_challenges').select('id, movies(title)').eq('challenge_date', date).maybeSingle();
    if (existing) {
      out.push({ date, title: existing.movies.title });
      continue;
    }
    const movieId = await ensureMovie(db, p.title, p.cast);
    const [hard, medium, easy] = [await uploadClip(db, movieId, 1), await uploadClip(db, movieId, 2), await uploadClip(db, movieId, 3)];
    const { error } = await db.from('daily_challenges').insert({
      challenge_date: date, movie_id: movieId, hard_clip_id: hard, medium_clip_id: medium, easy_clip_id: easy, status: 'published',
    });
    if (error) throw error;
    out.push({ date, title: p.title });
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await seedDevChallenges();
  for (const r of result) console.log(`${r.date}  ${r.title}`);
}
