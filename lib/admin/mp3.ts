import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * MP3 encoding for clue clips. MP3 plays on every phone and browser (WebM/Opus
 * does not play on older iPhones, and Chrome's recorded WebM has no duration,
 * which makes some phones stop early). Constant bitrate keeps files small and
 * their length exact.
 */
export const MP3_SAMPLE_RATE = 44_100;
/** 96 kbps: clear for music clips; ~120 KB for a 10 s clip. */
export const MP3_KBPS = 96;

/** Float samples (-1..1) to 16-bit PCM. */
export function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Encodes one (mono) or two (stereo) channels of float samples to MP3 bytes. */
export function encodeMp3(channels: Float32Array[], sampleRate = MP3_SAMPLE_RATE, kbps = MP3_KBPS): Uint8Array {
  if (channels.length < 1 || channels.length > 2) throw new Error('MP3 needs 1 or 2 channels');
  const [left, right] = channels.map(toInt16);
  const encoder = new Mp3Encoder(channels.length, sampleRate, kbps);
  const parts: Uint8Array[] = [];
  const block = 1152; // samples per MP3 frame
  for (let i = 0; i < left.length; i += block) {
    const chunk = right
      ? encoder.encodeBuffer(left.subarray(i, i + block), right.subarray(i, i + block))
      : encoder.encodeBuffer(left.subarray(i, i + block));
    if (chunk.length) parts.push(chunk);
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(tail);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
