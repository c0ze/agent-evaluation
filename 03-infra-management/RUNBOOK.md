# RUNBOOK — appstack (nginx + Flask API + Postgres + Redis)

Compose is used here as a single-host convenience, not an orchestrator. There is
no automatic failover, rolling update, or self-healing beyond `restart:
unless-stopped`; plan maintenance accordingly.

## Prerequisites

- Docker Engine with the Compose v2 plugin (`docker compose version`).
- Application code exposing:
  - a WSGI entrypoint `app:app` (adjust the gunicorn CMD in the `Dockerfile` if
    different);
  - `GET /health` returning HTTP 200 when the app (and its DB/cache
    connections) are usable — required by the API health check.

## Startup

1. Create the environment file and set a strong password:
   ```sh
   cp .env.example .env
   # edit .env; e.g. POSTGRES_PASSWORD=$(openssl rand -base64 32)
   ```
2. Build and start:
   ```sh
   docker compose build
   docker compose up -d
   ```
   Postgres and Redis become healthy first; the API starts only after both are
   healthy, and the proxy starts only after the API is healthy.
3. The API is available at `http://<host>/` (port 80 via nginx only).

## Health verification

```sh
docker compose ps                 # all services should show "(healthy)"
curl -fsS http://localhost/healthz   # nginx liveness, returns "ok"
curl -fsS http://localhost/health    # end-to-end check through proxy -> API
docker compose logs --tail=50 api    # inspect on failure
docker inspect --format='{{json .State.Health}}' appstack-api-1 | jq
```

If the API health check fails, confirm the app serves `/health` on port 8000
and that `DATABASE_URL`/`REDIS_URL` resolve (db/cache healthy first).

## Backup and restore (Postgres)

Data lives in the named volume `db-data`. Back up the logical database, not the
raw volume, while the service is running:

```sh
# Backup
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --format=custom --file=/tmp/backup.dump
docker compose cp db:/tmp/backup.dump ./backup-$(date +%Y%m%d%H%M%S).dump

# Restore (into a running, healthy db)
docker compose cp ./backup-YYYYMMDDhhmmss.dump db:/tmp/restore.dump
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists /tmp/restore.dump
```

Export `POSTGRES_USER`/`POSTGRES_DB` from `.env` first (`set -a; . ./.env; set +a`).
Store backups outside the host and test restores periodically. Redis here is a
cache and is intentionally not backed up; if it ever holds durable data, enable
AOF/RDB persistence and back up the dump file too.

## Secret handling

- The only secret is `POSTGRES_PASSWORD`, supplied via `.env` (git-ignored;
  `.env.example` contains placeholders only). Compose injects it into `db` and
  builds `DATABASE_URL` for the API at runtime — no credentials in images,
  `compose.yaml`, or the repository.
- Restrict permissions: `chmod 600 .env`.
- Rotate by changing the password in `.env`, then:
  `docker compose up -d db api` (update the role password first if the volume
  already exists: `ALTER ROLE app WITH PASSWORD '...';` — the
  `POSTGRES_PASSWORD` env var only applies on first initialization of a fresh
  volume).
- For multi-host/production use, move secrets to Docker secrets or an external
  secret manager instead of a plain env file.

## Rollback

- Config/image rollback: keep changes in version control. Check out the
  previous revision of `Dockerfile`, `compose.yaml`, and `nginx.conf`, then:
  ```sh
  docker compose build api
  docker compose up -d
  ```
  The API image is tagged `appstack-api:local`; to redeploy the exact previous
  image without rebuilding, tag images per release (e.g.
  `docker tag appstack-api:local appstack-api:$(git rev-parse --short HEAD)`)
  and pin the tag in an override file.
- Database rollback: restore the most recent backup as above. Note that
  restoring a backup discards writes made after it; take a fresh backup before
  any risky migration.
- To stop everything without deleting data: `docker compose down`. Data is
  preserved in the `db-data` volume; only `docker compose down -v` deletes it
  (destructive — never run unless you intend to wipe the database).

## Operational notes

- Resource limits (`deploy.resources.limits`) are best-effort guardrails under
  plain Compose, not guarantees.
- Logs use the `json-file` driver capped at 10 MB × 3 files per service; for
  long-term log retention ship them to an external collector.
- Only port 80 is published on the host. Postgres (5432) and Redis (6379) are
  reachable solely on the internal `backend` network.
