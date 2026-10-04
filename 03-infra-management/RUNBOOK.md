# RUNBOOK — small-api deployment

Operational guide for the Python API behind nginx with Postgres and Redis.
Targets the corrected `compose.yaml` / `Dockerfile` / `nginx.conf` in this
directory.

> Compose is **not** a full orchestrator. These procedures assume a single
> Docker host with named volumes for persistence. For multi-node production
> you would replace Compose with Swarm, Nomad, or Kubernetes — at which
> point many of these steps become platform-managed.

---

## 1. Startup

### 1.1 Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose version`)
- `curl` for health verification
- A copy of `.env.example` filled in and saved as `.env`

```bash
cp .env.example .env
# edit .env — set POSTGRES_PASSWORD, DATABASE_URL, REDIS_URL, etc.
chmod 600 .env
```

### 1.2 First-time bring-up

```bash
docker compose pull            # fetch pinned images (nginx, postgres, redis)
docker compose build api       # build the API image
docker compose up -d           # start everything in the background
docker compose ps              # confirm services are Up + healthy
```

Bring-up order is enforced by health-gated `depends_on`:
`db`/`cache` reach `healthy` → `api` starts → `proxy` starts.

### 1.3 Subsequent restarts

```bash
docker compose restart api     # restart just the API
docker compose up -d           # idempotent: starts only what is not running
docker compose down            # stop and remove containers, KEEP volumes
docker compose down --volumes  # DESTRUCTIVE — also removes pgdata/redisdata
```

### 1.4 Rebuild after a code change

```bash
docker compose build api
docker compose up -d api
```

---

## 2. Health verification

### 2.1 Container-level health

```bash
docker compose ps
```

Every service should be `Up` and report `(healthy)`. Status strings are
driven by the `healthcheck.test` blocks in `compose.yaml`:

| Service | What it actually checks                                  |
|---------|----------------------------------------------------------|
| proxy   | `GET /healthz` on localhost (returns `{"status":"ok"}`)  |
| api     | `GET /healthz` on the app container                      |
| db      | `pg_isready -U <user> -d <db>`                           |
| cache   | `redis-cli ping`                                         |

### 2.2 End-to-end check through the proxy

```bash
# From the Docker host:
curl -fsS http://127.0.0.1:8080/healthz        # nginx-level liveness
curl -fsS http://127.0.0.1:8080/api/healthz   # proxied through to the API
# Add -i if you want to inspect headers (X-Forwarded-* etc.)
```

### 2.3 Live logs

```bash
docker compose logs -f --tail=200            # all services, follow
docker compose logs -f api                   # one service
docker compose logs --since=15m api          # last 15 minutes
```

Logs are JSON-on-stdout from nginx, json-file from every container, with
10 MB × 5 file rotation. Tail them with `docker compose logs` or ship them
to a log aggregator via the Compose `logging` driver.

### 2.4 Inspecting state

```bash
docker compose exec api env | sort           # view rendered environment
docker compose exec db pg_isready            # one-off readiness probe
docker compose exec cache redis-cli ping
```

---

## 3. Backup and restore

Compose-managed named volumes are persistent. Back them up with a
sidecar container that has the matching client tool, so you do not need
to install `pg_dump` / `redis-cli` on the host.

### 3.1 Postgres backup

```bash
# Logical backup (recommended — portable across Postgres versions):
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > backups/pg_$(date -u +%Y%m%dT%H%M%SZ).sql.gz
```

### 3.2 Postgres restore

```bash
gunzip -c backups/pg_<timestamp>.sql.gz \
  | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

For a full-volume restore from a file-system snapshot of `pgdata`, stop
the API first, then `docker compose down`, restore the volume contents,
and `docker compose up -d`.

### 3.3 Redis backup

Redis is in append-only mode (`--appendonly yes`), so the volume itself
is the backup. For an off-host copy:

```bash
docker compose exec cache sh -c 'cp /data/dump.rdb /tmp/snapshot.rdb'
docker compose cp cache:/tmp/snapshot.rdb backups/redis_$(date -u +%Y%m%dT%H%M%SZ).rdb
```

### 3.4 Backup discipline

- Store backups **outside** the host (object storage, off-host NFS).
- Encrypt backups at rest.
- Test restores periodically — a backup you haven't restored is not a
  backup.

---

## 4. Secret handling

- All credentials live in `.env`, mode `600`, **never** committed.
- `compose.yaml` references them via `${VAR}` substitution or
  `env_file: .env`.
- The DB and cache ports are not published to the host — only the proxy
  is reachable (and only on `127.0.0.1`).
- The `backend` network is `internal: true`, so DB/Redis containers
  cannot reach the internet even if compromised.
- Rotate secrets by editing `.env` and `docker compose up -d`. If the
  rotated secret is `POSTGRES_PASSWORD`, restart the DB **first**, then
  the API (otherwise the old `DATABASE_URL` will fail to connect).
- For real production, prefer Docker secrets (Swarm), a vault (HashiCorp
  Vault, AWS Secrets Manager), or a sealed-secrets controller. Compose
  plaintext `.env` is acceptable for a small deployment but should not
  be the end state for anything sensitive.

---

## 5. Rollback

### 5.1 Code / image rollback

```bash
docker compose pull api        # if you keep images in a registry
docker compose down api
docker compose up -d api
```

For an image built locally, keep previous tags rather than `--force-rm`
overwriting them:

```bash
docker compose build api                      # rebuilds small-api/api:latest
docker tag small-api/api:latest small-api/api:previous
```

If a deploy breaks something, switch back:

```bash
docker compose down api
docker compose up -d api                     # re-pin via image: small-api/api:previous
```

### 5.2 Configuration rollback

`compose.yaml`, `Dockerfile`, and `nginx.conf` are all in this directory
under version control. Roll back by reverting the file(s) and re-running
`docker compose up -d`. Nginx reloads without dropping connections when
you run:

```bash
docker compose exec proxy nginx -s reload
```

### 5.3 Data rollback (destructive)

Restore the relevant named volume from a backup (see §3). Stop dependents
first:

```bash
docker compose stop api proxy
# restore pgdata or redisdata
docker compose up -d
```

### 5.4 Disaster-recovery checklist

1. Confirm backups exist and are not corrupt (`gzip -t`, `pg_restore --list`).
2. Provision a clean host with Docker + the same `.env`.
3. Copy backups across.
4. Restore volumes (or seed from a fresh `pg_dump`).
5. `docker compose up -d` and walk through §2.