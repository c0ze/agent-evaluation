# Runbook — app stack (nginx / API / Postgres / Redis)

A single-host Docker Compose deployment. nginx is the only publicly
reachable service; the API, Postgres, and Redis live on internal networks
(`backend` is `internal: true`, so it has no internet egress either).

```
client -> proxy (nginx, :80) -> api (gunicorn :5000) -> db / cache
         frontend network            frontend + backend      backend
```

## Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose version`)
- A `.env` file in this directory (see below)

## First-time startup

```sh
cp .env.example .env
$EDITOR .env          # set POSTGRES_PASSWORD (openssl rand -hex 24)
docker compose up -d --build
docker compose ps     # all four services should report (healthy)
```

Compose interpolates credentials from `.env` and refuses to start with a
clear error if any required variable is missing. The API waits for `db`
and `cache` to pass their health checks before starting; the proxy waits
for the API.

The application must expose `GET /health` returning 2xx — the compose
healthcheck for `api` and the gunicorn entrypoint assume this. If your
Flask module/object is not `app:app`, change the gunicorn argument in the
Dockerfile.

## Health verification

```sh
# Container-level (healthchecks from compose.yaml)
docker compose ps

# Proxy is serving (nginx answers this locally, no upstream involved)
curl -fsS http://localhost/health

# End-to-end through nginx to the API
curl -fsS http://localhost/<any-real-api-route>

# Component checks from inside the stack
docker compose exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec cache redis-cli ping
docker compose exec api python - <<'PY'
import os, urllib.request
urllib.request.urlopen("http://127.0.0.1:5000/health", timeout=3)
print("api healthy")
PY

# Logs (json-file driver, rotated at 10m x 3 files per container)
docker compose logs --tail=100 api
docker compose logs -f proxy
```

## Backup / restore (Postgres)

Data persists in the named volume `db_data`, so it survives `docker compose down`.

First load your `.env` into the shell (the commands below expand
`$POSTGRES_USER` / `$POSTGRES_DB` locally):

```sh
set -a; source .env; set +a
```

```sh
# Backup (custom-format dump; portable and compressible)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > backup.dump

# Restore into an empty database, or clean existing objects first
docker compose exec -T db pg_restore -U "$POSTGRES_USER" --clean --if-exists \
  -d "$POSTGRES_DB" < backup.dump

# Physical fallback: snapshot the volume (stop writes first)
docker compose stop api
docker run --rm -v <project>_db_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/db_data.tgz -C /data .
docker compose start api
```

Store dumps off-host. Restore order: stop `api` (so nothing writes during
restore), restore, then `docker compose up -d`.

## Secret handling

- All credentials live in `.env`, which is git-ignored and excluded from
  the image build via `.dockerignore`. Nothing is hardcoded in
  compose.yaml / Dockerfile.
- Generate the DB password with `openssl rand -hex 24`. Use only
  characters that are safe inside a URI (hex is), or URL-encode them —
  the password is interpolated into `DATABASE_URL`.
- **Password rotation**: changing `POSTGRES_PASSWORD` in `.env` does NOT
  affect an already-initialized volume. Rotate like this:
  ```sh
  docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '<new>';"
  # then update .env and restart the API
  docker compose up -d api
  ```
- For production, prefer a real secret store (Vault, cloud secret
  manager) or at least Docker secrets / an orchestrator; `.env` is a
  convenience for local/small deployments, not an access-control
  mechanism. Restrict file permissions (`chmod 600 .env`).

## Rollback

The state that matters is `db_data` plus the deployed configuration.

```sh
# 1. Roll back the configuration to the previous version
git checkout <previous-tag-or-commit> -- Dockerfile compose.yaml nginx.conf

# 2. Rebuild and restart (data volume is untouched)
docker compose up -d --build

# 3. If the data schema also regressed, restore the matching dump
docker compose exec -T db pg_restore -U "$POSTGRES_USER" --clean --if-exists \
  -d "$POSTGRES_DB" < backup.dump
```

Useful operations:

```sh
docker compose down          # stop and remove containers; db_data survives
docker compose down --volumes   # DANGER: deletes Postgres data permanently
docker compose restart api   # bounce a single service
```

Take a fresh `pg_dump` before any rollback that touches the database.

## Limits of this setup (Compose is not an orchestrator)

- Single host only; if the machine dies, everything is down. `restart:
  unless-stopped` restarts crashed containers, but there is no rescheduling.
- Resource limits are enforced by the kernel where supported (cgroups),
  but there is no autoscaling or cluster self-healing.
- Log rotation is per-container (10 MB x 3); aggregate logs elsewhere if
  you need retention.
- Backups are manual — schedule them via cron/host tooling if this stops
  being a dev deployment.
