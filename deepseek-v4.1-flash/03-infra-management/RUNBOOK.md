# RUNBOOK — app deployment (nginx + API + Postgres + Redis)

Four containers on one host:

| service | reachable from | published host port |
|---|---|---|
| `proxy` (nginx 1.27) | the internet / your LB | `${HTTP_PORT}` (default 80) |
| `api` (gunicorn, uid 10001) | `proxy` only | none |
| `db` (Postgres 17) | `api` only | none |
| `cache` (Redis 7) | `api` only | none |

`backend` is an `internal: true` network, so Postgres and Redis have no route
off the host. `frontend` carries proxy↔api traffic and gives the API egress if
it calls external services. Only `proxy` publishes a port.

**Application contract assumed by this configuration** (the app code is not
part of this task):

- `GET /healthz` — cheap liveness check, no dependency calls, 200 when the
  process can serve. Used by the container healthcheck.
- `GET /readyz` — readiness check that pings Postgres and Redis and returns
  503 when either is unavailable. Used by operators and by a load balancer,
  *not* by the container healthcheck (a dependency outage should not mark the
  API container itself unhealthy).

## 1. First start

```sh
cp .env.example .env
chmod 600 .env
# fill in POSTGRES_PASSWORD and REDIS_PASSWORD; use different values:
#   openssl rand -hex 24
$EDITOR .env

docker compose config          # renders the resolved config; fails loudly if a
                               # required variable is missing
docker compose build
docker compose up -d
docker compose ps              # wait for "healthy" on db, cache, api, proxy
```

Postgres initialises from `POSTGRES_*` **only on first start** with an empty
`pgdata` volume. Changing those values later does not change the database
password — see §4.

`docker compose down` stops everything but keeps the `pgdata` volume.
`docker compose down -v` **deletes the database volume**; take a backup first.

## 2. Health verification

```sh
# Edge, end to end (also proves nginx can reach the API):
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:${HTTP_PORT:-80}/healthz

# Readiness incl. Postgres and Redis:
curl -fsS http://localhost:${HTTP_PORT:-80}/readyz

# Container-level state and health-check history:
docker compose ps
docker inspect --format '{{.Name}} {{.State.Health.Status}}' \
  $(docker compose ps -q)
docker compose exec proxy nginx -t    # config syntax inside the running proxy

# Direct service probes (no published ports needed):
docker compose exec db    sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec cache sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli --no-auth-warning ping'
docker compose exec api   python -c 'import urllib.request;print(urllib.request.urlopen("http://127.0.0.1:8000/readyz").status)'

# Recent errors only:
docker compose logs --since 10m --no-log-prefix api proxy | grep -iE 'error|critical|traceback' || true
```

Expected: `healthy` for all four; `/healthz` and `/readyz` return 200; Redis
returns `PONG`.

If `api` is healthy but `proxy` is not, nginx cannot resolve/reach `api` —
check name resolution and connectivity from inside the proxy:

```sh
docker compose exec proxy wget -q -O - http://api:8000/healthz
```

## 3. Backups and restore

Logical backup (safe while running; `-Fc` is compressed and restore-selective):

```sh
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/app-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Verify a dump before trusting it:

```sh
docker compose exec -T db sh -c 'pg_restore --list' < backups/app-<ts>.dump | head
```

Restore (stop writers first; `--clean` drops and recreates objects):

```sh
docker compose stop api
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' \
  < backups/app-<ts>.dump
docker compose start api
```

Full-volume backup (host-level snapshot, for disaster recovery only; requires
a brief stop so the files are consistent):

```sh
docker compose stop db
docker run --rm -v app_pgdata:/var/lib/postgresql/data:ro -v "$PWD/backups:/backup" \
  alpine tar czf /backup/pgdata-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /var/lib/postgresql/data .
docker compose start db
```

Restore the volume only into an empty `pgdata` (`docker compose down -v` first)
and never while `db` is running. Keep backups off the host; a `pgdata` volume
only survives failures of the container, not of the disk.

Schedule `pg_dump` from cron/systemd with the same command; retention is your
policy (e.g. daily × 14, weekly × 8). Redis is a cache with persistence
disabled — losing it is expected and requires no backup.

## 4. Secrets

- All credentials live in `.env` (mode `0600`, owner root or the deploy user,
  listed in `.gitignore` and `.dockerignore`). Nothing is baked into the image
  or in `compose.yaml`.
- `.env` values are visible to anyone who can run `docker inspect` on the
  host, and to root. That is the trade-off for a single-host deployment. For
  stronger isolation use Docker Compose/Swarm `secrets:` (files mounted at
  `/run/secrets/*`, `POSTGRES_PASSWORD_FILE`) or an external secret manager,
  and read them the same way from the API.
- Never pass secrets on the command line (they land in shell history and
  `ps`); never put them in `nginx.conf` or image `ENV`/`ARG`.
- Rotate on a schedule and after any suspected exposure.

**Rotating the database password** (the container's `POSTGRES_PASSWORD` is
ignored once the volume is initialised). The generated hex value has no SQL
metacharacters, so it can be interpolated safely:

```sh
set -a; . ./.env; set +a          # load POSTGRES_USER/POSTGRES_DB for the CLI
NEW=$(openssl rand -hex 24)
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "ALTER ROLE \"$POSTGRES_USER\" WITH PASSWORD '$NEW';"

sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW/" .env
docker compose up -d --no-deps --force-recreate api

# Verify over TCP with the real DSN (a local `psql` inside db uses socket auth
# and would not prove the password works):
docker compose exec -T api python -c \
  'import os, psycopg2; psycopg2.connect(os.environ["DATABASE_URL"]).close(); print("db auth ok")'
```

**Rotating the Redis password**: update `REDIS_PASSWORD` in `.env`, then
`docker compose up -d --no-deps --force-recreate cache api` (Redis applies
`requirepass` only at start; the cache is flushed).

If `.env` is ever committed or leaks, treat every value in it as compromised
and rotate all of them.

## 5. Deploy and rollback

Never deploy a mutable `:latest`. Tag every build with the commit it came from
and keep the previous tags on the host (or push them to a registry):

```sh
TAG=$(git rev-parse --short HEAD)
docker compose build                            # builds app-api:local
docker image tag app-api:local "app-api:$TAG"   # archive this build

# deploy (and rollback): choose which archived build runs
docker image tag "app-api:$TAG" app-api:local
docker compose up -d --no-deps --force-recreate api
curl -fsS http://localhost:${HTTP_PORT:-80}/readyz
```

`compose.yaml` names the image `app-api:local`; the retag step is what selects
which build runs. For a registry flow, push `app-api:$TAG` and change the
`image:` field (or set it via an override file) to that reference, then
`docker compose pull api && docker compose up -d --no-deps api`.

**Rollback** is a redeploy of the previous tag — the exact same commands with
`$TAG` replaced by the previous one:

```sh
docker image tag "app-api:$PREVIOUS_TAG" app-api:local
docker compose up -d --no-deps --force-recreate api
curl -fsS http://localhost:${HTTP_PORT:-80}/readyz
docker compose ps
```

This is a *recreate*, not a rolling update: expect a few seconds of 503 from
nginx while the API restarts (nginx returns `{"error":"service_unavailable"}`
with `Retry-After: 5`). Database migrations are the hard part — make them
forward-compatible (expand/contract) so the previous API version can still run
against the newer schema; otherwise roll back the data as well:

```sh
docker compose stop api
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' \
  < backups/app-<ts>.dump
docker compose start api
```

If the host itself is lost: install Docker, restore this directory, restore
`.env` from your secret store, recreate the `pgdata` volume from the last
dump, `docker compose up -d`.

## 6. What Compose does and does not do here

It does: restart crashed containers (`unless-stopped`, with Docker's
exponential backoff), order startup on health (`depends_on` +
`condition: service_healthy`), cap CPU/memory, rotate logs at 10 MB × 3, and
keep data services off the public network.

It does **not**:

- restart or replace a container that is *running but unhealthy* — health
  status is reported, nothing acts on it. Alert on it; do not expect
  self-healing.
- reschedule onto another host, drain a node, or roll back a failed deploy.
- give zero-downtime updates, or restart dependents when a dependency dies.
- enforce `deploy.resources.reservations` (limits are applied by Compose,
  reservations are only meaningful in Swarm).
- isolate the host from a compromised container beyond the controls above —
  `read_only`, `cap_drop: ALL`, `no-new-privileges` and the internal network
  reduce blast radius, they are not a sandbox.

If you outgrow those limits, the next step is an orchestrator, not more
Compose features.

## 7. Routine checks

- `docker compose ps` — all four `healthy`.
- Disk: `docker system df`, `du -sh backups` — a full disk stops Postgres.
- Logs: JSON driver, rotated; ship them if you need history beyond 3 files.
- Base images are pinned to minor tags on purpose. Bump them deliberately
  (Renovate/Dependabot PR, changelog review), not by switching back to
  `latest`; a Postgres major bump on an existing `pgdata` volume needs
  `pg_dump`/`pg_upgrade`.
