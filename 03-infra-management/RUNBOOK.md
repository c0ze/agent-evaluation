# Runbook — API + nginx + Postgres + Redis (single host, Docker Compose)

Scope: one host, `docker compose`. Compose gives you restart, health checks,
log rotation and resource limits. It is **not** an orchestrator — it will not
reschedule onto another node, do rolling upgrades, or heal an "unhealthy"
container. Anything beyond that belongs to a scheduler, which is deliberately
out of scope here.

Layout after this change:

| Service | Image / build | Reachable from host | Network |
| ------- | ------------- | ------------------- | ------- |
| `proxy` | `nginx:1.29`  | `80/tcp`            | `frontend` |
| `api`   | build (`Dockerfile`), gunicorn on `5000` | not published | `frontend` + `backend` |
| `db`    | `postgres:18` | not published       | `backend` (internal) |
| `cache` | `redis:8`     | not published       | `backend` (internal) |

---

## 1. Startup

Prerequisites: Docker Engine + Compose v2, and a `.env` file.

```sh
cp .env.example .env          # then edit: real passwords, see §4
docker compose config         # renders + validates; fails on missing vars
docker compose build          # build the api image
docker compose up -d          # start everything in dependency order
docker compose ps             # watch STATUS until db/cache are (healthy)
```

Ordering is enforced by health, not by sleep:

- `cache` and `db` start first; each has a health check with a `start_period`
  (Redis 10s, Postgres 40s for the first `initdb`).
- `api` waits for `condition: service_healthy` on both, then gunicorn binds
  `5000`. Its own readiness probe hits `/readyz`, which actually connects to
  Postgres *and* Redis.
- `proxy` waits only for `condition: service_started` on `api`. That is
  intentional: nginx must come up even if the app is briefly unavailable, and
  the nginx `resolver 127.0.0.11` directive resolves `api` per request, so no
  startup-time DNS failure. Until the app is ready, nginx returns 502.

First boot takes ~40s (Postgres `initdb`). Rebuild after changing only app
code: `docker compose up -d --build api`.

Stop / teardown:

```sh
docker compose down            # stop + remove containers (volume survives)
docker compose down -v         # ALSO DELETES THE pgdata VOLUME — destructive
```

## 2. Health verification

```sh
# Per-service status (healthy / unhealthy / health: starting)
docker compose ps

# End-to-end through nginx — expect 200 {"status":"ok",...}
curl -fsS http://localhost/readyz

# liveness only, no downstream I/O
curl -fsS http://localhost/healthz

# proxy itself, without touching the app
curl -fsS http://localhost/nginx-healthz

# container-level view
docker inspect --format '{{.State.Health.Status}}' $(docker compose ps -q api)
```

Interpretation:

- `/healthz` 200 + `/readyz` 503 → app process is fine, a dependency is down.
  Check `docker compose logs db cache`.
- `502` from `/` or `/readyz` → api container is not serving; usually still
  starting, or `proxy` cannot resolve/reach `api` on the `frontend` network.
- Repeated restarts of `api` → crash loop, almost always a bad `DATABASE_URL`
  or `REDIS_URL`. `docker compose logs --tail=100 api`.

Logs (json-file driver, 10 MB × 5 files per service, so self-pruning):

```sh
docker compose logs -f --tail=100 api
docker compose logs --since 15m db
```

## 3. Backup and restore

The only durable state is the `pgdata` volume. Redis is a cache
(`--appendonly no --save ""`), so it is intentionally disposable — anything
that must survive a restart belongs in Postgres.

### Logical backup (preferred: portable, version-safe)

```sh
set -a; . ./.env; set +a        # export POSTGRES_USER / POSTGRES_DB for psql

# Dump (custom format, compressible, restorable selectively)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "backup-$(date +%Y%m%d-%H%M%S).dump"

# Restore into a running stack — stops the api first so nothing writes mid-restore
docker compose stop api
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner < backup-YYYYMMDD-HHMMSS.dump
docker compose start api
```

### Volume-level backup (offline snapshot)

```sh
PGDATA_VOL=$(docker volume ls --format '{{.Name}}' | grep pgdata)   # e.g. <project>_pgdata
docker compose stop api db                       # quiesce writers
docker run --rm -v "$PGDATA_VOL:/data" -v "$PWD:/backup" \
  busybox tar czf "/backup/pgdata-$(date +%Y%m%d).tgz" -C /data .
docker compose start db api
```

Restore: create an empty volume, extract the archive into it before the first
`docker compose up`, or restore onto a stopped stack with the same volume name.

Verify a backup by restoring it into a throwaway stack on a different volume
and running `pg_restore -l` / a row count. An unverified backup is not a backup.
Test the whole restore path on a schedule, not during an incident.

## 4. Secret handling

- All secrets live in `.env` (copied from `.env.example`), which is in
  `.gitignore` **and** `.dockerignore` — so they are neither committed nor sent
  to the build context.
- Compose interpolates them at parse time (`${VAR:?message}`). A missing value
  aborts `docker compose config`/`up` with an explicit error instead of
  silently starting with empty credentials.
- Nothing sensitive is written into `compose.yaml`, the `Dockerfile`, or the
  image. Credentials reach the api only as `DATABASE_URL` / `REDIS_URL`.
- Generate real values, never reuse the placeholders:
  `openssl rand -base64 32`.
- On a shared host, keep `.env` mode `0600`. For a multi-user host, move to
  Docker secrets or an external secret manager — `.env` is a single-host
  convenience, not a vault.
- Rotation: update `.env`, then `docker compose up -d` for the affected
  services (compose recreates a container when its env changes). For Postgres,
  `ALTER ROLE ... PASSWORD` first, then update `.env` and restart `api`; Redis
  `requirepass` changes need `CONFIG SET requirepass` plus the env update.
- Assume any value that has ever been in git or an image layer is burned:
  rotate, don't just delete.

## 5. Rollback

Images are pinned to `nginx:1.29`, `postgres:18`, `redis:8` and
`python:3.13-slim`; the app image is built from a commit. Rollback is therefore
"redeploy the previous known-good build".

```sh
# 1. Identify the last good commit / image
git log --oneline -5
docker images --filter reference='*api*'

# 2. Redeploy the previous code
git checkout <previous-commit>          # or: git revert <bad-commit>
docker compose up -d --build api        # rebuild + recreate only api
curl -fsS http://localhost/readyz       # verify before declaring victory

# 3. If the failure was config-only (no image change)
git checkout <previous-commit> -- compose.yaml nginx.conf
docker compose up -d
```

Database caution: rolling back code does **not** roll back schema migrations.
Before any deploy that includes a migration, take a `pg_dump` (§3). If the
rollback requires undoing a migration, restore that dump or apply the
explicitly-written down-migration — never hand-edit production data. Postgres
major-version upgrades (e.g. 17 → 18) are one-way; restore from a dump to go
back.

Fast abort without touching git: `docker compose down` then redeploy the
previous image tag if you publish tagged images (`image: registry/api:<sha>`).

## 6. Day-to-day operations

- Resources: `deploy.resources.limits` per service (api 1 CPU / 512 MB, db 2
  CPU / 1 GB, proxy and cache 0.5 CPU / 256 MB) plus reservations. Tune from
  `docker stats` output, not guesses. `WEB_CONCURRENCY` in compose must stay
  in step with the api CPU limit.
- Restarts: `restart: unless-stopped` everywhere. Compose does **not** restart
  a container that is merely `unhealthy`; use the health signal for alerting and
  restart it yourself (`docker compose restart api`).
- Dependencies: `requirements.txt` is fully pinned. Upgrade deliberately,
  rebuild, run the health checks; then refresh pins. Add `--require-hashes`
  once hashes cover the transitive set.
- Debugging without exposing ports — do not publish `5432`/`6379`:
  ```sh
  set -a; . ./.env; set +a
  docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  docker compose exec cache redis-cli -a "$REDIS_PASSWORD" ping
  ```
  If you must reach them from the host temporarily, uncomment the
  `127.0.0.1:...` port lines in `compose.yaml`, use them, then re-comment and
  `docker compose up -d`.
- Containers run with `no-new-privileges`, dropped capabilities, and (for
  `api`) a read-only root filesystem with `/tmp` on tmpfs. Rebuilding with
  `read_only: true` will fail if the app ever needs to write outside `/tmp` —
  add an explicit tmpfs/volume rather than disabling it.
