# Deployment Runbook

Operational guide for the hardened `proxy` (nginx) -> `api` (Flask/Gunicorn) -> `db` (PostgreSQL) + `cache` (Redis) stack.

## 1. Startup

1. Create a local environment file from the template and set unique URL-safe secrets:
   ```bash
   cp .env.example .env
   chmod 600 .env
   # Generate values for POSTGRES_PASSWORD and REDIS_PASSWORD:
   openssl rand -hex 24
   ```
   Edit `.env` to replace both placeholder passwords (hex avoids URL-encoding issues in `DATABASE_URL` and `REDIS_URL`). Adjust `PROXY_PORT=8080` if port `80` is unavailable or running rootless Docker.
2. Validate the Compose configuration before starting:
   ```bash
   docker compose config -q
   ```
   Compose refuses to start if required variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`) are missing or empty.
3. Build and start the stack:
   ```bash
   docker compose up -d --build
   ```
   Health-gated `depends_on` enforces startup order: `db` and `cache` become healthy first, then `api`, then `proxy`.
   *Application expectation:* the Python service exposes WSGI entrypoint `app:app` (override `api.command` if different) and `GET /health` returning HTTP `200`.

## 2. Health Verification

1. Confirm all four services report `healthy` and only `proxy` publishes a host port:
   ```bash
   docker compose ps
   ```
   Expected port binding: `127.0.0.1:${PROXY_PORT:-80}->8080/tcp` on `proxy` only (`api`, `db`, and `cache` must show no published host ports).
2. Verify nginx edge liveness and end-to-end API health through the proxy:
   ```bash
   docker compose exec proxy wget -qO- http://127.0.0.1:8080/nginx-health
   curl -fsS "http://127.0.0.1:${PROXY_PORT:-80}/health"
   ```
3. Inspect logs or detailed healthcheck output if a service fails to go healthy:
   ```bash
   docker compose logs --tail=100 proxy api db cache
   docker inspect --format='{{json .State.Health}}' "$(docker compose ps -q api)"
   ```

## 3. Backup and Restore (PostgreSQL)

Postgres data persists in the named `postgres_data` volume. Redis (`cache`) is configured as an ephemeral LRU cache (`128mb` limit, persistence disabled); Postgres is the system of record.

> **Never** run `docker compose down -v` in an environment where data must be kept — `-v` deletes `postgres_data`.

### Backup

Stream a consistent custom-format dump to the host:

```bash
set -a && . ./.env && set +a
mkdir -p backups && chmod 700 backups
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backups/db_$(date +%Y%m%d_%H%M%S).dump"
```

Store backups off-host (encrypted) and periodically test restores against a scratch volume.

### Restore

Stop `api` so no connections or writes race with the restore, restore the dump, then restart `api`:

```bash
set -a && . ./.env && set +a
docker compose stop api
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner < backups/db_YYYYMMDD_HHMMSS.dump
docker compose start api
```

Re-run the health checks in Section 2 afterward.

## 4. Secret Handling

- **Local files:** Keep `.env` untracked (`.gitignore` / `.dockerignore`) with `0600` permissions. Never bake `.env` or credentials into images or `compose.yaml`.
- **DSN safety:** Use alphanumeric/hex secrets (e.g., `openssl rand -hex 24`) so special characters do not break `DATABASE_URL` or `REDIS_URL`.
- **Rotation:**
  1. Update `POSTGRES_PASSWORD` and/or `REDIS_PASSWORD` in `.env`.
  2. For Postgres (which only applies `POSTGRES_PASSWORD` on initial `initdb`), update the existing DB role first:
     ```bash
     set -a && . ./.env && set +a
     docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
       -c "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '$POSTGRES_PASSWORD';"
     ```
  3. Recreate containers so `api` and `cache` pick up the new credentials:
     ```bash
     docker compose up -d --force-recreate cache api
     ```
- **Production hardening:** Beyond single-host Compose, replace `.env` secrets with mounted secret files (e.g., `/run/secrets/*` with `POSTGRES_PASSWORD_FILE` and a secret manager) and terminate TLS before `proxy` (or add TLS server blocks in `nginx.conf`).

## 5. Rollback

Tag releases explicitly before deploying (`IMAGE_TAG=v1.2.3 docker compose build api`) so the prior image remains available.

1. **Application image rollback** (no rebuild required):
   ```bash
   IMAGE_TAG=<previous-tag> docker compose up -d --no-deps --no-build api
   ```
   Wait for `api` to become `healthy` and verify `curl -fsS "http://127.0.0.1:${PROXY_PORT:-80}/health"`. (`nginx.conf` re-resolves `api` via `127.0.0.11` every `10s`, so `proxy` picks up the new `api` container IP automatically.)
2. **Database schema rollback:** If the failed release applied a destructive or backward-incompatible migration, restore the pre-deploy backup (Section 3) **before** starting the previous `IMAGE_TAG`.
3. **Configuration rollback:** Restore `compose.yaml`, `nginx.conf`, or `Dockerfile` from the last known-good commit, run `docker compose config -q`, and apply with `docker compose up -d`.
