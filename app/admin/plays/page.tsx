'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, SkipForward, X } from 'lucide-react';
import { Badge, Card, Field, Input, Notice, PageHeader, friendlyError } from '@/components/admin/ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';
import { istDateString } from '@/lib/time/ist';

type Guess = { clue: number; result: 'correct' | 'wrong' | 'skipped'; movie: string | null; year: number | null };
type Play = {
  player: string; named: boolean; is_admin: boolean; mode: 'daily' | 'time_travel';
  status: 'playing' | 'won' | 'lost'; points: number; solved_on_clue: number | null;
  started_at: string; finished_at: string | null; guesses: Guess[];
};
type Report = {
  date: string;
  challenge: { title: string; year: number | null } | null;
  totals: { players: number; won: number; lost: number; playing: number; on1: number; on2: number; on3: number; time_travel: number };
  plays: Play[];
};

const timeIst = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel-2 px-3 py-3 text-center">
      <div className="text-[22px] font-bold leading-none">{value}</div>
      <div className="mt-1.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}

/** Admin: who played a day's challenge and what they guessed, clue by clue. */
export default function AdminPlaysPage() {
  const db = useAdminDb();
  const [date, setDate] = useState(() => istDateString(Date.now()));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    db.rpc('admin_day_report', { p_date: date }).then(({ data, error: e }) => {
      if (cancelled) return;
      if (e) { setError(friendlyError(e)); setReport(null); return; }
      setError(null);
      setReport(data as Report);
    });
    return () => { cancelled = true; };
  }, [db, date]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (report?.plays ?? []).filter(p => !term || p.player.toLowerCase().includes(term));
  }, [report, q]);

  // Wrong answers people gave most often: shows which films the clues get confused with.
  const commonWrong = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of report?.plays ?? []) {
      for (const g of p.guesses) {
        if (g.result === 'wrong' && g.movie) {
          const key = `${g.movie}${g.year ? ` (${g.year})` : ''}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [report]);

  const t = report?.totals;
  return (
    <>
      <PageHeader
        title="Who played"
        description="Everyone who played a day’s challenge and what they guessed on each clue. Unnamed players appear as “Guest” with a short id."
        actions={
          <Field label="Day" htmlFor="report-date">
            <Input id="report-date" type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="w-[170px]" />
          </Field>
        }
      />
      {error && <div className="mb-4"><Notice tone="bad">{error}</Notice></div>}

      {!report ? <p className="text-[12px] text-muted">Loading…</p> : !report.challenge ? (
        <Notice>No challenge is scheduled for {report.date}.</Notice>
      ) : (
        <div className="grid gap-6">
          <Card title={`${report.date} · ${report.challenge.title}${report.challenge.year ? ` (${report.challenge.year})` : ''}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <Stat label="Players" value={t!.players} />
              <Stat label="Solved" value={t!.won} />
              <Stat label="Missed" value={t!.lost} />
              <Stat label="Still playing" value={t!.playing} />
              <Stat label="On clue 1" value={t!.on1} />
              <Stat label="On clue 2" value={t!.on2} />
              <Stat label="On clue 3" value={t!.on3} />
            </div>
            {t!.time_travel > 0 && <p className="m-0 mt-3 text-[11px] text-muted">{t!.time_travel} of these played it later via Time Travel (no points).</p>}
            {commonWrong.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[12px] text-muted">Most common wrong guesses</div>
                <div className="flex flex-wrap gap-1.5">
                  {commonWrong.map(([movie, n]) => <Badge key={movie} tone="bad">{movie} · {n}</Badge>)}
                </div>
              </div>
            )}
          </Card>

          <Card title={`Players (${shown.length})`}>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search players…" aria-label="Search players" className="mb-4 max-w-[320px]" />
            {shown.length === 0 ? <p className="m-0 text-[12px] text-muted">Nobody yet.</p> : (
              <ul className="m-0 grid list-none gap-1.5 p-0" aria-label="Plays">
                {shown.map((p, i) => (
                  <li key={`${p.player}-${i}`} className="grid gap-2 rounded-lg bg-panel-2 px-3 py-2.5 text-[13px] sm:grid-cols-[minmax(150px,1fr)_auto_2fr] sm:items-center">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className={p.named ? '' : 'font-normal text-muted'}>{p.player}</strong>
                      {p.is_admin && <Badge tone="warn">admin</Badge>}
                      {p.mode === 'time_travel' && <Badge>time travel</Badge>}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
                      {timeIst(p.started_at)}
                      <Badge tone={p.status === 'won' ? 'good' : p.status === 'lost' ? 'bad' : 'neutral'}>
                        {p.status === 'won' ? `won · ${p.points} pt${p.points === 1 ? '' : 's'}` : p.status === 'lost' ? 'missed' : 'playing'}
                      </Badge>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {p.guesses.length === 0 && <span className="text-[12px] text-muted">no guess yet</span>}
                      {p.guesses.map(g => (
                        <span key={g.clue} className={`guess-history-chip is-${g.result}`}>
                          {g.result === 'correct' ? <Check size={12} aria-label="correct" /> : g.result === 'skipped' ? <SkipForward size={12} aria-label="skipped" /> : <X size={12} aria-label="wrong" />}
                          Clue {g.clue}: {g.result === 'skipped' ? 'skipped' : `${g.movie}${g.year ? ` (${g.year})` : ''}`}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
