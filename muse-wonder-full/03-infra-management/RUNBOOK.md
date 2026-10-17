# Runbook — Python API behind nginx (Compose, single host)

Topology: `proxy` (nginx, the only published port) → `api` (gunicorn, port
5000 on internal networks only) → `db` (Postgres) and `cache` (Redis).
Two networks keep traffic separated: `edge` (proxy ↔ api) and `backend`
(api ↔ db/cache, no route outside). The proxy cannot reach the database
or cache. Postgres data lives in the named volume `db-data`; Redis AOF in
`cache-data`.

This is a single-host Compose deployment, not an orchestrator: no HA, no
scheduling, no zero-downtime upgrades. Host loss = downtime. Restarts
(`unless-stopped`), log rotation, and CPU/memory limits in `compose.yaml`
are local guard-rails, not a substitute for monitoring or a second host.

## Prerequisites and assumptions

- Docker Engine with Compose v2 (`docker compose version`).
- The application exposes `GET /health` returning HTTP 200 when it can
  serve (used by the api healthchecks; make it check DB/Redis connectivity
  with short timeouts so "healthy" is meaningful).
- The app entrypoint is `app.py` exposing `app` (the gunicorn target in
  the `Dockerfile`). If yours differs, change the final `app:app` argument.
- The app honours `DATABASE_URL` / `REDIS_URL` and trusts
  `X-Forwarded-*` only from this proxy (e.g. Werkzeug `ProxyFix` with
  `x_for=1, x_proto=1`) — safe because the api port is never published.
- The api and proxy containers run with read-only filesystems. If the app
  must write files (uploads, local caches), add a named volume for that
  path instead of removing `read_only`.

## Configure

```sh
cp .env.example .env
# Fill in POSTGRES_PASSWORD and REDIS_PASSWORD, e.g. with: openssl rand -hex 32
chmod 600 .env
```

Passwords must be URL-safe (hex output is) because Compose embeds them in
`DATABASE_URL` / `REDIS_URL`. Compose refuses to start if either password
is empty — that failure is intentional.

## Startup

```sh
docker compose config        # validate + show interpolated config (check for surprises)
docker compose build api
docker compose up -d
docker compose ps            # wait until db/cache/api/proxy show "(healthy)"
```

Startup order is health-gated: api starts only after `pg_isready` and the
authenticated Redis `PING` pass; the proxy starts only after api `/health`
passes. First boot is slower while Postgres initialises the volume.

## Health verification

```sh
docker compose ps                          # STATUS column shows health
curl -fsS http://localhost/healthz         # nginx itself: "ok"
curl -fsS http://localhost/health          # through proxy to the API
docker compose logs --tail=100 api db cache proxy
docker compose exec db pg_isready
docker compose exec cache redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping   # paste value from .env
```

If a service is `unhealthy`, read its logs first, then the failing check:

```sh
docker inspect --format '{{json .State.Health}}' app-api-1   # adjust container name
```

Also confirm nothing except the proxy is reachable from the host:
`docker compose ps` should show a published port only for `proxy`
(`0.0.0.0:80->80/tcp` by default). db/cache/api must show no host ports.

## Backup and restore (Postgres)

Back up with a logical dump (safe while running), and store dumps off the
host — a backup that only exists next to the volume is not a backup.

```sh
# Backup (.env values apply inside the container)
docker compose exec -T db pg_dump -U app -d app -Fc > backup-$(date +%F).dump
sha256sum backup-*.dump

# Restore into a running stack (app stopped to avoid writes mid-restore)
docker compose stop api proxy
docker compose exec -T db pg_restore -U app -d app --clean --if-exists < backup-YYYY-MM-DD.dump
docker compose up -d
```

Rehearse a restore before you need one (e.g. into a scratch
`docker compose -p restore-test` project) and verify the API passes its
health checks against the restored data. Never run `docker compose down -v`
on the real project unless data loss is intended — it deletes `db-data`.

## Secret handling

- `.env` is the only place secrets live: mode `600`, listed in
  `.gitignore` and `.dockerignore`, never pasted into images, tickets, or
  chat. `.env.example` ships with empty password fields on purpose.
- Anyone with Docker/host access can read container env and command lines
  (`docker inspect`, `ps`), including the Redis password. Treat host and
  Docker-socket access as root-equivalent and restrict it accordingly.
- Rotation: generate a new value, update `.env`, then
  `docker compose up -d db cache api` to recreate the affected
  containers. For Postgres, change the password inside the database too
  (`ALTER USER app PASSWORD '...'`) — `POSTGRES_PASSWORD` only sets it on
  first volume initialisation; rotate DB first, then `.env`, then restart
  api. Redis picks up the new password on recreate; restart api after it.
- If a secret ever lands in git or an image, rotate it — deleting the
  commit/file is not enough.
- For anything beyond this single-host setup, move secrets to the
  platform's secret store instead of a file on disk.

## Release and rollback

Releases are image tags. Set `APP_VERSION` in `.env` per release:

```sh
# Release
sed -i 's/^APP_VERSION=.*/APP_VERSION=1.4.0/' .env   # or edit by hand
docker compose build api          # builds app-api:1.4.0
docker compose up -d api proxy    # proxy waits for the new api to be healthy
docker compose ps && curl -fsS http://localhost/health

# Rollback (no rebuild needed while the old image is still on the host)
sed -i 's/^APP_VERSION=.*/APP_VERSION=1.3.2/' .env
docker compose up -d api proxy
```

Keep the last few `app-api:*` images on the host; prune only after a
release has baked. Database migrations constrain rollback: only roll the
app back across backward-compatible migrations; otherwise restore the
database from backup (above) and accept the downtime — Compose gives you
no rolling deploys, so expect a brief outage while api recreates.

## Updating base images

Base images are patch/minor-pinned (`python:3.13.7-slim-bookworm`,
`postgres:17.6-alpine`, `redis:7.4-alpine`, `nginx:1.27.5-alpine`). Bump
them deliberately: edit the tag, `docker compose build`/`pull`, redeploy,
watch health and logs. For stricter reproducibility, pin by digest
(`image: postgres:17.6-alpine@sha256:...` from `docker compose images` /
the registry) once a tested build exists. Similarly,
`requirements.txt` pins exact versions; add hashes
(`pip install --require-hashes`, generated e.g. via `pip-tools`) if the
supply-chain bar rises.

## TLS

This stack serves plain HTTP on `HTTP_PORT`. For real users, terminate TLS
in front (host reverse proxy or load balancer) or add certificates to
`nginx.conf` (and then enable HSTS). `X-Forwarded-Proto` already reflects
the scheme nginx saw, so app-level secure-cookie/redirect logic keeps
working either way.
