"""Gunicorn settings for the API container.

Everything is env-overridable so the same image runs unchanged in local and
production environments (12-factor); the defaults suit a small JSON API.
"""

import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


bind = f"0.0.0.0:{os.environ.get('APP_PORT', '8000')}"

# gthread: a JSON API is I/O-bound on Postgres/Redis, and threads keep the
# memory footprint inside the container limit set in compose.yaml.
worker_class = "gthread"
workers = _int("GUNICORN_WORKERS", 2)
threads = _int("GUNICORN_THREADS", 4)

# Must stay below nginx's proxy_read_timeout so the proxy sees a real 504
# instead of a killed worker.
timeout = _int("GUNICORN_TIMEOUT", 30)
graceful_timeout = 30

# Longer than nginx keepalive_timeout (65s) so the upstream never closes a
# pooled connection mid-request.
keepalive = 75

# Cheap defence against slow leaks; jitter avoids restarting all workers at once.
max_requests = 1000
max_requests_jitter = 100

# The API port is never published and only the proxy can reach the container
# network, so X-Forwarded-* from that hop is trusted. nginx overwrites those
# headers on every request (see nginx.conf), so clients cannot forge them.
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "*")

# Logs go to stdout/stderr and are collected by the container runtime.
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")
access_log_format = (
    '{"remote":"%({x-forwarded-for}i)s","method":"%(m)s","path":"%(U)s",'
    '"query":"%(q)s","status":"%(s)s","bytes":"%(B)s","duration_ms":"%(M)s",'
    '"request_id":"%({x-request-id}i)s","user_agent":"%(a)s"}'
)

# Keeps worker temp files off a possibly slow/read-only overlay; compose mounts
# a tmpfs at /tmp because the container filesystem is read-only.
worker_tmp_dir = "/tmp"
