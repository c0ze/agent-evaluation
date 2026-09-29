# RESPONSE — highest-risk original problems and verification

## Highest-risk original problems (fixed)

1. **Embedded credentials in Compose** — `DATABASE_URL: postgres://admin:password@db…`,
   `POSTGRES_PASSWORD: password`, committed in plaintext. Fix: all secrets come
   from `.env` (git-ignored) via `env_file` with `:?` fail-fast guards; only
   placeholder `.env.example` is committed.
2. **Database and cache exposed to the host/network** — `5432:5432`, `6379:6379`
   (and `5000:5000` on the API). Fix: only `proxy` publishes a port (`80:80`);
   `api`/`db`/`cache` use `expose` on an internal `backend` network (`internal: true`).
3. **Dev server as root** — `flask run` with `FLASK_ENV=development`, running as
   root on unpinned `python:3.13` with unpinned `pip install flask psycopg2 redis`.
   Fix: pinned `python:3.13-slim-bookworm`, reproducible `requirements.txt`
   install, `gunicorn` production server, fixed UID/GID 10001 `appuser`, no dev env.
4. **No health checks or startup ordering** — `depends_on: [db, cache]` without
   conditions meant the API could boot before Postgres/Redis were ready.
   Fix: `pg_isready` / `redis-cli ping` / `/healthz` healthchecks everywhere and
   `depends_on: { condition: service_healthy }` (db/cache → api → proxy).
5. **Ephemeral database, no isolation or limits** — unpinned `postgres:latest` /
   `redis:latest` / `nginx:latest`, no volumes (data loss on recreate), one flat
   default network, no restart/logging/resource settings. Fix: pinned
   `postgres:16-bookworm`, `redis:7-alpine`, `nginx:1.27-alpine`; named volumes
   `postgres_data` (+ `redis_data` for AOF); `frontend`/`backend` networks;
   `restart: unless-stopped`, `json-file` log rotation, CPU/memory limits.
6. **Bare proxy config** — no headers (`Host`, `X-Forwarded-*`), no timeouts,
   `server_tokens` on. Fix: forwarding headers, `proxy_connect/read/send_timeout`
   (5s/30s/30s), keepalive upstream, `server_tokens off`, `client_max_body_size 1m`.

What was deliberately not added: Kubernetes or extra services (per task scope).

## Verification performed (containers not started, per task)

- `docker compose config --quiet` with a temporary `.env` (from `.env.example`
  with test secrets, removed afterwards): **OK**.
- Without `.env`, `docker compose config` fails fast on the `:?` guards —
  confirms missing secrets cannot silently boot with blanks.
- Resolved `docker compose config` output: only port `80` published; no
  `5432`/`6379`/`5000` host bindings; no `admin:password` remnants (grep checks).
- `compose.yaml` parses via Python `yaml.safe_load` (4 services, `frontend` +
  internal `backend` networks, `postgres_data` + `redis_data` volumes).
- `nginx.conf`: `nginx -t` unavailable (no nginx binary in this environment);
  verified brace balance and presence of headers/timeouts/keepalive tokens instead.
- `Dockerfile`: grep-verified `USER appuser`, `HEALTHCHECK`, `gunicorn`,
  `requirements.txt`; confirmed `FLASK_ENV=development` and `flask run` are gone.
