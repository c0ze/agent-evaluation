# Runbook

## Start and verify

The API image expects a Flask WSGI target in `APP_MODULE` (default `app:app`)
and a fast `GET /healthz` route that returns HTTP 200 when the API is ready.
The supplied directory has no API source, so provide that module and route in
the application before expecting the API container to become healthy.

1. Copy `.env.example` to `.env`. Replace `POSTGRES_PASSWORD` with the output
   of `openssl rand -hex 32`; hexadecimal keeps the value safe inside the
   generated `DATABASE_URL`. Keep the other settings appropriate for the
   deployment.
2. Start the stack with `docker compose up -d --build`.
3. Check `docker compose ps` for healthy services, then verify nginx and the
   proxied API with `curl -fsS http://localhost:8080/_nginx_health` and
   `curl -fsS http://localhost:8080/healthz`. If `HTTP_PORT` was changed, use
   that port. Inspect failures with `docker compose logs --tail=100 api db
   cache proxy`.

Only nginx is published to the host. The API is reachable by nginx over the
`edge` network, while Postgres and Redis are reachable by the API over the
internal `backend` network. Redis is a volatile cache and is not backed up.
Compose health checks gate startup order; they do not provide orchestration,
traffic failover, or automatic recovery from application-level failures.

## Backup and restore

Make and protect a custom-format Postgres backup before upgrades or data
changes. Store backups outside the project directory and encrypt them when
they leave the host:

```sh
umask 077
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /secure/backups/backup-$(date +%F).dump
```

To restore, stop API writes, then restore the selected dump into the configured
database. This replaces objects present in the archive; confirm the target and
retain a separate pre-restore backup first.

```sh
docker compose stop api
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /secure/backups/backup-YYYY-MM-DD.dump
docker compose up -d api proxy
docker compose ps
```

The named `pgdata` volume survives `docker compose down`; `docker compose down
-v` removes it and must not be used when the database should be retained.

## Secrets

Keep `.env` local and out of version control. It is excluded from this
directory's Git and Docker build contexts; commit only `.env.example`. Do not
put real values in Compose files or logs. Compose passes the database password
as a container environment variable, which is visible to administrators of the
Docker host. For production, source it from an approved secret manager and
adapt the API to consume mounted secrets if the deployment requires them.
Changing `POSTGRES_PASSWORD` in `.env` does not rotate the role password in an
already-initialized data volume; rotate the database role and API secret
together.

## Rollback

Keep the last known-good application and configuration revision plus a
pre-deployment database dump. To roll back, check out that revision and run
`docker compose up -d --build`, then verify the health checks and API. Do not
remove the Postgres volume. If a schema change is incompatible with the old
application, stop writes and restore the pre-deployment dump before bringing
the old API back up. Compose restart policies restart failed containers but
do not roll out versions or undo schema changes.
