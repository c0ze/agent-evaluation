# Run the API locally

Use Docker Engine and Compose v2 with `up --wait` support. Run commands from this directory and keep the same Compose project name so subsequent releases use the same `pgdata` volume.

## First start

Create a private configuration file once.

```sh
(umask 077 && set -C && cat .env.example > .env)
```

In `.env`, fill each blank password with a different value from a password manager or a separate run of `openssl rand -hex 32`. Choose the database name before first start. Set `API_TAG` to a unique value for each release you may need to roll back to.

```sh
docker compose config --quiet
docker compose build api
docker compose up -d --no-build --wait --wait-timeout 180
```

On an empty volume, Postgres creates the database and the `app_api` login that owns it. The API receives only that login's credentials. If migrating an existing deployment, dump its data with its original credentials before switching configurations. Check database ownership and role mappings when restoring a legacy dump.

## Verify health

```sh
docker compose ps
curl --fail --silent --show-error "http://$(docker compose port proxy 80)/healthz"
docker compose logs --tail=50 proxy api db cache
```

Expect four healthy services and HTTP 200 with `{"status":"ok"}`. This is the supplied app's only route. The request crosses nginx, runs a SQL query as `app_api` and pings Redis. A dependency failure returns 503 from the API. Only nginx publishes a port, on loopback (8080 by default). nginx assumes it receives HTTP directly from the client.

If startup stalls, look at the first unhealthy dependency in `docker compose ps -a`. Inspect its probe output with `docker inspect --format '{{json .State.Health}}' "$(docker compose ps -aq db)"` (substitute the failing service for `db`). Compose gates startup on health. Later probe failures change status, while `unless-stopped` restarts exited processes. Redis holds disposable cache entries and starts empty after a restart.

## Back up and restore Postgres

Take a consistent logical backup before a release. The following publishes the dump after both the export and the archive listing succeed.

```sh
backup="backups/app-$(date -u +%Y%m%dT%H%M%SZ).dump"
(
  set -e
  umask 077
  mkdir -p backups
  docker compose exec -T -u postgres db sh -ec 'exec pg_dump -U postgres -Fc -d "$POSTGRES_DB"' > "$backup.partial"
  docker compose exec -T -u postgres db pg_restore --list < "$backup.partial" > /dev/null
  mv "$backup.partial" "$backup"
)
```

Keep an encrypted copy off the Docker host. Rehearse restoration into a new database. Set `backup` to the selected archive and choose an unused name below. Run each command after the previous one succeeds. On a replacement cluster, first run the normal initialization to recreate the two roles.

```sh
docker compose exec -T -u postgres db createdb -U postgres -O app_api app_restore
docker compose exec -T -u postgres db pg_restore -U postgres --single-transaction --exit-on-error -d app_restore < "$backup"
docker compose exec -T -u postgres db psql -X -U postgres -d app_restore -c '\dt+'
```

Compare the restored tables and representative row counts with the expected backup contents. For a recovery cutover, schedule a write outage and account for writes made since the dump. Run `docker compose stop proxy api`, set `POSTGRES_DB=app_restore` in `.env`, then run `docker compose restart cache` to clear stale entries. Run the startup `up` command and health check. The original database remains available for recovery.

## Secrets

Restrict access to `.env`, dumps and the Docker daemon. Docker administrators can inspect injected environment values. Use `config --quiet` for validation and keep expanded configuration out of logs. Store production credentials in the deployment's secret store. The build context allows only the application and build inputs.

Changing a password in `.env` takes effect in recreated containers. Existing database roles retain their stored passwords until changed in Postgres. To rotate, stop proxy and API, open `docker compose exec -u postgres db psql -X -U postgres -d postgres` and use `\password app_api` or `\password postgres` at its prompt. Update the corresponding `API_DB_PASSWORD` or `POSTGRES_PASSWORD` in the secret store and `.env`, run the startup `up` command and verify health.

## Roll back

Before updating, retain the previous release files, its API image tag, the exact service images and a verified dump. For an application or proxy rollback, restore the previous release files in this directory, set the previous `API_TAG` in `.env` and keep the current valid credentials. Recreate the API and proxy using the retained local images.

```sh
docker compose up -d --no-build --pull never --no-deps --force-recreate --wait --wait-timeout 180 api proxy
curl --fail --silent --show-error "http://$(docker compose port proxy 80)/healthz"
```

Keep the database server on the volume's compatible major version. If the old application needs an earlier schema, restore its matching pre-release dump and follow the recovery cutover above. Routine shutdown is `docker compose down`. Adding `-v` deletes the named data volume.
