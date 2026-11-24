'use client';

import { useEffect, useState } from 'react';
import { ilikePattern } from '@/components/admin/MovieSearch';
import { Badge, Button, Card, Input, Notice, PageHeader, friendlyError } from '@/components/admin/ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';

type Player = { id: string; display_name: string | null; is_hidden: boolean; created_at: string };

export default function AdminPlayersPage() {
  const db = useAdminDb();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      let query = db.from('profiles').select('id, display_name, is_hidden, created_at')
        .not('display_name', 'is', null).order('created_at', { ascending: false }).limit(100);
      if (q.trim()) query = query.ilike('display_name', ilikePattern(q));
      const { data } = await query;
      if (!cancelled) setRows(data ?? []);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [db, q, version]);

  async function setHidden(p: Player, hidden: boolean) {
    setError(null);
    const { error: e } = await db.from('profiles').update({ is_hidden: hidden }).eq('id', p.id);
    if (e) setError(friendlyError(e));
    setVersion(v => v + 1);
  }

  return (
    <>
      <PageHeader
        title="Players"
        description="Players are anonymous; only their chosen display name is stored. Hide a player to remove an offensive or impersonating name from public leaderboards. Their games are kept."
      />
      {error && <div className="mb-4"><Notice tone="bad">{error}</Notice></div>}
      <Card title="Named players (newest first)">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search display names…" aria-label="Search display names" className="mb-4 max-w-[360px]" />
        {!rows ? <p className="m-0 text-[12px] text-muted">Loading…</p> : rows.length === 0 ? <p className="m-0 text-[12px] text-muted">No players found.</p> : (
          <ul className="m-0 grid list-none gap-1 p-0">
            {rows.map(p => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 py-2 text-[13px]">
                <span className="flex items-center gap-3">
                  <span className={p.is_hidden ? 'text-muted line-through' : ''}>{p.display_name}</span>
                  {p.is_hidden && <Badge tone="bad">hidden</Badge>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted">joined {p.created_at.slice(0, 10)}</span>
                  <Button className="h-7" onClick={() => setHidden(p, !p.is_hidden)}>{p.is_hidden ? 'Unhide' : 'Hide'}</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
