# RUNBOOK — small JSON API on one Docker host

Stack: `proxy` (nginx, unprivileged) → `api` (gunicorn) → `db` (Postgres) +
`cache` (Redis). Compose here is a process supervisor for a single host, not an
orchestrator: no rolling updates, no failover, no rescheduling. Plan downtime
accordingly.

| Service | Image                       | Listens | Network(s)       | Published |
|---------|-----------------------------|---------|------------------|-----------|
| proxy   | nginx-unprivileged 1.27     | 8080    | `edge`           | `${HTTP_BIND_ADDR}:${HTTP_PORT}` |
| api     | built from `Dockerfile`     | 8000    | `edge`, `backend`| no        |
| db      | postgres:17-alpine          | 5432    | `backend`        | no        |
| cache   | redis:8-alpine              | 6379    | `backend`        | no        |

`backend` is an `internal` network: no default gateway, no route off the host.
Reach the database and cache through `docker compose exec`, never through a
published port.

**Contract the application must satisfy**

- WSGI callable `app` in module `wsgi` (`/app/wsgi.py`); override the `CMD`
  target in `Dockerfile` if the module is named differently.
- `GET /healthz` → 200 when the process can serve traffic. Keep it cheap:
  process liveness only. It is the api container healthcheck and is neither
  rate-limited nor access-logged at the proxy.
- Optional `GET /readyz` for dependency checks (db/redis reachable). Do **not**
  fold those into `/healthz`, or a slow database will loop-restart the API.

---

## 1. Startup

```bash
cp .env.example .env          # never commit .env; fill in real values
chmod 600 .env
$EDITOR .env                  # set POSTGRES_PASSWORD and REDIS_PASSWORD

docker compose config --quiet # renders and validates; fails if a var is unset
docker compose build          # or: docker pull the release tag
docker compose up -d
docker compose ps             # wait for db/cache healthy → api healthy → proxy
```

Start order is enforced by health, not by guesswork: `db`+`cache` must report
healthy before `api` starts, and `api` must be healthy before `proxy` starts.
First `up` takes ~30-60s because Postgres runs `initdb`.

Stop / start / full teardown:

```bash
docker compose stop                 # keeps containers and data
docker compose down                 # removes containers, KEEPS the pgdata volume
docker compose down -v              # also DELETES the database volume — back up first
```

## 2. Health verification

```bash
docker compose ps --format 'table {{.Service}}\t{{.Status}}'   # all "(healthy)"
docker inspect --format '{{json .State.Health}}' $(docker compose ps -q api) | jq

curl -fsS http://127.0.0.1:8080/nginx-health   # proxy itself: {"status":"ok"}
curl -fsS http://127.0.0.1:8080/healthz        # through the proxy to the API
curl -si  http://127.0.0.1:8080/ | head -20    # check headers + status

docker compose exec db    pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec cache redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping
```

Confirm the isolation that matters, from the host:

```bash
docker compose port db 5432 || echo "db not published (expected)"
nc -z 127.0.0.1 5432 || echo "5432 closed on the host (expected)"
nc -z 127.0.0.1 6379 || echo "6379 closed on the host (expected)"
```

Logs (bounded to 10 MB × 5 per service):

```bash
docker compose logs -f --tail=100 api
docker compose logs --since=15m proxy | jq -c 'select(.status >= 500)'
```

`request_id` appears in both the nginx access log and the gunicorn access log
(`X-Request-Id`), so a slow or failed request can be followed across the hop.

## 3. Backup and restore

Backups are written to `./backups`, which is bind-mounted into `db` at
`/backups`. Store copies off-host; a volume on the same disk is not a backup.

**Backup (logical, per database):**

```bash
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/app-$(date +%Y%m%dT%H%M%S).dump"
```

Verify the dump is readable before trusting it:

```bash
pg_restore --list backups/app-<stamp>.dump | head
```

**Restore into a clean database** (destructive — the API must be stopped so it
cannot write during the restore):

```bash
docker compose stop api proxy
docker compose exec -T db sh -c \
  'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" \
   && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' \
  < backups/app-<stamp>.dump
docker compose start api proxy
docker compose ps        # wait for healthy
```

**Whole-volume snapshot** (faster for large data; the database must be stopped):

```bash
docker compose stop
docker run --rm -v smallapi_pgdata:/data:ro -v "$PWD/backups:/backups" \
  alpine tar czf /backups/pgdata-$(date +%Y%m%d).tgz -C /data .
docker compose up -d
```

Redis is a cache and is intentionally not persisted (`--save "" --appendonly
no`). After a restart it is empty; the application must treat a cache miss as
normal. Nothing to back up.

Retention: keep 7 daily + 4 weekly dumps, and test a restore into a scratch
database at least quarterly. An untested backup is a guess.

## 4. Secret handling

- Credentials live only in `.env` (git-ignored, `chmod 600`) and are injected as
  environment variables. `compose.yaml` contains no secret values — only
  `${VAR:?...}` references, which abort `up` when a variable is missing.
- Never pass secrets as build args or bake them into the image; the build
  context excludes `.env` via `.dockerignore`.
- Rotate the database password:

  ```bash
  docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "ALTER USER $POSTGRES_USER PASSWORD 'NEW';"
  sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=NEW/' .env
  docker compose up -d api          # picks up the new DATABASE_URL
  ```

  Redis: change `REDIS_PASSWORD` in `.env`, then `docker compose up -d cache api`
  (the cache restarts empty, which is fine).
- Passwords with `@ : / ?` must be percent-encoded inside `DATABASE_URL`; the
  simplest fix is to generate alphanumeric passwords (see `.env.example`).
- A compromised value is compromised for the whole stack: rotate, then
  `docker compose up -d` and confirm `docker compose logs db | grep -i auth` is
  clean.
- Next step when this outgrows one host: move to Docker/Swarm `secrets:` or a
  secret manager (Vault, SOPS-encrypted files, cloud secret manager) and read
  them from files rather than the environment — env vars are visible in
  `docker inspect` to anyone in the `docker` group.

## 5. Rollback

Images are tagged `smallapi/api:${APP_VERSION}`, so rollback is a tag change.

```bash
docker image ls smallapi/api                 # find the last good tag
APP_VERSION=<last-good> docker compose up -d api
docker compose ps && curl -fsS http://127.0.0.1:8080/healthz
```

Persist it by setting `APP_VERSION=<last-good>` in `.env`. If the proxy holds a
stale upstream IP after the api container is recreated:

```bash
docker compose restart proxy     # nginx resolves `api` only at startup
```

Rolling back configuration (`nginx.conf`, `compose.yaml`): revert in git, then
`docker compose up -d`; for proxy-only changes `docker compose restart proxy`.

Rolling back a **database migration** is not a container operation. Either apply
the down-migration, or restore the pre-deploy dump from §3 and roll the image
back to the matching version. Always take a dump immediately before a deploy
that migrates.

## 6. Routine operations

```bash
docker compose pull && docker compose up -d      # base image updates
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec cache redis-cli --no-auth-warning -a "$REDIS_PASSWORD" info memory
docker stats --no-stream                         # check against the deploy limits
docker system df                                 # disk pressure
```

Capacity: `api` is capped at 1.5 CPU / 512 MB, `db` at 1.5 CPU / 1 GB, `cache`
at 320 MB with `allkeys-lru`. A container that is OOM-killed shows
`State.OOMKilled=true` in `docker inspect`; raise the limit in `compose.yaml`
rather than removing it.

## 7. Known limits of this setup

- Single host: `restart: unless-stopped` covers process and host restarts, not
  hardware failure. There is no HA here.
- Redeploying `api` drops in-flight connections for up to `stop_grace_period`
  (30s drain, then kill). There is no zero-downtime rolling update in Compose.
- nginx resolves the `api` upstream once at startup (see §5).
- TLS terminates upstream of this stack (host reverse proxy, load balancer or
  tunnel). If this host must terminate TLS, add certificates and a `listen 8443
  ssl` server block to `nginx.conf` and publish that port too.
- The rate limits in `nginx.conf` (20 r/s, burst 40, 32 conns per IP) are
  starting values; tune them from real traffic.
