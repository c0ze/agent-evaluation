# Local deployment runbook

Run commands from this directory using Docker Engine and a current Docker Compose
plugin (`docker compose`). The supplied `app.py` is a minimal JSON API: replace
its root handler with business logic while keeping the health endpoints.

## Startup

```sh
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
openssl rand -hex 32
```

Put the two different generated values into `POSTGRES_PASSWORD` and
`REDIS_PASSWORD` in `.env`. Give `API_IMAGE` a unique release tag, such as
`local-json-api:release-001`, so an upgrade does not overwrite the rollback image.
Then run:

```sh
docker compose config --quiet
docker compose build api
docker compose up -d --wait --wait-timeout 180
docker compose ps
curl --fail --show-error http://127.0.0.1:8080/
```

Image pulls and the build need access to the pinned images and Python wheels;
an offline deployment needs those artifacts staged beforehand. Python package
versions, including transitive dependencies, are fixed; the build uses binary
wheels, disables dependency resolution, and runs `pip check`. Image patch tags
are fixed but remain mutable. For byte-identical release inputs, record approved
image digests and wheel hashes in a controlled release process. These versions
were not checked against current security advisories in this offline task.

Only nginx publishes a port, at `127.0.0.1:8080` by default. Adjust `.env` if using
a different host address/port. The API and proxy share `frontend`; only the API,
Postgres, and Redis share the `internal` backend network. Service DNS names are
`api:5000`, `db:5432`, and `cache:6379`. Host administrators still control Docker
and can access its resources. The HTTP-only default is for local use. Before
public exposure, configure TLS at the ingress and any required API authentication.
If adding another reverse proxy, explicitly configure its trusted addresses and
forwarded-header handling; the supplied nginx overwrites incoming client identity
headers and reports its own HTTP scheme.

## Health and operations

```sh
docker compose ps
docker compose exec -T api python /app/healthcheck.py
docker compose exec -T proxy nginx -t
curl --fail --show-error http://127.0.0.1:8080/health/live
curl --fail --show-error http://127.0.0.1:8080/health/ready
docker compose logs --tail=100 proxy api db cache
```

Use the configured host port if changed. Liveness checks the API process.
Readiness executes an authenticated Postgres query and Redis PING, returning
HTTP 503 without exception details if either fails. Database health checks use
TCP/password authentication to the configured database; Redis requires an
authenticated PONG. Proxy health traverses nginx and API readiness. API startup
waits for both dependencies to become healthy; nginx startup waits for the API.
Nginx refreshes API addresses using Docker DNS after container replacement.

Health dependency conditions apply at startup. Compose does not restart an
unhealthy-but-running process or provide failover, rolling updates, or recovery
from a lost host. `unless-stopped` handles process exits and daemon restarts;
investigate unhealthy services using logs before restarting them. Resource limits
are local container ceilings, not reservations or capacity guarantees. Tune them
under load; Redis evicts at 128 MB with 256 MB container headroom. Each service
keeps at most three 10 MB JSON log files. Keep secrets out of request URLs and logs.

Use `docker compose stop` to stop the stack. `docker compose down` preserves the
named Postgres volume, `small-json-api_postgres_data` with the default project
name. **Do not use `down --volumes` or prune that volume** unless intentionally
discarding the database. Keep the project name stable. Redis is a disposable
cache with persistence disabled; do not use it for durable jobs or records.

## Backup and restore

Create a consistent logical backup while Postgres is healthy. The temporary
suffix prevents a failed dump from looking like a finished backup:

```sh
umask 077
mkdir -p backups
backup="backups/app-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db sh -ec \
  'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' \
  > "$backup.partial" && mv "$backup.partial" "$backup"
docker compose exec -T db pg_restore --list < "$backup" > /dev/null
```

Check each command's exit status. Copy successful backups to protected storage
outside the Docker host, encrypt them as appropriate, and regularly test a restore
in a separate deployment. A catalog listing alone is not a restore test. This
backs up the application database, not cluster-wide roles; protect the matching
configuration and credentials separately. The initial role/database are created
by the Postgres image on an empty volume.

The following **replaces objects in the target database** from a chosen backup.
Take a fresh backup first, verify the target and file, and stop every database
writer. Use matching Postgres major versions. Do not resume the API if restore
fails; the transaction rolls back the restore's changes.

```sh
backup=backups/REPLACE-WITH-VERIFIED-BACKUP.dump
test -r "$backup" && docker compose stop proxy api &&
docker compose exec -T db sh -ec \
  'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error' \
  < "$backup" && docker compose up -d --wait --wait-timeout 180
```

Run the health checks and application smoke checks after restoration. Use a fresh,
isolated volume/deployment for recovery rehearsals or an exact replacement that
must also remove objects absent from the dump; `--clean` only drops dumped objects.

## Secrets

Empty passwords fail Compose validation. `.env` is excluded from source control
and the allowlisted build context; never commit it or share rendered Compose
configuration, which contains the interpolated values. Environment variables
and the Redis server command are visible to Docker administrators; `.env` is
local convenience, not a secret store. Use managed/file-mounted secrets and
appropriate application support for deployments requiring stronger isolation.
Prefer generated hex passwords; if entering other characters, single-quote `.env`
values containing `$` to prevent Compose interpolation. The API supplies database
credentials as separate connection fields, so URL encoding is unnecessary.

Changing `.env` does **not** change an existing Postgres role password. For a
rotation, stop proxy/API, open `docker compose exec db sh -c
'exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'`, and use psql's
interactive `\password` command for that role. Then update the protected `.env`
and recreate `db` and `api` with `docker compose up -d --force-recreate --wait`.
Keep the data volume. Coordinate Redis password changes in `.env` with recreation
of both cache and API; recreation intentionally loses cached data. The supplied
Postgres user is the image's bootstrap superuser; provision a separate, restricted
application role before adding business data or broader application functionality.

## Rollback

Before an upgrade, retain the working API image under its unique release tag,
save the matching Dockerfile/Compose/nginx/configuration files securely, and take
a database backup. Build a new API tag, deploy with `up -d --wait`, and verify
health plus application behavior. Expect brief downtime with this single API.

To roll back, restore the saved configuration files, set `API_IMAGE` to the
retained previous tag, and run:

```sh
docker compose up -d --no-build --pull never --wait --wait-timeout 180
```

Use the current valid credentials if they were rotated. Keep the Postgres volume
and compatible database/Redis versions. An image rollback does not undo schema
migrations; for incompatible schema changes, stop writers and use a tested
migration reversal or the backup/restore procedure (which loses post-backup
writes). Never point an older Postgres major version at a newer data directory;
restore a compatible logical backup into a fresh volume instead. Repeat health
and application checks before considering the rollback complete.
