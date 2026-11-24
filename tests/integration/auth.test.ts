import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * End-to-end checks of authentication and data access against the real
 * local Supabase stack (auth server + PostgREST + Postgres RLS).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const newClient = () => createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = () => createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const unique = () => Math.random().toString(36).slice(2, 8);

describe('environment', () => {
  it('has local Supabase settings (run `npm run env:local`)', () => {
    expect(url).toBeTruthy();
    expect(publishable).toBeTruthy();
    expect(secret).toBeTruthy();
  });
});

describe('anonymous players', () => {
  let player: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    player = newClient();
    const { data, error } = await player.auth.signInAnonymously();
    expect(error).toBeNull();
    userId = data.user!.id;
  });

  it('get an anonymous identity with no e-mail or phone', async () => {
    const { data } = await player.auth.getUser();
    expect(data.user?.is_anonymous).toBe(true);
    expect(data.user?.email ?? '').toBe('');
    expect(data.user?.phone ?? '').toBe('');
  });

  it('get a profile automatically, without a name yet', async () => {
    const { data, error } = await player.from('profiles').select('id, display_name').single();
    expect(error).toBeNull();
    expect(data).toEqual({ id: userId, display_name: null });
  });

  it('can set, normalise and read back a display name', async () => {
    const name = `Ravi ${unique()}`;
    const { data, error } = await player.rpc('set_display_name', { p_name: `  ${name.replace(' ', '   ')} ` });
    expect(error).toBeNull();
    expect(data).toBe(name);
    const { data: row } = await player.from('profiles').select('display_name').single();
    expect(row?.display_name).toBe(name);
  });

  it('cannot take a name already used by someone else (any case)', async () => {
    const name = `Taken${unique()}`;
    const other = newClient();
    await other.auth.signInAnonymously();
    expect((await other.rpc('set_display_name', { p_name: name })).error).toBeNull();
    const { error } = await player.rpc('set_display_name', { p_name: name.toUpperCase() });
    expect(error?.code).toBe('23505');
    expect(error?.message).toBe('display_name_taken');
  });

  it('get a clear error for an invalid name', async () => {
    const { error } = await player.rpc('set_display_name', { p_name: '<b>hi</b>' });
    expect(error?.code).toBe('22023');
  });

  it('cannot change their own profile row directly', async () => {
    const { error } = await player.from('profiles').update({ display_name: 'Direct' }).eq('id', userId);
    expect(error?.code).toBe('42501');
  });

  it('cannot read answers, clips or cast', async () => {
    for (const table of ['daily_challenges', 'clips', 'movie_cast']) {
      const { data, error } = await player.from(table).select('*');
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it('cannot write game state directly', async () => {
    const { error } = await player.from('plays').insert({ user_id: userId });
    expect(error?.code).toBe('42501');
  });

  it('cannot make themselves an admin', async () => {
    const { error } = await player.auth.updateUser({ data: { role: 'admin' } });
    expect(error).toBeNull(); // user_metadata is user-editable...
    const { error: insertError } = await player.from('movies').insert({ title: `Spam ${unique()}` });
    expect(insertError?.code).toBe('42501'); // ...but admin rights come only from app_metadata
  });

  it('can read the movie catalogue for autocomplete', async () => {
    const { data, error } = await player.from('movies').select('id, title, release_year, aliases').limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});

describe('sign-ups other than anonymous are blocked', () => {
  it('rejects e-mail + password self sign-up', async () => {
    const { data, error } = await newClient().auth.signUp({ email: `x${unique()}@example.com`, password: 'Abcdefgh12345' });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});

describe('admins (created by the operator with the secret key)', () => {
  const email = `admin-${unique()}@example.com`;
  const password = `Adm1n-${unique()}-Pass`;
  let adminId: string | undefined;

  afterAll(async () => {
    if (adminId) await admin().auth.admin.deleteUser(adminId);
  });

  it('can be created by the operator with role=admin in app_metadata', async () => {
    const { data, error } = await admin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'admin' },
    });
    expect(error).toBeNull();
    adminId = data.user?.id;
  });

  it('can sign in and manage content', async () => {
    const client = newClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    expect(error).toBeNull();
    const title = `Admin Movie ${unique()}`;
    const { data, error: insertError } = await client.from('movies').insert({ title }).select('id').single();
    expect(insertError).toBeNull();
    const { error: deleteError } = await client.from('movies').delete().eq('id', data!.id);
    expect(deleteError).toBeNull();
  });
});

describe('signed-out visitors', () => {
  it('cannot call set_display_name', async () => {
    const { error } = await newClient().rpc('set_display_name', { p_name: 'Nobody' });
    expect(error).not.toBeNull();
  });
});
