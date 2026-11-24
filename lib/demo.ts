import type { MovieOption } from './search/movies';

/**
 * PHASE 0 DEMO DATA — replaced by Supabase in Phases 1–4.
 *
 * Until the database exists, the demo answer has to live in the browser
 * bundle. From Phase 2 the answer is only ever known to the server and the
 * client receives the movie name and cast after the game ends.
 */

export const DEMO_CHALLENGE = {
  number: 24,
  title: 'The mystery soundtrack',
  clipDurations: [8, 12, 15] as const,
  answerId: 'jersey',
  reveal: { title: 'Jersey', cast: ['Nani', 'Shraddha Srinath', 'Sathyaraj'] },
};

export const DEMO_CATALOG: MovieOption[] = [
  { id: 'baahubali-1', title: 'Baahubali: The Beginning', year: 2015 },
  { id: 'baahubali-2', title: 'Baahubali 2: The Conclusion', year: 2017 },
  { id: 'avpl', title: 'Ala Vaikunthapurramuloo', year: 2020, aliases: ['AVPL'] },
  { id: 'jersey', title: 'Jersey', year: 2019 },
  { id: 'rrr', title: 'RRR', year: 2022 },
  { id: 'hi-nanna', title: 'Hi Nanna', year: 2023 },
  { id: 'magadheera', title: 'Magadheera', year: 2009 },
  { id: 'arya', title: 'Arya', year: 2004 },
  { id: 'arya-2', title: 'Arya 2', year: 2009 },
  { id: 'pokiri', title: 'Pokiri', year: 2006 },
  { id: 'eega', title: 'Eega', year: 2012 },
  { id: 'geetha-govindam', title: 'Geetha Govindam', year: 2018 },
  { id: 'mahanati', title: 'Mahanati', year: 2018 },
  { id: 'rangasthalam', title: 'Rangasthalam', year: 2018 },
  { id: 'sita-ramam', title: 'Sita Ramam', year: 2022 },
  { id: 'pushpa', title: 'Pushpa: The Rise', year: 2021 },
  { id: 'nuvvostanante', title: 'Nuvvostanante Nenoddantana', year: 2005, aliases: ['NVNA'] },
  { id: 'bommarillu', title: 'Bommarillu', year: 2006 },
  { id: 'athadu', title: 'Athadu', year: 2005 },
  { id: 'khaleja', title: 'Khaleja', year: 2010 },
];

/** Placeholder player stats shown in the UI until Phase 4. */
export const DEMO_STATS = { streak: 7, rank: 128, winRate: 82, weekDone: 5 };
