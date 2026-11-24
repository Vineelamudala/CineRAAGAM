'use client';

import { useEffect, useId, useState } from 'react';
import { Input } from './ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';

export type AdminMovie = { id: string; title: string; release_year: number | null; is_active: boolean };

/** Escape characters that have special meaning in a PostgREST ilike pattern. */
export const ilikePattern = (q: string) => `%${q.replace(/[%_\\,()]/g, ' ').trim()}%`;

/** Searches the whole catalogue (including inactive movies) by title. */
export function MovieSearch({ onPick, placeholder = 'Search movies by title…', autoFocus }: { onPick: (m: AdminMovie) => void; placeholder?: string; autoFocus?: boolean }) {
  const db = useAdminDb();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AdminMovie[]>([]);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await db.from('movies').select('id, title, release_year, is_active')
        .ilike('title', ilikePattern(term)).order('title').limit(12);
      if (!cancelled) setResults(data ?? []);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, db]);

  const shown = q.trim().length >= 2 ? results : [];

  return (
    <div className="relative">
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} aria-controls={listId} autoFocus={autoFocus} aria-label="Search movies" />
      {shown.length > 0 && (
        <ul id={listId} className="absolute top-11 right-0 left-0 z-10 m-0 max-h-72 list-none overflow-auto rounded-lg border border-line bg-panel-2 p-1 shadow-2xl">
          {shown.map(m => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => { onPick(m); setQ(''); setResults([]); }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-0 bg-transparent px-3 py-2 text-left text-[13px] text-text hover:bg-panel"
              >
                <span>{m.title}{!m.is_active && <span className="ml-2 text-[10px] text-muted">(inactive)</span>}</span>
                <span className="font-mono text-[11px] text-muted">{m.release_year ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
