# Operations Runbook

This runbook covers operational lifecycle procedures for the small Python API deployment (Nginx, Python API/Gunicorn, PostgreSQL, and Redis).

---

## 1. Startup

### Prerequisites
- Docker Engine 24.0+ and Docker Compose v2.20+ installed.
- Appropriate file permissions in the project directory.

### Initial Configuration
1. Initialize the environment file from the template:
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```
2. Edit `.env` to set strong, unique passwords and keys:
   - Set `POSTGRES_PASSWORD` to a secure random string (minimum 32 characters).
   - Set `SECRET_KEY` to a cryptographically secure random value.
   - Adjust `HTTP_PORT` (default: 80) if running alongside other web services.

### Service Launch
Start the service stack in detached mode:
```bash
docker compose up -d --build
```

### Startup Flow & Dependency Resolution
The stack starts deterministically using Docker Compose health dependency gating:
1. `db` (Postgres) and `cache` (Redis) initialize first on the isolated `backend` network.
2. `api` waits until both `db` and `cache` transition to `healthy` state (`pg_isready` and `redis-cli ping` succeed).
3. `proxy` (Nginx) initializes only after `api` reports healthy on the internal `frontend` network.

---

## 2. Health Verification

### Inspect Container Health Status
Check container statuses and healthcheck results across the stack:
```bash
docker compose ps
```
All containers should display state `Up` and status `(healthy)`.

To view raw healthcheck logs for a specific service:
```bash
docker compose exec db pg_isready -U app -d app
docker compose exec cache redis-cli ping
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q api) | python3 -m json.tool
```

### End-to-End API Health Check via Nginx
Query the public health endpoint via the reverse proxy:
```bash
curl -i http://localhost/health
```
Expected response: HTTP `200 OK` (with JSON content type).

### Log Inspection
Monitor logs across services or for individual components:
```bash
# Stream all logs
docker compose logs -f

# Check Nginx access and upstream logs
docker compose logs -f proxy

# Check API application errors
docker compose logs -f api
```

---

## 3. Backup and Restore

### PostgreSQL Backup
1. **Plain SQL Dump**:
   ```bash
   docker compose exec -T db pg_dump -U "${POSTGRES_USER:-app}" "${POSTGRES_DB:-app}" > "backup_$(date +%Y%m%d_%H%M%S).sql"
   ```
2. **Compressed Binary Format (Recommended for larger datasets)**:
   ```bash
   docker compose exec -T db pg_dump -U "${POSTGRES_USER:-app}" -Fc "${POSTGRES_DB:-app}" > "backup_$(date +%Y%m%d_%H%M%S).dump"
   ```

### PostgreSQL Restore
1. Stop the API to avoid concurrent write transactions:
   ```bash
   docker compose stop api
   ```
2. **Restore from Plain SQL Dump**:
   ```bash
   docker compose exec -T db psql -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}" < backup_file.sql
   ```
3. **Restore from Compressed Dump**:
   ```bash
   docker compose exec -T db pg_restore -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}" --clean --if-exists backup_file.dump
   ```
4. Restart the API:
   ```bash
   docker compose start api
   ```

### Redis Backup and Restore
1. Trigger a background snapshot:
   ```bash
   docker compose exec cache redis-cli bgsave
   ```
2. Check last save status:
   ```bash
   docker compose exec cache redis-cli lastsave
   ```
3. The RDB snapshot file is persisted inside the `redis_data` volume at `/data/dump.rdb`. To copy it to the host:
   ```bash
   docker compose cp cache:/data/dump.rdb ./redis_backup_$(date +%Y%m%d_%H%M%S).rdb
   ```

---

## 4. Secret Handling

### Core Principles
- **No Hardcoded Secrets**: Secrets and credentials must never be committed to git repositories, baked into Docker images, or defined statically in Compose configuration.
- **Access Restriction**: Ensure `.env` is restricted to the operating system user running the containers (`chmod 600 .env`).
- **Version Control Exclusion**: `.env` is explicitly excluded in `.gitignore` and `.dockerignore`.

### Production Secret Management
- In production CI/CD environments, inject secrets as environment variables from a centralized secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager, GitHub Actions Secrets).
- If deploying with Docker Swarm or Compose with secret support, use Docker Secrets mounted as read-only files rather than plain environment variables.

### Credential Rotation Procedure
1. Generate new credentials in `.env`.
2. For database password rotation:
   - Update password inside Postgres:
     ```bash
     docker compose exec -T db psql -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}" -c "ALTER USER ${POSTGRES_USER:-app} WITH PASSWORD 'new-secure-password';"
     ```
   - Update `POSTGRES_PASSWORD` in `.env`.
   - Recreate the API container to pick up the updated `DATABASE_URL`:
     ```bash
     docker compose up -d api
     ```

---

## 5. Rollback

### Application Code / Image Rollback
If a newly deployed version introduces errors or regressions:
1. Revert the repository or tag to the last known good commit:
   ```bash
   git checkout <last-known-good-commit-or-tag>
   ```
2. Rebuild and restart the API service:
   ```bash
   docker compose up -d --build api
   ```
3. Validate service health:
   ```bash
   docker compose ps
   curl -i http://localhost/health
   ```

### Database Migration Rollback
If the deployment included database schema migrations:
1. Run the migration rollback command before or immediately after reverting application code:
   ```bash
   docker compose exec api flask db downgrade  # or corresponding migration tool
   ```
2. If migrations cannot be reversed cleanly, restore from the pre-deployment database backup created during Step 3.

### Emergency Stack Reset
If containers enter a corrupted or unrecoverable state:
```bash
# Stop and remove containers (preserves postgres_data and redis_data volumes)
docker compose down

# Bring stack back up
docker compose up -d
```
