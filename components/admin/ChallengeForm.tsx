'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { AudioPreview } from './AudioPreview';
import { MovieSearch, type AdminMovie } from './MovieSearch';
import { Badge, Button, Card, Field, Input, Notice, Select, friendlyError } from './ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';
import { istToday } from '@/lib/admin/dates';

type Clip = { id: string; storage_path: string; kind: 'bgm' | 'song_interlude'; duration_ms: number; notes: string | null };
type Existing = {
  id: string; challenge_date: string; status: 'draft' | 'published'; movie_id: string;
  hard_clip_id: string; medium_clip_id: string; easy_clip_id: string;
};

const SLOTS = [
  { key: 'hard', label: 'Clue 1 · Hard (3 points)', hint: 'The least recognisable clip.' },
  { key: 'medium', label: 'Clue 2 · Medium (2 points)', hint: '' },
  { key: 'easy', label: 'Clue 3 · Easy (1 point)', hint: 'The most recognisable clip.' },
] as const;

/** Create (no `challengeId`) or edit a daily challenge. */
export function ChallengeForm({ challengeId, initialDate, justCreated = false }: { challengeId?: string; initialDate?: string; justCreated?: boolean }) {
  const db = useAdminDb();
  const router = useRouter();
  const [date, setDate] = useState(initialDate ?? istToday());
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [movie, setMovie] = useState<AdminMovie | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [castCount, setCastCount] = useState(0);
  const [picks, setPicks] = useState({ hard: '', medium: '', easy: '' });
  const [plays, setPlays] = useState(0);
  const [loaded, setLoaded] = useState(!challengeId);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(justCreated);
  const locked = plays > 0; // once people have played, the answer and clues must not change

  // Load an existing challenge.
  useEffect(() => {
    if (!challengeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await db.from('daily_challenges')
        .select('id, challenge_date, status, movie_id, hard_clip_id, medium_clip_id, easy_clip_id, movies(id, title, release_year, is_active), plays(count)')
        .eq('id', challengeId).maybeSingle();
      if (cancelled || !data) { setLoaded(true); return; }
      const d = data as unknown as Existing & { movies: AdminMovie; plays: { count: number }[] };
      setDate(d.challenge_date);
      setStatus(d.status);
      setMovie(d.movies);
      setPicks({ hard: d.hard_clip_id, medium: d.medium_clip_id, easy: d.easy_clip_id });
      setPlays(d.plays[0]?.count ?? 0);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [db, challengeId]);

  // Load the chosen movie's clips and cast count.
  useEffect(() => {
    if (!movie) return;
    let cancelled = false;
    (async () => {
      const [k, c] = await Promise.all([
        db.from('clips').select('id, storage_path, kind, duration_ms, notes').eq('movie_id', movie.id).order('created_at'),
        db.from('movie_cast').select('id', { count: 'exact', head: true }).eq('movie_id', movie.id),
      ]);
      if (cancelled) return;
      setClips((k.data as Clip[]) ?? []);
      setCastCount(c.count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [db, movie]);

  function pickMovie(m: AdminMovie) {
    setMovie(m);
    setPicks({ hard: '', medium: '', easy: '' });
    setSaved(false);
  }

  const chosen = [picks.hard, picks.medium, picks.easy];
  const complete = !!movie && chosen.every(Boolean) && new Set(chosen).size === 3;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!movie || !complete) return;
    setError(null);
    setSaved(false);
    const row = { challenge_date: date, status, movie_id: movie.id, hard_clip_id: picks.hard, medium_clip_id: picks.medium, easy_clip_id: picks.easy };
    const res = challengeId
      ? await db.from('daily_challenges').update(locked ? { status } : row).eq('id', challengeId).select('id').single()
      : await db.from('daily_challenges').insert(row).select('id').single();
    if (res.error) {
      setError(res.error.code === '23505' ? 'Another challenge is already scheduled on this date.' : friendlyError(res.error));
      return;
    }
    setSaved(true);
    if (!challengeId) router.replace(`/admin/challenges/${res.data.id}?created=1`);
  }

  async function remove() {
    if (!challengeId || !confirm('Delete this challenge?')) return;
    const { error: delError } = await db.from('daily_challenges').delete().eq('id', challengeId);
    if (delError) { setError(friendlyError(delError)); return; }
    router.replace('/admin/challenges');
  }

  if (!loaded) return <p className="text-[12px] text-muted">Loading…</p>;

  const clipLabel = (c: Clip, i: number) => `#${i + 1} · ${c.kind === 'bgm' ? 'BGM' : 'Song interlude'} · ${(c.duration_ms / 1000).toFixed(1)} s${c.notes ? ` · ${c.notes}` : ''}`;

  return (
    <form onSubmit={save} className="grid gap-6">
      {locked && (
        <Notice tone="warn">
          {plays} {plays === 1 ? 'player has' : 'players have'} already played this challenge, so the date, movie and clips are locked.
          You can still change whether it is published.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card title="When">
          <div className="grid gap-4">
            <Field label="Date (IST)" htmlFor="c-date" hint="The challenge goes live at 00:00 IST on this date.">
              <Input id="c-date" type="date" required value={date} disabled={locked} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Status" htmlFor="c-status" hint="Drafts are never shown to players.">
              <Select id="c-status" value={status} onChange={e => setStatus(e.target.value as typeof status)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="The movie (answer)">
          {movie ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 py-2.5">
              <span className="text-[14px] font-semibold">{movie.title} <span className="font-mono text-[11px] font-normal text-muted">{movie.release_year ?? ''}</span></span>
              <Link href={`/admin/movies/${movie.id}`} className="text-[12px] text-muted">Open movie</Link>
            </div>
          ) : <p className="m-0 mb-3 text-[12px] text-muted">Pick the movie players must guess.</p>}
          {!locked && <MovieSearch onPick={pickMovie} placeholder={movie ? 'Change movie…' : 'Search movies…'} />}
          {movie && !movie.is_active && <div className="mt-3"><Notice tone="bad">This movie is inactive, so players can’t pick it in the autocomplete. Activate it first.</Notice></div>}
          {movie && castCount === 0 && <div className="mt-3"><Notice tone="warn">No cast yet — add the main cast on the movie page so the reveal shows it.</Notice></div>}
        </Card>
      </div>

      {movie && (
        <Card title="Clues">
          {clips.length < 3 ? (
            <Notice tone="warn">
              This movie has {clips.length} clip{clips.length === 1 ? '' : 's'}; a challenge needs 3.{' '}
              <Link href={`/admin/movies/${movie.id}`}>Upload clips on the movie page</Link>.
            </Notice>
          ) : (
            <div className="grid gap-4">
              {SLOTS.map(slot => {
                const selected = clips.find(c => c.id === picks[slot.key]);
                return (
                  <Field key={slot.key} label={slot.label} hint={slot.hint} htmlFor={`slot-${slot.key}`}>
                    <div className="flex items-center gap-2">
                      <Select id={`slot-${slot.key}`} value={picks[slot.key]} disabled={locked} required
                        onChange={e => { setPicks({ ...picks, [slot.key]: e.target.value }); setSaved(false); }}>
                        <option value="">Choose a clip…</option>
                        {clips.map((c, i) => (
                          <option key={c.id} value={c.id} disabled={chosen.includes(c.id) && picks[slot.key] !== c.id}>{clipLabel(c, i)}</option>
                        ))}
                      </Select>
                      {selected && <AudioPreview path={selected.storage_path} label={`Play ${slot.key} clip`} />}
                    </div>
                  </Field>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {error && <Notice tone="bad">{error}</Notice>}
      {saved && <Notice tone="good">Saved{status === 'published' ? ' and published' : ' as a draft'}.</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={!complete}>{challengeId ? 'Save changes' : 'Create challenge'}</Button>
          <Badge tone={status === 'published' ? 'good' : 'warn'}>{status}</Badge>
        </div>
        {challengeId && (
          <Button variant="danger" onClick={remove} disabled={locked} title={locked ? 'Challenges that have been played cannot be deleted' : undefined}>
            <Trash2 size={13} /> Delete challenge
          </Button>
        )}
      </div>
    </form>
  );
}
