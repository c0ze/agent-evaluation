# Response — highest-risk original problems and verification

## Highest-risk problems in the original configuration

1. **Hardcoded credentials in `compose.yaml`** (`admin:password`, both in
   `DATABASE_URL` and the `db` environment). Committed secrets leak via git
   history and are readable by anyone with repo access. Fixed by sourcing all
   credentials from `.env` (required `:?` interpolation fails fast when unset)
   with only placeholders in `.env.example`.
2. **Database and cache ports published to the host** (`5432`, `6379`, plus
   the API's `5000`). Postgres/Redis were reachable from the network with
   weak known credentials. Fixed by publishing only nginx:80; `db`/`cache`
   sit on an `internal: true` backend network and the API is `expose`-only.
3. **Postgres data not persisted** (no volume). Any `down`, upgrade, or host
   restart silently destroyed all data. Fixed with a named `pgdata` volume
   plus backup/restore procedures in `RUNBOOK.md`.
4. **Development server running as root** (`flask run` with
   `FLASK_ENV=development` on the full `python:3.13` image). Debug-mode
   behavior, no process management, and a needless root user maximize blast
   radius. Fixed with a slim image, dedicated `appuser`, and gunicorn.
5. **Unreproducible, unpinned builds** (`:latest` images; `pip install flask
   psycopg2 redis` ignoring the pinned `requirements.txt`). Every build could
   drift or pull a compromised release. Fixed with pinned image tags and
   `pip install -r requirements.txt`.
6. **No health checks or ordered startup** (plain `depends_on`, `COPY . .`
   before install). The API raced the database on every boot and failures
   stayed silent. Fixed with per-service health checks and
   `condition: service_healthy` dependencies.
7. **Bare nginx proxy** (no forwarded headers, no timeouts). The API saw
   wrong client IPs/scheme and a hung upstream could hold connections
   forever. Fixed with `X-Forwarded-*`/`Host` headers, connect/read/send
   timeouts, body limits, and a dedicated `/nginx-health` probe.
8. **Secrets baked into image layers** (`COPY . .` before install, no
   `.dockerignore`). A local `.env` would have been copied into the image.
   Fixed with `.dockerignore` excluding `.env` and install-before-copy layer
   ordering.

## What changed (summary)

- `Dockerfile`: slim pinned-base image, non-root `appuser`, reproducible
  install from `requirements.txt`, gunicorn, image-level `HEALTHCHECK`.
- `compose.yaml`: no hardcoded secrets, no public db/cache/api ports, pinned
  images, `pgdata` volume, frontend/backend networks (backend internal),
  health checks + health-gated startup, `unless-stopped` restarts, bounded
  logging, modest resource limits.
- `nginx.conf`: proxy headers, timeouts, body limits, `server_tokens off`,
  upstream with fail thresholds, `/nginx-health` endpoint.
- `.env.example`: documents every variable with placeholder secrets.
- Added `.dockerignore`, `RUNBOOK.md`, `RESPONSE.md`.

## Assumptions (no app source was supplied)

- API entrypoint is `app:app` and it serves `GET /healthz` → 200.
- Redis stays passwordless on the isolated backend network (documented
  opt-in for auth in `.env.example`).

## Verification performed (no containers started, no network used)

- `docker compose config` with dummy env vars: exit 0; rendered output
  confirms only `proxy` publishes a port, `db` mounts `pgdata`, backend
  network is internal, all four health checks and three
  `service_healthy` gates present.
- `docker compose config` without secrets: fails fast naming the missing
  variable (`Set POSTGRES_USER in .env`), exit 1.
- Secret scan over `compose.yaml`/`Dockerfile`/`nginx.conf`: no literal
  credentials — only `${POSTGRES_*}` references and a `.dockerignore`
  comment mention them.
- `:latest` and `flask run`/`FLASK_ENV` scans: no remaining hits.
- `Dockerfile` contains `USER appuser`, `pip install -r requirements.txt`,
  and a gunicorn `CMD`.
- `nginx.conf`: braces balanced (6/6); all required proxy headers, timeouts,
  `client_max_body_size`, `server_tokens off`, upstream, and health endpoint
  present.
- Not run (per constraints): `docker build`, `docker compose up`, `nginx -t`
  (no nginx binary installed); image pulls would require network access.
