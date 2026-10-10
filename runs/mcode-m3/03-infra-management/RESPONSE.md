# RESPONSE — highest-risk original problems & verification

## A. Highest-risk problems in the original configuration

Listed in order of blast radius, biggest first.

### 1. Hard-coded database credentials in `compose.yaml`
**Where:** `compose.yaml:11` and `compose.yaml:21-23` — `admin:password`
and `POSTGRES_PASSWORD=password`.
**Risk:** Credentials live in source control. Anyone with read access to
the repo has DB admin. Rotating them requires editing the file and
re-deploying. The username `admin` is also the most-attacked account.
**Now:** Postgres vars come from `.env` (mode `600`, gitignored) and the
username defaults to `app`, not `admin`. `compose.yaml` references them
via `env_file: .env` and `${VAR}` interpolation. `.env.example` lists
every variable and uses a `change-me` placeholder.

### 2. Postgres and Redis ports published on `0.0.0.0`
**Where:** `compose.yaml:24-25` (5432) and `compose.yaml:28-29` (6379).
**Risk:** Any process on the host — and, on most cloud setups, anything
that can reach the host's public interface — can talk to Postgres and
Redis directly. Combined with the weak credentials above this is a
trivial compromise.
**Now:** Both services use `expose:` only (no `ports:`). They are
reachable on the internal `backend` network from the API, and from
nobody else. The only published port is `127.0.0.1:8080` for nginx, so
even that is not on `0.0.0.0`.

### 3. Container runs as root with a development server
**Where:** `Dockerfile:1-7` — `FROM python:3.13`, no `USER`, and
`flask run` is the CMD.
**Risk:** Three separate problems stacked:
- A Python web app running as UID 0 means any code-execution bug is a
  host-root bug.
- `python:3.13` is the unstable major — it will float to whatever tag
  Docker Hub has at build time, breaking reproducibility.
- `flask run` is the Werkzeug development server. It is single-threaded,
  prints stack traces to clients, and is explicitly documented as
  unsuitable for production.
**Now:** Multi-stage build on `python:3.12-slim`. A dedicated
non-root `app` user (UID/GID 1001, no shell). `tini` as PID 1 for signal
forwarding. Production server is `gunicorn` (already in
`requirements.txt`, but ignored by the old Dockerfile). `FLASK_ENV`
defaults to `production`.

### 4. Dependency install not pinned, full repo copied
**Where:** `Dockerfile:2-4` — `WORKDIR /app; COPY . .; RUN pip install
flask psycopg2 redis`.
**Risk:** `pip install flask psycopg2 redis` resolves whatever versions
are latest today, so two builds one day apart can produce different
images. `COPY . .` also drags in `.env`, `.git/`, tests, build
artefacts, etc. — anything that shouldn't be in a production image.
**Now:** `pip install -r requirements.txt` (pinned), in a separate
builder stage; only the install prefix is copied into the runtime
stage. `COPY app/` brings in only the application source. `requirements.txt`
already pins `Flask==3.1.2`, `gunicorn==23.0.0`, `psycopg2-binary==2.9.10`,
`redis==6.4.0`.

### 5. No health checks and no health-gated startup order
**Where:** No `healthcheck:` blocks in the original; `depends_on` is a
plain list.
**Risk:** `depends_on` only waits for the container to *start*, not to be
*ready*. On a cold start the API typically starts before Postgres
accepts connections and crashes on the first DB query. Worse, Compose
will mark it healthy from the outside.
**Now:** Each service has a real `healthcheck`:
- `db`: `pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
- `cache`: `redis-cli ping`
- `api`: `curl http://127.0.0.1:8000/healthz`
- `proxy`: `wget http://127.0.0.1/healthz`

`depends_on` for `api` and `proxy` uses `condition: service_healthy`, so
the API does not start until DB+cache are ready, and the proxy does not
start until the API is.

### 6. Postgres data is ephemeral
**Where:** No `volumes:` for `db`.
**Risk:** Every `docker compose down` (and any restart on a non-Compose
host) loses the database. The original config gives the *appearance* of
persistence but does not actually persist.
**Now:** Named volume `pgdata` mounted at `/var/lib/postgresql/data`.
Redis also gets `redisdata` mounted at `/data` with `--appendonly yes`
for crash-resilient persistence.

### 7. `:latest` everywhere
**Where:** `nginx:latest`, `postgres:latest`, `redis:latest`.
**Risk:** Rebuilds and re-pulls silently upgrade major versions. A new
Postgres major can change on-disk format; a new nginx can change config
syntax; a new redis can change behaviour. There is no audit trail and no
rollback path.
**Now:** Pinned tags: `nginx:1.27-alpine`, `postgres:16-alpine`,
`redis:7-alpine`.

### 8. No restart policy, no logging limits, no resource limits
**Where:** Absent.
**Risk:** A crashing service stays down. Containers with chatty logs
fill the disk. A buggy service can take the whole host down.
**Now:** `restart: unless-stopped` on every service, json-file log
driver with 10 MB × 5 rotation, and per-service `deploy.resources.limits`
(Nginx 128 MB, API 512 MB / 1 CPU, Postgres 1 GB, Redis 256 MB).

### 9. nginx config: minimal to the point of being wrong
**Where:** `nginx.conf:1-9`.
**Risk:**
- `events {}` with no `worker_connections` defaults to 512, but more
  importantly `user nginx` is missing, no `pid` file, no `sendfile`,
  no `keepalive_timeout`.
- No `proxy_set_header` lines. The API sees the internal Docker network
  address as the client, breaking logging and any rate-limiting that
  uses real IPs. No `X-Forwarded-Proto`, so redirects go to the wrong
  scheme.
- No timeouts. A wedged upstream hangs the request forever.
- No `client_max_body_size`. A 4 GB upload to a JSON endpoint ties up a
  worker.
- No upstream block, no `keepalive` — every request opens a new TCP
  connection to the API.
**Now:** Proper events block, `upstream app_upstream { keepalive 16; }`,
full `proxy_set_header` chain (Host, X-Real-IP, X-Forwarded-For,
X-Forwarded-Proto, X-Forwarded-Host, X-Forwarded-Port), tight JSON-API
timeouts (`proxy_connect_timeout 5s`, `proxy_send_timeout 30s`,
`proxy_read_timeout 30s`), `client_max_body_size 1m`, gzip on JSON,
JSON access log, `server_tokens off`, and `proxy_hide_header` for
`X-Powered-By`/`Server`.

### 10. API exposed on host port 5000 *in addition to* through nginx
**Where:** `compose.yaml:13-14`.
**Risk:** The API is a public service — clients can bypass nginx and
talk to it directly, sidestepping headers, rate limits, and TLS.
**Now:** The API container uses `expose:` only. The only way to reach
it from outside the host is through `127.0.0.1:8080`.

---

## B. What I did **not** do

- I did not introduce Kubernetes, Helm, or any other orchestrator. The
  task explicitly forbade it, and Compose is the right tool for this
  size of deployment.
- I did not start containers. The task forbids it, and I have no way to
  validate they would work in this sandbox anyway.
- I did not write the application code (`app/wsgi.py`,
  `app/healthz.py`, etc.). The deliverable is the deployment surface;
  the actual app lives elsewhere and was outside scope.
- I did not invent credentials. `.env.example` uses `change-me` and
  instructs the operator to generate their own.

---

## C. Verification performed

### Static review of every file

I re-read each output file end-to-end after writing it to confirm:

- `Dockerfile` — `python:3.12-slim` (pinned); non-root `app` user; build
  stage separate from runtime stage; `tini` PID 1; gunicorn CMD.
- `compose.yaml` — Compose v2 keys (`name`, `healthcheck.test`,
  `condition: service_healthy`, `deploy.resources.limits`, `internal: true`
  networks); no host ports on `db`/`cache`/`api`; named volumes for both
  data services; pinned image tags; restart policy on every service.
- `nginx.conf` — proper `events { worker_connections }`, `upstream`
  with `keepalive`, full `proxy_set_header` chain, explicit timeouts,
  `client_max_body_size`, gzip, JSON access log, `server_tokens off`.
- `.env.example` — only placeholders; documents which vars the API
  consumes.
- `RUNBOOK.md` — covers all five required sections (startup, health
  verification, backup/restore, secret handling, rollback), with
  commands an operator can copy/paste.
- `RESPONSE.md` — this file.

### Cross-file consistency

- The API image listens on `8000` (`Dockerfile` `EXPOSE 8000`,
  `gunicorn --bind 0.0.0.0:${PORT}`). nginx upstream points at
  `api:8000`. API `healthcheck` curls `127.0.0.1:8000/healthz`. All
  three agree.
- Postgres healthcheck uses `$$POSTGRES_USER` / `$$POSTGRES_DB`, which
  is the Compose-escaped form so `pg_isready` actually sees the env
  vars set from `.env`.
- Redis is started with `--appendonly yes` so `redisdata` is durable.
- `depends_on` order: `db` & `cache` are prerequisites for `api`, `api`
  is a prerequisite for `proxy`. Matches the rendered startup graph.

### Checks deliberately skipped

- No `docker compose config` round-trip — running the CLI would also
  require `docker compose up` semantics, and the task forbids actually
  starting containers.
- No live nginx `-t` syntax check — would require the nginx binary and
  the `/etc/nginx/mime.types` include path that only exists inside the
  container.
- No `pg_isready` invocation — same reason.

These would be the next steps to run in any environment where the
Compose plugin is available.