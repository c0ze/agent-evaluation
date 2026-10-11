# Operational Runbook

This runbook outlines operational procedures for the hardened small deployment stack consisting of Nginx, a Python Flask API (served via Gunicorn), PostgreSQL 16, and Redis 7.

---

## 1. Startup

### Prerequisites
- Docker Engine 24.0+ and Docker Compose v2.20+.
- Host port 80 available (or configured via `PORT` in `.env`).

### Initial Configuration
1. Initialize the environment configuration file from template:
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```
2. Edit `.env` to configure production credentials and parameters:
   ```ini
   POSTGRES_USER=app
   POSTGRES_PASSWORD=generate_a_secure_random_password
   POSTGRES_DB=app
   PORT=80
   FLASK_ENV=production
   ```

### Launching the Stack
1. Build the API image and start containers in detached mode:
   ```bash
   docker compose up -d --build
   ```
2. Verify startup status:
   ```bash
   docker compose ps
   ```
   All services (`proxy`, `api`, `db`, `cache`) should transition from starting to `healthy` state.

---

## 2. Health Verification

The stack features strict healthcheck gates and startup dependency ordering:
- `db` and `cache` must be healthy before `api` starts.
- `api` must be healthy before `proxy` begins serving traffic.

### Automated Container Health Status
Inspect service health status directly:
```bash
docker compose ps
```
Or check individual container health outputs:
```bash
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q api) | jq .
```

### HTTP Endpoint Verification
1. **Application Health (via Nginx reverse proxy):**
   ```bash
   curl -i http://localhost/health
   ```
   **Expected Response:** HTTP 200 OK
   ```json
   {
     "status": "healthy",
     "checks": {
       "database": "ok",
       "cache": "ok"
     }
   }
   ```
2. **Nginx Reverse Proxy Liveness:**
   ```bash
   curl -i http://localhost/healthz
   ```
   **Expected Response:** HTTP 200 OK
   ```json
   {"status":"ok","proxy":"healthy"}
   ```

### Component-Level Diagnostics
- **PostgreSQL Database:**
  ```bash
  docker compose exec -T db pg_isready -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}"
  ```
- **Redis Cache:**
  ```bash
  docker compose exec -T cache redis-cli ping
  # Expected: PONG
  ```
- **Logs Inspection:**
  ```bash
  docker compose logs -f --tail=100 api
  docker compose logs -f --tail=100 proxy
  ```

---

## 3. Backup and Restore

### PostgreSQL Backup (Logical Dump)
Perform a non-blocking logical backup using `pg_dump`:
```bash
BACKUP_FILE="backup_postgres_$(date +%Y%m%d_%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}" | gzip > "${BACKUP_FILE}"
```
Verify the backup file is non-empty:
```bash
ls -lh "${BACKUP_FILE}"
```

### PostgreSQL Restore
1. Verify the backup archive integrity:
   ```bash
   gunzip -t "${BACKUP_FILE}"
   ```
2. Temporarily stop incoming write traffic by scaling down API or stopping proxy:
   ```bash
   docker compose stop proxy api
   ```
3. Restore database schema and data:
   ```bash
   gunzip -c "${BACKUP_FILE}" | docker compose exec -T db psql -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}"
   ```
4. Restart services and verify health:
   ```bash
   docker compose up -d
   docker compose ps
   ```

### Redis Cache Persistence
Redis is ephemeral cache in this topology. If snapshotting is required:
```bash
docker compose exec -T cache redis-cli bgsave
```

---

## 4. Secret Handling

### Guidelines
- **Zero Credentials in Code:** Never commit `.env` or hardcode passwords in `compose.yaml` or `Dockerfile`.
- **File System Permissions:** Keep `.env` restricted to owner permissions (`chmod 600 .env`).
- **Exclusion:** `.env` is excluded from Docker build context via `.dockerignore` and git tracking via `.gitignore`.
- **Production Orchestration:** In production CI/CD pipelines, inject secrets from an external secrets vault (e.g., HashiCorp Vault, AWS Secrets Manager, GitHub Secrets) into the runner environment or a restricted `.env` file before executing compose commands.

### Secret Rotation Procedure (PostgreSQL Password)
1. Generate new password: `NEW_PASSWORD=$(openssl rand -hex 24)`.
2. Update the user password in PostgreSQL:
   ```bash
   docker compose exec -T db psql -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}" -c "ALTER USER ${POSTGRES_USER:-app} WITH PASSWORD '${NEW_PASSWORD}';"
   ```
3. Update `POSTGRES_PASSWORD` in `.env`.
4. Gracefully restart the API service with the new credentials:
   ```bash
   docker compose up -d --no-deps api
   ```
5. Verify health:
   ```bash
   docker compose ps
   curl -f http://localhost/health
   ```

---

## 5. Rollback

In the event of a faulty application deployment, failed dependency update, or unrecoverable error:

### Application Rollback
1. Checkout the previous known-stable git commit or release tag:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT_OR_TAG>
   ```
2. Rebuild and deploy containers:
   ```bash
   docker compose up -d --build
   ```
3. Confirm all services return to a healthy state:
   ```bash
   docker compose ps
   curl -f http://localhost/health
   ```

### Database Rollback (Schema / Data Corruption)
If a failed migration damaged the database schema or data:
1. Stop traffic to prevent further inconsistencies:
   ```bash
   docker compose stop proxy api
   ```
2. Restore database from pre-deployment snapshot (see Section 3).
3. Start stack with the previous stable application version:
   ```bash
   docker compose up -d
   ```
4. Run health check verification:
   ```bash
   curl -f http://localhost/health
   ```
