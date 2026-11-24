import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, resetTwoFactor, serviceClient } from '../../scripts/admin.mjs';
import { totp } from '../helpers/totp';

/** Admin accounts, 2-step verification and storage writes against the real local stack. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const newClient = () => createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = randomUUID().slice(0, 8);
const service = serviceClient();

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe('admin accounts (scripts/admin.mjs)', () => {
  const email = `it-admin-${tag}@example.com`;
  let id: string;
  let password: string;

  beforeAll(async () => {
    ({ id, password } = await createAdmin(service, email));
  });
  afterAll(async () => { await service.auth.admin.deleteUser(id); });

  it('creates an admin with a strong generated password', () => {
    expect(password).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{24}$/);
  });

  it('the admin can manage content and upload clips', async () => {
    const admin = await signIn(email, password);
    const { data: movie, error } = await admin.from('movies').insert({ title: `IT Movie ${tag}` }).select('id').single();
    expect(error).toBeNull();
    const path = `${randomUUID()}.webm`;
    const up = await admin.storage.from('clips').upload(path, readFileSync('e2e/fixtures/clue-1.webm'), { contentType: 'audio/webm' });
    expect(up.error).toBeNull();
    const { error: clipError } = await admin.from('clips').insert({ movie_id: movie!.id, storage_path: path, kind: 'bgm', duration_ms: 6000 });
    expect(clipError).toBeNull();
    const signed = await admin.storage.from('clips').createSignedUrl(path, 60);
    expect(signed.error).toBeNull(); // admins can preview any clip

    // cleanup
    await admin.from('clips').delete().eq('storage_path', path);
    await admin.storage.from('clips').remove([path]);
    await admin.from('movies').delete().eq('id', movie!.id);
  });

  it('a password reset invalidates the old password', async () => {
    const { password: next } = await createAdmin(service, email);
    await expect(signIn(email, password)).rejects.toThrow();
    await expect(signIn(email, next)).resolves.toBeTruthy();
    password = next;
  });
});

describe('2-step verification is enforced by the database', () => {
  const email = `it-mfa-${tag}@example.com`;
  let id: string;
  let password: string;
  let secret: string;

  beforeAll(async () => {
    ({ id, password } = await createAdmin(service, email));
    const admin = await signIn(email, password);
    const { data, error } = await admin.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'it' });
    if (error) throw error;
    secret = data.totp.secret;
    const verify = await admin.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(secret) });
    if (verify.error) throw verify.error;
  });
  afterAll(async () => { await service.auth.admin.deleteUser(id); });

  it('a password-only session cannot use admin powers', async () => {
    const admin = await signIn(email, password);
    const { data: aal } = await admin.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal).toMatchObject({ currentLevel: 'aal1', nextLevel: 'aal2' });
    const { error } = await admin.from('movies').insert({ title: `Blocked ${tag}` });
    expect(error?.code).toBe('42501');
    const { data: challenges } = await admin.from('daily_challenges').select('id').limit(1);
    expect(challenges).toEqual([]);
  });

  it('after entering the authenticator code the admin has full access', async () => {
    const admin = await signIn(email, password);
    const { data: factors } = await admin.auth.mfa.listFactors();
    const { error } = await admin.auth.mfa.challengeAndVerify({ factorId: factors!.totp[0].id, code: totp(secret) });
    expect(error).toBeNull();
    const { data: movie, error: insertError } = await admin.from('movies').insert({ title: `Allowed ${tag}` }).select('id').single();
    expect(insertError).toBeNull();
    await admin.from('movies').delete().eq('id', movie!.id);
  });

  it('the operator can reset 2-step verification for a lost phone', async () => {
    expect(await resetTwoFactor(service, email)).toBe(1);
    const admin = await signIn(email, password);
    const { data: aal } = await admin.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal?.nextLevel).toBe('aal1');
  });
});

describe('players cannot touch admin content', () => {
  let player: SupabaseClient;
  beforeAll(async () => {
    player = newClient();
    await player.auth.signInAnonymously();
  });

  it('cannot upload or overwrite audio files', async () => {
    const up = await player.storage.from('clips').upload(`${randomUUID()}.webm`, Buffer.from('fake'), { contentType: 'audio/webm' });
    expect(up.error).not.toBeNull();
  });

  it('can only see audio files they are already allowed to play (clue 1 of live days)', async () => {
    // Listing uses the same rule as reading: a fresh player may see the Hard
    // (clue 1) clips of published days up to today — never locked clues,
    // drafts or future days.
    const { data: listed } = await player.storage.from('clips').list('', { limit: 1000 });
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const { data: live } = await service.from('daily_challenges')
      .select('hard:clips!daily_challenges_hard_clip_id_movie_id_fkey(storage_path)')
      .eq('status', 'published').lte('challenge_date', today);
    const allowed = new Set((live ?? []).map(r => (r as unknown as { hard: { storage_path: string } }).hard.storage_path));
    for (const f of listed ?? []) expect(allowed.has(f.name), f.name).toBe(true);
  });

  it('cannot hide other players', async () => {
    const { data } = await player.from('profiles').update({ is_hidden: true }).neq('id', '00000000-0000-0000-0000-000000000000').select('id');
    expect(data ?? []).toEqual([]);
  });
});
