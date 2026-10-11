# RUNBOOK — small Python API behind nginx (Postgres + Redis)

Stack: `proxy` (nginx, the only published port, host 80) → `api` (gunicorn, non-root)
→ `db` (Postgres) and `cache` (Redis). Postgres data lives in the `pgdata` named
volume. `db` and `cache` publish no ports and sit on an `internal: true` network,
so they are reachable only from other containers.

Compose is **not** an orchestrator: it gives you single-host startup ordering,
health-gated dependencies, restart policies, and resource/log caps. It does not
provide rolling deploys, automatic rollback, or multi-host scheduling — those
steps below are manual.

## 1. Prerequisites

- Docker Engine with Compose v2 (`docker compose version`).
- The image expects a WSGI callable at `app:app` (a module `app.py` exposing `app`).
  If your module differs, adjust the `CMD` in the `Dockerfile`.

## 2. First-time setup (secrets)

```sh
cp .env.example .env
$EDITOR .env        # set POSTGRES_PASSWORD to a long random secret
```

Generate a strong, URL-safe password (it is interpolated into `DATABASE_URL`,
so avoid `@ : / # ?` characters):

```sh
openssl rand -hex 32
```

Rules:

- `.env` is git-ignored (`.gitignore`) and excluded from the image build
  (`.dockerignore`). **Never commit it and never paste real values into
  `compose.yaml`** — all secrets are injected via `.env` variable substitution.
- `POSTGRES_USER` / `POSTGRES_DB` default to `app`; only the password is mandatory
  (Compose fails fast with a clear error if `POSTGRES_PASSWORD` is unset).
- Rotate by changing `.env` and running `docker compose up -d` (recreates `db`
  only if you also change the volume — see backup/restore below; changing the
  password on an existing volume requires `ALTER USER` inside the container).

## 3. Startup

```sh
docker compose up -d --build
```

Startup order is health-gated: `db` and `cache` must pass their healthchecks
(`pg_isready`, `redis-cli ping`) before `api` starts; `api` must be listening
before `proxy` starts. First boot also builds the API image.

Useful day-2 commands:

```sh
docker compose ps                 # container + health status
docker compose logs -f api        # follow API (gunicorn) logs
docker compose logs --tail=100 proxy
docker compose restart api        # restart one service
docker compose down               # stop everything (keeps the pgdata volume)
```

Never use `docker compose down -v` casually — `-v` deletes the `pgdata` volume
and all database data.

## 4. Health verification

```sh
docker compose ps                                   # HEALTHY next to each service
curl -sS http://localhost/healthz                   # nginx itself: "ok"
curl -sS http://localhost/                          # end-to-end through the proxy
```

Per-service detail:

```sh
docker inspect --format='{{.Name}} {{.State.Health.Status}}' $(docker compose ps -q)
docker compose exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec cache redis-cli ping            # expect PONG
```

The API healthcheck is a TCP probe of gunicorn's port (defined as `HEALTHCHECK`
in the `Dockerfile`). Once the application exposes a real liveness endpoint
(e.g. `GET /health`), upgrade it to an HTTP check for a more meaningful signal.

Debugging without exposing ports: `docker compose run --rm --service-ports api`
publishes the API port for that one-off container, or use
`docker compose exec api sh`.

## 5. Backup and restore (Postgres)

Backup (logical dump, safe while running):

```sh
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  > "backup-$(date +%F-%H%M%S).sql"
```

Restore:

```sh
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -f - < backup-YYYY-MM-DD-HHMMSS.sql
```

Cold backup of the raw volume (stop the stack first):

```sh
docker compose down
docker run --rm -v "$(basename "$PWD")_pgdata":/data -v "$PWD":/backup alpine \
  tar czf /backup/pgdata-$(date +%F).tgz -C /data .
docker compose up -d --build
```

Restore the volume by unpacking the tarball into a fresh `pgdata` volume the
same way (or `docker volume rm <project>_pgdata` then recreate and untar).

Redis is a cache with `maxmemory`/`allkeys-lru` and no persistence configured;
if you enable AOF/RDB later, back up `/data` the same way (e.g.
`docker compose exec cache redis-cli SAVE`, then copy `dump.rdb` out of the
container).

## 6. Secret handling

- Single source of truth: `.env` (never committed, never baked into images).
- `compose.yaml` references `${POSTGRES_PASSWORD:?…}` — builds fail closed with
  an explicit message if the secret is missing.
- Rotate: edit `.env`, then `docker compose up -d`. For the DB password on an
  existing volume, also run `ALTER USER` inside `db` (or restore from backup).
- Audit: `git grep` should never match real secrets; `docker history <api-image>`
  should not contain `.env` contents (it is excluded via `.dockerignore`).

## 7. Rollback

Compose has no automatic rollback. Manual procedure:

1. Tag the current (known-good) API image before deploying:
   `docker tag <project>-api:latest <project>-api:good`
2. Deploy the new build: `docker compose up -d --build`
3. Verify health (section 4). If broken:
   ```sh
   docker compose down
   # point compose at the previous image, e.g. via an override file:
   #   services.api.image: <project>-api:good
   docker compose -f compose.yaml -f compose.rollback.yaml up -d
   ```
   or simply `git checkout <previous-commit> -- Dockerfile compose.yaml nginx.conf`
   and `docker compose up -d --build`.
4. If the release also changed the schema, restore the database from the most
   recent backup (section 5) **before** starting the old API image.
5. Config-only rollback (nginx/Dockerfile/compose): `git revert` the offending
   commit and `docker compose up -d` — no data is touched.

Keep at least the previous image tag and the previous DB dump until the new
release is confirmed healthy.

## 8. Operational limits (by design)

- `restart: unless-stopped` + healthchecks keep the stack up on a single host;
  there is no automatic failover or scaling.
- Container logs use the `json-file` driver capped at 10 MiB × 3 files per
  container; ship them to a log aggregator for long-term retention.
- Resource limits (`deploy.resources.limits`) are per-container caps for
  cpu/memory; tune them to the host.
- TLS termination is out of scope for this file set; put a TLS-terminating
  proxy (or nginx `listen 443 ssl`) in front for anything internet-facing.
