// Seeds challenges in the local stack, creates test admins, and exposes the
// values the tests need. Uses the secret key on the test runner only — never
// in the browser.
import { createAdmin, resetTwoFactor } from '../scripts/admin.mjs';
import { adminClient, istDate, seedDevChallenges } from '../scripts/dev-seed.mjs';

export const E2E_ADMIN = { email: 'e2e-admin@example.com', password: 'E2e-Admin-Passw0rd-Local' };
export const E2E_MFA_ADMIN = { email: 'e2e-admin-mfa@example.com', password: 'E2e-Mfa-Passw0rd-Local' };

export default async function globalSetup() {
  const db = adminClient();
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

  // Local-only test admins with fixed passwords; the 2FA admin starts without 2FA.
  await createAdmin(db, E2E_ADMIN.email, E2E_ADMIN.password);
  await createAdmin(db, E2E_MFA_ADMIN.email, E2E_MFA_ADMIN.password);
  await resetTwoFactor(db, E2E_MFA_ADMIN.email);
}
