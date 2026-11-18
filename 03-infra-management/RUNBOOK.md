# Deployment runbook

## First startup

Run from this directory with Docker Compose v2. Create the local settings and
two independent passwords once. Keep existing passwords when redeploying.

```sh
test -f .env || cp .env.example .env
(
  set -eu
  umask 077
  mkdir -p secrets
  chmod 0700 secrets
  set -C
  openssl rand -hex 32 > secrets/postgres_admin_password
  openssl rand -hex 32 > secrets/postgres_api_password
  chmod 0444 secrets/postgres_admin_password secrets/postgres_api_password
)
docker compose config --quiet
docker compose up -d --build --wait
```

nginx listens on `127.0.0.1:8080` by default. Use `.env` to change the bind
address or port. The API joins the frontend and private backend networks.
Postgres and Redis are reachable only through the backend network. Redis is
an ephemeral cache and relies on that network for access control.

## Health and stop

```sh
docker compose ps
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/readyz
docker compose logs --tail=100 proxy api db cache
```

Liveness returns `{"status":"ok"}`. Readiness runs an authenticated Postgres
query and a Redis ping and returns `{"status":"ready"}` or HTTP 503 when a
dependency fails. Update the curl port if you changed `.env`. Compose gates
startup on health and restarts exited containers. An unhealthy status alone
leaves the process running, so use the logs to diagnose it.

`docker compose down` keeps the named Postgres volume. The `-v` option deletes
that volume.

## Backup and restore

Create a logical backup and keep a protected copy off the Docker host. Store
the secret files separately. The database dump excludes cluster roles, which
the initialization script creates on a fresh volume.

```sh
(
  set -eu
  umask 077
  mkdir -p backups
  backup="backups/app-$(date -u +%Y%m%dT%H%M%SZ).dump"
  temporary="$(mktemp backups/.app-XXXXXXXX)"
  trap 'rm -f "$temporary"' EXIT
  docker compose exec -T db sh -ec \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$temporary"
  docker compose exec -T db pg_restore --list < "$temporary" >/dev/null
  mv "$temporary" "$backup"
  printf '%s\n' "$backup"
)
```

Restore into a fresh database on an initialized stack. Replace the example
archive path and use an unused database name for each restore attempt.

```sh
backup=backups/app-YYYYMMDDTHHMMSSZ.dump
docker compose exec -T db createdb -U postgres --owner=api app_restored
docker compose exec -T db pg_restore -U postgres --exit-on-error \
  --single-transaction -d app_restored < "$backup"
docker compose exec -T db psql -U postgres -d app_restored -c '\dt'
```

Verify expected tables and data. For a cutover, pause writes before the final
backup and restore. Set `POSTGRES_DB=app_restored` in `.env`, run
`docker compose up -d --wait`, and check readiness and application data. Keep
the original database until recovery is confirmed. A switch back to it omits
writes made after cutover.

When migrating data from the original deployment, take a logical backup of
its existing database first. Check the source Postgres major version and
restore compatibility before migration. The new named volume is initialized
independently of any original container or anonymous volume.

## Secrets

The `.env` file contains settings and file paths. Password files contain one
line of random hex. Compose mounts them read-only. The protected host
directory allows the mounted files to be readable by the container users.
The API receives only its own password and connects as the non-superuser
`api` role. Keep `.env`, password files, and backups out of version control.

To rotate a password, stop the proxy and API with
`docker compose stop proxy api`. Generate a fresh password and enter it at
the prompt from `docker compose exec db psql -U postgres -d postgres`, using
`\password api` or `\password postgres` for the matching role. Replace the
corresponding secret file, restore its `0444` mode, then run
`docker compose up -d --force-recreate --wait` and verify readiness. Postgres
initialization runs only on an empty data directory, so existing role
passwords are changed in Postgres during rotation.

## Rollback

Before an update, record the working deployment configuration and tag the
running API image with a unique release tag. Use the same tag in the rollback
command if the new release fails.

```sh
docker image tag "$(docker compose images -q api)" local/json-api:rollback-20261118
# After a failed API update
API_IMAGE=local/json-api:rollback-20261118 \
  docker compose up -d --no-build --wait proxy
curl -fsS http://127.0.0.1:8080/readyz
```

Set `API_IMAGE` in `.env` to the restored tag for subsequent starts. If the
update changed proxy or Compose configuration, restore the working versions
and apply them with `docker compose up -d --no-build --wait`. Keep the data
volume and confirm database compatibility before rolling back application
code. If a schema change is incompatible, use the pre-release backup and
the restore procedure. Roll back a Postgres major upgrade by restoring a
compatible backup into a fresh volume for the target version.
