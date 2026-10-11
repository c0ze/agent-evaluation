# RUNBOOK — small-api (nginx + Flask API + Postgres + Redis)

Single-host Docker Compose deployment. Not Kubernetes, not multi-node.

## Architecture

```
internet -> host:${HTTP_PORT:-80} -> proxy (nginx, "frontend" net)
                                       -> api (gunicorn :8000, frontend+backend)
                                            -> db    (postgres:17, backend only, internal)
                                            -> cache (redis:7.4,   backend only, internal)
```

- The **only** published port is the proxy's HTTP port. `api`, `db`, and
  `cache` have no host ports; `db`/`cache` sit on an `internal: true` network.
- Data volumes: `pgdata` (Postgres), `redisdata` (Redis AOF). Redis is
  configured as a **cache** (`allkeys-lru`, 256 MB); Postgres is the source of
  truth and the only thing that must be backed up.
- The API image expects a WSGI entry point `wsgi:app` (adjust the `CMD` in
  `Dockerfile` if yours is e.g. `app:app`) and a `GET /healthz` endpoint
  returning 200 (it should verify DB/Redis connectivity).

## Prerequisites

- Docker Engine 24+ with Compose v2 (`docker compose version`).
- Free port 80 on the host (or set `HTTP_PORT` in `.env`).

## Startup

```bash
cp .env.example .env
chmod 600 .env
# edit .env: real POSTGRES_PASSWORD (openssl rand -hex 32), etc.

docker compose up -d --build
docker compose ps          # wait until all services show "healthy"
```

Startup order is enforced by health-gated `depends_on`:
`db`/`cache` healthy -> `api` healthy -> `proxy` starts. Compose exits with a
clear error if `.env` is missing required variables.

## Health verification

```bash
docker compose ps                                   # HEALTH column = healthy
curl -fsS http://localhost:${HTTP_PORT:-80}/healthz # end-to-end (nginx -> api -> deps)
curl -fsS http://localhost:${HTTP_PORT:-80}/nginx-health  # proxy alone

docker compose exec db    pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec cache redis-cli ping            # -> PONG

# Inspect raw health probe history for a service:
docker inspect --format '{{json .State.Health}}' \
  $(docker compose ps -q api) | python3 -m json.tool
```

Unhealthy services are auto-restarted (`restart: unless-stopped`); check
`docker compose logs -f <svc>` and `docker inspect ... .State.Health` for the
failing probe output.

## Backup / restore (Postgres)

Logical dump — safe while running; take before every deploy and on a cron
(e.g. nightly, keep 14 days off-host):

```bash
mkdir -p backups
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/app-$(date +%F-%H%M).dump"

# verify the dump is readable:
pg_restore --list "backups/app-YYYY-MM-DD-HHMM.dump" | head
```

Restore (destructive — drops and recreates objects):

```bash
docker compose up -d db                 # ensure db is healthy first
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < backups/app-YYYY-MM-DD-HHMM.dump
docker compose restart api              # clear stale connections/pools
```

Cold volume backup (rare; full-fidelity, requires downtime):

```bash
docker compose stop db
docker run --rm -v small-api_pgdata:/data -v "$PWD/backups":/out alpine \
  tar czf /out/pgdata-$(date +%F).tgz -C /data .
docker compose start db
```

Redis holds cache only: **do not** back it up; it repopulates on its own.

## Secret handling

- All secrets live in `.env` (mode `600`, git-ignored, never in images or
  compose.yaml). `.env.example` contains placeholders only.
- Generate: `openssl rand -hex 32`. Keep `POSTGRES_PASSWORD` alphanumeric or
  URL-encode it — it is interpolated into `DATABASE_URL`.
- Rotate the DB password:
  1. `docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER \"$POSTGRES_USER\" PASSWORD 'NEW-PASSWORD';"`
  2. Update `.env`, then `docker compose up -d api` (recreates api with the new URL).
- If `.env` is ever leaked or committed, treat all values as compromised:
  rotate immediately and scrub git history.
- Scaling up: move to Docker secrets / an external secret manager and mount
  secrets as files instead of env vars; env vars are visible via
  `docker inspect` to anyone with docker access.

## Rollback

Every deploy should tag the built API image so you can step back:

```bash
# at deploy time (release v1.4.0):
docker compose build api
docker tag small-api:local small-api:v1.4.0
IMAGE_TAG=v1.4.0 docker compose up -d        # runs the tagged image
```

Roll back the application:

```bash
IMAGE_TAG=v1.3.0 docker compose up -d --no-build api   # previous known-good tag
docker compose ps && curl -fsS http://localhost/healthz
```

Roll back configuration (compose.yaml / nginx.conf / Dockerfile): revert the
commit in git, then `docker compose up -d` (nginx-only changes:
`docker compose exec proxy nginx -s reload` after re-rendering, or
`docker compose restart proxy`).

Database: schema migrations are **not** auto-reversible. If a deploy included
migrations, roll the data back by restoring the pre-deploy dump (above) —
take that dump *before* deploying. Prefer backward-compatible migrations
(expand/contract) so old app versions run against the new schema.

Never run `docker compose down -v` on a live host — it deletes `pgdata`.

## Routine operations

```bash
docker compose logs -f api          # logs are json-file, rotated 3x10 MB
docker compose restart api          # gunicorn graceful reload
docker compose down                 # stop (volumes survive)
docker compose pull && docker compose up -d   # patch base images (test first)
```

Resource limits (CPU/memory per service) are set in `compose.yaml` under
`deploy.resources.limits` — tune to the host, they are guardrails, not
autoscaling. Compose gives you no leader election, no zero-downtime rolling
updates, and no self-healing beyond container restarts; plan a maintenance
window for deploys and keep an eye on `df -h` for the docker data root.

## Known caveats / assumptions

- TLS terminates upstream (cloud LB, reverse proxy, or add 443 + certs to
  nginx). Port 80 is plain HTTP; do not expose this directly to the internet
  without TLS in front.
- `api` runs with `read_only: true` and a writable `/tmp` tmpfs; if the app
  must write elsewhere, add a named volume for that path.
- Image tags are pinned to minor versions (nginx 1.28, postgres 17, redis
  7.4, python 3.13-slim); for full reproducibility pin digests in CI and add
  hashes to `requirements.txt` (`pip-compile --generate-hashes`).
