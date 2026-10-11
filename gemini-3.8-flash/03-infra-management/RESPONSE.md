# Infrastructure Hardening Review and Deliverables

## Overview
This document outlines the findings from the review of the original deployment configuration (`Dockerfile`, `compose.yaml`, `nginx.conf`, and `.env.example`) and details the hardening remediations implemented alongside the non-invasive verification performed.

---

## Highest-Risk Original Problems

### 1. Plaintext Credentials Hardcoded in Version Control Configuration
- **Issue:** `compose.yaml` had hardcoded credentials (`admin:password` for Postgres and `DATABASE_URL: postgres://admin:password@db:5432/app`), bypassing `.env.example`.
- **Risk:** High risk of credential exfiltration via version control repositories, logs, and unauthorized access to production data.
- **Remediation:** Removed all hardcoded secrets from `compose.yaml`. Secrets and parameters are now parameterized via environment variables (`${POSTGRES_USER:-app}`, `${POSTGRES_PASSWORD}`, `${POSTGRES_DB:-app}`) with `.env.example` as a template and `.env` ignored via `.gitignore` and `.dockerignore`.

### 2. Public Exposure of Database and Cache Services
- **Issue:** `compose.yaml` published host ports for Postgres (`5432:5432`), Redis (`6379:6379`), and API (`5000:5000`).
- **Risk:** External attackers could directly reach database and cache engines from outside the container network, bypassing authentication, rate limiting, and reverse proxy protections.
- **Remediation:** Removed host port mappings (`ports`) for `db`, `cache`, and `api`. Only `proxy` binds port 80 to the host interface (`${PORT:-80}:80`). Inter-service communication happens exclusively across internal Docker networks.

### 3. Ephemeral Database Storage (Total Data Loss on Recreation)
- **Issue:** The `db` service had no persistent volume attached.
- **Risk:** All database records and state were stored inside the ephemeral container filesystem and would be irrevocably destroyed whenever the container was recreated, upgraded, or restarted.
- **Remediation:** Configured a persistent named volume (`postgres_data`) mounted to `/var/lib/postgresql/data`.

### 4. Running as Root & Flask Development Server in Container
- **Issue:** The original `Dockerfile` used the unpinned `python:3.13` base image, installed packages globally as root without a non-root user, set `FLASK_ENV=development`, and launched via `flask run --host=0.0.0.0`.
- **Risk:**
  - Running as `root` increases the severity of any container breakout or command injection vulnerability.
  - The built-in Flask development server is single-threaded, lacks security hardening, leaks stack traces/debug info, and is officially unsupported for production.
- **Remediation:**
  - Switched to `python:3.13-slim-bookworm` to minimize attack surface.
  - Created a dedicated unprivileged user and group (`appuser:appgroup` UID/GID 1001).
  - Configured Gunicorn 23.0.0 with 2 workers and 4 threads as the production WSGI server.
  - Added `.dockerignore` to avoid leaking secrets or build artifacts into images.

### 5. Non-Reproducible Dependency Installation & Layer Cache Busting
- **Issue:** `Dockerfile` performed `COPY . .` before `RUN pip install flask psycopg2 redis`, ignoring `requirements.txt`.
- **Risk:** Any minor code or documentation edit invalidated the Docker build cache and triggered a re-download of unpinned packages, risking breaking changes and inconsistent deployments across environments.
- **Remediation:** Copied `requirements.txt` independently prior to application code and installed pinned dependencies using `pip install --no-cache-dir -r requirements.txt`.

### 6. Missing Health Checks and Faulty Startup Dependencies
- **Issue:** `api` specified `depends_on: [db, cache]`, but Docker Compose by default only waits for container creation, not database or cache readiness. Neither `db`, `cache`, `api`, nor `proxy` possessed health checks.
- **Risk:** When starting up, the API crashed immediately because PostgreSQL and Redis were still initializing. Similarly, Nginx routed external traffic before the API was bound, returning 502 Bad Gateway errors.
- **Remediation:**
  - Configured native health checks for PostgreSQL (`pg_isready`), Redis (`redis-cli ping`), API (Python stdlib HTTP probe to `/health`), and Nginx (`wget -qO- /healthz`).
  - Added conditional dependencies: `api` depends on `db` and `cache` with `condition: service_healthy`; `proxy` depends on `api` with `condition: service_healthy`.

### 7. Unhardened Nginx Configuration for JSON API
- **Issue:** `nginx.conf` had an empty `events {}` block, omitted client timeouts, had no proxy headers, lacked request payload size limits, and exposed server tokens.
- **Risk:**
  - Without `Host`, `X-Real-IP`, and `X-Forwarded-*` headers, the backend cannot identify client IP addresses or original scheme (breaking logging, audit trails, and IP-based rate limiting).
  - Without timeouts and body limits, malicious or slow clients could cause resource exhaustion and DoS.
- **Remediation:**
  - Added headers: `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Port`.
  - Configured HTTP/1.1 and upstream keepalive connections (`upstream api_backend`).
  - Configured JSON API timeouts (`proxy_connect_timeout 5s`, `proxy_read_timeout 30s`, `proxy_send_timeout 10s`).
  - Enforced `client_max_body_size 10m` to mitigate payload DoS.
  - Added security headers (`nosniff`, `DENY`, `CSP`) and disabled `server_tokens`.
  - Added read-only bind mount for `nginx.conf` (`:ro`).

### 8. Flat Network Architecture
- **Issue:** All containers defaulted to an unsegmented default bridge network.
- **Risk:** No network-level perimeter between the public proxy layer and internal database/cache layers.
- **Remediation:** Segmented into two isolated networks:
  - `frontend`: bridges `proxy` and `api`.
  - `backend`: internal network (`internal: true`) connecting `api`, `db`, and `cache`. Nginx has zero route to `db` or `cache`.

### 9. Unbounded Log Growth and Resource Contention
- **Issue:** No logging drivers or resource limits were defined.
- **Risk:** Default Docker `json-file` logging grows indefinitely, eventually exhausting disk space. A runaway process could starve the entire host machine of CPU or memory.
- **Remediation:** Added `json-file` log rotation (`max-size: 10m`, `max-file: 3`) and CPU/memory limits and reservations for all services.

---

## Verification Performed

In compliance with instructions ("Work only in this directory; do not actually start containers. Do not use the network."):

1. **Docker Compose Configuration Validation:**
   - Ran `docker compose config` to validate YAML syntax, schema conformance, and variable substitution.
   - Verified that `docker compose config` successfully parsed with default `.env` and custom environment overrides.
   - Inspected parsed output to confirm that:
     - No public ports are published for `db`, `cache`, or `api`.
     - Only port 80 is published for `proxy`.
     - Named volume `postgres_data` is mounted to `/var/lib/postgresql/data`.
     - Network segmentation (`frontend` and `backend` with `internal: true`) is properly declared.
     - Health checks and `condition: service_healthy` startup orders are properly structured.
     - Resource limits and log rotation settings are applied.

2. **Python Code Compilation and Syntax Verification:**
   - Verified `app.py` compiles without syntax or type errors using `python3 -m py_compile app.py`.
   - Confirmed endpoint logic for `/` and `/health`, including graceful handling of missing or connected database/cache connections.

3. **Nginx Configuration Review:**
   - Audited `nginx.conf` syntax, directive context nesting (`events`, `http`, `upstream`, `server`, `location`), upstream naming consistency, and proxy header mappings.
   - Verified read-only mount declaration in `compose.yaml`.

4. **Security and Secret Isolation Audit:**
   - Verified that `compose.yaml`, `Dockerfile`, and `nginx.conf` contain zero embedded plaintext secrets.
   - Confirmed presence of `.gitignore` and `.dockerignore` to prevent `.env` and repository metadata from leaking into source control or image layers.
