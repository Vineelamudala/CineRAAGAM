// Seeds challenges in the local stack and exposes today's answer to the tests.
// Uses the secret key on the test runner only — never in the browser.
import { adminClient, istDate, seedDevChallenges } from '../scripts/dev-seed.mjs';

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
}
