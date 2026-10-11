# Runbook — API + nginx + Postgres + Redis (single-host Compose)

Services: `proxy` (nginx 1.27-alpine, published on `$HTTP_PORT`), `api`
(gunicorn, non-root, internal only), `db` (Postgres 17, internal only, named
volume `db-data`), `cache` (Redis 7, internal only, no persistence).

Networks: `edge` (proxy ↔ api) and `backend` (`internal: true`, api ↔ db/cache).
`db` and `cache` publish **no** host ports.

## 1. Prerequisites

- Docker Engine 24+ with Compose v2 (`docker compose version`).
- `git`, `curl` (for health checks), `psql`/`pg_restore` only if you want to run
  them on the host — all commands below use the containers.

## 2. First-time setup

```bash
cp .env.example .env          # never commit .env (see §7)
$EDITOR .env                  # set POSTGRES_PASSWORD, REDIS_PASSWORD
chmod 600 .env
```

Required variables: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
`REDIS_PASSWORD`. Compose fails fast with
`required variable ... is missing a value` if any is unset.
Optional: `HTTP_PORT` (default `80`; use `8080` if you are not root),
`APP_MODULE` (WSGI entrypoint, default `app:app`), `WEB_CONCURRENCY`,
`HEALTHCHECK_PATH` (default `/healthz`), `IMAGE_TAG`.

If a password contains `@ : / # ? %`, URL-encode it when Compose builds
`DATABASE_URL`/`REDIS_URL` (`%` → `%25`, `@` → `%40`, …), or set those two
variables verbatim in `.env` and drop them from the `environment:` block.

## 3. Build and start

```bash
docker compose build api                 # reproducible: pinned requirements.txt in a venv
docker compose up -d                     # starts db → cache → api → proxy
docker compose ps                        # wait until all are "healthy"
docker compose logs -f --tail=100 api
```

Startup order is health-gated: `api` waits for `db`/`cache`
`condition: service_healthy`, `proxy` waits for `api` healthy. First boot runs
Postgres `initdb`, so allow ~40 s before everything reports healthy.

Restart: `docker compose restart api` (graceful: `stop_grace_period: 30s`
matches gunicorn `--graceful-timeout 30`).
Stop: `docker compose down` (keeps the `db-data` volume). Remove everything
including data: `docker compose down -v` (destructive — take a dump first).

## 4. Health verification

```bash
docker compose ps                                    # STATUS = Up (healthy)
docker inspect -f '{{.State.Health.Status}}' app-api-1

curl -fsS http://localhost/nginx-health              # proxy liveness  -> "ok"
curl -fsS http://localhost/healthz                   # API through the proxy
docker compose exec api python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/healthz').status)"
docker compose exec db pg_isready -U app -d app      # /var/run/postgresql: accepting connections
docker compose exec cache redis-cli ping             # PONG (auth via REDISCLI_AUTH)

# Proof that the data services are not reachable from the host:
docker compose ps --format '{{.Service}} {{.Ports}}'   # only proxy has a published port
nc -z localhost 5432 || echo "5432 closed (expected)"
nc -z localhost 6379 || echo "6379 closed (expected)"
```

The `api` health check is `GET http://127.0.0.1:8000$HEALTHCHECK_PATH`
(`Dockerfile` `HEALTHCHECK`, 30 s interval, 20 s start period). If the
application does not expose `/healthz`, set `HEALTHCHECK_PATH` to its real
liveness route — a 200 is required, otherwise Compose keeps the container
`unhealthy` and `proxy` will never start.

Through the proxy, unhealthy upstream requests return 502; check
`docker compose logs proxy` and `$upstream_response_time` in the JSON access log.

## 5. Logs

- JSON access log on the proxy (`request_id`, `status`, `request_time`,
  `upstream_time`); error log at `warn`.
- API logs go to stdout as gunicorn access/error logs.
- All services use `json-file` with `max-size: 10m`, `max-file: 3` (~30 MB per
  service). Inspect with `docker compose logs --since 15m api`.
- Correlate a request end-to-end with `X-Request-ID` (nginx generates it,
  forwarded to the API).

## 6. Backup and restore (Postgres)

Logical dump (preferred, consistent while running):

```bash
mkdir -p backups
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl \
  > "backups/app-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Restore into the running database:

```bash
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner \
  < backups/app-20261012T000000Z.dump
docker compose restart api
```

Cold volume snapshot (only with the stack stopped, or accept crash-consistency):

```bash
docker compose down
docker run --rm -v app_db-data:/data -v "$PWD/backups:/backup" alpine \
  tar czf /backup/db-data.tgz -C /data .
docker compose up -d
```

Schedule: nightly dump + 14-day retention; **always** dump immediately before a
schema migration or image upgrade. Test a restore into a scratch database at
least monthly — an untested dump is not a backup. Redis holds no durable data
(`--appendonly no`, `--save ""`, `allkeys-lru`); losing it only costs cache
warmth.

## 7. Secret handling

- Secrets live only in `.env` (mode `600`), which is excluded by `.dockerignore`
  and must be in `.gitignore`; `.env.example` holds placeholders only.
- Never pass credentials as build args or bake them into images (`COPY . .` is
  filtered by `.dockerignore`).
- Compose interpolates them into `DATABASE_URL`/`REDIS_URL` for the API and into
  `POSTGRES_*` for the DB. They are visible via `docker inspect`; for a higher
  bar use `secrets:` files with `POSTGRES_PASSWORD_FILE`, or an external secret
  store, and inject at start-up.
- Rotation — Postgres (env password is only read by `initdb`, so rotate in two
  steps):

  ```bash
  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "ALTER USER $POSTGRES_USER WITH PASSWORD 'new-secret';"
  $EDITOR .env                       # POSTGRES_PASSWORD=new-secret
  docker compose up -d --no-deps api # API picks up the new DATABASE_URL
  docker compose up -d --no-deps db  # keeps .env and the cluster in sync
  ```

- Rotation — Redis (requires a restart because `requirepass` is a start-up
  flag): edit `.env`, then `docker compose up -d --no-deps --force-recreate cache`
  followed by `docker compose up -d --no-deps api`. Cache contents are dropped.
- After any rotation, re-run the §4 checks and confirm the API can still connect.

## 8. Rollback

Images are pinned by tag (no `:latest`), and the API image is tagged
`app-api:$IMAGE_TAG`, so rollbacks are deterministic.

```bash
# 1. Record what is running now
docker compose ps --format '{{.Service}} {{.Image}}' | tee rollback-state.txt

# 2. Application rollback (image)
git checkout <previous-tag-or-sha>
IMAGE_TAG=<previous-tag> docker compose build api
IMAGE_TAG=<previous-tag> docker compose up -d --no-deps api
curl -fsS http://localhost/healthz || IMAGE_TAG=<current> docker compose up -d --no-deps api

# 3. Proxy config rollback
git checkout <previous-tag-or-sha> -- nginx.conf
docker compose exec proxy nginx -t && docker compose exec proxy nginx -s reload
```

Database: prefer rolling forward. If a migration must be undone, stop writes,
dump (§6), run the down-migration, and only restore the dump if the down-migration
is impossible — restoring loses everything written after the dump.

## 9. What Compose does *not* give you

This stack runs on a single host: no scheduler, no self-healing across nodes,
no rolling updates, no HA. `depends_on: condition: service_healthy` orders
*start-up* only — it does not re-check dependencies later, so the API must
reconnect on DB/Redis restarts. `deploy.resources.limits` are per-container
cgroup limits (`memory` is a hard cap: Postgres will be OOM-killed above 1 GB),
not cluster resource management. For multi-host or zero-downtime operation,
move to a real orchestrator — outside the scope of this task.
