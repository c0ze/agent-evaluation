# Runbook — API + nginx + Postgres + Redis

## Overview

Four services: `proxy` (nginx), `api` (Flask behind gunicorn), `db` (Postgres),
`cache` (Redis). Only `proxy` publishes a port (`80`) on the host. `db` and
`cache` live on a private `backend` network; `api` joins both networks.

## Prerequisites

- Docker Engine + Compose v2 (`docker compose version`)
- No containers currently running

## Startup

1. Create local env file from the template and set a real password:

   ```sh
   cp .env.example .env
   # edit .env, replace POSTGRES_PASSWORD=change-me
   ```

2. Build and start:

   ```sh
   docker compose up -d --build
   ```

   On **first** run only, `db` becomes healthy before `api` starts
   (`depends_on.condition: service_healthy`). `cache` starts after `db`.

3. Check status:

   ```sh
   docker compose ps
   ```

## Health verification

```sh
# Compose-level health status (all services)
docker compose ps

# nginx renders as OK against /nginx-health
curl -fsS http://localhost/nginx-health

# The API exposes /healthz (proxied through nginx)
curl -fsS http://localhost/healthz

# Readiness of Postgres / Redis directly (internal hostnames only)
docker compose exec db pg_isready -U "$(grep '^POSTGRES_USER=' .env | cut -d= -f2)"
docker compose exec cache redis-cli ping
```

`healthcheck` is defined per service in `compose.yaml`. A service is healthy
when its check passes; unhealthy states surface via `docker compose ps` and
`docker inspect --format '{{json .State.Health}}' <service>`.

## Backup / restore

Postgres data is persisted in the named volume `db-data`.

```sh
# Backup
docker compose exec db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  > "backup-$(date +%F).sql"

# Restore
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < backup-YYYY-MM-DD.sql
```

Redis is a cache (LRU eviction, no persistence) and is not backed up.

## Secret handling

- Credentials live only in `.env` (git-ignored) and are interpolated by Compose.
- No password is embedded in `compose.yaml`, `Dockerfile`, or `nginx.conf`.
- The API receives `DATABASE_URL`/`REDIS_URL` via environment, not baked images.
- `.env.example` is committed as a template with a placeholder only.
- Never run the `db`/`cache` ports on the host in production; keep them on the
  internal `backend` network (`proxy` is the sole ingress).

## Rollback

Compose state is declarative. To roll back a code or config change:

1. Revert the changed file (e.g. `git checkout -- compose.yaml` or redeploy the
   previous image tag).
2. Rebuild/restart:

   ```sh
   docker compose up -d --build
   ```

3. Re-run the health checks above. The `db-data` volume is untouched by
   rollbacks, so data survives.

## Notes / limitations

- Compose is a single-host tool, not an orchestrator; `restart`, `logging`, and
  `deploy.resources` are best-effort local settings. Replica/scaling and
  cross-host failover require a real orchestrator (e.g. Swarm/Kubernetes).
- The API entrypoint is `app:app` (i.e. `app.app`) with a `/healthz` route —
  adjust the gunicorn `CMD` in `Dockerfile` if your module/object differs.