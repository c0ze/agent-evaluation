# Runbook: API stack (nginx, gunicorn/Flask, Postgres, Redis)

Single host, Docker Compose v2. Only `proxy` publishes a port, by default on
`127.0.0.1:8080`. `db` and `cache` sit on the `backend` network, which is
marked `internal` and has no published ports.

Compose restarts containers that crash (`restart: unless-stopped`) and starts
them in health order. It does **not** restart containers that become
*unhealthy*, do rolling updates, or fail over between hosts. Those jobs belong
to an operator or to monitoring.

## 1. Startup

Prerequisites: the app must serve `GET /healthz` and return 200 (a cheap
liveness check with no DB call), and `APP_MODULE` must point at the WSGI
callable.

```sh
cp .env.example .env && chmod 600 .env
# Replace every change-me value. Use URL-safe secrets:
openssl rand -hex 32            # run once per password

docker compose config -q        # fails if a required secret is missing
docker compose build --pull
docker compose up -d
docker compose ps               # every service should reach "healthy"
```

Startup order is enforced by health: `db` and `cache` become healthy, then
`api`, then `proxy`. On first start Postgres initialises the `pgdata` volume
from `POSTGRES_*`. Those variables are ignored on every later start.

Stop with `docker compose down`, which keeps data. **Never** run
`down -v` unless you mean to delete the database volume.

## 2. Health verification

```sh
docker compose ps                                    # STATUS column shows (healthy)
curl -fsS http://127.0.0.1:8080/nginx-health         # nginx itself
curl -fsS http://127.0.0.1:8080/healthz              # end to end through the proxy to the API
docker compose exec db sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec cache sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
docker inspect --format '{{json .State.Health}}' "$(docker compose ps -q api)"   # last check output
docker compose logs --tail=100 api proxy
```

If a service shows `unhealthy`, read its logs and the `State.Health` output,
then run `docker compose restart <service>` yourself. Compose will not restart
it for you. A 503 body `{"error":"service_unavailable"}` means nginx could not
reach the API or timed out after 35s.

Logs use the `json-file` driver capped at 5 x 10 MB per container. Ship them
elsewhere if you need longer retention.

## 3. Backup and restore (Postgres)

Redis runs as a pure cache (no persistence) and needs no backup.

**Backup** (logical, custom format, consistent without stopping the app):

```sh
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/app-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db pg_restore --list < backups/<file>.dump > /dev/null && echo OK
```

Copy the dumps off the host (they contain all application data), encrypt them
at rest, and schedule the backup with cron or a systemd timer. Test a restore
into a scratch database on a regular schedule.

**Restore** (this overwrites the current data, so take a fresh backup first):

```sh
docker compose stop proxy api                 # stop writers
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' \
  < backups/<file>.dump
docker compose start api proxy
curl -fsS http://127.0.0.1:8080/healthz
```

**Postgres major upgrades** (for example 17 to 18) need a dump and restore into
a new volume. The `postgres:18` image also moves the data mount to
`/var/lib/postgresql`. Never change the major version tag on an existing volume.

## 4. Secret handling

- Secrets live only in `.env` (mode 600, listed in `.gitignore`).
  `.dockerignore` keeps `.env` out of the image build context. Nothing is
  hard-coded in `compose.yaml`, and `${VAR:?}` makes Compose refuse to start
  when a secret is missing.
- Passwords are placed into `DATABASE_URL` and `REDIS_URL`, so they must be
  URL-safe. Use hex output from `openssl rand -hex 32`.
- Anyone who can run `docker inspect` or `docker compose config` can read these
  values. Docker access is equivalent to root, so limit the `docker` group.
  For stricter handling, move to Compose `secrets:` with `POSTGRES_PASSWORD_FILE`
  and have the app read its password from a file.
- **Rotate the Postgres password.** `POSTGRES_PASSWORD` only applies at first
  init, so change the role password in the database too:
  ```sh
  docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\password $POSTGRES_USER"'
  # then update POSTGRES_PASSWORD in .env to match and recreate dependants:
  docker compose up -d --force-recreate db api
  ```
- **Rotate the Redis password.** Update `REDIS_PASSWORD` in `.env`, then run
  `docker compose up -d --force-recreate cache api`. The cache contents are
  lost, which is expected.
- If a secret leaks, rotate it immediately and check the Postgres logs for
  unexpected connections.

## 5. Deploy and rollback

Tag every API build with a release identifier so the previous image stays
available locally:

```sh
git rev-parse --short HEAD                    # e.g. 1a2b3c4
API_TAG=1a2b3c4 docker compose build api
API_TAG=1a2b3c4 docker compose up -d --no-deps api   # then persist API_TAG in .env
curl -fsS http://127.0.0.1:8080/healthz
```

The API is recreated in place, so expect a few seconds of 503s. nginx
re-resolves `api` through Docker DNS and needs no restart.

**Roll back the application:** set `API_TAG` back to the last known-good tag in
`.env`, then run `docker compose up -d --no-build --no-deps api`. Do not prune
old images until the new release has proved itself.

**Roll back configuration** (`compose.yaml`, `nginx.conf`, `.env`): run
`git checkout <good-rev> -- <file>` and then `docker compose up -d`. After an
nginx-only change you can reload instead:
`docker compose exec proxy nginx -t && docker compose exec proxy nginx -s reload`.

**Database changes:** keep migrations backward-compatible (expand, then
contract) so the previous image still works against the new schema. If a
migration cannot be undone, the rollback is a restore from the backup taken
just before the deploy (section 3). Always take one before migrating.
