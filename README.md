# Cineraagam

A daily Telugu cinema music guessing game. Each day there is one movie and three
audio clues (BGMs or song interludes), going from hard to easy. Name the movie in
as few clues as you can.

Free and open-source stack, self-hostable, no player logins.

## Game rules

| Clue | Difficulty | Points if solved |
|------|------------|------------------|
| 1    | Hard       | 3                |
| 2    | Medium     | 2                |
| 3    | Easy       | 1                |
| —    | Not solved | 0                |

- One guess per clue. A guess must be picked from the autocomplete list.
- A wrong guess or a skip unlocks the next clue. Replaying audio is free.
- A correct guess ends the game. After three misses the movie and main cast are revealed.
- **Streak** = consecutive days (IST) on which you solved the daily movie.
- A new challenge starts at **00:00 IST**.
- **Leaderboards:** weekly (resets Monday 00:00 IST), monthly and all-time, by points.
  Ties go to more days solved, then to whoever reached the total first.
- **Time Travel:** play past days for fun. It shows "would-have" points in your
  history but never counts toward leaderboards or streaks.
- **No login:** players get a silent anonymous identity and only choose a display
  name. Clearing browser data or switching device starts a fresh identity.

## Run locally

Requires **Node.js 24** and **Docker** (for the local Supabase stack).

```bash
npm install
npm run db:start       # local Supabase in Docker (first run downloads images)
npm run env:local      # writes .env.local from the running stack
npm run dev            # http://localhost:3000
```

Supabase Studio (database UI) runs at http://127.0.0.1:54323. Stop the stack with
`npm run db:stop`. `npm run db:reset` re-applies all migrations and `supabase/seed.sql`.

Without `.env.local` the site still renders, but player profiles are disabled.

### Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (Vitest): rules, points, IST time, search, share text, names |
| `npm run test:db` | Database tests (pgTAP): RLS, grants, constraints, points rule, names |
| `npm run test:integration` | Auth + API tests against the local stack (Vitest + supabase-js) |
| `npm run test:e2e` | End-to-end tests (Playwright, desktop + mobile); run `npm run build` first |
| `npm run check` | lint + typecheck + unit tests |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase stack |
| `npm run env:local` | Generate `.env.local` from `supabase status` |

First-time e2e setup: `npx playwright install chromium`. Integration and e2e tests
need the local stack running and `.env.local` generated.

## Security model

- **Players are anonymous Supabase users.** The browser creates the session on the
  first visit, so bots don't create accounts and rate limits apply per visitor. The
  proxy (`proxy.ts`) refreshes it and sets the auth cookies from the server.
- **No player sign-up of any other kind.** An auth hook
  (`private.before_user_created`) rejects every non-anonymous sign-up. Admins are
  created by the operator with the secret key and `app_metadata.role = 'admin'`,
  which users cannot edit.
- **Row Level Security on every table.** Nothing is granted by default
  (`auto_expose_new_tables = false`). Players can read the movie catalogue and
  their own profile and plays. Answers (`daily_challenges`), clips and cast are
  admin-only.
- **Players never write game tables directly.** Points are enforced by a database
  CHECK constraint (3/2/1/0), and there is one play per player per challenge and
  one guess per clue.
- **Audio** lives in a private bucket under opaque UUID file names.
- **Secrets:** only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key reach the
  browser. `SUPABASE_SECRET_KEY` is server/test-only and never `NEXT_PUBLIC_`.
- A Content-Security-Policy restricts the page to our origin and the Supabase origin.

Schema and policies live in `supabase/migrations/`, and their tests in `supabase/tests/`.

## Project layout

```
app/                 Next.js App Router pages (/, /time-travel, /leaderboard,
                     /stats, /history, /how-to-play), layout, fonts, styles
app/styles/legacy.css  Original prototype CSS, migrated to Tailwind gradually
components/          UI components (shell/, game/, ...)
lib/                 Framework-free logic with unit tests
  game/              Rules, points and the game state machine
  time/ist.ts        IST date and countdown helpers
  search/movies.ts   Autocomplete matching
  share.ts           Spoiler-free share text
  player/            Display-name validation
  demo.ts            Phase 0 demo data (replaced by Supabase)
e2e/                 Playwright tests
```

### Styling

Tailwind CSS v4 is imported **without Preflight** so the original prototype CSS
(`app/styles/legacy.css`) renders unchanged. Design tokens such as `bg-panel`,
`text-accent`, `text-cyan` and `font-display` are defined in `app/globals.css`.
New components use Tailwind. Legacy rules are unlayered, so they override
utilities on the same element. Retire them as each component is rebuilt.

## Status and roadmap

- [x] **Phase 0 — Foundation:** Next.js 16 / React 19 security upgrade, Tailwind v4,
  ESLint, Vitest, Playwright, real routes, 3/2/1/0 points, accessible autocomplete
  and dialogs, self-hosted fonts, live IST countdown.
- [x] **Phase 1 — Supabase:** local stack, schema migrations, RLS, pgTAP tests,
  silent anonymous auth, display name stored server-side.
- [ ] **Phase 2 — Daily game:** server-validated guesses (Postgres functions),
  private audio with signed URLs, real player, Wikidata movie catalogue.
- [ ] **Phase 3 — Admin:** movies, cast, clip upload (5–20 s, metadata stripped), scheduling.
- [ ] **Phase 4 — Progress:** streaks, statistics, history, leaderboards, sharing.
- [ ] **Phase 5 — Time Travel.**
- [ ] **Phase 6 — Polish:** PWA install, accessibility and responsive pass, audio visualiser.
- [ ] **Phase 7 — Production:** Docker Compose (app + self-hosted Supabase + Caddy), backups.

> **Demo data:** until Phase 2, the Today page uses a demo challenge with the answer
> in the browser bundle. From Phase 2 answers and unrevealed clues stay on the server.
