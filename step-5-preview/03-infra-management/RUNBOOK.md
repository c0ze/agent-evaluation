# RUNBOOK — small Python API stack (nginx + API + Postgres + Redis)

## Architecture

```
client -> proxy (nginx, ${HTTP_PORT:-8080}) -> api (gunicorn, 8000)
                                            -> db     (postgres:16-alpine)
                                            -> cache  (redis:7-alpine)
```

- `edge` network: proxy <-> api only.
- `backend` network: `internal: true`, api <-> db/cache only. db and cache have
  no published host ports and are unreachable from outside Compose.
- The API is published on the loopback interface only (`127.0.0.1:${API_PORT}`)
  for debugging; normal traffic goes through the proxy.
- Postgres data lives in the named volume `pgdata`. Redis runs as a pure cache
  (persistence disabled, LRU eviction, 192 MB cap).

## 1. Prerequisites

- Docker Engine >= 24 and Docker Compose v2 (`docker compose version`).
- Nothing is installed on the host; everything runs in containers.

## 2. Configuration and secrets

1. `cp .env.example .env`
2. Generate a real password, e.g.
   `openssl rand -base64 24` — avoid `@ : / ? #` (or percent-encode them in
   `DATABASE_URL`).
3. Edit `.env`: set `POSTGRES_PASSWORD`. Optionally change `HTTP_PORT`,
   `API_PORT`, `POSTGRES_USER`, `POSTGRES_DB`.

Rules:

- `.env` holds all credentials and is the only place they exist. Compose
  interpolates `.env` into the service definitions; the compose file itself
  contains no secrets.
- If `POSTGRES_PASSWORD` is unset, `docker compose up` fails immediately with a
  clear error (never starts with a default credential).
- `.dockerignore` excludes `.env` from the build context, so credentials can
  never land in an image layer.
- Never commit `.env`. If a credential ever leaks, rotate it: update `.env`,
  `docker compose up -d` (Postgres password is only applied at volume init —
  see "Rotating the database password" below).

### Rotating the database password

`POSTGRES_PASSWORD` is honored on first initialization of an existing volume
only if the data directory is new; for an existing volume:

```
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "ALTER ROLE \"$POSTGRES_USER\" WITH PASSWORD '<new-password>';"
```

then update `.env` and `docker compose up -d`.

## 3. Startup / shutdown

```
docker compose up -d --build          # build API image and start everything
docker compose ps                     # all four services should be healthy/running
docker compose logs -f api            # follow API logs (gunicorn access+error to stdout)
docker compose down                   # stop and remove containers (keeps pgdata volume)
docker compose down -v                # DESTROYS the pgdata volume and all data
```

Startup order is health-gated: `db` and `cache` must be healthy before `api`
starts, and `api` must be healthy before `proxy` starts. The API healthcheck
comes from the `Dockerfile` (`HEALTHCHECK` on `GET /healthz`); db/cache/proxy
healthchecks are defined in `compose.yaml`.

Update flow: `docker compose up -d --build` reuses the volume; containers are
recreated only when their config changes.

## 4. Health verification

```
# Service states (look for "(healthy)")
docker compose ps

# End-to-end through the proxy
curl -fsS http://localhost:${HTTP_PORT:-8080}/healthz
#   -> {"checks":{"cache":"ok","db":"ok"},"status":"ok"}

# Directly against the API (host-only port)
curl -fsS http://127.0.0.1:${API_PORT:-8000}/healthz

# Dependencies
docker compose exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec cache redis-cli ping        # -> PONG
```

Expected: `curl` returns HTTP 200 with `status: ok`; a 503 means the API is up
but lost db/cache connectivity. The proxy is healthy when nginx can serve
`/healthz` from the API.

## 5. Backup and restore

Postgres data is in the named volume `pgdata`. Two supported methods.

### A. Logical backup (recommended, portable)

```
mkdir -p backups
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --format=custom \
  > "backups/app-$(date +%Y%m%d-%H%M%S).dump"
```

Restore:

```
docker compose stop api proxy
docker compose up -d db                       # make sure db is healthy
cat backups/app-YYYYMMDD-HHMMSS.dump | docker compose exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner
docker compose up -d api proxy
```

Restoring a *new* volume instead of an existing one:

```
docker compose down
docker volume rm 03-infra-management_pgdata    # or: docker compose down -v
# then recreate the stack and restore into the empty database
docker compose up -d db
... pg_restore as above ...
docker compose up -d
```

### B. Volume-level snapshot (fast, host-local)

```
docker run --rm -v 03-infra-management_pgdata:/data -v "$PWD/backups:/backup" \
  alpine tar czf /backup/pgdata-YYYYMMDD.tgz -C /data .
```

Restore with the stack stopped: `docker compose down`, then run the same image
with `tar xzf` into `/data`, then `docker compose up -d`.

Keep at least one restored-and-verified backup; test restore procedures
periodically. Redis needs no backup (cache, persistence intentionally off).

## 6. Secret handling summary

- Secrets live only in `.env` on the host (mode 600 recommended) and are passed
  as environment variables to containers.
- Compose interpolates them; they are not stored in `compose.yaml`, the
  `Dockerfile`, the image, or nginx config.
- For anything beyond a single host, move `.env` values into the platform's
  secret store (Docker/Swarm secrets, Vault, cloud secret manager) and inject
  them instead of committing `.env` to hosts.
- Rotate credentials on any suspected exposure (see above).

## 7. Rollback

1. Stop traffic: `docker compose stop proxy api`.
2. Roll back the API image: check out the previous known-good commit and
   `docker compose up -d --build` (or pin the previous image tag).
   Because images are rebuilt from `requirements.txt` with pinned versions +
   pinned base image tags (`python:3.13-slim`, `postgres:16-alpine`,
   `redis:7-alpine`, `nginx:1.27-alpine`), a rollback reproduces the old build.
3. If the release changed the database schema and the rollback undoes that
   migration, restore the matching logical backup (section 5A) — roll back code
   and data together.
4. Verify: `docker compose ps` (all healthy) and `curl .../healthz` -> 200.
5. Re-open traffic: `docker compose up -d` (or `docker compose start proxy`).

Config-only rollbacks (`compose.yaml`, `nginx.conf`, `Dockerfile`) do not touch
`pgdata`; re-running `docker compose up -d` with the previous files is enough.

## 8. Known limits of this setup (Compose is not an orchestrator)

- Single replica of every service; no scheduler, autoscaling, or rolling
  updates. `restart: unless-stopped` covers process crashes only.
- `deploy.resources.limits` (CPU/memory caps) are applied locally by Docker
  Compose v2; Swarm-only features (replicas, placement constraints) are
  intentionally not used.
- json-file logging is capped at 10 MB x 3 files per container.
- Postgres readiness only waits for `pg_isready` to accept connections.
