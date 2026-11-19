# Operations Runbook

This runbook covers single-host Docker Compose operation for the hardened `proxy` (nginx) -> `api` (Flask/Gunicorn) -> `db` (PostgreSQL) + `cache` (Redis) stack.

> **Operational scope:** Docker Compose is a single-host runner, not a multi-node orchestrator. Container recreates incur brief downtime, and there is no automatic cross-host failover. For production internet traffic, place this stack behind a TLS-terminating reverse proxy or load balancer (enabling HTTPS, HSTS, and `set_real_ip_from` / trusted `X-Forwarded-Proto` forwarding).

## Architecture Summary

- **Exposed port:** Only `proxy` publishes a host port (`${HTTP_BIND:-127.0.0.1}:${HTTP_PORT:-8080}` -> container `8080`). `api`, `db`, and `cache` publish no host ports.
- **Networks:**
  - `frontend`: connects `proxy` and `api` only (`proxy` cannot reach `db` or `cache`).
  - `backend` (`internal: true`): connects `api`, `db`, and `cache` with no external routing.
- **State:** PostgreSQL persists data in the named volume `postgres_data`. Redis runs as a bounded, volatile LRU cache (`128mb`, persistence disabled).
- **Application expectations:** The API image serves WSGI entrypoint `app:app` via Gunicorn on port `5000` and exposes `GET /health` returning HTTP `200` when ready.

---

## 1. Startup

1. Create `.env` from `.env.example` and restrict its permissions:
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```
2. Generate strong, URL-safe secrets (alphanumeric plus `-_.~`, because `POSTGRES_PASSWORD` and `REDIS_PASSWORD` are interpolated into connection URIs) and set them in `.env`:
   ```bash
   openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
   ```
3. Validate Compose configuration and variable interpolation before starting:
   ```bash
   docker compose config --quiet
   ```
   Compose refuses to start if `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, or `REDIS_PASSWORD` is unset or empty.
4. Build and start the stack:
   ```bash
   docker compose up -d --build
   ```
   Startup order is enforced by health checks: `db` and `cache` must become `healthy` before `api` starts, and `api` must become `healthy` before `proxy` starts.

---

## 2. Health Verification

1. Confirm all four services are running and report `(healthy)`:
   ```bash
   docker compose ps
   ```
2. If a service is unhealthy or still starting, inspect its health check output and recent logs:
   ```bash
   docker compose logs --tail=50 proxy api db cache
   docker inspect --format='{{json .State.Health}}' "$(docker compose ps -q api)"
   ```
3. Verify end-to-end routing and response headers through `proxy`:
   ```bash
   curl -fsSi "http://${HTTP_BIND:-127.0.0.1}:${HTTP_PORT:-8080}/health"
   ```
   Confirm HTTP `200`, `X-Request-ID`, security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`), and no nginx version in the `Server` header.
4. Confirm internal-only services have no published host ports:
   ```bash
   docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
   ```
   Only `proxy` should list a host port mapping.

---

## 3. Backup and Restore (PostgreSQL)

PostgreSQL (`postgres_data`) is the persistent store. Redis is a volatile cache and does not require backup.

### Backup

Stream a compressed custom-format dump to a private host directory (store encrypted copies off-host and never commit dumps to git):

```bash
mkdir -p backups && chmod 700 backups
set -a && source .env && set +a
BACKUP_FILE="backups/pg_${POSTGRES_DB}_$(date -u +%Y%m%dT%H%M%SZ).dump"

(umask 077 && docker compose exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc \
  --no-owner \
  --no-privileges > "$BACKUP_FILE")
```

Verify the backup archive is readable and non-empty:

```bash
docker compose exec -T db pg_restore --list < "$BACKUP_FILE" | head -n 20
```

### Restore

1. Stop `api` to halt application writes (keep `db` running):
   ```bash
   docker compose stop api
   ```
2. Take a safety backup of the current database state (using the Backup command above) before overwriting.
3. Restore the target dump into `db`:
   ```bash
   set -a && source .env && set +a
   docker compose exec -T db pg_restore \
     -U "$POSTGRES_USER" \
     -d "$POSTGRES_DB" \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --single-transaction < "$BACKUP_FILE"
   ```
4. Flush Redis so stale cached entries cannot contradict restored database rows:
   ```bash
   docker compose exec cache redis-cli FLUSHALL
   ```
5. Restart `api` and verify stack health:
   ```bash
   docker compose start api
   docker compose ps
   ```

Test restores periodically into a separate scratch database to verify backup usability.

---

## 4. Secret Handling

- **Local files:** Keep `.env` untracked in git and mode `600`. `.dockerignore` excludes `.env*` so secrets are never baked into the API image.
- **Production secrets:** On a production host, avoid long-lived plaintext `.env` files where possible—inject credentials from a secret manager into the deployment environment or switch to file-based Docker secrets (`POSTGRES_PASSWORD_FILE` and mounted read-only secret files).
- **Avoid leaking secrets in logs/history:** Never pass passwords on CLI flags (e.g., `redis-cli -a ...`); `cache` uses `REDISCLI_AUTH` from container environment instead.
- **Rotating the PostgreSQL password:** `POSTGRES_PASSWORD` is only read by Postgres during initial volume creation (`initdb`). To rotate an existing database:
  1. Update the role password inside Postgres first:
     ```bash
     set -a && source .env && set +a
     docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
       -v new_pw="'<NEW_URL_SAFE_PASSWORD>'" \
       -c "ALTER ROLE \"$POSTGRES_USER\" WITH PASSWORD :new_pw;"
     ```
  2. Update `POSTGRES_PASSWORD` in `.env`.
  3. Recreate `api` and `db` so container environments match:
     ```bash
     docker compose up -d db api
     ```
- **Rotating the Redis password:** Update `REDIS_PASSWORD` in `.env`, then recreate `cache` and `api`:
  ```bash
  docker compose up -d cache api
  ```

---

## 5. Deployment and Rollback

### Tagging Releases

Build and tag each release with an immutable version or git SHA so prior images remain available for rollback:

```bash
API_TAG="$(git rev-parse --short HEAD)" docker compose build api
```

Update `API_TAG` in `.env` (or pass it in the environment), take a pre-deploy Postgres backup before any schema migration, and deploy:

```bash
docker compose up -d --no-build api
docker compose exec proxy nginx -s reload
docker compose ps
```

*(Reloading `proxy` refreshes nginx's upstream DNS cache if `api` received a new bridge IP on recreate.)*

### Rolling Back the API Image

1. Set `API_TAG` in `.env` to the last known-good tag (check available local images with `docker images "${API_IMAGE:-app-api}"`).
2. Recreate `api` without rebuilding and reload `proxy`:
   ```bash
   docker compose up -d --no-build --force-recreate api
   docker compose exec proxy nginx -s reload
   ```
3. Verify health (`docker compose ps` and `curl -fsS http://127.0.0.1:8080/health`).

### Rolling Back Configuration (`compose.yaml` / `nginx.conf`)

1. Restore the previous known-good revision from git:
   ```bash
   git checkout <good-commit> -- compose.yaml nginx.conf
   ```
2. Validate and re-apply:
   ```bash
   docker compose config --quiet
   docker compose up -d
   ```

### Database Migration Rollback

Prefer backward-compatible (expand/contract) schema changes so rolling back the API does not require downgrading the database. If an irreversible migration must be undone, follow the **Restore** procedure above using the pre-deploy backup.
