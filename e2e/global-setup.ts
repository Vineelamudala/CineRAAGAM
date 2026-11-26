// Seeds challenges in the local stack, creates test admins, and exposes the
// values the tests need. Uses the secret key on the test runner only — never
// in the browser.
import { createAdmin, resetTwoFactor } from '../scripts/admin.mjs';
import { adminClient, istDate, seedDevChallenges } from '../scripts/dev-seed.mjs';

/**
 * LOCAL STACK ONLY: delete anonymous players left by earlier test runs, so the
 * leaderboards (top 50) never fill up with old test players. Never touches a
 * hosted project: it refuses unless the Supabase URL is localhost.
 */
async function removeOldLocalTestPlayers(db: ReturnType<typeof adminClient>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) return;
  const cutoff = Date.now() - 10 * 60 * 1000; // keep anything from a run in progress
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const old = data.users.filter(u => u.is_anonymous && new Date(u.created_at).getTime() < cutoff);
    if (old.length === 0) return;
    for (const u of old) await db.auth.admin.deleteUser(u.id);
  }
}

export const E2E_ADMIN ={ email: 'e2e-admin@example.com', password: 'E2e-Admin-Passw0rd-Local' };
export const E2E_MFA_ADMIN = { email: 'e2e-admin-mfa@example.com', password: 'E2e-Mfa-Passw0rd-Local' };

export default async function globalSetup() {
  const db = adminClient();
  await removeOldLocalTestPlayers(db);
  await seedDevChallenges(db);
  const { data, error } = await db
    .from('daily_challenges')
    .select('movies(title, release_year)')
    .eq('challenge_date', istDate(0))
    .single();
  if (error) throw error;
  const movie = (data as unknown as { movies: { title: string; release_year: number | null } }).movies;
  process.env.E2E_ANSWER_TITLE = movie.title;
  process.env.E2E_ANSWER_YEAR = String(movie.release_year ?? '');

  // Alias used by the autocomplete test (real catalogues get aliases from admins).
  // (Wikidata spells it "Ala Vaikunthapurramloo"; the local seed "…ramuloo".)
  const { data: avpl } = await db.from('movies').select('id, aliases').ilike('title', 'Ala Vaikunthapurram%').limit(1).maybeSingle();
  if (avpl && !avpl.aliases.includes('AVPL')) {
    await db.from('movies').update({ aliases: [...avpl.aliases, 'AVPL'] }).eq('id', avpl.id);
  }

  // Local-only test admins with fixed passwords; the 2FA admin starts without 2FA.
  await createAdmin(db, E2E_ADMIN.email, E2E_ADMIN.password);
  await createAdmin(db, E2E_MFA_ADMIN.email, E2E_MFA_ADMIN.password);
  await resetTwoFactor(db, E2E_MFA_ADMIN.email);
}
