# Small API operations

Run all commands from this directory. Use Docker Engine with the Docker Compose
v2 plugin (2.20+ or compatible newer versions), not legacy `docker-compose` or
Swarm. This is one host with four services; it provides neither high availability
nor automatic rolling deployment. No containers were started during this task.

## Startup

```sh
umask 077
cp .env.example .env
chmod 600 .env
python3 -c 'import secrets; print(secrets.token_hex(32))'
python3 -c 'import secrets; print(secrets.token_hex(32))'
```

Put the independently generated values in `POSTGRES_PASSWORD` and
`REDIS_PASSWORD` in `.env`. Redis requires at least 32 hexadecimal characters.
Blank passwords cause configuration validation to fail. The API uses separate
connection fields, so database passwords do not require URL escaping. Set
`API_IMAGE` to a new release tag, such as `small-api:release-001`, before building.

```sh
docker compose config --quiet
docker compose up --detach --build --wait --wait-timeout 120
```

The supplied `app.py` makes this otherwise source-less example runnable: `/`
returns JSON, `/health/live` checks the application process, and `/health/ready`
performs an authenticated `SELECT 1` and Redis `PING` with bounded timeouts and
no retries. Extend this module for the real API and retain these health routes.
Gunicorn runs as uid 10001. nginx and Redis also run without root or capabilities;
their writable temporary files live on tmpfs. Postgres uses its official
entrypoint to initialize volume ownership and drop privileges.

Only nginx publishes a host port, at `127.0.0.1:8080` by default. The API reaches
`db:5432` and `cache:6379` by Docker DNS on an internal backend network. Redis is
an authenticated, disposable cache with a 128 MiB limit and LRU eviction;
recreation loses its contents. Do not use it for durable jobs or primary data.
Postgres data lives in the named `small-api_postgres_data` volume. Keep the
Compose project name stable. `docker compose down` preserves that volume;
**do not use `down --volumes` or prune it** when data must survive.

These defaults serve HTTP locally. Before public exposure, provide HTTPS at the
existing ingress and deliberately configure the bind address and firewall.
nginx overwrites incoming forwarding headers because it is the direct edge.
If another proxy is introduced, configure explicit trusted proxy addresses and
scheme handling before relying on forwarded client information.

## Health verification and diagnosis

```sh
docker compose ps
curl --fail --show-error http://127.0.0.1:8080/health/live
curl --fail --show-error http://127.0.0.1:8080/health/ready
docker compose exec -T proxy nginx -t
docker compose exec -T api id
docker compose logs --tail 100 proxy api db cache
```

Both HTTP checks should return `{"status":"ok"}`. Readiness returns HTTP 503
when either dependency fails; nginx's healthcheck exercises that same route
through the proxy. If `HTTP_PORT` changed, adjust the URLs. `docker compose ps`
should show only the proxy port published, all services healthy, and `id` should
show uid 10001. To inspect a particular probe failure locally:

```sh
docker inspect --format '{{json .State.Health}}' "$(docker compose ps --quiet api)"
```

API startup waits for healthy Postgres and Redis; proxy startup waits for a
healthy API. These conditions apply during startup. A later unhealthy status
does not restart a container or stop its dependants. `unless-stopped` restarts
exited processes, not merely unhealthy processes. Investigate logs, credentials,
memory limits, and dependencies, then recreate/restart the affected service.
DNS is re-resolved by nginx after API replacement. Logs rotate at 10 MiB with
three files per service; CPU, memory, and PID limits are starting budgets to tune
against real load, not capacity guarantees.

## Backup and restore

Back up before upgrades or migrations. These commands authenticate inside the
database container without printing the password; never copy a live data
directory as a logical backup.

```sh
umask 077
mkdir -p backups
backup="backups/app-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-password --format=custom' > "$backup.tmp" && mv "$backup.tmp" "$backup"
docker compose exec -T db pg_restore --list < "$backup"
```

Only a successful dump is renamed to `.dump`; remove a failed `.tmp` and retry.
Archive listing is a preliminary integrity check. Copy successful backups to
encrypted storage outside this host, apply a retention policy, and periodically
test a restore to a separate database before trusting them. The dump contains
the database, not cluster roles or `.env`; retain those settings securely too.

The following restore **destroys the current application database**. Select and
verify the intended backup, take a fresh pre-restore backup, and stop all writers
(including external clients). Use the recorded compatible Postgres image.

```sh
backup=backups/app-REPLACE_WITH_TIMESTAMP.dump
test -s "$backup" && \
docker compose exec -T db pg_restore --list < "$backup" && \
docker compose stop proxy api cache && \
docker compose exec -T db sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; dropdb --host=127.0.0.1 --username="$POSTGRES_USER" --no-password --if-exists --force "$POSTGRES_DB"; createdb --host=127.0.0.1 --username="$POSTGRES_USER" --no-password --owner="$POSTGRES_USER" --template=template0 "$POSTGRES_DB"' && \
docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-password --exit-on-error --single-transaction --no-owner --no-privileges' < "$backup"
```

The `&&` chain stops on failure, including a missing or unreadable archive.
Proceed only if every restore command succeeds. Stopping Redis clears stale
cached data. Dropping/recreating the database also removes objects absent from
the backup. On failure keep writers stopped,
investigate, and repeat the restore. On success:

```sh
docker compose up --detach --no-build --wait --wait-timeout 120
curl --fail --show-error http://127.0.0.1:8080/health/ready
```

## Secrets and versions

`.env` is a local convenience, not a secret manager. It and `backups/` are ignored
by Git, and the build context admits only the Dockerfile, requirements, and API
source. Do not commit real secrets, paste resolved Compose output into tickets,
or expose container inspection output: environment secrets are visible to
Docker administrators. Redis's private startup config avoids passwords in
process arguments. Use a managed secret source or mounted secret files for a
production deployment and adapt the clients accordingly.

Postgres initialization variables apply only when the data volume is empty.
Changing `.env` alone does not rotate an existing database password. Use an
interactive `psql` session (`docker compose exec db psql -U app -d app`, adjusting
the names) and `\password app`; then update `.env` and recreate `db` and `api` so
their probes and clients use the new value. Expect downtime and do not delete the
volume. To rotate Redis's password, update `.env` and recreate `cache` and `api`;
its cache contents will be lost. Re-run health verification afterward.

The official image makes `POSTGRES_USER` the bootstrap superuser. This minimal
example uses that role for its read-only readiness query; provision a separate
least-privilege application role before adding business database operations.

All Python runtime dependencies, including transitive dependencies, have exact
versions. Installation uses binary wheels with `--no-deps` and `pip check`.
Image tags specify patch versions but tags can be republished. For immutable
releases, replace the image variables with approved `repository@sha256:...`
references and retain built API images, dependency wheels/hashes, and config
snapshots. Artifact availability and current vulnerability status have not been
checked offline; review and update the pinned baseline before deployment.

## Rollback

Before each release, retain the previous API image under a distinct tag/digest,
record all image references, save `compose.yaml` and `nginx.conf` securely in
`backups/`, and take a database backup. Never overwrite or prune the sole copy of
the previous image. Expect a brief interruption while Compose replaces services.

Restore the previous Compose/nginx files and set the image variables in `.env`
to the recorded versions while retaining current valid secrets. Then:

```sh
docker compose config --quiet
docker compose up --detach --no-build --pull never --wait --wait-timeout 120
curl --fail --show-error http://127.0.0.1:8080/health/ready
```

`--no-build --pull never` reuses the retained release instead of rebuilding or
fetching a different image. Prefer backward-compatible schema changes. If a
migration prevents application rollback, keep writers stopped and use the
pre-release restore procedure; that loses writes since the backup. Never run an
older Postgres major version against a newer major's data directory. Major
database upgrades require a separate upgrade/restore plan, not a tag rollback.
