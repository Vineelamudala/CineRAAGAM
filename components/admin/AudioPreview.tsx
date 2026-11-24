'use client';

import { useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { useAdminDb } from '@/lib/admin/AdminProvider';

/** Play/pause button for a stored clip (admins may sign any clip URL). */
export function AudioPreview({ path, label = 'Preview clip' }: { path: string; label?: string }) {
  const db = useAdminDb();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  async function toggle() {
    if (state === 'playing') {
      audioRef.current?.pause();
      return;
    }
    if (!audioRef.current) {
      setState('loading');
      const { data, error } = await db.storage.from('clips').createSignedUrl(path, 600);
      if (error || !data) { setState('error'); return; }
      const audio = new Audio(data.signedUrl);
      audio.onplaying = () => setState('playing');
      audio.onpause = () => setState('idle');
      audio.onended = () => setState('idle');
      audio.onerror = () => setState('error');
      audioRef.current = audio;
    }
    try { await audioRef.current.play(); } catch { setState('error'); }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={state === 'playing' ? 'Pause' : label}
      title={state === 'error' ? 'Could not play this clip' : label}
      className={`inline-grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border ${state === 'error' ? 'border-[#5a2a31] text-danger' : 'border-line text-text'} bg-panel-2 hover:border-muted`}
    >
      {state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : state === 'playing' ? <Pause size={14} /> : <Play size={14} />}
    </button>
  );
}
