# Runbook: API stack (nginx + Flask/gunicorn + Postgres + Redis)

| Service | Image             | Reachable from        | Health check                          |
|---------|-------------------|-----------------------|---------------------------------------|
| proxy   | nginx:1.28-alpine | host port `HTTP_PORT` | `GET /healthz` through nginx          |
| api     | built from `.`    | proxy only (frontend) | `GET /healthz` (checks db and cache)  |
| db      | postgres:17       | api only (backend)    | `pg_isready` over TCP                 |
| cache   | redis:8-alpine    | api only (backend)    | `redis-cli ping`                      |

The `backend` network is internal (no route to the host or the internet).
Postgres data lives in the named volume `<project>_db_data`; Redis is a cache
with no persistence. Run every command below from this directory.

## 1. Startup

Prerequisites: Docker Engine with Compose v2 (`docker compose version`).

```sh
cp .env.example .env            # then set POSTGRES_PASSWORD and REDIS_PASSWORD
chmod 600 .env
docker compose config --quiet   # validates the file; fails if a required variable is empty
API_TAG=$(git rev-parse --short HEAD) docker compose build
API_TAG=$(git rev-parse --short HEAD) docker compose up -d
```

`up` starts db and cache first, waits until their health checks pass, then
api, then proxy once api is healthy. Startup fails (rather than half-starting)
if a dependency never becomes healthy; see section 2 to find out why.

Put `API_TAG=<sha>` in `.env` for the value used by later `docker compose`
commands, so a plain `docker compose up -d` does not fall back to `api:dev`.

Config-only nginx change (no downtime):

```sh
docker run --rm -v "$PWD/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.28-alpine nginx -t
docker compose exec proxy nginx -s reload
```

## 2. Health verification

```sh
docker compose ps                        # every service should show "(healthy)"
curl -fsS "http://localhost:${HTTP_PORT:-80}/healthz"
# {"checks":{"cache":"ok","database":"ok"},"status":"ok"}
```

- HTTP 503 with `"status":"degraded"` names the failing dependency; nginx
  itself answers `503 {"error":"service unavailable"}` when the api is down.
- Details of a failing check: `docker inspect --format '{{json .State.Health}}' "$(docker compose ps -q api)"`
- Logs (rotated, 3 x 10 MB per container): `docker compose logs --tail=100 -f api`
  Each request carries an `X-Request-ID` that appears in both the nginx and
  gunicorn access logs and in the response headers.

## 3. Backup and restore (Postgres)

Backups are logical dumps taken from the running database; they do not
require downtime.

```sh
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/app-$(date +%Y%m%dT%H%M%S).dump"
```

Schedule this (cron/systemd timer) and copy the files off the host. Verify a
backup occasionally by restoring it into a scratch database.

Restore (replaces the current contents; stop the api first so nothing writes):

```sh
docker compose stop api
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backups/app-<timestamp>.dump
docker compose start api
```

Fresh host or lost volume: run `docker compose up -d db`, wait for
`(healthy)`, then run the restore, then `docker compose up -d`.

Redis holds cache data only and is not backed up.

## 4. Secret handling

- Secrets live only in `.env` (git-ignored, docker-ignored, mode 600) and are
  passed to each container as environment variables; nothing is hard-coded
  in `compose.yaml` and nothing is baked into the image (`.dockerignore`).
- Required values use `${VAR:?...}`, so a missing secret stops startup
  instead of silently using a default.
- Rotating the Postgres password (the `POSTGRES_PASSWORD` variable only
  seeds the very first initialisation; afterwards the database is the source
  of truth):
  ```sh
  docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\password"'   # prompts, no shell history
  # set the same value in .env, then recreate the api with the new DATABASE_URL:
  docker compose up -d api
  ```
- Rotating the Redis password: change `REDIS_PASSWORD` in `.env`, then
  `docker compose up -d cache api` (the cache is emptied; it is only a cache).
- Anyone with access to the Docker socket can read container environments
  (`docker inspect`); restrict it to the deploy user. Where that is not
  acceptable, move to Compose `secrets:` and `POSTGRES_PASSWORD_FILE`, or an
  external secret store, without changing anything else in this stack.

## 5. Rollback

Every deploy builds an image tagged with the git SHA, so the previous image
is still on the host until `docker image prune` removes it.

```sh
docker image ls api                       # find the previous tag
API_TAG=<previous-sha> docker compose up -d --no-build api
curl -fsS "http://localhost:${HTTP_PORT:-80}/healthz"
```

Only the api container is replaced; nginx re-resolves the `api` name from
Docker DNS, so no proxy restart is needed. `--no-build` refuses to run if the
tag does not exist locally rather than building something unexpected.

- Config rollback (`compose.yaml`, `nginx.conf`, `.env`): restore the previous
  file from git or a copy, run `docker compose config --quiet`, then
  `docker compose up -d` (or `nginx -t` + `nginx -s reload` for nginx alone).
- Database rollback: if the new version changed the schema, restore the dump
  taken before the deploy (section 3) after rolling the api back. Take that
  dump as the first step of every deploy that includes a migration.
- Image versions are pinned (`nginx:1.28`, `postgres:17`, `redis:8`,
  `python:3.13-slim`); bump them deliberately. A Postgres major upgrade needs
  a dump/restore, never just a tag change.
