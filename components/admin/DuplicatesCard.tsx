'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Merge } from 'lucide-react';
import { MovieSearch, type AdminMovie } from './MovieSearch';
import { Button, Card, Notice, friendlyError } from './ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';
import { loadActiveMovies } from '@/lib/admin/catalogue';
import { findSimilarMovies, type MovieOption } from '@/lib/search/movies';

type Props = {
  movie: { id: string; title: string; release_year: number | null; aliases: string[] };
  /** Called after a merge with a message for the admin. */
  onMerged: (message: string) => void;
};

type MergeResult = { removed: string; plays_corrected: number; guesses_moved: number };

/**
 * Lists movies that look like the same film (other spellings) and lets the
 * admin merge a duplicate into this movie, including differently named ones.
 */
export function DuplicatesCard({ movie, onMerged }: Props) {
  const db = useAdminDb();
  const [catalogue, setCatalogue] = useState<MovieOption[] | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadActiveMovies(db).then(all => { if (!cancelled) setCatalogue(all); }).catch(() => { if (!cancelled) setCatalogue([]); });
    return () => { cancelled = true; };
  }, [db, version]);

  const similar = useMemo(() => {
    if (!catalogue) return [];
    const seen = new Map<string, MovieOption>();
    for (const name of [movie.title, ...movie.aliases]) {
      for (const m of findSimilarMovies(name, catalogue)) if (m.id !== movie.id) seen.set(m.id, m);
    }
    return [...seen.values()];
  }, [catalogue, movie.id, movie.title, movie.aliases]);

  async function merge(other: { id: string; title: string; year?: number | null }) {
    const label = `${other.title}${other.year ? ` (${other.year})` : ''}`;
    if (!confirm(`Merge "${label}" into "${movie.title}"?\n\nIts name becomes another name of "${movie.title}", players who picked it are counted as picking "${movie.title}", and it is removed from the players' list. This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await db.rpc('admin_merge_movie', { p_duplicate: other.id, p_keep: movie.id });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message.includes('duplicate_has_clips')
        ? `"${label}" has its own clips or a challenge, so it can't be merged away. If it's the right one, open it and merge this movie into it instead.`
        : friendlyError(rpcError));
      return;
    }
    const r = data as MergeResult;
    setVersion(v => v + 1);
    onMerged(`Merged "${r.removed}" into this movie.${r.plays_corrected ? ` ${r.plays_corrected} player result${r.plays_corrected === 1 ? '' : 's'} corrected.` : ''} Players see the change within about 10 minutes.`);
  }

  return (
    <Card title="Duplicates" className="mt-6">
      <p className="m-0 mb-3 text-[12px] text-muted">
        The same film listed twice confuses players. Merge the extra entry into this one: its name is kept as another name, and players who picked it get the credit.
      </p>
      {error && <div className="mb-3"><Notice tone="bad">{error}</Notice></div>}
      {!catalogue ? <p className="m-0 mb-3 text-[12px] text-muted">Checking for other spellings…</p> : similar.length === 0 ? (
        <p className="m-0 mb-3 text-[12px] text-muted">No other spellings of this title found.</p>
      ) : (
        <ul className="m-0 mb-4 grid list-none gap-1.5 p-0" aria-label="Possible duplicates">
          {similar.map(m => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel-2 px-3 py-2 text-[13px]">
              <span>
                <Link href={`/admin/movies/${m.id}`}>{m.title}</Link>{' '}
                <span className="font-mono text-[11px] text-muted">{m.year ?? 'year unknown'}</span>
                {m.year && movie.release_year && m.year !== movie.release_year && <span className="ml-2 text-[11px] text-muted">different year: may be another film</span>}
              </span>
              <Button className="h-8" disabled={busy} onClick={() => merge(m)} aria-label={`Merge ${m.title} into this movie`}>
                <Merge size={13} /> Merge into this movie
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-1.5">
        <span className="text-[12px] text-muted">Duplicate with a different name (e.g. “Baahubali 2” vs “Baahubali: The Conclusion”)? Find it and merge it here:</span>
        <MovieSearch
          placeholder="Search for the duplicate…"
          onPick={(m: AdminMovie) => { if (m.id !== movie.id) merge({ id: m.id, title: m.title, year: m.release_year }); }}
        />
      </div>
    </Card>
  );
}
