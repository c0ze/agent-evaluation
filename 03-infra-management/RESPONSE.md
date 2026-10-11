# RESPONSE — Task 03: Hardening review

## Highest-risk original problems (in order)

1. **Hardcoded database credentials committed to the repo.** `compose.yaml`
   embedded `admin:password` both in `DATABASE_URL` and in the `db` service
   environment. Credentials are now injected from a git-ignored `.env`
   (documented in `.env.example`) via required variable interpolation
   (`${VAR:?...}`), so the stack refuses to start with unset secrets.
2. **Postgres and Redis published on public host ports** (`5432:5432`,
   `6379:6379`), exposing the database and cache — protected only by that weak
   password — to anyone who can reach the host. Neither service publishes a
   host port now; both sit on an `internal: true` backend network, and the API
   itself is also unpublished (only nginx port 80 is exposed).
3. **API container ran as root with the Flask development server**
   (`FLASK_ENV=development`, `flask run`). The image now creates and runs as an
   unprivileged `app` user on a slim base and serves via gunicorn with pinned
   worker/timeout settings.
4. **Non-reproducible dependency installation and unpinned images.**
   `pip install flask psycopg2 redis` (unpinned, ignoring `requirements.txt`,
   in-cache) plus `nginx:latest` / `postgres:latest` / `redis:latest`. The
   Dockerfile installs from the pinned `requirements.txt` with
   `--no-cache-dir`, and all images are pinned to specific versions.
5. **No health checks, no health-based startup ordering, no data
   persistence.** `depends_on` was a plain list (start order only), and
   Postgres had no volume — every `down -v` or container recreation risked
   silent data loss. All four services now have meaningful health checks
   (`pg_isready`, `redis-cli ping`, HTTP `/health`, nginx `/healthz`), the API
   waits for `service_healthy` on db/cache and the proxy waits for a healthy
   API, and Postgres data persists in the named `db-data` volume.
6. **nginx had no proxy headers or timeouts** — the API would see all traffic
   as coming from nginx and slow clients/upstreams could hang connections
   indefinitely. Added `Host`/`X-Real-IP`/`X-Forwarded-For`/`X-Forwarded-Proto`
   headers, fail-fast connect/send/read timeouts appropriate for a JSON API, a
   bounded `client_max_body_size`, and keepalive to the upstream.

Also addressed: no restart policy (now `unless-stopped`), unbounded logs (now
`json-file` capped at 10 MB × 3), no resource guardrails (best-effort
`deploy.resources.limits`, with a RUNBOOK note that Compose is not an
orchestrator), and implicit networking (now explicit `frontend`/`backend`
networks so db/cache are unreachable from the proxy tier).

## Verification performed

Per the task constraints I did **not** start containers. I verified statically:

- `compose.yaml` parses as valid YAML (Python `yaml.safe_load`) and its
  structure was reviewed against Compose semantics: `depends_on` long-form
  conditions, `internal: true` network, named volume, healthcheck formats
  (`CMD`/`CMD-SHELL`, `$${...}` escaping so container env vars are expanded at
  runtime, not by Compose).
- `Dockerfile` reviewed line-by-line: build order maximizes layer caching
  (requirements before code), no secret material copied or baked, `USER app`
  precedes `CMD`, gunicorn binds the same port the health check and nginx
  upstream target (8000).
- `nginx.conf` structure checked (events/http/server blocks, upstream name
  matches Compose service DNS name `api`, `/healthz` matches the proxy health
  check path, `wget` used in the health check is present in
  `nginx:*-alpine`).
- Cross-file consistency: ports (8000 end-to-end), health endpoints
  (`/healthz`, `/health`), network attachment per service, env var names
  identical across `.env.example`, `compose.yaml`, and RUNBOOK commands.

## Residual caveats

- The gunicorn entrypoint assumes `app:app` and the API health check assumes
  the application exposes `GET /health`; both are documented in the RUNBOOK and
  must match the actual application code.
- `deploy.resources.limits` are honored by recent Compose versions on a single
  host but are guardrails, not scheduling guarantees.
- The first-boot password caveat (changing `POSTGRES_PASSWORD` does not update
  an existing volume's role) is documented in the RUNBOOK's secret-rotation
  section.
