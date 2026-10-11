# Security Hardening & Infrastructure Review

This document outlines the highest-risk vulnerabilities and operational deficiencies identified in the original deployment configuration, along with the remediation steps implemented and the verification performed.

---

## 1. Highest-Risk Original Problems

### Critical Security Vulnerabilities

1. **Exposed Database, Cache, and API Host Ports**:
   - *Problem*: `compose.yaml` mapped ports `5432:5432` (PostgreSQL), `6379:6379` (Redis), and `5000:5000` (API) directly to the host machine.
   - *Risk*: Anyone with network access to the Docker host could directly connect to Postgres and Redis, bypassing Nginx reverse proxy authentication, rate limiting, and access controls. Redis without authentication on a public port is frequently exploited for remote code execution and data compromise.

2. **Hardcoded Plaintext Credentials in Configuration**:
   - *Problem*: `compose.yaml` contained hardcoded database credentials (`admin:password`).
   - *Risk*: Committing credentials to version control leads to immediate credential leakage across git logs, CI/CD runners, and developer machines.

3. **Running Application Container as Root**:
   - *Problem*: The original `Dockerfile` did not specify a `USER` directive, executing the Python runtime as root (`UID 0`).
   - *Risk*: Any application-level vulnerability (e.g., arbitrary file write, dependency vulnerability, command injection) provides the attacker with root privileges inside the container, substantially increasing the risk of container escape and host compromise.

4. **Insecure Flask Development Server in Production**:
   - *Problem*: `Dockerfile` executed `flask run --host=0.0.0.0` with `FLASK_ENV=development`.
   - *Risk*: The Werkzeug/Flask development server is single-threaded, unoptimized, and explicitly unsupported for production. Development mode exposes interactive debugging pins and stack traces, leaking internal environment details and enabling remote code execution if debug pins are breached.

5. **Reverse Proxy Security & DoS Weaknesses**:
   - *Problem*: `nginx.conf` had no proxy headers (`Host`, `X-Real-IP`, `X-Forwarded-*`), no payload limits, no timeouts, and exposed default Nginx version tokens.
   - *Risk*: Backend services cannot reliably verify client IPs (impairing auditing and rate limiting). Lack of request size limits allows memory exhaustion DoS attacks via oversized payloads. Unbounded connection timeouts leave workers vulnerable to slowloris attacks.

### Operational and Reliability Deficiencies

6. **Catastrophic Data Loss Risk (No Persistent Database Volumes)**:
   - *Problem*: `db` (Postgres) did not mount a named volume or host volume to `/var/lib/postgresql/data`.
   - *Risk*: Any container restart, update, or recreation (`docker compose down`) permanently deletes all database tables and records.

7. **Missing Health Checks and Startup Race Conditions**:
   - *Problem*: Services relied on simple `depends_on: [db, cache]`, which only checks container creation, not database or cache readiness.
   - *Risk*: When Postgres or Redis took several seconds to initialize sockets, the API crashed on startup due to failed connection attempts, requiring manual intervention or causing startup crash loops.

8. **Unreproducible Dependencies and Broken Build Caching**:
   - *Problem*: `Dockerfile` ran `RUN pip install flask psycopg2 redis`, completely ignoring `requirements.txt`. It also ran `COPY . .` before dependency installation.
   - *Risk*: Unpinned package installations lead to unpredictable builds that break on upstream releases. Placing `COPY . .` first invalidated Docker's layer cache on every minor source edit, causing unnecessary re-downloads and slow builds.

9. **Unbounded Container Logs and Resources**:
   - *Problem*: Containers had no logging limits or resource constraints (CPU/memory).
   - *Risk*: Unchecked logging fills host disks, crashing system services. A memory leak in the API could consume all host RAM, triggering the kernel OOM killer against arbitrary system processes.

10. **Lack of Internal Network Segmentation**:
    - *Problem*: All containers ran on the default bridge network with no boundaries.
    - *Risk*: Proxy could directly address databases and caches, violating the principle of least privilege.

---

## 2. Remediations Implemented

| Component | Changes Made |
| :--- | :--- |
| **`Dockerfile`** | Switched to `python:3.13-slim`; added dedicated non-root user `app:app` (UID/GID 10001); cached dependencies with `COPY requirements.txt` before code; installed pinned versions via `pip install --no-cache-dir -r requirements.txt`; switched production server to `gunicorn` with worker pool; added Python urllib health check; set `PYTHONUNBUFFERED=1` and `FLASK_ENV=production`. |
| **`compose.yaml`** | Removed host ports from `db`, `cache`, and `api`; bound only `proxy` port 80; added named persistent volume `postgres_data` (and `redis_data`); implemented explicit `frontend` and `backend` (internal) networks; configured health checks with `condition: service_healthy` startup gating; added `restart: unless-stopped`, `json-file` log rotation (10m max, 3 files), and CPU/memory resource limits; parameterized all credentials via `.env`. |
| **`nginx.conf`** | Added upstream keepalive connection pool (`keepalive 32`); configured HTTP/1.1 reverse proxying; forwarded client headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Port`); set JSON API timeouts (5s connect, 30s read/send); configured client payload limits (`client_max_body_size 10m`); suppressed server tokens; added security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`); configured structured JSON logging. |
| **`.env.example`** | Expanded template with comprehensive, documented configuration parameters for Postgres, API secrets, worker counts, and HTTP port. |
| **`.dockerignore`** | Created to exclude `.git`, `.env`, virtualenvs, cache files, and markdown documentation from Docker build contexts. |
| **`RUNBOOK.md`** | Authored concise operational runbook detailing startup, health verification, backup/restore procedures, secret management, and rollbacks. |

---

## 3. Verification Performed

In strict accordance with the instructions, all verification was performed offline inside the task directory without starting containers or using external network access:

1. **Docker Compose Configuration Validation**:
   - Executed `docker compose config` to validate syntax, volume definitions, networks, and dependency conditions. Configuration resolved cleanly with exit code 0.
   - Tested environment interpolation with `docker compose --env-file .env.example config` to verify that environment variables populate correctly.

2. **Nginx Configuration Syntax & Structure Verification**:
   - Validated block delimiter balancing (open/close braces matched).
   - Verified existence and placement of critical directives: `upstream`, `proxy_pass`, `proxy_http_version 1.1`, timeouts (`proxy_connect_timeout`, `proxy_read_timeout`, `proxy_send_timeout`), security headers, and `server_tokens off`.

3. **Dockerfile Best Practice Inspection**:
   - Verified non-root execution (`USER app`).
   - Verified separation of dependency installation and source code copy for optimal layer caching.
   - Verified production WSGI command invocation (`gunicorn` instead of `flask run`).
   - Verified container-level `HEALTHCHECK` command.

4. **Network & Port Isolation Verification**:
   - Confirmed only the `proxy` service publishes host ports (`${HTTP_PORT:-80}:80`).
   - Confirmed `db` and `cache` services only connect to `backend` (internal network) and expose ports internally.
   - Confirmed `postgres_data` volume is declared and mounted to `/var/lib/postgresql/data`.
