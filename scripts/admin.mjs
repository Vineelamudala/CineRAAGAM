// Operator tool for admin accounts. Players never have accounts; admins are the
// only users with an e-mail + password, and only this tool (holding the secret
// key) can create them.
//
//   node scripts/admin.mjs create <email>      create an admin, prints a strong password once
//   node scripts/admin.mjs reset <email>       set a new random password (prints it once)
//   node scripts/admin.mjs reset-2fa <email>   remove 2-step verification (lost phone)
//   node scripts/admin.mjs list                list admin accounts
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment or
// .env.local. For production, run it on the server with the production values.
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export function generatePassword() {
  // 24 chars from an unambiguous alphabet, guaranteed to contain lower, upper and digit.
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    const bytes = randomBytes(24);
    const pw = [...bytes].map(b => alphabet[b % alphabet.length]).join('');
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) return pw;
  }
}

export function serviceClient() {
  try { process.loadEnvFile('.env.local'); } catch { /* use existing env */ }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function findUserByEmail(db, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}

/** Creates (or promotes) an admin. Returns the generated password. */
export async function createAdmin(db, email, password = generatePassword()) {
  const existing = await findUserByEmail(db, email);
  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, { password, app_metadata: { role: 'admin' }, email_confirm: true });
    if (error) throw error;
    return { id: existing.id, password, created: false };
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'admin' } });
  if (error) throw error;
  return { id: data.user.id, password, created: true };
}

export async function resetTwoFactor(db, email) {
  const user = await findUserByEmail(db, email);
  if (!user) throw new Error(`No user with e-mail ${email}`);
  const { data, error } = await db.auth.admin.mfa.listFactors({ userId: user.id });
  if (error) throw error;
  for (const f of data.factors) {
    const res = await db.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
    if (res.error) throw res.error;
  }
  return data.factors.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, email] = process.argv.slice(2);
  const usage = 'Usage: node scripts/admin.mjs create|reset|reset-2fa <email>  |  node scripts/admin.mjs list';
  const db = serviceClient();
  try {
    if (command === 'list') {
      const admins = [];
      for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        admins.push(...data.users.filter(u => u.app_metadata?.role === 'admin'));
        if (data.users.length < 200) break;
      }
      for (const a of admins) console.log(`${a.email}  (created ${a.created_at?.slice(0, 10)})`);
      if (!admins.length) console.log('No admins yet.');
    } else if ((command === 'create' || command === 'reset') && email) {
      if (command === 'reset' && !(await findUserByEmail(db, email))) throw new Error(`No user with e-mail ${email}`);
      const { password, created } = await createAdmin(db, email);
      console.log(`${created ? 'Created admin' : 'Updated admin'} ${email}`);
      console.log(`Password (shown once — store it in a password manager): ${password}`);
    } else if (command === 'reset-2fa' && email) {
      const n = await resetTwoFactor(db, email);
      console.log(`Removed ${n} 2-step verification factor(s) for ${email}. They can set it up again after signing in.`);
    } else {
      console.log(usage);
      process.exit(1);
    }
  } catch (err) {
    console.error(err.message ?? err);
    process.exit(1);
  }
}
