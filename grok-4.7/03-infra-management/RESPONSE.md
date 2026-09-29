# Response

## Highest-risk original problems

1. **Postgres was reachable with a known superuser password.** `compose.yaml` set `POSTGRES_USER` and `POSTGRES_PASSWORD` to `admin` and `password`, set `DATABASE_URL` to `postgres://admin:password@db:5432/app`, and published `5432:5432`. A host that accepted connections on 5432 allowed a full database login. `.env.example` already defined different variable names and was not read by Compose.

2. **Redis was published with no authentication.** `6379:6379` was mapped on the host, and the server had no password. Callers who could reach that port could read and write the cache.

3. **The API process was the Flask development server, running as root.** The image was `python:3.13`, `pip install flask psycopg2 redis` ignored the pinned `requirements.txt` (including `psycopg2-binary` and `gunicorn`), `FLASK_ENV=development` was set, and the command was `flask run --host=0.0.0.0`. Port 5000 was published, so clients could bypass nginx. Builds were not reproducible, and a request-handling bug ran as root in the container.

4. **Startup did not wait for usable dependencies, and Postgres data was ephemeral.** `depends_on` listed service names only, so Compose waited for process start. There were no health checks. The database container had no volume, so deleting it deleted the data.

5. **The proxy did not behave like an API edge, and the host had no failure bounds.** `nginx.conf` contained `proxy_pass http://api:5000` and no `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, body limit, or timeouts. One network attached the proxy to Postgres and Redis as well as the API. `nginx`, `postgres`, and `redis` used `latest`. No service set a restart policy, a log size cap, or a memory limit, so a crash loop or one leak could fill the disk or starve the host.

## Verification

Checks ran in this directory. No container was started, and the network was not used. `docker images` showed no local `nginx`, `postgres`, `redis`, or `python` images, and `nginx` is not installed on the host, so `nginx -t`, image builds, and live health requests were not run.

- `docker compose --env-file .env.example config` with Docker Compose v5.1.4 exited 0. The rendered project publishes only `127.0.0.1:8080` to proxy port 80. `api`, `db`, and `cache` have no host ports. `api` waits for `db` and `cache` with `condition: service_healthy`; `proxy` waits for `api` the same way. Network `data` is `internal: true`. The named volume is `app_pgdata`, mounted at `/var/lib/postgresql/data`. Resource limits were normalized to 128 MiB / 0.25 CPU (proxy), 512 MiB / 1 CPU (api), 1 GiB / 1 CPU (db), and 256 MiB / 0.5 CPU (cache). Postgres shared memory is 128 MiB. Logging is `json-file` with `max-size` 10m and `max-file` 3. `DATABASE_URL` and `REDIS_URL` were built from the example variables and the hostnames `db` and `cache`.
- `docker compose --env-file` pointed at an empty env file exited 1 with `required variable POSTGRES_USER is missing a value`.
- `sh -n` passed for `docker-entrypoint.sh`, `redis-entrypoint.sh`, and `postgres-healthcheck.sh`.
- The Dockerfile `HEALTHCHECK` and `ENTRYPOINT` exec forms parse as JSON. `nginx.conf` has balanced braces (13 pairs). Directory files have no CR bytes. `Dockerfile`, `compose.yaml`, `nginx.conf`, and the three shell scripts contain none of `flask run`, `FLASK_ENV`, `:latest`, `5432:5432`, `6379:6379`, or `admin:password`.

Direct dependencies remain the pinned `requirements.txt`. Transitive hashes and image digests were not added; producing them needs a package index and a registry. There is no application module in this directory, so `GET /healthz` was not called. Compose accepted the cgroup limits in its rendered model; a running container was not inspected.
