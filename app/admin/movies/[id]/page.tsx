'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { AudioPreview } from '@/components/admin/AudioPreview';
import { ClipUploader } from '@/components/admin/ClipUploader';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, friendlyError } from '@/components/admin/ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';

type Movie = { id: string; title: string; release_year: number | null; aliases: string[]; wikidata_id: string | null; imdb_id: string | null; is_active: boolean };
type CastRow = { id: string; person_name: string; billing_order: number };
type Clip = { id: string; storage_path: string; kind: 'bgm' | 'song_interlude'; duration_ms: number; notes: string | null; created_at: string };

export default function AdminMoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useAdminDb();
  const router = useRouter();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [form, setForm] = useState({ title: '', year: '', aliases: '', imdb: '', active: true });
  const [cast, setCast] = useState<CastRow[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [usedClipIds, setUsedClipIds] = useState<Set<string>>(new Set());
  const [newCast, setNewCast] = useState('');
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [m, c, k, used] = await Promise.all([
        db.from('movies').select('id, title, release_year, aliases, wikidata_id, imdb_id, is_active').eq('id', id).maybeSingle(),
        db.from('movie_cast').select('id, person_name, billing_order').eq('movie_id', id).order('billing_order').order('person_name'),
        db.from('clips').select('id, storage_path, kind, duration_ms, notes, created_at').eq('movie_id', id).order('created_at'),
        db.from('daily_challenges').select('hard_clip_id, medium_clip_id, easy_clip_id').eq('movie_id', id),
      ]);
      if (cancelled) return;
      const found = m.data;
      if (!found) { setNotFound(true); return; }
      setMovie(found);
      setForm(f => (f.title ? f : {
        title: found.title, year: found.release_year?.toString() ?? '', aliases: found.aliases.join(', '),
        imdb: found.imdb_id ?? '', active: found.is_active,
      }));
      setCast(c.data ?? []);
      setClips((k.data as Clip[]) ?? []);
      setUsedClipIds(new Set((used.data ?? []).flatMap(r => [r.hard_clip_id, r.medium_clip_id, r.easy_clip_id])));
    })();
    return () => { cancelled = true; };
  }, [db, id, version]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const aliases = form.aliases.split(',').map(a => a.trim()).filter(Boolean);
    const { error } = await db.from('movies').update({
      title: form.title.trim(),
      release_year: form.year ? Number(form.year) : null,
      aliases,
      imdb_id: form.imdb.trim() || null,
      is_active: form.active,
    }).eq('id', id);
    setMsg(error ? { tone: 'bad', text: friendlyError(error) } : { tone: 'good', text: 'Saved.' });
    if (!error) reload();
  }

  async function addCast(e: React.FormEvent) {
    e.preventDefault();
    const name = newCast.trim();
    if (!name) return;
    const order = cast.length ? Math.max(...cast.map(c => c.billing_order)) + 1 : 1;
    const { error } = await db.from('movie_cast').insert({ movie_id: id, person_name: name, billing_order: order });
    if (error) { setMsg({ tone: 'bad', text: friendlyError(error) }); return; }
    setNewCast('');
    reload();
  }

  async function moveCast(index: number, dir: -1 | 1) {
    const a = cast[index], b = cast[index + dir];
    if (!a || !b) return;
    // Renumber the whole list so orders stay unique and sequential.
    const next = [...cast];
    next[index] = b; next[index + dir] = a;
    await Promise.all(next.map((c, i) => db.from('movie_cast').update({ billing_order: i + 1 }).eq('id', c.id)));
    reload();
  }

  async function removeCast(castId: string) {
    await db.from('movie_cast').delete().eq('id', castId);
    reload();
  }

  async function deleteClip(clip: Clip) {
    if (!confirm('Delete this clip? This cannot be undone.')) return;
    const { error } = await db.from('clips').delete().eq('id', clip.id); // fails if a challenge uses it
    if (error) { setMsg({ tone: 'bad', text: friendlyError(error) }); return; }
    await db.storage.from('clips').remove([clip.storage_path]);
    reload();
  }

  async function deleteMovie() {
    if (!confirm('Delete this movie from the catalogue? Movies with clips or challenges cannot be deleted — deactivate them instead.')) return;
    const { error } = await db.from('movies').delete().eq('id', id);
    if (error) { setMsg({ tone: 'bad', text: friendlyError(error) }); return; }
    router.push('/admin/movies');
  }

  if (notFound) return <Notice tone="bad">Movie not found. <Link href="/admin/movies">Back to movies</Link></Notice>;
  if (!movie) return <p className="text-[12px] text-muted">Loading…</p>;

  return (
    <>
      <PageHeader
        title={movie.title}
        description={<>
          {movie.release_year ?? 'Year unknown'}
          {movie.wikidata_id && <> · <a className="text-muted" href={`https://www.wikidata.org/wiki/${movie.wikidata_id}`} target="_blank" rel="noreferrer">Wikidata</a></>}
          {movie.imdb_id && <> · <a className="text-muted" href={`https://www.imdb.com/title/${movie.imdb_id}/`} target="_blank" rel="noreferrer">IMDb</a></>}
        </>}
        actions={<Link href="/admin/movies" className="text-[12px] text-muted">← All movies</Link>}
      />
      {msg && <div className="mb-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Details">
          <form onSubmit={save} className="grid gap-3">
            <Field label="Title (what players type and see)" htmlFor="m-title">
              <Input id="m-title" required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Release year" htmlFor="m-year"><Input id="m-year" type="number" min={1930} max={2100} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} /></Field>
              <Field label="IMDb id" htmlFor="m-imdb"><Input id="m-imdb" pattern="tt\d+" placeholder="tt1234567" value={form.imdb} onChange={e => setForm({ ...form, imdb: e.target.value })} /></Field>
            </div>
            <Field label="Other names (comma separated)" htmlFor="m-aliases" hint="Players can find the movie by these too, e.g. AVPL.">
              <Input id="m-aliases" value={form.aliases} onChange={e => setForm({ ...form, aliases: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              Active (shown in the players’ autocomplete)
            </label>
            <div className="flex justify-between gap-2">
              <Button type="submit" variant="primary">Save details</Button>
              <Button variant="danger" onClick={deleteMovie}><Trash2 size={13} /> Delete movie</Button>
            </div>
          </form>
        </Card>

        <Card title="Main cast (shown in the reveal)">
          {cast.length === 0 && <p className="m-0 mb-3 text-[12px] text-muted">No cast yet. Add the main actors in billing order — the first five are shown to players.</p>}
          <ol className="m-0 mb-3 grid list-none gap-1 p-0">
            {cast.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-panel-2 px-3 py-2 text-[13px]">
                <span><span className="mr-2 font-mono text-[11px] text-muted">{i + 1}</span>{c.person_name}</span>
                <span className="flex gap-1">
                  <Button variant="ghost" className="h-7 px-2" onClick={() => moveCast(i, -1)} disabled={i === 0} aria-label={`Move ${c.person_name} up`}><ArrowUp size={13} /></Button>
                  <Button variant="ghost" className="h-7 px-2" onClick={() => moveCast(i, 1)} disabled={i === cast.length - 1} aria-label={`Move ${c.person_name} down`}><ArrowDown size={13} /></Button>
                  <Button variant="ghost" className="h-7 px-2" onClick={() => removeCast(c.id)} aria-label={`Remove ${c.person_name}`}><Trash2 size={13} /></Button>
                </span>
              </li>
            ))}
          </ol>
          <form onSubmit={addCast} className="flex gap-2">
            <Input value={newCast} onChange={e => setNewCast(e.target.value)} placeholder="Actor name" maxLength={120} aria-label="Actor name" />
            <Button type="submit" disabled={!newCast.trim()}>Add</Button>
          </form>
        </Card>
      </div>

      <Card title={`Clips (${clips.length})`} className="mt-6">
        <p className="m-0 mb-4 text-[12px] text-muted">A challenge needs three different clips of this movie: one hard, one medium, one easy.</p>
        {clips.length > 0 && (
          <ul className="m-0 mb-5 grid list-none gap-1.5 p-0">
            {clips.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-[13px]">
                <AudioPreview path={c.storage_path} label={`Play clip ${i + 1}`} />
                <span className="font-mono text-[11px] text-muted">#{i + 1}</span>
                <Badge>{c.kind === 'bgm' ? 'BGM' : 'Song interlude'}</Badge>
                <span className="font-mono text-[12px]">{(c.duration_ms / 1000).toFixed(1)} s</span>
                <span className="flex-1 text-[12px] text-muted">{c.notes}</span>
                {usedClipIds.has(c.id) ? <Badge tone="good">in a challenge</Badge> : (
                  <Button variant="ghost" className="h-7 px-2" onClick={() => deleteClip(c)} aria-label={`Delete clip ${i + 1}`}><Trash2 size={13} /></Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <ClipUploader movieId={id} onUploaded={() => { setMsg({ tone: 'good', text: 'Clip saved.' }); reload(); }} />
      </Card>
    </>
  );
}
