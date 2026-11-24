# Cineraagam — frontend starter

A responsive Next.js starter for the Telugu movie music guessing game.

## Run locally

1. Install Node.js 20 or newer.
2. In this folder run `npm install`.
3. Run `npm run dev`.
4. Open http://localhost:3000.

## What's included

- Responsive desktop, tablet and mobile dashboard.
- Cineraagam visual identity and dark cinematic styling.
- Daily challenge screen with three sequential clue states.
- Guess, skip, replay-preview UI, result reveal and share action.
- Time Travel, Leaderboard, Statistics and How to Play navigation shells.
- Display-name welcome modal (front-end demo only).
- PWA manifest foundation.

## Important prototype notes

This is the first frontend prototype, not a production-connected game yet. The audio player is a visual interaction placeholder; no licensed audio files are included. The sample answer and sample statistics are demo data. The display name currently lives only in React state and is not persisted. Supabase anonymous authentication, profile persistence, daily puzzle APIs, secure scoring, leaderboard queries, and real audio playback are the next implementation phase.

## Planned backend

- Supabase Anonymous Auth only (no email, password, phone, Google login or account linking).
- `profiles`: `id` (auth user UUID), `display_name`, `created_at`.
- `daily_challenges`: puzzle date, difficulty, answer movie ID, publication status.
- `challenge_clips`: challenge ID, sequence (1–3), licensed audio object path, duration.
- `game_attempts`: user ID, challenge ID, guesses, clips used, outcome, score, completion timestamp.
- `movies`: movie title and cast names for the post-game reveal.

Use Row Level Security and server-side validation for attempts and scores. Do not expose answer keys or direct storage paths before the game ends.
