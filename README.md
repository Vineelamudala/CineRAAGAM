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
- **Streak** = consecutive challenge days (IST) on which you solved the daily movie.
  A day with no published challenge never breaks a streak, and today doesn't
  break it until you lose (or midnight passes unsolved).
- A new challenge starts at **00:00 IST**. A daily game must be finished that day:
  after midnight an unfinished game turns into a Time Travel game (0 leaderboard
  points, streak not extended), which you can still finish for fun (no points).
- **Leaderboards:** weekly (resets Monday 00:00 IST), monthly and all-time, by points.
  Ties go to more days solved, then to whoever reached the total first. Only named,
  non-hidden players appear; admins are left out.
- **Time Travel:** replay past days just for fun. Time Travel gives **no points**
  and never counts toward leaderboards or streaks.
- **No login:** players get a silent anonymous identity and only choose a display
  name. Clearing browser data or switching device starts a fresh identity.

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for running Cineraagam on your own server, with HTTPS,
self-hosted Supabase and daily backups. It takes about 30 minutes.

## Run locally

Requires **Node.js 24** and **Docker** (for the local Supabase stack).

```bash
npm install
npm run db:start       # local Supabase in Docker (first run downloads images)
npm run env:local      # writes .env.local from the running stack
npm run catalog:import # optional: ~5,500 Telugu films from Wikidata (CC0)
npm run db:seed:dev    # optional: sample challenges with synthetic audio
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
| `npm run catalog:import` | Import/refresh the Telugu film catalogue from Wikidata (`-- --dry-run` to preview). Never overwrites edited titles. |
| `npm run db:seed:dev` | **Local only:** publish sample challenges (today, 3 past days, 1 future) using synthetic audio |
| `npm run audio:fixtures` | Regenerate the synthetic test clips in `e2e/fixtures/` |
| `node scripts/generate-icons.mjs` | Re-render the app icons from `public/icons/icon.svg` |
| `node scripts/admin.mjs …` | Create/reset admin accounts and 2-step verification (see "Running the show") |

First-time e2e setup: `npx playwright install chromium`. Integration and e2e tests
need the local stack running and `.env.local` generated.

## Running the show (admin)

The admin dashboard lives at **`/admin`**. Players never see it, and it never
creates player sessions.

1. **Create an admin account.** Run this on the machine that holds the secret key:
   ```bash
   node scripts/admin.mjs create you@example.com   # prints a strong password once
   node scripts/admin.mjs reset you@example.com    # new password (if forgotten)
   node scripts/admin.mjs reset-2fa you@example.com  # lost phone: remove 2-step verification
   node scripts/admin.mjs list
   ```
   There is no public sign-up, so admins can only be created this way.
2. **Sign in** at `/admin/login`, then open **Security** and turn on 2-step
   verification with any authenticator app. After that, a password alone is not
   enough: the database refuses admin actions until the code is entered.
   Use a separate browser profile for admin work. Signing in as admin replaces
   that browser's anonymous player identity.
3. **Movies & clips:** find the movie (the Wikidata catalogue is already loaded)
   and add the main cast in billing order. Then upload clips: pick any audio file,
   choose a 5–20 s section and preview it. The browser re-encodes just that section
   into a new WebM/Opus file, so no title/artist/album tags survive, and stores it
   under a random name.
4. **Schedule:** pick a date, the movie, and a Hard, Medium and Easy clip, then
   publish. The Overview shows the next 14 days and flags gaps.
   Once anyone has played a challenge, its date, movie and clips are locked; only
   its published status can change. The database enforces this too.
5. **Players:** hide offensive or impersonating display names. Their games are kept.

## Security model

- **Players are anonymous Supabase users.** The browser creates the session on the
  first visit, so bots don't create accounts and rate limits apply per visitor. The
  proxy (`proxy.ts`) refreshes it and sets the auth cookies from the server.
- **No player sign-up of any other kind.** An auth hook
  (`private.before_user_created`) rejects every non-anonymous sign-up. Admins are
  created by the operator with the secret key and `app_metadata.role = 'admin'`,
  which users cannot edit.
- **Admin 2-step verification is enforced in the database.** `private.is_admin()`
  requires an `aal2` session whenever the admin has a verified authenticator, so a
  stolen password alone cannot change anything. Anonymous users are never admins.
- **Row Level Security on every table.** Nothing is granted by default
  (`auto_expose_new_tables = false`). Players can read the movie catalogue and
  their own profile and plays. Answers (`daily_challenges`), clips and cast are
  admin-only.
- **Players never write game tables directly.** Guesses go through
  `public.submit_guess()`, which checks them server-side, locks the play row and
  ignores duplicate or stale submissions. Points are also enforced by a database
  CHECK constraint (3/2/1/0). There is one play per player per challenge and one
  guess per clue.
- **The answer never reaches the browser** until the game is over:
  `public.get_challenge()` returns no movie, cast or locked clue until then.
  Future and draft challenges are invisible.
- **Audio** lives in a private bucket under opaque UUID file names. Storage RLS
  (`private.can_read_clip`) lets a player sign a short-lived URL only for clues
  they have unlocked, so the web app never needs the secret key to serve audio.
- **Secrets:** only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key reach the
  browser. `SUPABASE_SECRET_KEY` is server/test-only and never `NEXT_PUBLIC_`.
- A Content-Security-Policy restricts the page to our origin and the Supabase origin.

Schema and policies live in `supabase/migrations/`, and their tests in `supabase/tests/`.

## Project layout

```
app/(game)/          Player pages (/, /time-travel[/date], /leaderboard, /stats,
                     /history, /how-to-play) with the anonymous-player shell
app/admin/           Admin dashboard (separate login; Phase 3)
app/styles/          legacy.css (prototype) + cinema.css (theme)
components/          UI components (shell/, game/, admin/, ...)
lib/                 Logic with unit tests
  game/              Rules/points and the typed game API client
  catalog/           Wikidata catalogue parsing
  time/ist.ts        IST date and countdown helpers
  search/movies.ts   Autocomplete matching
  share.ts           Spoiler-free share text
  player/            Display-name validation + anonymous player provider
  supabase/          Browser/server Supabase clients
scripts/             env, Wikidata import, dev seed, admin tools, test audio
supabase/            config, migrations, seed, pgTAP tests
tests/integration/   API/auth/storage tests against the local stack
e2e/                 Playwright tests + synthetic audio fixtures
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
- [x] **Phase 2 — Daily game:** server-validated guesses (Postgres functions),
  private audio with signed URLs, real player (replay, re-listen, buffering and
  error states), progress across refreshes, midnight-IST rule, basic Time Travel,
  Wikidata movie catalogue.
- [x] **Phase 3 — Admin:** separate login with optional 2-step verification
  (enforced by RLS), operator CLI, movies/cast editor, in-browser clip cutter and
  re-encoder (5–20 s, metadata stripped), scheduling with a played-challenge lock,
  player moderation.
- [x] **Phase 4 — Progress:** streaks (in challenge days), statistics with a
  solved-on chart, My History, weekly/monthly/all-time leaderboards, live sidebar
  and right-rail stats, streak in the share text.
- [x] **Phase 5 — Time Travel extras:** month calendar with results, filters (not played / in progress / solved / missed), list view, "Surprise me".
- [x] **Phase 6 — Polish:** installable PWA (icons, manifest, conservative service
  worker, offline page, install button), live Web Audio visualiser, cached compact
  catalogue endpoint (/api/catalog), accessibility pass (axe-core audit clean on every
  page, skip link, focus handling, readable minimum text sizes), robots.txt, social metadata.
- [x] **Phase 7 — Production:** Docker Compose with the app, a trimmed self-hosted
  Supabase (Postgres, Auth, REST, Storage), Caddy (automatic HTTPS, single origin),
  a migration runner, daily backups with tested restore, operator tools. See [DEPLOY.md](DEPLOY.md).
