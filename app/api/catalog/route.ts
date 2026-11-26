import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { serverSupabaseEnv } from '@/lib/supabase/env';

/**
 * The public movie catalogue for autocomplete, in one compact cached response
 * instead of several paged database requests per visitor. Contains only what
 * every player can already read (active movies: id, title, year, aliases).
 *
 * Format: [[id, title, year|null, aliases?], ...]
 */
export const dynamic = 'force-dynamic';

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; body: string; etag: string } | null = null;

async function build(): Promise<{ body: string; etag: string }> {
  const env = serverSupabaseEnv();
  if (!env) throw new Error('Supabase not configured');
  const db = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows: [string, string, number | null, string[]?][] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('movies')
      .select('id, title, release_year, aliases')
      .eq('is_active', true).order('title').range(from, from + 999);
    if (error) throw error;
    for (const m of data) rows.push(m.aliases?.length ? [m.id, m.title, m.release_year, m.aliases] : [m.id, m.title, m.release_year]);
    if (data.length < 1000) break;
  }
  const body = JSON.stringify(rows);
  return { body, etag: `"${createHash('sha1').update(body).digest('base64url')}"` };
}

export async function GET(request: Request) {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), ...(await build()) };
  } catch {
    if (!cache) return Response.json({ error: 'catalogue unavailable' }, { status: 503 });
    // Serve the last good copy if the database is briefly unreachable.
  }
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=600, stale-while-revalidate=86400',
    ETag: cache.etag,
  };
  if (request.headers.get('if-none-match') === cache.etag) return new Response(null, { status: 304, headers });
  return new Response(cache.body, { headers });
}
