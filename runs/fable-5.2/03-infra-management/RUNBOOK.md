# Runbook — API stack (nginx → API → Postgres + Redis)

Single host, Docker Compose. Run every command from this directory.
Only nginx is reachable from the host; the API, Postgres and Redis have no
published ports.

## 1. Startup

First time on a host:

```sh
cp .env.example .env && chmod 600 .env
# Fill in POSTGRES_PASSWORD and REDIS_PASSWORD, each from:
openssl rand -hex 24
```

Start (or apply any change to `.env` / `compose.yaml`):

```sh
docker compose config -q          # fails with a clear message if a value is missing
docker compose up -d --build --wait
```

`--wait` returns once every service reports healthy. Order is enforced by
health: db and cache → api → proxy.

If it ends with `dependency failed to start: container ... is unhealthy`,
read `docker compose logs api`. The two usual causes are settings that depend
on the application:

| Setting | Default | Where |
|---|---|---|
| WSGI entry point (`module:callable`) | `app:app` | `WSGI_APP` in `.env` |
| Health endpoint (must return 200) | `/healthz` | `API_HEALTHCHECK_PATH` in `.env` |

Stop without losing data: `docker compose down`.
**Never** add `-v` unless you intend to delete the database volume.

## 2. Health verification

```sh
docker compose ps                                   # all four services "healthy"
curl -fsS http://127.0.0.1:8080/nginx-health        # proxy alone → ok
curl -fsS -i http://127.0.0.1:8080/healthz          # proxy → API → 200
docker compose exec db sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec cache redis-cli ping            # PONG
```

Adjust host and port if `HTTP_BIND` / `HTTP_PORT` differ from the defaults.

Confirm nothing but the proxy is exposed (expect no output):

```sh
ss -ltn | grep -E ':(5000|5432|6379)\b'
```

Logs: `docker compose logs -f --tail=100 <service>`. nginx writes one JSON
line per request; its `request_id` is sent to the API as `X-Request-ID` and
returned to the client. Logs rotate at 5 × 10 MB per service, so ship them
elsewhere if you need history.

## 3. Backup and restore

Postgres is the only durable state (volume `api-stack_pgdata`). Redis is
configured as a cache and is not backed up.

Backup (safe while the stack is running):

```sh
mkdir -p backups && chmod 700 backups
f=backups/app-$(date -u +%Y%m%dT%H%M%SZ).dump
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$f"
docker compose exec -T db pg_restore --list < "$f" | head     # readable archive?
```

Nothing schedules this for you: run it from host cron and copy the files off
the host. `backups/` is ignored by git and excluded from the image.

Restore (replaces the whole database; take a fresh backup first if the
current data has any value):

```sh
docker compose stop proxy api
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < backups/<file>.dump
docker compose up -d --wait
```

A backup is only proven by restoring it. Periodically restore the latest dump
into a scratch database (`createdb restore_test`, `pg_restore -d restore_test`,
check a few tables, `dropdb restore_test`).

## 4. Secret handling

- Secrets live only in `.env` on the host (mode 600, ignored by git, excluded
  from the image by `.dockerignore`). `compose.yaml` holds none and refuses to
  start if one is missing.
- Use hex or alphanumeric values: they are embedded in connection URLs.
- They reach containers as environment variables, and the Redis password also
  as a process argument, so anyone with Docker access on the host can read
  them. Treat membership of the `docker` group as access to the secrets.
- Keep `docker compose config` output out of tickets and chat; it prints the
  resolved values.

Rotate the Postgres password (`POSTGRES_PASSWORD` in `.env` is only applied
when the volume is first initialised, so change it in the database first):

```sh
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\password"'
# put the same value in .env, then:
docker compose up -d --wait
```

Rotate the Redis password: change `REDIS_PASSWORD` in `.env`, then
`docker compose up -d --wait`. The cache restarts empty.

## 5. Deploy and rollback

Deploy a new API version. Note the current `API_TAG` first — that is the
rollback target.

```sh
grep '^API_TAG=' .env                 # write this down
# set API_TAG=<new release id, e.g. git short SHA> in .env
docker compose up -d --build --wait
```

Roll back the API:

```sh
# set API_TAG=<previous value> in .env
docker image ls api-stack/api         # the previous tag must still be present
docker compose up -d --no-build --wait
```

Do not prune images until a release has proven itself; with no registry, a
pruned tag can only be recovered by rebuilding from the old commit.

Roll back configuration (`compose.yaml`, `nginx.conf`): restore the previous
version of the file from git, then

```sh
docker compose config -q
docker compose run --rm --no-deps proxy nginx -t    # only if nginx.conf changed
docker compose up -d --wait
docker compose restart proxy                        # only if nginx.conf changed
```

Compose does not notice edits to the mounted `nginx.conf`; the restart is what
loads it.

Database: rolling back the image does not undo schema or data changes. Take a
backup (section 3) before any deploy that migrates the schema, and restore it
if the old code cannot run against the new schema. Changing the Postgres major
version (the `postgres:17-alpine` tag) is a dump-and-restore migration, not a
tag edit, in either direction.

## 6. Moving from the previous compose file

The old file ran under a different project name, published 80/5000/5432/6379
and kept Postgres data in an anonymous volume as user `admin`. Before first
start of this version: dump the old database if it holds anything worth
keeping (`pg_dump` as in section 3, with `-U admin`), run
`docker compose down` with the old file, then start this stack and restore.
