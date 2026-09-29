"""Gunicorn settings for the API container.

Every knob is env-overridable so one image runs unchanged in local and
production environments; the defaults suit a small JSON API on one host.
"""

import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, ValueError):
        return default


bind = f"0.0.0.0:{os.environ.get('APP_PORT', '8000')}"

# gthread: this API is I/O-bound on Postgres and Redis, and threads keep the
# resident set inside the container memory limit set in compose.yaml.
worker_class = "gthread"
workers = _int("GUNICORN_WORKERS", 2)
threads = _int("GUNICORN_THREADS", 4)

# Keep at or below nginx's proxy_read_timeout (30s) so a stuck request surfaces
# as a clean 504 at the proxy instead of a silently killed worker.
timeout = _int("GUNICORN_TIMEOUT", 30)
graceful_timeout = 30

# Longer than nginx's upstream keepalive_timeout (60s) so gunicorn never closes
# a pooled connection that nginx still considers usable.
keepalive = 75

# Cheap guard against slow leaks; jitter avoids recycling all workers at once.
max_requests = 1000
max_requests_jitter = 100

# The API port is not published and only the proxy shares a network with this
# container, so the single X-Forwarded-* hop is trusted. nginx overwrites those
# headers on every request, so clients cannot forge them.
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "*")

# Logs to stdout/stderr, collected by the container runtime (bounded json-file
# driver in compose.yaml). JSON access lines carry the proxy's request id.
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")
access_log_format = (
    '{"remote":"%({x-forwarded-for}i)s","method":"%(m)s","path":"%(U)s",'
    '"query":"%(q)s","status":"%(s)s","bytes":"%(B)s","duration_ms":"%(M)s",'
    '"request_id":"%({x-request-id}i)s","user_agent":"%(a)s"}'
)

# The container root filesystem is read-only; compose mounts a tmpfs here.
worker_tmp_dir = "/tmp"
