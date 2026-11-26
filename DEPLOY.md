# Deploying Cineraagam

This guide puts Cineraagam online on your own server: the website, your own
self-hosted Supabase (database, login, file storage), automatic HTTPS and daily
backups. Everything is free and open-source; you pay only for the server and
domain.

```
Internet ──► Caddy (HTTPS) ──► website (Next.js)
                          ├──► /auth/v1     Supabase Auth
                          ├──► /rest/v1     Supabase REST API
                          └──► /storage/v1  Supabase Storage (audio)
             Postgres and the backup job are private — never exposed.
```

## What you need

- **A server** running Ubuntu 24.04 (or any Linux with Docker): 2 vCPU, **4 GB RAM**, 40 GB disk.
  A small VPS from Hetzner, Netcup, DigitalOcean etc. (~€4–8/month) is plenty to start.
- **A domain name** (e.g. `cineraagam.in`) whose DNS you can edit.
- About 30 minutes.

## 1. Prepare the server

SSH in, then install Docker and a firewall:

```bash
curl -fsSL https://get.docker.com | sh
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

## 2. Point your domain at the server

At your domain registrar, add an **A record** for `cineraagam.in` (or `@`) with the
server's IP address. (Add an AAAA record too if the server has IPv6.) Wait until
`ping cineraagam.in` shows the server's IP.

## 3. Get the code and generate secrets

```bash
git clone https://github.com/Vineelamudala/CineRAAGAM.git cineraagam
cd cineraagam
docker run --rm -v "$PWD":/w -w /w node:24-alpine node deploy/generate-secrets.mjs cineraagam.in
```

This writes `deploy/.env` with a strong database password and API keys.
**Copy `deploy/.env` somewhere safe (a password manager)** — without it you
cannot access your database or restore a backup.

## 4. Start everything

```bash
cd deploy
docker compose up -d --build
docker compose ps        # all services "running"/"healthy"; migrate "exited (0)"
```

The first start builds the website (a few minutes), sets up the database,
applies every migration and requests an HTTPS certificate automatically.
Open `https://cineraagam.in` — the game should load.

## 5. Load the movie catalogue and create your admin account

```bash
docker compose run --rm tools node scripts/import-wikidata.mts          # ~5,500 Telugu films
docker compose run --rm tools node scripts/admin.mjs create you@example.com
```

The second command prints your admin password **once** — save it. Then go to
`https://cineraagam.in/admin`, sign in, open **Security** and turn on 2-step
verification. Add cast and clips for your first movies and schedule the first
days (see "Running the show" in the README).

> Players can only play once a challenge is **published for today**. Schedule a
> few days ahead; the admin Overview flags missing days.

## Day-to-day operations

| Task | Command (in `deploy/`) |
|---|---|
| See status | `docker compose ps` |
| Logs | `docker compose logs -f app` (or `auth`, `storage`, `caddy`, `backups`) |
| Reset an admin password | `docker compose run --rm tools node scripts/admin.mjs reset you@example.com` |
| Admin lost their phone (2FA) | `docker compose run --rm tools node scripts/admin.mjs reset-2fa you@example.com` |
| Refresh the movie catalogue | `docker compose run --rm tools node scripts/import-wikidata.mts` |
| Database shell | `docker compose exec db psql -U postgres` |
| Stop / start | `docker compose down` / `docker compose up -d` |

### Updating to a new version

```bash
cd cineraagam && git pull
cd deploy && docker compose up -d --build
```

New database migrations are applied automatically before the website restarts.
Take a backup first (below) when an update includes migrations.

## Backups

The `backups` service saves, every 24 hours, into `deploy/backups/`:

- `db-<time>.dump` — all game data (players, plays, movies, cast, clips, schedule, admin accounts)
- `storage-<time>.tar.gz` — the uploaded audio files

It keeps 14 days (change `BACKUP_RETENTION_DAYS` in `.env`).

**Backups on the same server don't protect you if the server dies.** Copy them
off regularly, e.g. from your own computer:

```bash
rsync -av user@your-server:cineraagam/deploy/backups/ ./cineraagam-backups/
```

(or use any free tool such as `rclone` to sync the folder to cloud storage).

Make an extra backup right now (e.g. before an update):

```bash
docker compose run --rm --entrypoint sh backups /backup.sh --once
```

### Restoring

On a working install (same or new server, with **the same `deploy/.env`**):

```bash
cd deploy
docker compose up -d                       # schema is created by the migrate service
ls backups/                                # pick a time, e.g. 20261201T033000Z
docker compose run --rm restore 20261201T033000Z
docker compose restart
```

## Security notes

- Only ports 80/443 are open; the database and Supabase services are on a private Docker network.
- Players are anonymous; admins are created only with the service key (tools container).
- `deploy/.env` holds the secrets — permission 600, never commit it, keep an offline copy.
- Anonymous sign-ins are limited to 30 per hour per visitor IP (`ANON_SIGNUPS_PER_HOUR`).
- Keep the server patched: `sudo apt update && sudo apt upgrade` monthly.

## Trying the production stack on your own computer

```bash
node deploy/generate-secrets.mjs --local     # http://localhost:8080, no HTTPS
cd deploy && docker compose up -d --build
```
