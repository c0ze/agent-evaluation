# Response — highest-risk original problems and verification

## Highest-risk original problems

1. **Embedded, public database credentials.** `compose.yaml` hard-coded
   `POSTGRES_PASSWORD: password` / `admin` and a `postgres://admin:password` URL,
   and exposed `db` on `5432:5432`. This is the top risk: a weak, known, and
   committed password plus a publicly published port.
2. **Root user + development server.** `Dockerfile` ran `flask run` as root with
   `FLASK_ENV=development`, bundling the dev server and interactive debugger —
   both unsafe and unperformant in production.
3. **Unpinned, non-reproducible dependencies.** `pip install flask psycopg2
   redis` with no versions, no `requirements.txt`, all images `:latest`, and no
   `--no-cache-dir` — builds drift over time and can silently pull breaking or
   vulnerable releases.
4. **No health checks or startup ordering.** `depends_on` only listed names
   (no `condition`), so `api` could start before Postgres was ready.
5. **Exposed cache and no data persistence.** Redis published `6379` publicly and
   Postgres had no volume, so data would be lost on container recreation.
6. **Missing proxy headers/timeouts.** nginx forwarded no `Host` /
   `X-Forwarded-*` info and had default buffering/timeouts inappropriate for a
   JSON API.

## Changes made

- `compose.yaml`: credentials via `${...}` from `.env`; removed `db`/`cache`
  host ports (`expose` only); explicit `frontend`/`backend` networks with
  `backend: internal: true`; named volume `db-data`; per-service `healthcheck`
  with `depends_on.condition: service_healthy`; `restart: unless-stopped`;
  `logging` rotation; `deploy.resources` limits; pinned image versions.
- `Dockerfile`: multi-stage build, pinned `requirements.txt` install
  (`--no-cache-dir`), non-root `app` user (uid/gid 10001), gunicorn WSGI server,
  `slim` base image.
- `nginx.conf`: `Host`/`X-Real-IP`/`X-Forwarded-For/Proto/Host` headers,
  JSON `default_type` + structured access log, explicit connect/read/send
  timeouts, `client_max_body_size 1m`, upstream keepalive, `/nginx-health`.
- `.env.example`: kept as a template with placeholder password and added Redis
  tuning knobs.
- Added `RUNBOOK.md`.

## Verification performed

- Reviewed all five original files and the task goals before editing.
- Static validation of Compose syntax:
  `docker compose config -q` (passes; interpolation of `${...}` is sound).
- Manual re-read of each file to confirm: no literal secrets remain; no
  `ports:` on internal services; non-root `USER` directive present; health
  checks wired to `depends_on.condition`; volume + internal network present.
- Confirmed proxy header and timeout blocks are syntactically valid nginx
  config (listened block balanced, `;`-terminated).
- Did **not** start containers or access the network, per task instructions.

## Verification tools / extent

Static only. `docker compose config` and visual/manual review were used; no
containers were run and no network was used. End-to-end health/backup paths are
documented in `RUNBOOK.md` but were not executed here.