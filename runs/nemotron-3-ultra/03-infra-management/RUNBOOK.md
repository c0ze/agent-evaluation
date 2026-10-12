# Runbook

## Startup

```bash
cp .env.example .env
# Edit .env with secure passwords
docker compose up -d --build
```

Verify all services are healthy:
```bash
docker compose ps
docker compose logs -f
```

## Health Verification

```bash
# Overall stack health
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# API health endpoint
curl -f http://localhost/health

# Database connectivity
docker compose exec db pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}

# Redis connectivity
docker compose exec cache redis-cli ping

# Nginx proxy
curl -f http://localhost/health
```

## Backup / Restore

### Postgres Backup
```bash
docker compose exec -T db pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > backup_$(date +%F).sql
```

### Postgres Restore
```bash
docker compose exec -T db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} < backup_2024-01-15.sql
```

### Redis Backup (RDB)
```bash
docker compose exec cache redis-cli BGSAVE
docker cp $(docker compose ps -q cache):/data/dump.rdb ./redis_backup_$(date +%F).rdb
```

### Redis Restore
```bash
docker compose stop cache
docker cp ./redis_backup_2024-01-15.rdb $(docker compose ps -q cache):/data/dump.rdb
docker compose start cache
```

## Secret Handling

- Never commit `.env` to version control
- Use `.env.example` as template only
- Generate strong passwords: `openssl rand -base64 32`
- Rotate secrets periodically
- In production, use Docker secrets or external secret manager (HashiCorp Vault, AWS Secrets Manager)

## Rollback

### Image Rollback
```bash
# Tag current image before deploy
docker tag myapi:latest myapi:backup-$(date +%F)

# Rollback
docker compose down
docker tag myapi:backup-2024-01-15 myapi:latest
docker compose up -d
```

### Database Rollback
```bash
# Restore from backup (see Backup/Restore section)
docker compose exec -T db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} < backup_2024-01-15.sql
```

### Full Stack Rollback
```bash
docker compose down -v
# Restore .env from backup
# Restore postgres_data and redis_data volumes from backup
docker compose up -d
```

## Troubleshooting

| Issue | Check |
|-------|-------|
| API unhealthy | `docker compose logs api` |
| DB connection refused | `docker compose logs db` |
| Redis OOM | `docker compose exec cache redis-cli INFO memory` |
| Nginx 502 | `docker compose logs proxy` |
| High memory | `docker stats` |

## Maintenance

- Update base images monthly: `docker compose pull && docker compose up -d --build`
- Monitor disk usage: `docker system df`
- Prune unused: `docker system prune -a --volumes`