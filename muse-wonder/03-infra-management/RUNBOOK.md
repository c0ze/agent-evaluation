# Runbook — Python API behind nginx (Postgres + Redis)

Stack: `proxy` (nginx, only published port) → `api` (gunicorn/Flask) → `db` (Postgres) and `cache` (Redis) on an internal network. Compose is used for local/single-host operation only; it is not a clustered orchestrator (no scheduling, secrets manager, or HA).

## Prerequisites

- Docker with the Compose v2 plugin (`docker compose version`).
- Application code in this directory exposing a Flask object `app` (adjust the `CMD` in `Dockerfile` if your module differs) and a `GET /health` route returning HTTP 200, e.g. `{"status": "ok"}`. Do not make `/health` depend on external calls in a way that flaps; keep it a cheap liveness/readiness check.

## First-time setup and startup

```bash
cp .env.example .env
chmod 600 .env
# Replace both passwords in .env with:  openssl rand -hex 32
docker compose config          # render + validate; should print no secrets warnings beyond masked values
docker compose up -d --build
docker compose ps              # wait until db, cache, api, proxy show (healthy)
curl -fsS http://localhost/healthz   # proxy liveness
curl -fsS http://localhost/health    # API via proxy (or your API route)
```

Only `http://localhost:80` is reachable from the host. Postgres (5432) and Redis (6379) have no host ports; reach them via `docker compose exec db psql -U "$POSTGRES_USER" "$POSTGRES_DB"` or `docker compose exec cache redis-cli -a "$REDIS_PASSWORD"`.

Useful day-to-day commands:

```bash
docker compose logs -f api proxy   # follow logs (rotated: 10m x 3 per service)
docker compose restart api         # restart one service
docker compose down                # stop; keeps named volumes (data preserved)
docker compose down -v             # DESTRUCTIVE: also deletes postgres_data/redis_data
```

## Health verification

```bash
docker compose ps                                   # STATUS column should say (healthy)
docker compose exec db pg_isready -U app -d app     # accepting connections
docker compose exec cache redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping   # PONG
curl -fsS http://localhost/healthz && curl -fsS http://localhost/health
docker compose logs --tail=100 api                  # check for gunicorn boot errors
```

Startup order is enforced by health, not just container start: `api` waits for `db`/`cache` `service_healthy`, and `proxy` waits for `api`. If a service stays `unhealthy`, inspect its health log with `docker inspect --format '{{json .State.Health}}' <container>`.

## Backup and restore

Postgres data lives in the named volume `app_postgres_data`. Prefer logical backups:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U app -d app -Fc > "backups/app-$(date +%F-%H%M).dump"

# Restore into the running db (destructive to current data):
docker compose exec -T db pg_restore -U app -d app --clean --if-exists < backups/<file>.dump
```

Verify a backup before trusting it: `pg_restore --list <file>.dump | head`. Redis (`app_redis_data`, AOF enabled) is a cache — treat it as disposable; back it up only if you store non-rebuildable data in it. Test restores on a throwaway copy (e.g. `docker compose down`, rename the volume) before a real incident. Schedule dumps outside Compose (host cron/systemd timer) and copy them off-host; Compose does not do this for you.

## Secret handling

- Real secrets live only in `.env` (mode `600`, never committed, excluded from the image by `.dockerignore`). `compose.yaml` contains no literal passwords; `POSTGRES_PASSWORD` and `REDIS_PASSWORD` use `:?` guards so Compose aborts if they are missing.
- Generate with `openssl rand -hex 32`; use a different value per secret and per environment. Rotate by updating `.env`, then `docker compose up -d` (note: changing `POSTGRES_PASSWORD` after first init does not change the existing DB role password — also run `ALTER ROLE` in Postgres, and changing `REDIS_PASSWORD` requires recreating `cache` and `api` together).
- For anything beyond a single host, move secrets to the platform's secret store (e.g. Docker secrets or a vault) rather than a plaintext `.env` file.

## Rollback

Application rollback is an image/config rollback; pin what you deploy by tagging builds (e.g. `git rev-parse --short HEAD`) instead of relying on `latest`.

```bash
git log --oneline -5                 # find last known-good commit
git checkout <good-commit> -- Dockerfile compose.yaml nginx.conf requirements.txt
docker compose up -d --build         # rebuild and recreate with previous config
docker compose ps && curl -fsS http://localhost/health
```

If a bad deploy also ran a DB migration, roll the database back separately from the verified backup above — code rollback alone does not undo schema/data changes. If the new config itself fails to start, `docker compose logs` plus `git diff` against the last known-good commit is the fastest triage.
