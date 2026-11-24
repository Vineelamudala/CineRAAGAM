'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ilikePattern } from '@/components/admin/MovieSearch';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, friendlyError } from '@/components/admin/ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';

type Row = {
  id: string; title: string; release_year: number | null; is_active: boolean;
  clips: { count: number }[]; movie_cast: { count: number }[];
};

export default function AdminMoviesPage() {
  const db = useAdminDb();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [onlyWithClips, setOnlyWithClips] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newYear, setNewYear] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      let query = db.from('movies').select('id, title, release_year, is_active, clips(count), movie_cast(count)').order('title').limit(60);
      if (q.trim()) {
        query = query.ilike('title', ilikePattern(q));
      } else if (onlyWithClips) {
        const { data: clipRows } = await db.from('clips').select('movie_id');
        const ids = [...new Set((clipRows ?? []).map(r => r.movie_id))];
        if (ids.length === 0) { if (!cancelled) setRows([]); return; }
        query = query.in('id', ids);
      }
      const { data } = await query;
      if (!cancelled) setRows((data as unknown as Row[]) ?? []);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [db, q, onlyWithClips]);

  async function addMovie(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const year = newYear ? Number(newYear) : null;
    const { data, error: insertError } = await db.from('movies')
      .insert({ title: newTitle.trim(), release_year: year })
      .select('id').single();
    if (insertError) { setError(friendlyError(insertError)); return; }
    router.push(`/admin/movies/${data.id}`);
  }

  return (
    <>
      <PageHeader
        title="Movies & clips"
        description="The catalogue powers the players’ autocomplete (imported from Wikidata). Open a movie to edit its names, add the main cast and upload clips."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Catalogue">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by title…" aria-label="Search movies" className="max-w-[360px]" />
            {!q.trim() && (
              <label className="flex items-center gap-2 text-[12px] text-muted">
                <input type="checkbox" checked={onlyWithClips} onChange={e => setOnlyWithClips(e.target.checked)} /> Only movies with clips
              </label>
            )}
          </div>
          {!rows ? <p className="m-0 text-[12px] text-muted">Loading…</p> : rows.length === 0 ? (
            <p className="m-0 text-[12px] text-muted">{q ? 'No movies match.' : 'No movies with clips yet — search for a movie and open it to upload clips.'}</p>
          ) : (
            <ul className="m-0 grid list-none gap-1 p-0">
              {rows.map(m => (
                <li key={m.id}>
                  <Link href={`/admin/movies/${m.id}`} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[13px] text-text no-underline hover:bg-panel-2">
                    <span>{m.title} <span className="font-mono text-[11px] text-muted">{m.release_year ?? ''}</span></span>
                    <span className="flex items-center gap-2">
                      {!m.is_active && <Badge tone="warn">inactive</Badge>}
                      <Badge tone={m.clips[0]?.count >= 3 ? 'good' : 'neutral'}>{m.clips[0]?.count ?? 0} clips</Badge>
                      <Badge>{m.movie_cast[0]?.count ?? 0} cast</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Add a movie">
          <form onSubmit={addMovie} className="grid gap-3">
            <p className="m-0 text-[12px] text-muted">Search first — most Telugu films are already in the catalogue.</p>
            <Field label="Title" htmlFor="new-title"><Input id="new-title" required maxLength={200} value={newTitle} onChange={e => setNewTitle(e.target.value)} /></Field>
            <Field label="Release year" htmlFor="new-year"><Input id="new-year" type="number" min={1930} max={2100} value={newYear} onChange={e => setNewYear(e.target.value)} /></Field>
            {error && <Notice tone="bad">{error}</Notice>}
            <Button type="submit" variant="primary" disabled={!newTitle.trim()}>Add movie</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
