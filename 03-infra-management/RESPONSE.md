# Response — highest-risk original problems and verification

## Highest-risk problems in the supplied configuration

1. **Weak hardcoded credentials on a published database port.**
   `compose.yaml` set `POSTGRES_PASSWORD: password` (user `admin`), inlined
   the same secret in the api's `DATABASE_URL`, and published
   `5432:5432` to the host — anyone who could reach the host could log in
   to Postgres with a password that was also sitting in the repo. Redis
   (`6379:6379`) was likewise published with no authentication at all,
   which is effectively remote code execution on the cache host.
2. **API exposed around the proxy, running as root on the dev server.**
   The api published `5000:5000`, bypassing nginx entirely, and the
   `Dockerfile` ran `flask run` (single-threaded development server, not
   built for untrusted traffic) as root with `FLASK_ENV=development` —
   one app bug away from a root shell in the container.
3. **Nothing pinned, dependencies not reproducible.** `python:3.13`,
   `nginx:latest`, `postgres:latest`, `redis:latest`, and
   `pip install flask psycopg2 redis` (no versions, ignoring the pinned
   `requirements.txt` that was already present, and choosing source-built
   `psycopg2` over the shipped binary). Any rebuild could silently change
   every layer, including major database upgrades against an existing
   data directory.
4. **No Postgres persistence.** No volume for
   `/var/lib/postgresql/data`, so recreating the `db` container destroyed
   the database.
5. **Startup raced dependency readiness.** List-form `depends_on` only
   waits for containers to start, and there were no healthchecks anywhere;
   the api could crash-loop against a Postgres that was still initialising,
   and "is it up?" had no machine-readable answer.
6. **Proxy passed no client context and had no bounds.** `nginx.conf` set
   no `Host`/`X-Real-IP`/`X-Forwarded-*` headers (the app could not see
   real client IPs or scheme, breaking logging, rate decisions, and
   secure cookies), and set no timeouts or body-size limit, so slow or
   oversized requests could tie up API workers indefinitely. It also
   resolved `api` once at startup, so a recreated api container left nginx
   proxying to a dead IP.
7. **Build context leaked into the image.** `COPY . .` with no
   `.dockerignore` baked whatever sat beside the Dockerfile — including a
   real `.env` — into the image, and copying source before installing
   dependencies invalidated the dependency layer on every code change.
8. **No operational guard-rails.** No restart policy, unbounded container
   logs (a chatty service could fill the disk), no CPU/memory limits, one
   implicit flat network (the proxy could reach Postgres directly), and
   `.env.example` disagreed with `compose.yaml` (user `app`/`change-me`
   in the example vs hardcoded `admin`/`password` actually used).

## What changed (summary)

- `Dockerfile`: pinned slim base, deps installed from `requirements.txt`
  with `--no-cache-dir` before source copy, dedicated non-root `app` user,
  gunicorn instead of `flask run`, stdlib `HEALTHCHECK` on `/health`,
  dev-mode env removed. Added `.dockerignore` (notably excludes `.env`).
- `compose.yaml`: secrets only via `.env` interpolation with `:?`
  fail-fast; no published ports for api/db/cache; Redis requires a
  password; pinned images; named volumes for Postgres (and Redis AOF);
  explicit `edge`/`backend` networks with `backend` internal; healthgated
  `depends_on` (`service_healthy`); per-service healthchecks;
  `restart: unless-stopped`, bounded `json-file` logging, CPU/memory
  limits; read-only root filesystems + tmpfs for proxy/api, `cap_drop:
  ALL` and `no-new-privileges` for the api; `APP_VERSION` image tagging
  for rollback. `.env.example` now matches the variables actually used and
  ships empty passwords with generation instructions; `.gitignore` covers
  `.env`.
- `nginx.conf`: forwarding headers, runtime re-resolution of `api` via
  Docker DNS (`resolver 127.0.0.11` + variable `proxy_pass`), connect/send/
  read timeouts aligned with gunicorn, `client_max_body_size 1m`, gzip for
  JSON, `server_tokens off`, baseline security headers, and a
  proxy-local `/healthz` for its own healthcheck.
- `RUNBOOK.md`: startup, health verification, `pg_dump`/`pg_restore`
  backup/restore, secret generation/rotation, tag-based rollback, and the
  limits of single-host Compose (plus the `/health` and `app:app`
  entrypoint assumptions).

## Verification performed

Per the task constraints, **no containers were started and no network was
used**; verification was static only:

- Read all five supplied files in full and audited them line by line
  against the task goals before editing.
- Parsed the rewritten `compose.yaml` with Python/PyYAML to confirm valid
  YAML. (See repository session for command output.)
- Ran `docker compose config` (client-side render/validation only — pulls
  and starts nothing) with throwaway `POSTGRES_PASSWORD`/`REDIS_PASSWORD`
  values supplied via the shell environment (no `.env` file created), and
  inspected the rendered config to confirm: only the proxy publishes a
  port; db/cache have none; healthchecks and `service_healthy` conditions
  render as intended; both networks and both named volumes are wired to
  the right services; interpolated `DATABASE_URL`/`REDIS_URL` contain no
  committed secret.
- Repeated `docker compose config` **without** the passwords to confirm
  Compose fails fast with the `:?` error instead of rendering empty
  credentials.
- Grepped the final files for regression markers: `latest`, `password`
  as a literal value, `FLASK_ENV`, `flask run`, published `5432`/`6379`
  mappings, and `USER`/root usage — confirming the original defects are
  gone and that `Dockerfile`, `compose.yaml`, and `nginx.conf` agree on
  the api port (5000) and service name (`api`).
- `requirements.txt` already pinned `gunicorn==23.0.0` and
  `psycopg2-binary`, which the new `Dockerfile` now actually installs;
  no dependency changes were needed.

Not verified (out of scope / impossible under the constraints): actually
building or booting the stack, runtime behaviour of the healthchecks
against the real application (there is no app source in this directory —
`GET /health` and the `app:app` entrypoint are documented assumptions in
`RUNBOOK.md`), `nginx -t` against the nginx binary (none installed
locally; config was checked by inspection), and that the pinned image
tags resolve in a registry (no network). These need a live
`docker compose up` smoke test on a host with registry access before
production use.
