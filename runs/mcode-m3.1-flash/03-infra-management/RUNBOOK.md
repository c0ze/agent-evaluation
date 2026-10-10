# RUNBOOK

Operations for the small JSON API behind nginx (`proxy` → `api` → `db`/`cache`).
Plain Docker Compose on a single host. Commands assume you are in this
directory.

## 1. First start

```bash
cp .env.example .env
# Generate real passwords, do not use the placeholders:
#   openssl rand -base64 32
$EDITOR .env          # set POSTGRES_PASSWORD and REDIS_PASSWORD

docker compose config --quiet    # validate; fails if a required secret is missing
docker compose up -d --build
docker compose ps                # wait for all four to read "healthy"
```

Startup order is enforced by health, not by timing: `db` and `cache` must pass
their healthchecks before `api` starts, and `api` must pass `/ready` before
`proxy` starts. On a cold image pull, the first `up` can take a minute.

```bash
docker compose logs -f api      # follow the application
docker compose logs -f proxy    # JSON access log, one object per line
```

### Everyday commands

| Task | Command |
| --- | --- |
| Start / stop | `docker compose up -d` / `docker compose stop` |
| Stop, keep containers | `docker compose down` |
| Stop **and delete data** | `docker compose down -v` (destroys `pgdata`) |
| Rebuild after code change | `docker compose up -d --build api` |
| Shell in the API | `docker compose exec api sh` |
| Use psql | `docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |
| Use redis-cli | `docker compose exec cache sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli'` |

## 2. Health verification

Three distinct signals, on purpose:

| Endpoint | Means | Consequence of failure |
| --- | --- | --- |
| `GET /health` | the API process is alive | container restarts (`restart: unless-stopped`) |
| `GET /ready` | the API can reach db and cache | API marked unhealthy; nginx is not started |
| `GET /healthz` (on nginx) | the proxy process is alive | proxy restarts |

```bash
# 1. Data stores are up and reachable
docker compose ps                                   # every service: healthy
docker compose exec db sh -c 'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' && echo "db ready"

# 2. API liveness, straight to the container
docker compose exec api python -c "import urllib.request as u; print(u.urlopen('http://127.0.0.1:8000/health').read())"

# 3. API readiness - reports each dependency separately
docker compose exec api python -c "import urllib.request as u; print(u.urlopen('http://127.0.0.1:8000/ready').read())"

# 4. End to end, through the only published port
curl -i http://127.0.0.1:8080/healthz    # proxy liveness
curl -i http://127.0.0.1:8080/health     # proxied to the API
```

`/ready` returns `503` with a `checks` object when a dependency is down, e.g.
`{"status":"degraded","checks":{"postgres":true,"redis":false}}`.

Inspect health decisions without starting anything:

```bash
docker inspect --format '{{.Name}} {{.State.Health.Status}}' $(docker compose ps -q)
```

**A `degraded` `/ready` is not a restart event.** Compose restarts a container
only when the process exits, so a database outage makes the API unhealthy
without a restart loop. If you want the API to refuse traffic while degraded,
put an upstream health gate in front of it at the load balancer; that is
deliberately out of scope here.

## 3. Backup and restore

Data lives in the named volume `pgdata`. Redis is a cache and is not backed up.
Commands use `sh -c` so `$POSTGRES_USER`/`$POSTGRES_DB` are read from the
container's own environment and keep working if you change them in `.env`.

```bash
# Backup: logical dump in plain SQL format. Contains real rows -> gitignored.
mkdir -p backups
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  > backups/app-$(date +%F-%H%M).sql

# Verify the dump - a 0-byte or truncated file is a failed backup
ls -lh backups/
head -20 backups/app-2026-01-01-0000.sql      # must show the pg_dump header
```

Plain SQL is used deliberately: it restores from stdin without any seeking,
and `--clean --if-exists` makes it re-runnable. For large databases prefer
`pg_dump -Fc` and copy the file into the container, because the custom format is
not seekable on stdin (slower, but supports `pg_restore -j`).

Restore, into the same database. This **overwrites existing data**:

```bash
docker compose stop api                      # stop writers first
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backups/app-2026-01-01-0000.sql
docker compose start api
curl -fsS http://127.0.0.1:8080/ready && echo restored
```

`ON_ERROR_STOP=1` matters: without it `psql` reports success to the shell even
when statements failed, and a partial restore looks like a good one.

Backup reminders: `pg_dump` is consistent as of its own start, but for a real
deployment run it on a schedule (cron/systemd timer) and copy it off the host.
A backup that only exists on the same disk is not a backup. Postgres major
versions (16) are pinned; a dump restores into a same-or-newer major version
only.

## 4. Secret handling

- **All secrets come from `.env`**, never from committed files. `compose.yaml`
  contains only `${...}` placeholders, and required ones use `${VAR:?message}`,
  so a missing secret fails at `docker compose config` with a clear message
  instead of starting with an empty password.
- `.env` is in `.gitignore` and `.dockerignore`: it cannot be committed
  accidentally, and it cannot be baked into an image. The Dockerfile copies
  `app.py` and `requirements.txt` only - never `COPY . .`.
- **Rotate a secret** by editing `.env` and recreating the affected services:

  ```bash
  # Postgres password
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -base64 32)/" .env
  docker compose up -d --force-recreate db api
  # Existing sessions are dropped; connections re-authenticate with the new password.
  ```

  Changing `POSTGRES_PASSWORD` does **not** change the password of an already
  initialised data volume (it only applies on first init). For a live rotation,
  `ALTER ROLE app WITH PASSWORD '...'` inside the container, then update `.env`
  and recreate `api`.

  ```bash
  # Redis password (cache only - safe to rotate freely)
  sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$(openssl rand -base64 32)/" .env
  docker compose up -d --force-recreate cache api
  ```

- **Limitations, stated plainly.** Compose env vars are visible to anyone who
  can run `docker inspect`, to root on the host, and in `docker compose config`
  output. For a shared or production host, move to file-based `secrets:` in
  `compose.yaml` and read them from `/run/secrets/*` (the Postgres image also
  supports `POSTGRES_PASSWORD_FILE`); or use a real orchestrator with a real
  secret store. The structure here is ready for that change.
- Passwords are passed as discrete variables, not inside a `postgres://` URL,
  so a password containing `@`, `:` or `/` cannot silently corrupt the DSN.

## 5. Rollback

Every artifact is a committed file, so rollback is `git`:

```bash
git status                        # what changed
git log --oneline -5
git checkout <last-good-sha> -- compose.yaml Dockerfile nginx.conf requirements.txt
docker compose config --quiet
docker compose up -d --build
```

For the database, roll forward or restore (section 3). There is no automated
down-migration, which is intentional: destructive schema rollback is a decision
for a human with a verified backup.

Image-only rollback, when only the app code was bad:

```bash
docker compose up -d --build api   # rebuild from the restored source
```

Note that `docker compose up -d` does not rebuild an image whose Dockerfile did
not change. Force it with `--build` (Compose also caches layers, so an
unchanged `requirements.txt` reuses the dependency layer).

## 6. Limits of this setup

Compose is a single-host tool, not an orchestrator. This setup does **not**
provide: multi-host failover, rolling or zero-downtime deploys, secret
rotation, autoscaling, or TLS termination. When any of those become
requirements, move to Kubernetes, Nomad, or ECS rather than growing this file.
Before that, the practical next steps are:

1. Terminate TLS at the proxy and redirect HTTP to HTTPS. Compose has no cert
   automation; use a mounted certificate or a sidecar.
2. Pin images by digest (`image: postgres:16-alpine@sha256:...`) so a rebuild
   cannot silently change what runs.
3. Add an access log shipper, and alert on `/ready` failures and 5xx rates.
4. Run the `api` image under a read-only filesystem (already set) and consider
   dropping `security_opt: no-new-privileges` only if a driver needs it.
