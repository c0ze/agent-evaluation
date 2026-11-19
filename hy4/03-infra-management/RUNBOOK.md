# RUNBOOK — small-api stack

Single-host Docker Compose deployment: nginx (`proxy`) → gunicorn/Flask
(`api`) → `db` (Postgres 17) and `cache` (Redis 7). All commands run from this
directory. This is a single-node setup, not a cluster; it has no automatic
failover, no rolling deploys and no built-in secret store.

## 1. Startup

Prerequisites: Docker with the Compose v2 plugin; ports `PROXY_PORT` free.

```sh
cp .env.example .env
# Edit .env: set strong POSTGRES_PASSWORD and REDIS_PASSWORD (see §4).
# e.g. python3 -c "import secrets; print(secrets.token_urlsafe(24))"

docker compose config          # review the fully rendered config (secrets masked in output)
docker compose build           # reproducible: pinned requirements.txt, slim base
docker compose up -d           # starts in dependency/health order
```

Startup order is enforced by health-based `depends_on`: `db` and `cache` must
report healthy before `api` starts, and `api` must be healthy before `proxy`.
`start_period` gives a slow first boot (Postgres init, gunicorn workers) time to
settle. Compose does **not** wait for the application to be "ready" beyond its
healthcheck — if your app needs DB migrations, run them explicitly (below) after
`up`.

> The application must provide `app.py` exposing a Flask `app` with a
> `GET /health` route returning `200`. `/health` should check what the app
> actually needs (a trivial DB `SELECT 1` and/or Redis `PING`); keep it cheap
> because it runs every 15s.

```sh
# Example one-off migration/initialisation (adapt to your app):
docker compose run --rm api flask --app app db upgrade
```

## 2. Health verification

```sh
docker compose ps                         # STATUS should show (healthy) for db, cache, api, proxy
docker compose logs --tail=50 api         # gunicorn access/errors go to stdout
curl -fsS http://localhost:${PROXY_PORT:-80}/healthz   # proxy liveness, no upstream needed
curl -fsS http://localhost:${PROXY_PORT:-80}/health    # app health through the proxy
```

Direct dependency checks (run from inside the network, no host ports needed):

```sh
# Use sh -c with escaped $$ so the variables expand INSIDE the container,
# not in the host shell (where .env is not sourced).
docker compose exec db sh -c 'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
docker compose exec cache redis-cli ping          # REDISCLI_AUTH is set in the service
```

If a service is `unhealthy`, inspect `docker compose logs <svc>` and
`docker inspect --format '{{json .State.Health}}' <container>` for the failing
probe. Only `proxy` publishes a host port; `api`, `db`, `cache` are reachable
solely over the internal networks.

## 3. Backup and restore

Postgres data lives in the named volume `pgdata`; Redis AOF in `cache_data`.
Back up while the stack is running is fine for `pg_dump` (logical, consistent).

**Backup (logical, portable):**

```sh
# sh -c with escaped $$ expands the vars inside the container. PGPASSWORD /
# .pgpass may also be needed depending on the image's pg_hba; the db image
# trusts local socket connections from its own user by default.
docker compose exec -T db sh -c \
  'pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -Fc' \
  > backup_$(date +%F_%H%M).dump
```

Store dumps off-host and encrypted. The Redis volume is a cache (AOF, LRU
eviction) — it is rebuildable and normally **not** backed up; re-warm after a
restore. If you must snapshot volumes, stop the stack first for a consistent
copy:

```sh
docker compose down            # stops containers, KEEPS volumes
docker run --rm -v small-api_pgdata:/data -v "$PWD":/backup alpine \
  tar czf /backup/pgdata_$(date +%F).tgz -C /data .
docker compose up -d
```

**Restore (destroys current DB contents — confirm first):**

```sh
docker compose up -d db                                  # ensure db is healthy
docker compose exec -T db sh -c \
  'pg_restore -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" --clean --if-exists' \
  < backup_YYYY-MM-DD_HHMM.dump
docker compose restart api                               # reconnect pools
```

> `docker compose down -v` DELETES both named volumes permanently. Never use
> `-v` unless you intend to wipe data. There are no automatic backups; schedule
> the `pg_dump` command (cron/systemd timer) on the host.

## 4. Secret handling

- The only place real credentials go is `.env`, which is git-ignored
  (`.gitignore`) and excluded from the image (`.dockerignore`). `compose.yaml`
  and `Dockerfile` contain **no** credential literals — they interpolate
  `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, `${POSTGRES_DB}`,
  `${REDIS_PASSWORD}`.
- `.env.example` documents every required variable with placeholder values; it
  is safe to commit and is the template operators copy.
- `db` receives only the three `POSTGRES_*` vars via an explicit `environment:`
  list; `api` gets `DATABASE_URL` / `REDIS_URL` built from the same variables.
  Using explicit lists (rather than `env_file: .env`) keeps the Redis password
  and proxy port out of containers that don't need them. Redis requires AUTH;
  no passwordless cache is reachable (and no port is published).
- Rotation: change the value in `.env`, then `docker compose up -d` to recreate
  affected services. Rotating `POSTGRES_PASSWORD` on an **existing** volume does
  not re-init the DB — also `ALTER ROLE ... PASSWORD` inside `db`, or restore
  from a dump into a fresh volume. Rotate `REDIS_PASSWORD` similarly (the
  `command` flag is read on restart).
- For anything beyond a single host, move to a real secret manager (Docker
  secrets / Vault / cloud KMS). Compose `.env` is file-based, not a secrets
  backend; do not treat it as one.
- Never pass secrets on the CLI (`-e`, `redis-cli -a`) where they leak into
  process lists and shell history; the `REDISCLI_AUTH` env var avoids `-a`.

## 5. Rollback

Config/code changes are rolled back by reverting and recreating:

```sh
git revert <commit>            # or git checkout <previous> -- Dockerfile compose.yaml nginx.conf
docker compose up -d --build   # re-resolve config and rebuild the api image
```

Pinning matters: images use explicit major tags (`postgres:17-alpine`,
`redis:7-alpine`, `nginx:1.27-alpine`) and the base is `python:3.13-slim`, not
`latest`, so a rebuild is reproducible. `requirements.txt` is fully pinned.

- To roll back only the image while keeping data:
  `docker compose build api && docker compose up -d --no-deps api`.
- A bad deploy that corrupted data: `docker compose down` (keep volumes),
  restore the dump from §3, then `up -d`. Volumes are never removed by `down`
  alone, which is what makes this safe.
- Keep the previous known-good image tag/commit hash handy. Because this is a
  single node, any rollback is briefly disruptive (no rolling update) — plan a
  maintenance window. Compose provides no built-in canary/blue-green; that is an
  orchestrator concern, deliberately out of scope.

## 6. Shutdown / troubleshooting

```sh
docker compose down            # stop, keep volumes (normal)
docker compose down -v         # DESTRUCTIVE: also deletes pgdata + cache_data
docker compose logs -f         # tail all services
docker compose restart <svc>   # recreate one service
```

Logs are `json-file` with `max-size: 10m` / `max-file: 3` per service so a
chatty API cannot fill the disk. Resource limits (`mem_limit`, `cpus`,
`pids_limit`) and `restart: unless-stopped` keep a single runaway container from
taking down the host — but these are per-container guards, not cluster-wide QOS.
