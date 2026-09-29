# RUNBOOK — Python API + nginx + Postgres + Redis (Compose)

Prerequisite: the API image serves a `/healthz` endpoint (200 OK) and reads
`DATABASE_URL` / `REDIS_URL` from the environment.

## 1. Startup

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, REDIS_PASSWORD (32+ random chars),
# and matching DATABASE_URL / REDIS_URL.
docker compose up -d --build
docker compose ps
```

Startup order is enforced by health-gated `depends_on`:
`db`/`cache` healthy → `api` starts → `proxy` starts once `api` is healthy.

## 2. Health verification

```bash
curl -i http://localhost/healthz          # via nginx; expect 200
docker compose ps                          # all services "healthy" / "running"
docker inspect --format='{{.State.Health.Status}}' infra-management-api-1
docker compose logs --tail=50 api proxy db cache
```

If `api` never becomes healthy: check `docker compose logs api` (bad
`DATABASE_URL`/`REDIS_URL`, missing `/healthz` route) and
`docker compose exec db pg_isready` / cache auth.

## 3. Backup / restore

Postgres lives in the `postgres_data` named volume; Redis AOF in `redis_data`.

```bash
# Postgres logical backup (no host port exposed; run via the db container)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql

# Restore to a fresh volume
docker compose down
docker volume rm infra-management_postgres_data   # actual name from `docker volume ls`
docker compose up -d db
sleep 10
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < backup-YYYY-MM-DD.sql
docker compose up -d
```

Verify after restore: `docker compose exec db psql -U "$POSTGRES_USER" -c '\dt'`
and the `/healthz` check above. Redis AOF persists automatically; treat it as
cache (rebuildable), not a backup source.

## 4. Secret handling

- Secrets live only in `.env` (loaded via `env_file`). `.env` is git-ignored
  (see `.dockerignore`); only `.env.example` with placeholders is committed.
- Compose fails fast (`:?` guards) if a required variable is unset.
- Rotate: `docker compose down`, edit `.env`, `docker compose up -d`.
  Note: changing `POSTGRES_PASSWORD` after init does not rewrite the
  already-initialized data volume — rotate via dump / fresh volume / restore.
- Redis requires `REDIS_PASSWORD`; `REDIS_URL` must embed the same value.

## 5. Rollback

Each deploy is `docker compose up -d --build`:

```bash
docker compose up -d --build   # roll forward with previous image tag/commit
docker compose ps              # confirm healthy
# If broken:
git log --oneline -5           # find last good commit
git checkout <good-sha> -- .   # or `git revert`
docker compose up -d --build
```

No persistent app state lives in the `api` container, so rollback is a
rebuild + restart. Postgres data survives (named volume) unless explicitly
removed; take a `pg_dump` before risky migrations. Compose `deploy.resources`
limits and `restart: unless-stopped` are best-effort guards — Compose is not
a full orchestrator (no autoscaling, rolling updates, or multi-host failover).
