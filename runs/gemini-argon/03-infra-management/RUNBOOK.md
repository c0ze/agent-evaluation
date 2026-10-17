# Operations Runbook

## 1. Secret Handling

1. Create `.env` from `.env.example` and restrict its file permissions:
   ```sh
   cp .env.example .env
   chmod 600 .env
   ```
2. Generate a strong random password for PostgreSQL before first boot:
   ```sh
   openssl rand -base64 32
   ```
3. Set `POSTGRES_PASSWORD` in `.env` to the generated value. Never commit `.env` to git; `.dockerignore` also excludes `.env` from Docker build contexts.
4. **Credential rotation**:
   - Apply the new password in PostgreSQL:
     ```sh
     docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER \"${POSTGRES_USER}\" WITH PASSWORD 'NEW_PASSWORD';"
     ```
   - Update `POSTGRES_PASSWORD` in `.env`.
   - Recreate the dependent services:
     ```sh
     docker compose up -d db api
     ```

## 2. Startup

1. Validate the rendered Compose configuration:
   ```sh
   docker compose config -q
   ```
2. Build and start the stack in detached mode:
   ```sh
   docker compose up -d --build
   ```
   Startup order is enforced via health checks: `db` and `cache` must report `healthy` before `api` starts, and `api` must report `healthy` before `proxy` starts.
3. For public exposure beyond localhost, set `PROXY_BIND_ADDRESS=0.0.0.0` in `.env` (preferably behind a TLS-terminating firewall or load balancer).

## 3. Health Verification

1. Verify all four containers report `(healthy)` and only `proxy` binds a host port:
   ```sh
   docker compose ps
   ```
2. Check reverse proxy liveness:
   ```sh
   curl -fsS [http://127.0.0.1](http://127.0.0.1):${PROXY_PORT:-80}/healthz
   ```
3. Check end-to-end API health through nginx:
   ```sh
   curl -fsS [http://127.0.0.1](http://127.0.0.1):${PROXY_PORT:-80}/health
   ```
4. Check backend data stores directly inside the internal network:
   ```sh
   docker compose exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
   docker compose exec cache redis-cli ping
   ```
5. Tail recent logs if any service is unhealthy:
   ```sh
   docker compose logs --tail=100 api proxy db cache
   ```

## 4. Backup and Restore (PostgreSQL)

### Backup
Create a compressed, custom-format PostgreSQL dump and verify its table of contents:
```sh
set -a && . ./.env && set +a
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).dump"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl > "$BACKUP_FILE"
docker compose exec -T db pg_restore --list < "$BACKUP_FILE" >/dev/null
```

### Restore
1. Stop `api` so no active connections write to the database during restore:
   ```sh
   docker compose stop api
   ```
2. Restore the dump cleanly into PostgreSQL:
   ```sh
   set -a && . ./.env && set +a
   docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl < "$BACKUP_FILE"
   ```
3. Restart `api` and verify health:
   ```sh
   docker compose start api
   docker compose ps
   ```

## 5. Rollback

1. **Before deploying**, tag the current working API image and take a database backup:
   ```sh
   docker tag 03-infra-management-api:latest 03-infra-management-api:rollback
   ```
2. **Application rollback**:
   - Check out the previous known-good commit and rebuild `api`:
     ```sh
     git checkout <previous-commit-sha>
     docker compose up -d --build --no-deps api
     ```
   - Or restore the tagged image directly without rebuilding:
     ```sh
     docker tag 03-infra-management-api:rollback 03-infra-management-api:latest
     docker compose up -d --no-build --no-deps api
     ```
3. **Database rollback**: If the failed release included schema or data changes, follow the **Restore** procedure above using the pre-deployment `.dump` file before restarting `api`.
