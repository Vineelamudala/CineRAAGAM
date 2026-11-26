import type { SupabaseClient } from '@supabase/supabase-js';
import type { MovieOption } from '@/lib/search/movies';

/** Every active movie (paged reads), for duplicate checks in the admin area. */
export async function loadActiveMovies(db: SupabaseClient): Promise<MovieOption[]> {
  const all: MovieOption[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('movies').select('id, title, release_year, aliases')
      .eq('is_active', true).order('title').range(from, from + 999);
    if (error) throw error;
    for (const m of data) all.push({ id: m.id, title: m.title, year: m.release_year ?? undefined, aliases: m.aliases ?? [] });
    if (data.length < 1000) return all;
  }
}
