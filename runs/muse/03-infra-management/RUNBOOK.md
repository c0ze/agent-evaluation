# Runbook — small Python API behind nginx (Compose)

Stack: `proxy` (nginx) → `api` (gunicorn/Flask) → `db` (Postgres 16),
`cache` (Redis 7, ephemeral). Single-host Compose deployment.

## Assumptions

- The API entrypoint is `app.py` exposing Flask object `app`, and it serves
  `GET /healthz` with HTTP 200 when ready (also after DB/Redis checks pass).
- A `.env` file exists (see "Startup"). `DATABASE_URL`/`REDIS_URL` are built
  by Compose; only Postgres credentials and the nginx host port are set.

## Startup

1. `cp .env.example .env`, then set a strong `POSTGRES_PASSWORD` in `.env`.
2. `docker compose up -d --build`
3. `docker compose ps` — every service should reach `(healthy)`.
4. `curl -f http://localhost:<NGINX_HTTP_PORT>/healthz` should return 200.

Stop: `docker compose stop`. Full teardown (containers + networks, data kept
in the `pgdata` volume): `docker compose down`.

## Health verification

- `docker compose ps` shows per-service health status.
- Proxy itself: `curl -f http://localhost:<NGINX_HTTP_PORT>/nginx-health`
- End to end: `curl -f http://localhost:<NGINX_HTTP_PORT>/healthz`
- Postgres: `docker compose exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
  (load `.env` into the shell first, or substitute values literally).
- Redis: `docker compose exec cache redis-cli ping` (expect `PONG`).
- Logs: `docker compose logs --tail=100 <service>`.

Startup order is health-gated: `api` waits for `db` and `cache` to be
healthy; `proxy` waits for `api`. A service stuck in `(unhealthy)` blocks
its dependents — inspect its logs before restarting anything.

## Backup / restore

Postgres data lives in the named volume `pgdata` and survives `down` and
container recreation. It is deleted only by `docker compose down -v`.

- Logical backup: `docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > backup-$(date +%F).sql`
- Restore to a running stack: `cat backup.sql | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
- Volume-level backup (stack stopped): `docker run --rm -v <project>_pgdata:/data -v "$PWD:/out" alpine tar czf /out/pgdata-$(date +%F).tgz -C /data .`
- Verify a backup by restoring into a scratch database and running a smoke
  query; never treat an unrestored dump as a verified backup.

Redis is a cache with no volume: nothing to back up. It starts empty after
recreation by design.

## Secret handling

- Secrets live only in `.env` (mode `600`, never committed). No credentials
  are hardcoded in `compose.yaml`, `Dockerfile`, or `nginx.conf`.
- `.dockerignore` excludes `.env` so secrets are never baked into image
  layers via `COPY . .`.
- Rotate the Postgres password: update `.env`, then
  `docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '<new>'"` and
  `docker compose up -d api` to pick up the new `DATABASE_URL`.
  A restart of `db` is not needed for the password change itself.
- Treat any credential once committed to git as compromised: rotate it.

## Rollback

1. Identify the last good state: `docker compose config` (current rendered
   config) and your git history for these files.
2. Code/config rollback: `git stash` or `git checkout -- <files>` to the last
   good commit, then `docker compose up -d --build`.
3. Data rollback: restore a `pg_dump` backup as above. Note restores lose
   writes made after the backup; there is no point-in-time recovery here.
4. Verify with the health checks above before declaring the rollback done.

## What Compose does not do

This is one host with local restart policies and log rotation — not a full
orchestrator. There is no multi-host failover, rolling deploys, autoscaling,
or secret store. `deploy.resources.limits` documents intent and caps local
usage; reservations need Swarm/Kubernetes semantics. Plan a migration before
those properties are required.
