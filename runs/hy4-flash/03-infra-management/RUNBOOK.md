# Runbook — small API stack

Four services: `proxy` (nginx, the only public listener), `api` (Python/Flask
behind gunicorn), `db` (Postgres), `cache` (Redis). Compose is used for local /
small-scale operation only; it is **not** a full orchestrator. `restart:
unless-stopped` restarts crashed containers but provides no rescheduling,
rolling updates, or cross-host self-healing. The `deploy.resources.limits` keys
are advisory CPU/memory caps honored by Docker, not a scheduler guarantee.

## Prerequisites & first-time setup

1. Docker Engine with the Compose v2 plugin (`docker compose version`).
2. Create secrets and the local env file (never commit `.env`):

   ```sh
   cp .env.example .env
   # Generate two independent secrets and paste them into .env:
   openssl rand -hex 32   # POSTGRES_PASSWORD
   openssl rand -hex 32   # REDIS_PASSWORD
   ```

3. Fill in `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
   `REDIS_PASSWORD`, and `HTTP_PORT` (use `127.0.0.1:80` for localhost-only,
   or `0.0.0.0:80` to bind all interfaces). `.env` is excluded by `.gitignore`
   and `.dockerignore` so it neither enters version control nor the image.

4. Build and start:

   ```sh
   docker compose -f compose.yaml up -d --build
   ```

Startup order is health-gated: `db` and `cache` must pass their health checks
before `api` starts; `api` must pass its `/healthz` check before `proxy` starts.
This replaces the original `depends_on` list, which only waited for container
creation, not readiness.

## Health verification

```sh
docker compose -f compose.yaml ps                 # all services Up (healthy)
docker compose -f compose.yaml logs -f --tail=100
curl -fsS http://127.0.0.1/healthz                # nginx -> {"status":"ok"}
curl -fsS http://127.0.0.1/<your-api-route>       # proxied JSON from gunicorn
```

What each check covers:

- `db`: `pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"` (Postgres accepting connections).
- `cache`: authenticated `redis-cli ping` via `REDISCLI_AUTH` (Redis accepting the password).
- `api`: `GET http://127.0.0.1:8000/healthz` must return 200 (gunicorn + app alive). The application must implement this route; the same probe is declared both in `Dockerfile HEALTHCHECK` and in `compose.yaml`.
- `proxy`: nginx's own `/healthz` returns a static JSON 200, useful for uptime probes.

The dedicated `edge` and `backend` networks are explicit: only `proxy` and
`api` share `edge`; only `api`, `db`, and `cache` share `backend`, which is
`internal: true` (no outbound route). Postgres and Redis publish **no** host
ports.

## Backup / restore (Postgres)

Backups run from the `db` container so no host Postgres client is needed.

Backup (logical dump, gzipped, timestamped):

```sh
docker compose -f compose.yaml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > backup_$(date +%Y%m%d_%H%M%S).dump
```

Rotate and store dumps off-host (encrypted). Do not keep them in the build
context. Restore into a fresh/empty database:

```sh
# Stop the API first to avoid writes during restore.
docker compose -f compose.yaml stop api
docker compose -f compose.yaml exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < backup_YYYYMMDD_HHMMSS.dump
docker compose -f compose.yaml start api
```

Volume-level (physical) backup alternative must be done while the DB is
stopped for consistency, e.g. `docker run --rm -v <pgdata-volume>:/data -v
$PWD:/backup busybox tar czf /backup/pgdata.tgz -C /data .` — use the logical
`pg_dump` method above for routine backups.

Redis has `--appendonly yes` with data in the `redisdata` volume; it is a cache,
so treat its contents as disposable on restore.

## Secret handling

- All credentials live only in `.env` (git/docker ignored) and are injected at
  runtime. No password is baked into `compose.yaml`, the image, or nginx config.
- `DATABASE_URL` / `REDIS_URL` are assembled in Compose from `${...}` vars.
  Redis uses `--requirepass "$REDIS_PASSWORD"`; its healthcheck authenticates
  via `REDISCLI_AUTH`. Postgres uses SCRAM (`scram-sha-256`).
- Rotate a secret: update `.env`, then recreate consumers:
  `docker compose -f compose.yaml up -d --force-recreate api cache db`.
  Rotating the Postgres password also requires updating any existing roles/
  connections; test before rotating in production.
- Never paste real secrets into `docker inspect` output, logs, tickets, or chat.
  For production, replace `.env` with a real secret manager / Docker secrets
  and pin the base image by digest (`FROM python:3.13-slim-bookworm@sha256:...`).

## Updates, rollback, and teardown

```sh
# Rebuild after code/dependency changes:
docker compose -f compose.yaml up -d --build api
# Roll back to a previously tagged image:
docker compose -f compose.yaml up -d --no-build --force-recreate api \
  # after setting `image:` to the last known-good tag in compose.yaml
```

Rollback procedure:

1. Stop writes: `docker compose -f compose.yaml stop api proxy`.
2. Restore the last good `pg_dump` (see above) if the release migrated schema.
3. Re-point `image:` (or git checkout the previous commit and rebuild) to the
   last known-good version, then `docker compose -f compose.yaml up -d --build`.
4. Re-run the health verification steps above.

Teardown (removes containers/networks; named volumes are preserved unless
`--volumes` is added — do **not** add it unless you intend to delete data):

```sh
docker compose -f compose.yaml down
```

Notes: `nginx.conf` is mounted read-only (`:ro`). Logs are JSON-file with a
10 MB × 3 rotation per service to avoid unbounded disk use. Gunicorn uses 3
workers / 2 threads, 30 s timeouts, and recycles workers after 1000 requests.
