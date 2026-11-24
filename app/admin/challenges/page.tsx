'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, ButtonLink, Card, PageHeader } from '@/components/admin/ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';
import { addDays, formatDay, istToday } from '@/lib/admin/dates';

type Row = { id: string; challenge_date: string; status: 'draft' | 'published'; movies: { title: string; release_year: number | null } | null; plays: { count: number }[] };

export default function AdminChallengesPage() {
  const db = useAdminDb();
  const today = istToday();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const from = showPast ? addDays(today, -365) : today;
      const { data } = await db.from('daily_challenges')
        .select('id, challenge_date, status, movies(title, release_year), plays(count)')
        .gte('challenge_date', from).order('challenge_date', { ascending: !showPast }).limit(200);
      if (!cancelled) setRows((data as unknown as Row[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [db, today, showPast]);

  return (
    <>
      <PageHeader
        title="Schedule"
        description="One challenge per day. Players only ever see published challenges, and only from their date onwards (00:00 IST)."
        actions={<ButtonLink href="/admin/challenges/new" variant="primary">Schedule a day</ButtonLink>}
      />
      <Card
        title={showPast ? 'All challenges (newest first)' : 'Today and upcoming'}
        actions={<button className="cursor-pointer border-0 bg-transparent text-[12px] text-muted hover:text-text" onClick={() => setShowPast(p => !p)}>{showPast ? 'Show upcoming' : 'Show past too'}</button>}
      >
        {!rows ? <p className="m-0 text-[12px] text-muted">Loading…</p> : rows.length === 0 ? (
          <p className="m-0 text-[12px] text-muted">Nothing scheduled yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {rows.map(r => (
              <li key={r.id}>
                <Link href={`/admin/challenges/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-3.5 py-2.5 text-[13px] text-text no-underline hover:border-muted">
                  <span className="flex items-center gap-3">
                    <span className="w-[150px] font-mono text-[12px] text-muted">{formatDay(r.challenge_date)}</span>
                    <span>{r.movies?.title} <span className="font-mono text-[11px] text-muted">{r.movies?.release_year ?? ''}</span></span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-muted">{r.plays[0]?.count ?? 0} plays</span>
                    <Badge tone={r.status === 'published' ? 'good' : 'warn'}>{r.status}</Badge>
                    {r.challenge_date === today && <Badge>today</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
