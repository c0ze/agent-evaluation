# Runbook: API + nginx + Postgres + Redis (single-host Compose)

Run every command from this directory. Requires Docker Engine with Compose v2.

## Assumptions

- The app source sits next to the `Dockerfile` (it is not part of this directory's
  supplied files). It must expose a WSGI callable `app` in `app.py`; otherwise set
  `APP_MODULE=module:callable` in `.env`.
- The app serves `GET /healthz` returning 2xx. Ideally the handler runs `SELECT 1` and a
  Redis `PING` with short timeouts. **Without this endpoint `api` never turns healthy and
  `proxy` never starts.**
- Redis is a disposable cache (no persistence, 128 MB, LRU eviction).
- Compose here means one host: a crashed container is restarted, but there is no failover,
  no rescheduling, and a recreate of `api` or `proxy` is a few seconds of downtime.
  An **unhealthy** container is *not* restarted by Docker, so something must watch
  `docker compose ps` (or the `/healthz` URL) and alert.
- TLS is not included. Terminate it in front of `proxy` (cloud LB, Caddy, etc.) before
  exposing this to the internet.

## Startup

```sh
cp .env.example .env
sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|; \
            s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(openssl rand -hex 24)|" .env && rm .env.bak
chmod 600 .env

docker compose build
docker compose up -d
```

Order is enforced by health: `db` and `cache` healthy, then `api`, then `proxy`.
Compose refuses to start with a clear message if either password is empty.
Default URL is `http://127.0.0.1:8080` (loopback only). For a real host set
`PROXY_BIND=0.0.0.0` and `PROXY_PORT=80` in `.env`.

## Health verification

```sh
docker compose ps                                   # every service: (healthy)
curl -fsS -i http://127.0.0.1:8080/healthz          # 200 through nginx to the app
docker compose exec db pg_isready -h 127.0.0.1      # accepting connections
docker compose exec cache redis-cli ping            # PONG
docker compose logs --tail=50 proxy api             # access + error logs (stdout/stderr)
```

Confirm nothing but nginx is reachable from the host:

```sh
docker compose ps --format '{{.Service}}\t{{.Ports}}'   # only proxy shows a host port
ss -ltn | grep -E ':(5432|6379|8000)\b' || echo "no db/cache/api ports on host"
```

## Backup and restore (Postgres)

Backup (custom format, compressed, restorable selectively). Run before every deploy and on
a schedule (cron or a systemd timer wrapping the snippet below), and copy dumps **off this
host**.

```sh
mkdir -p backups
f=backups/app-$(date +%Y%m%d-%H%M%S).dump
( umask 077; docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$f" )
test -s "$f" && docker compose exec -T db pg_restore --list < "$f" | head -5   # sanity check
```

Rehearse a restore into a scratch database (do this regularly; an untested backup is a hope):

```sh
docker compose exec db sh -c 'createdb -U "$POSTGRES_USER" restore_test'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d restore_test --no-owner' < "$f"
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d restore_test -c "\dt"'
docker compose exec db sh -c 'dropdb -U "$POSTGRES_USER" restore_test'
```

Restore over the live database (destructive; replaces current data with the dump):

```sh
docker compose stop proxy api
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction --clean --if-exists --no-owner' \
  < backups/app-YYYYMMDD-HHMMSS.dump
docker compose up -d
```

`--single-transaction` makes it all-or-nothing. Data lives in the named volume
`apistack_pgdata`. **`docker compose down -v` deletes it**; never use `-v` on a real host.
Redis is not backed up by design.

## Secret handling

- Secrets live only in `.env` (mode 600, git-ignored, docker-ignored so it cannot be copied
  into an image). `.env.example` holds names and empty values, never real secrets.
- Generate with `openssl rand -hex 24` (hex keeps them URL-safe for `DATABASE_URL` and
  `REDIS_URL`).
- `docker compose config` and `docker inspect` print resolved secrets. Do not paste their
  output into tickets or chat, and treat Docker socket access as access to the secrets.
- Rotate Redis: edit `REDIS_PASSWORD`, then `docker compose up -d` (cache restarts empty,
  which is fine for a cache).
- Rotate Postgres: the password is applied only when the volume is first initialised, so
  editing `.env` alone breaks `api`. Run
  `docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`, use
  `\password`, then update `.env` and `docker compose up -d`.
- If a secret was ever committed, pasted, or logged, rotate it immediately.
- Later step up: Docker/Compose `secrets:` with `*_FILE`, or an external secret manager.

## Rollback

Application image (tagged per release through `API_TAG`):

```sh
# deploy: take a backup first, note the current tag, then
sed -i.bak 's/^API_TAG=.*/API_TAG=2026-09-29a/' .env && rm .env.bak
docker compose build api && docker compose up -d --no-deps api

# roll back: set API_TAG back to the previous tag (kept locally as an image)
sed -i.bak 's/^API_TAG=.*/API_TAG=<previous-tag>/' .env && rm .env.bak
docker compose up -d --no-deps --no-build api    # fails loudly if that tag is gone
```

Do not `docker image prune -a` between releases or the previous tag disappears.

If the release included a database migration that the old code cannot run against, rolling
back the image is not enough. Restore the pre-deploy dump (see above); writes made since the
backup are lost.

Config files (`nginx.conf`, `compose.yaml`): `git checkout <good-commit> -- nginx.conf
compose.yaml`, then

```sh
docker compose run --rm --no-deps proxy nginx -t    # validate first
docker compose up -d
docker compose restart proxy                        # single-file bind mount: a replaced file
                                                    # is only seen after a restart, not a reload
```

Postgres major upgrades are not a tag bump. Dump, start the new major on a new volume,
restore, verify, then switch. Keep the old volume until verified.
