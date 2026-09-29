# Runbook

Single-host stack: nginx proxies a gunicorn API, which uses Postgres and Redis. Postgres data is the Docker volume `app_pgdata`. Redis is a cache with no volume; a restart drops its keys. The proxy is the only published port, bound to `127.0.0.1` and `${HTTP_PORT:-8080}`. Postgres and Redis are on the internal `data` network, which only the API shares with them. The proxy and the API share the `edge` network.

Compose applies restart policies, JSON-file log rotation (10 MB × 3 files per service), and cgroup CPU and memory limits on this one host. It does not place replicas, store secrets, or page anyone. The restart policy runs when a process exits. A container that stays up and fails its health check remains running and reports unhealthy.

| Service | Published on the host | CPU | Memory |
| --- | --- | --- | --- |
| proxy | 127.0.0.1:8080 → container port 80 | 0.25 | 128M |
| api | none | 1 | 512M |
| db | none | 1 | 1G |
| cache | none | 0.5 | 256M |

The API image loads WSGI app `app:app` unless `GUNICORN_APP` is set. `GET /healthz` must return HTTP 200 only when the app can use Postgres and Redis. Put that module in this directory before building. Until it is in the build context, the API process exits and restarts, and Compose waits to start the proxy until the API is healthy.

Gunicorn trusts `X-Forwarded-*` from any container that can reach port 5000 (`FORWARDED_ALLOW_IPS` defaults to `*`). That set is the proxy on `edge`, plus Postgres and Redis on `data`. The port is not published on the host. Nginx accepts a 1 MB body, spends at most 5 seconds opening the upstream connection, and waits 30 seconds to send the request and read the response. A larger body is JSON 413, an unreachable API is JSON 502, and an upstream timeout is JSON 504.

Run every command below from this directory. The Compose project name is `app`.

## Startup

```bash
cp .env.example .env
chmod 600 .env
```

Replace both `change-me` values with output from `openssl rand -hex 24`. Hex passwords stay intact inside `DATABASE_URL` and `REDIS_URL`. Optional knobs in the same file (`WEB_CONCURRENCY`, `GUNICORN_TIMEOUT`, `GUNICORN_APP`, `HTTP_PORT`) apply on the next start of the matching service.

```bash
docker compose up -d --build
docker compose ps
```

The first start creates `app_pgdata` and records `POSTGRES_PASSWORD` there. A later edit to `.env` does not change that role password; use Secret handling.

`pull_policy: missing` means a later `up` reuses images already on the host. To refresh them:

```bash
docker compose pull proxy db cache
docker compose build --pull api
docker compose up -d
```

`docker compose down` keeps `app_pgdata`. `docker compose down -v` deletes that volume.

## Health verification

```bash
docker compose ps
curl -fsS "http://127.0.0.1:8080/nginx-health"
curl -fsS "http://127.0.0.1:8080/healthz"
```

Use the `HTTP_PORT` value from `.env` when it is not 8080.

`docker compose ps` should list `db`, `cache`, `api`, and `proxy` as healthy.

- `/nginx-health` is answered by nginx itself and returns `ok`.
- `/healthz` is proxied to the API.
- Postgres is healthy after `SELECT 1` succeeds over TCP with `POSTGRES_USER` and `POSTGRES_PASSWORD`. The image's first-boot helper does not listen on TCP, so the check stays failed until the real server accepts clients.
- Redis is healthy after an authenticated `PING`.
- The API waits until Postgres and Redis are healthy. The proxy waits until the API is healthy, then calls `/healthz` through nginx.

When a check fails:

```bash
docker compose ps
docker compose logs --tail=100 db cache api proxy
```

## Backup and restore

Dumps contain the database. The `backups/` directory is gitignored. Keep the files on this machine and mode `600`.

```bash
mkdir -p backups
chmod 700 backups
stamp=$(date +%Y%m%d%H%M%S)
docker compose exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner' \
  > "backups/app-${stamp}.dump"
chmod 600 "backups/app-${stamp}.dump"
```

Restore replaces objects in the existing database. Stop the writers first. If `pg_restore` exits non-zero, leave the API stopped and read that output before starting it again.

```bash
docker compose stop proxy api
docker compose exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' \
  < "backups/app-STAMP.dump"
docker compose up -d
```

Then repeat the health checks. Redis is a cache and is left out of this dump.

For a stopped copy of the data directory, using the same `postgres:16-alpine` image:

```bash
stamp=$(date +%Y%m%d%H%M%S)
docker compose stop db
docker run --rm --entrypoint tar \
  -v app_pgdata:/var/lib/postgresql/data:ro \
  -v "$PWD/backups:/backups" \
  postgres:16-alpine \
  czf "/backups/pgdata-${stamp}.tgz" -C /var/lib/postgresql/data .
docker compose up -d db
```

To put that archive back, stop `db`, delete the current files in `app_pgdata`, and extract the archive. The image entrypoint corrects ownership on the next start.

```bash
docker compose stop db
docker run --rm --entrypoint sh \
  -v app_pgdata:/var/lib/postgresql/data \
  -v "$PWD/backups:/backups:ro" \
  postgres:16-alpine \
  -c 'find /var/lib/postgresql/data -mindepth 1 -delete && tar xzf /backups/pgdata-STAMP.tgz -C /var/lib/postgresql/data'
docker compose up -d
```

## Secret handling

Secrets are the `.env` file, mode `600`. `.env.example` holds placeholders only. `.gitignore` omits `.env` and dump files. `.dockerignore` omits `.env` from the API image build.

Compose rejects the project when `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, or `REDIS_PASSWORD` is empty. `DATABASE_URL` and `REDIS_URL` are assembled in `compose.yaml` from those variables and the hostnames `db` and `cache`.

`docker compose config` prints the resolved secrets. Do not save or forward that output. Anyone who can use the Docker socket can read container environment variables.

Rotate the database role while the current `db` container is still running, so its environment still holds the password Postgres already has:

```bash
docker compose exec -it db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

At the prompt, run `\password` and enter the new hex password twice. Write that same value into `.env`, then recreate the services that read it:

```bash
docker compose up -d --force-recreate db api
```

Rotate Redis by setting `REDIS_PASSWORD` in `.env` and recreating the cache. Cached keys are dropped.

```bash
docker compose up -d --force-recreate cache api
```

## Rollback

Before replacing a running API image, keep the current tag and a database dump:

```bash
docker tag app-api:local "app-api:$(date +%Y%m%d%H%M%S)"
```

Use the backup commands above for the dump. Deploy with:

```bash
docker compose up -d --build
```

To run an older image that is still present locally, set `APP_IMAGE_TAG` to that tag. `--no-build` keeps Compose from rebuilding the tag out of the current source:

```bash
APP_IMAGE_TAG=STAMP docker compose up -d --no-build api
docker compose up -d proxy
```

The shell assignment overrides `APP_IMAGE_TAG` from `.env` for that command. `app_pgdata` stays in place. If the release changed database contents, stop `proxy` and `api`, restore the pre-deploy dump, then run `docker compose up -d`. Confirm health with the checks above.
