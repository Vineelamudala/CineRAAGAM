// Backs up or restores the audio files in the private "clips" bucket through
// the Storage API (works with hosted Supabase and the self-hosted stack).
//
//   node scripts/storage-backup.mjs backup <dir>    download every clip into <dir>
//   node scripts/storage-backup.mjs restore <dir>   upload clips from <dir> that are missing
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (env or .env.local).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'clips';
const TYPES = { webm: 'audio/webm', ogg: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg' };

export function storageClient() {
  try { process.loadEnvFile('.env.local'); } catch { /* use existing env */ }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** All object names in the bucket (clips are stored at the bucket root). */
export async function listClips(db) {
  const names = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    names.push(...data.filter(o => o.id).map(o => o.name)); // folders have no id
    if (data.length < 1000) return names;
  }
}

export async function backup(db, dir) {
  mkdirSync(dir, { recursive: true });
  const names = await listClips(db);
  for (const name of names) {
    const { data, error } = await db.storage.from(BUCKET).download(name);
    if (error) throw new Error(`download ${name}: ${error.message}`);
    writeFileSync(join(dir, name), Buffer.from(await data.arrayBuffer()));
  }
  return names.length;
}

export async function restore(db, dir) {
  const existing = new Set(await listClips(db));
  let uploaded = 0;
  for (const name of readdirSync(dir)) {
    if (existing.has(name)) continue;
    const ext = name.slice(name.lastIndexOf('.') + 1);
    const { error } = await db.storage.from(BUCKET).upload(name, readFileSync(join(dir, name)), {
      contentType: TYPES[ext] ?? 'application/octet-stream', upsert: false,
    });
    if (error) throw new Error(`upload ${name}: ${error.message}`);
    uploaded++;
  }
  return uploaded;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, dir] = process.argv.slice(2);
  if (!['backup', 'restore'].includes(command) || !dir) {
    console.error('Usage: node scripts/storage-backup.mjs backup|restore <dir>');
    process.exit(1);
  }
  const db = storageClient();
  const n = command === 'backup' ? await backup(db, dir) : await restore(db, dir);
  console.log(command === 'backup' ? `Backed up ${n} clip(s) to ${dir}` : `Restored ${n} missing clip(s) from ${dir}`);
}
