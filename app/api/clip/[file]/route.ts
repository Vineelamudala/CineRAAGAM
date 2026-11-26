import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Serves a clue's audio through the hosting CDN so it isn't downloaded from
 * Supabase Storage for every player (Supabase's free plan meters downloads).
 *
 * Access rule is unchanged: the file is fetched from Storage with the
 * REQUESTING PLAYER's session, so Storage RLS (private.can_read_clip) still
 * decides whether this clue is unlocked for them. Refusals are never cached.
 * Successful responses are cached publicly by URL: file names are random
 * UUIDs revealed to a player only once that clue is unlocked, and a file's
 * content never changes (a new upload gets a new name).
 */
const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|ogg|opus|m4a|mp3)$/;
const TYPES: Record<string, string> = {
  webm: 'audio/webm', ogg: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg',
};

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!FILE.test(file)) return notFound();

  const supabase = await getServerSupabase();
  if (!supabase) return notFound();
  const { data, error } = await supabase.storage.from('clips').download(file);
  if (error || !data) return notFound(); // locked for this player, or missing

  const ext = file.slice(file.lastIndexOf('.') + 1);
  return new Response(data, {
    headers: {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Content-Length': String(data.size),
      // Browsers keep it for a day; the CDN keeps it for a year (immutable file).
      'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
    },
  });
}
