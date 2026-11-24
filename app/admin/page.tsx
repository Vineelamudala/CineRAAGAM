'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, ButtonLink, Card, PageHeader } from '@/components/admin/ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';
import { addDays, dateRange, formatDay, istToday } from '@/lib/admin/dates';

type Row = { id: string; challenge_date: string; status: 'draft' | 'published'; movies: { title: string } | null };
type Stats = { players: number; playsToday: number; solvedToday: number; movies: number };

export default function AdminOverviewPage() {
  const db = useAdminDb();
  const today = istToday();
  const until = addDays(today, 13);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [schedule, players, plays, solved, movies] = await Promise.all([
        db.from('daily_challenges').select('id, challenge_date, status, movies(title)').gte('challenge_date', today).lte('challenge_date', until),
        db.from('profiles').select('id', { count: 'exact', head: true }),
        db.from('plays').select('id', { count: 'exact', head: true }).eq('challenge_date', today).eq('mode', 'daily'),
        db.from('plays').select('id', { count: 'exact', head: true }).eq('challenge_date', today).eq('mode', 'daily').eq('status', 'won'),
        db.from('movies').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      if (cancelled) return;
      setRows((schedule.data as unknown as Row[]) ?? []);
      setStats({ players: players.count ?? 0, playsToday: plays.count ?? 0, solvedToday: solved.count ?? 0, movies: movies.count ?? 0 });
    })();
    return () => { cancelled = true; };
  }, [db, today, until]);

  const byDate = new Map((rows ?? []).map(r => [r.challenge_date, r]));
  const missing = dateRange(today, until).filter(d => byDate.get(d)?.status !== 'published').length;

  return (
    <>
      <PageHeader
        title="Overview"
        description="The next two weeks of shows and today’s numbers. Every day needs a published challenge before midnight IST."
        actions={<ButtonLink href="/admin/challenges/new" variant="primary">Schedule a day</ButtonLink>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Players', stats?.players],
          ['Played today', stats?.playsToday],
          ['Solved today', stats?.solvedToday],
          ['Movies in catalogue', stats?.movies],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-line bg-panel p-4">
            <div className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{label}</div>
            <div className="mt-2 text-[26px] font-bold tracking-[-0.03em]">{value ?? '—'}</div>
          </div>
        ))}
      </div>

      <Card
        title="Next 14 days"
        actions={missing > 0 ? <Badge tone="warn">{missing} day{missing === 1 ? '' : 's'} not published</Badge> : <Badge tone="good">All published</Badge>}
      >
        {!rows ? (
          <p className="m-0 text-[12px] text-muted">Loading…</p>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {dateRange(today, until).map(d => {
              const r = byDate.get(d);
              return (
                <li key={d} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-3.5 py-2.5 text-[13px]">
                  <span className="flex items-center gap-3">
                    <span className="w-[150px] font-mono text-[12px] text-muted">{formatDay(d)}{d === today ? ' · today' : ''}</span>
                    <span>{r?.movies?.title ?? <span className="text-muted">Nothing scheduled</span>}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {r ? <Badge tone={r.status === 'published' ? 'good' : 'warn'}>{r.status}</Badge> : <Badge tone="bad">missing</Badge>}
                    <Link className="text-[12px] text-muted hover:text-text" href={r ? `/admin/challenges/${r.id}` : `/admin/challenges/new?date=${d}`}>
                      {r ? 'Edit' : 'Schedule'}
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
