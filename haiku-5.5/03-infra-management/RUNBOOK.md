# RUNBOOK: API stack (nginx → API → Postgres, Redis)

Single-host Docker Compose stack. Only nginx is reachable, and only on `127.0.0.1:${HTTP_PORT}` (default 8080). Postgres and Redis have no host ports and live on an internal network.

Run every command from this directory.

## Assumptions about the application

The directory contains no application code. Confirm these before the first start:

- `app.py` (or another importable module) exposes a WSGI object named `app`. The image runs `gunicorn ... app:app`.
- The app reads `DATABASE_URL` and `REDIS_URL` from the environment.
- The app listens on port 5000.
- `GET /healthz` returns 2xx only when the app can serve traffic (ideally after checking Postgres and Redis) and a non-2xx status otherwise. The API healthcheck and the startup ordering depend on this.
- The app does not need schema migrations to run at startup. If it does, run them as a one-off step before the first start: `docker compose run --rm api <migrate command>`.

## 1. Startup

Prerequisites: Docker Engine with Compose v2 (`docker compose version`) and `openssl`.

```sh
cp .env.example .env
chmod 600 .env
```

Edit `.env` and set `POSTGRES_PASSWORD` and `REDIS_PASSWORD`. Generate each one with:

```sh
openssl rand -hex 32
```

Then validate and start:

```sh
docker compose config -q          # checks .env and interpolation; prints nothing on success
docker compose up -d --build      # builds the api image, starts services in dependency order
docker compose ps                 # wait until all four services show (healthy)
```

`config -q` fails with a message naming the missing variable if a secret is empty. Do not run `docker compose config` without `-q` in a shared terminal or log, because it prints the resolved secrets.

Startup order is db and cache, then api, then proxy. Each waits for the previous service's healthcheck to pass.

Other common commands:

```sh
docker compose logs -f --tail=100 api proxy   # proxy logs are one JSON object per request
docker compose stop                           # stop containers, keep data and containers
docker compose down                           # remove containers and network, keep volumes
```

Never run `docker compose down -v` unless you intend to delete the database. `-v` removes the `pgdata` and `redisdata` volumes.

## 2. Health verification

Run these after startup, after any change, and during an incident.

1. **Service status.** Every service must show `healthy` in `docker compose ps`.

2. **End to end through the proxy.** This should return 2xx and an `X-Request-ID` header:

   ```sh
   curl -i http://127.0.0.1:8080/healthz
   ```

3. **Proxy itself.** `/nginx-health` only answers from inside the container. A request from the host gets 403, which is expected:

   ```sh
   docker compose exec proxy wget -qO- http://127.0.0.1/nginx-health   # prints: ok
   ```

4. **Proxy error path.** Stop the API and confirm the proxy returns a JSON 503, not an HTML page. Then restart it:

   ```sh
   docker compose stop api
   curl -i http://127.0.0.1:8080/healthz      # 503, body {"error":"upstream_unavailable"}
   docker compose start api
   ```

5. **Database and cache answer inside the stack:**

   ```sh
   docker compose exec db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   docker compose exec cache sh -c 'redis-cli ping'           # prints PONG
   ```

6. **No unintended exposure.** The PORTS column for `db` and `cache` must show no `->` mapping, and `proxy` must show only `127.0.0.1:8080->80`:

   ```sh
   docker compose ps --format 'table {{.Service}}\t{{.Ports}}'
   ```

7. **Hardening took effect.** The API runs as UID 10001 with a read-only root filesystem:

   ```sh
   docker compose exec api id -u                        # prints 10001
   docker compose exec api sh -c 'touch /x'             # fails: Read-only file system or Permission denied
   ```

## 3. Backup and restore

Postgres is the only service holding data you cannot regenerate. Redis is treated as a cache and is not backed up. If the app stores data only in Redis, add a backup step and revisit this section.

Use logical dumps. Do not copy the volume while Postgres is running.

### Backup

```sh
mkdir -p backups && chmod 700 backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups/app-$(date +%Y%m%d-%H%M%S).dump"
```

Confirm the archive is readable before you rely on it:

```sh
docker compose exec -T db pg_restore --list < backups/app-YYYYMMDD-HHMMSS.dump > /dev/null && echo "archive OK"
```

Backups contain all application data. Keep them out of version control and off shared storage. Keep at least one copy off the host.

### Restore (replaces current data)

```sh
docker compose stop api proxy
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/app-YYYYMMDD-HHMMSS.dump
docker compose up -d
```

To restore onto a new host, run `docker compose up -d db` first. Postgres creates the user and database from `.env` on first start. Then restore as above.

### Restore drill

Test restores regularly, not only when you need one. This restores into a scratch database and drops it afterwards:

```sh
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE restore_check" && pg_restore -U "$POSTGRES_USER" -d restore_check --no-owner' < backups/app-YYYYMMDD-HHMMSS.dump
docker compose exec db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP DATABASE restore_check"'
```

Schedule the backup command with cron or a systemd timer, and set a retention policy.

## 4. Secret handling

- **Where secrets live.** All secrets are in `.env`. The file is git-ignored (`.gitignore`) and excluded from the image (`.dockerignore`). `.env.example` contains no secret values.
- **Permissions.** Keep `.env` at `chmod 600`.
- **Generation.** Use `openssl rand -hex 32`. Hex output is URL-safe, which matters because `DATABASE_URL` and `REDIS_URL` embed the passwords without URL-encoding. Do not use any generator that produces `@ : / ? # % $` characters.
- **Who gets what.** Only the containers that need a secret receive it:
  - `db` gets `POSTGRES_PASSWORD`.
  - `api` gets both passwords, embedded in `DATABASE_URL` and `REDIS_URL`.
  - `cache` gets `REDIS_PASSWORD` in its command line and in `REDISCLI_AUTH`, used by its healthcheck.
  - `proxy` gets no secrets.
- **Limits of this approach.** Anyone who can run `docker inspect` or read the container's environment can see these values. So can anyone with Docker access on the host. Compose has no secrets manager, so treat the host as the trust boundary.

### Rotating the Postgres password

`POSTGRES_PASSWORD` only takes effect when the data volume is first initialized. Changing `.env` does not change the password of an existing database. Change it in the database first:

```sh
NEW_PW=$(openssl rand -hex 32)
docker compose exec -T -e NEW_PW="$NEW_PW" db sh -c 'psql -v ON_ERROR_STOP=1 -v pw="$NEW_PW" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
ALTER USER CURRENT_USER PASSWORD :'pw';
SQL
```

Then set `POSTGRES_PASSWORD` in `.env` to the same value and recreate the containers that use it:

```sh
docker compose up -d db api
```

### Rotating the Redis password

Set `REDIS_PASSWORD` in `.env`, then recreate the two services that use it. Expect a brief API reconnect:

```sh
docker compose up -d cache api
```

### Do not

- Commit `.env`, paste it into tickets, or copy it into images.
- Use `docker compose config` without `-q` anywhere it will be logged.

## 5. Rollback

### Application image

Keep the current image before you rebuild:

```sh
docker tag api:local api:previous
docker compose up -d --build api          # deploy the new version
```

To roll back:

```sh
APP_IMAGE=api:previous docker compose up -d --no-deps api
docker compose ps                          # then run section 2 checks
```

To make the rollback persist across `up`, set `APP_IMAGE=api:previous` in `.env`, or rebuild from the previous commit of this directory.

### Proxy configuration

Validate the config before you apply it:

```sh
docker compose exec proxy nginx -t
```

Then recreate the proxy. Recreating also works if your editor replaced the file and broke the bind mount:

```sh
docker compose up -d --force-recreate proxy
```

To roll back, restore the previous `nginx.conf` from version control and repeat.

### Compose configuration

Restore the previous `compose.yaml` from version control, then run `docker compose up -d`. Services whose definitions changed are recreated.

### Database

Schema migrations are often not reversible. Before any deploy that changes the schema, take a backup (section 3). To roll back data, restore that backup. Anything written after the backup is lost.

### Postgres major versions

Moving `postgres:17` to a newer major version is not an in-place upgrade. Dump, change the tag, start with a fresh volume, and restore. Do not change the tag on an existing `pgdata` volume.

## 6. Routine maintenance

- **Pin images by digest.** Tags are mutable. After you pull and test a tag, record its digest and use `image: postgres:17@sha256:...` in `compose.yaml`:

  ```sh
  docker pull postgres:17
  docker image inspect --format '{{index .RepoDigests 0}}' postgres:17
  ```

- **Upgrade deliberately.** Change one tag at a time in `compose.yaml`, deploy, and run section 2.
- **Resource limits** in `compose.yaml` are starting points. Check real usage with `docker stats` and adjust.
- **Project name.** The fixed `name: api-stack` keeps volume names stable if this directory is renamed or copied. Without it, a rename would silently create a new empty database volume.

## 7. Known gaps

- **Transitive Python dependencies are not pinned.** `requirements.txt` pins only top-level packages. For a fully reproducible install, generate a hash-locked file with `pip-compile --generate-hashes` and install with `pip install --require-hashes -r`. This needs network access and was not done here.
- **`psycopg2-binary` in production.** The psycopg project advises building `psycopg2` from source for production. The supplied binary package was kept. Revisit if your policy requires it.
- **Base images are not digest-pinned.** See section 6.
- **No TLS.** The proxy serves plain HTTP on loopback only. Before exposing it beyond the host, terminate TLS at a load balancer or add a TLS listener to `nginx.conf`. If a load balancer sits in front, switch the proxy's `X-Forwarded-For` to append (`$proxy_add_x_forwarded_for`) and configure `set_real_ip_from`.
- **Client IP.** Behind Docker's port publishing, the proxy sees the bridge gateway address for host clients, not their real address. `X-Forwarded-For` is therefore only meaningful after a real load balancer is in front.
- **API outbound access.** The api container can reach the internet through the `frontend` network, because the proxy has to share a network with it. If the API makes no outbound calls, put proxy↔api on its own `internal: true` network and give the proxy a separate non-internal network.
- **No rate limiting or authentication at the proxy.** Request bodies are capped at 1 MB.
- **Single host only.** Compose gives no rolling updates, multi-host scheduling, or automatic failover.
