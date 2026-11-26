'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, Square, Upload } from 'lucide-react';
import { Button, Field, Input, Notice, Select, friendlyError } from './ui';
import { useAdminDb } from '@/lib/admin/AdminProvider';
import { ACCEPT_FILES, CLIP_MAX_SEC, CLIP_MIN_SEC, FADE_SEC, canCutClip, clampSelection, formatSeconds, waveformPeaks } from '@/lib/admin/clipEncoding';
import { encodeMp3, MP3_SAMPLE_RATE } from '@/lib/admin/mp3';

type Phase = 'idle' | 'decoding' | 'ready' | 'encoding' | 'uploading' | 'error';

/**
 * Upload a clip for a movie: pick any audio file, choose a 5–20 s section,
 * preview it, then the browser renders just that section into a brand-new
 * MP3 file (with a short fade). Re-encoding drops all original tags
 * (title, album, artist…) so the file can never reveal the movie, and it is
 * stored under a random UUID name.
 */
export function ClipUploader({ movieId, onUploaded }: { movieId: string; onUploaded: () => void }) {
  const db = useAdminDb();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(10);
  const [kind, setKind] = useState<'bgm' | 'song_interlude'>('bgm');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);

  const total = buffer?.duration ?? 0;

  // Draw the waveform with the selected section highlighted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const w = canvas.width, h = canvas.height;
    const peaks = waveformPeaks(buffer.getChannelData(0), w / 3);
    g.clearRect(0, 0, w, h);
    const selA = (start / total) * w, selB = ((start + length) / total) * w;
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(selA, 0, selB - selA, h);
    peaks.forEach((p, i) => {
      const x = i * 3;
      g.fillStyle = x >= selA && x <= selB ? '#e6e8ec' : '#4a4d55';
      const bar = Math.max(1, p * h * 0.9);
      g.fillRect(x, (h - bar) / 2, 2, bar);
    });
  }, [buffer, start, length, total]);

  useEffect(() => () => { previewRef.current?.ctx.close(); }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhase('decoding');
    setFileName(file.name);
    try {
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      await ctx.close();
      if (!canCutClip(decoded.duration)) throw new Error(`This file is only ${decoded.duration.toFixed(1)} s long — clips must be at least ${CLIP_MIN_SEC} s.`);
      setBuffer(decoded);
      const sel = clampSelection(0, 10, decoded.duration);
      setStart(sel.start);
      setLength(sel.length);
      setPhase('ready');
    } catch (err) {
      setBuffer(null);
      setPhase('error');
      setError(err instanceof Error && err.message.includes('clips must') ? err.message : 'Could not read the sound in this file. Try an MP3, M4A, WAV or MP4 file.');
    }
  }

  function updateSelection(nextStart: number, nextLength: number) {
    const sel = clampSelection(nextStart, nextLength, total);
    setStart(sel.start);
    setLength(sel.length);
  }

  function stopPreview() {
    previewRef.current?.src.stop();
    previewRef.current?.ctx.close();
    previewRef.current = null;
    setPreviewing(false);
  }

  function preview() {
    if (!buffer) return;
    if (previewing) { stopPreview(); return; }
    const ctx = new AudioContext();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = () => stopPreview();
    src.start(0, start, length);
    previewRef.current = { ctx, src };
    setPreviewing(true);
  }

  async function encodeAndUpload() {
    if (!buffer) return;
    if (typeof OfflineAudioContext === 'undefined') { setError('This browser cannot process audio. Please use a recent Chrome, Edge, Firefox or Safari.'); return; }
    stopPreview();
    setError(null);
    setPhase('encoding');
    setProgress(0);

    let blob: Blob;
    try {
      // Render just the selection (with short fades) faster than real time, as
      // 44.1 kHz stereo, then encode a brand-new MP3: no original tags survive,
      // and MP3 plays on every phone with an exact length.
      const offline = new OfflineAudioContext(2, Math.ceil(length * MP3_SAMPLE_RATE), MP3_SAMPLE_RATE);
      const src = offline.createBufferSource();
      src.buffer = buffer;
      const gain = offline.createGain();
      src.connect(gain).connect(offline.destination);
      gain.gain.setValueAtTime(0, 0);
      gain.gain.linearRampToValueAtTime(1, FADE_SEC);
      gain.gain.setValueAtTime(1, length - FADE_SEC);
      gain.gain.linearRampToValueAtTime(0, length);
      src.start(0, start, length);
      const rendered = await offline.startRendering();
      setProgress(0.6);
      const bytes = encodeMp3([rendered.getChannelData(0), rendered.getChannelData(1)]);
      blob = new Blob([bytes as BlobPart], { type: 'audio/mpeg' });
      setProgress(1);
    } catch {
      setPhase('ready');
      setError('Could not convert this clip. Try another file or browser.');
      return;
    }

    setPhase('uploading');
    const storagePath = `${crypto.randomUUID()}.mp3`;
    const up = await db.storage.from('clips').upload(storagePath, blob, { contentType: 'audio/mpeg', upsert: false });
    if (up.error) { setPhase('ready'); setError(`Upload failed: ${up.error.message}`); return; }
    const { error: rowError } = await db.from('clips').insert({
      movie_id: movieId,
      storage_path: storagePath,
      kind,
      duration_ms: Math.round(length * 1000),
      notes: notes.trim() || null,
    });
    if (rowError) {
      await db.storage.from('clips').remove([storagePath]); // don't leave an orphan file
      setPhase('ready');
      setError(friendlyError(rowError));
      return;
    }
    setPhase('idle');
    setBuffer(null);
    setNotes('');
    setFileName('');
    onUploaded();
  }

  const busy = phase === 'encoding' || phase === 'uploading';

  return (
    <div className="grid gap-4 rounded-xl border border-dashed border-line p-4">
      <Field label="Audio or video file" hint="MP3, M4A, WAV, OGG, or a video (MP4, MOV…): only its sound is used. Only the section you choose is kept, re-encoded without any metadata.">
        {/* Explicit extensions too: iPhones grey out files that match only a wildcard like audio/*. */}
        <Input type="file" accept={ACCEPT_FILES} disabled={busy} onChange={e => onFile(e.target.files?.[0])} aria-label="Audio file" className="h-auto py-2" />
      </Field>

      {phase === 'decoding' && <p className="m-0 flex items-center gap-2 text-[12px] text-muted"><Loader2 size={14} className="animate-spin" /> Reading {fileName}…</p>}
      {error && <Notice tone="bad">{error}</Notice>}

      {buffer && (
        <>
          <canvas ref={canvasRef} width={900} height={80} className="h-20 w-full rounded-lg bg-panel-2" aria-label="Waveform with the selected section highlighted" />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={`Start: ${formatSeconds(start)} of ${formatSeconds(total)}`} htmlFor="clip-start">
              <input id="clip-start" type="range" min={0} max={Math.max(0, total - length)} step={0.1} value={start} disabled={busy}
                onChange={e => updateSelection(Number(e.target.value), length)} className="w-full" />
            </Field>
            <Field label={`Length: ${length.toFixed(1)} s (${CLIP_MIN_SEC}–${CLIP_MAX_SEC} s)`} htmlFor="clip-length">
              <input id="clip-length" type="range" min={CLIP_MIN_SEC} max={Math.min(CLIP_MAX_SEC, total)} step={0.1} value={length} disabled={busy}
                onChange={e => updateSelection(start, Number(e.target.value))} className="w-full" />
            </Field>
            <Field label="Type" htmlFor="clip-kind">
              <Select id="clip-kind" value={kind} onChange={e => setKind(e.target.value as typeof kind)} disabled={busy}>
                <option value="bgm">BGM</option>
                <option value="song_interlude">Song interlude</option>
              </Select>
            </Field>
            <Field label="Private note (optional)" htmlFor="clip-notes" hint="Only admins see this.">
              <Input id="clip-notes" value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} disabled={busy} placeholder="e.g. interlude before 2nd chorus" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={preview} disabled={busy}>{previewing ? <><Square size={13} /> Stop</> : <><Play size={13} /> Preview selection</>}</Button>
            <Button variant="primary" onClick={encodeAndUpload} disabled={busy}>
              {phase === 'encoding' ? <><Loader2 size={13} className="animate-spin" /> Encoding {Math.round(progress * 100)}%</>
                : phase === 'uploading' ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
                : <><Upload size={13} /> Save clip</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
