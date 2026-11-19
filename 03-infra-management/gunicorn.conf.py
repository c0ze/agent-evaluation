"""Gunicorn configuration for the API container.

Values that operators may legitimately tune per environment come from the
environment; everything else is a deliberate, conservative default.
"""

import multiprocessing
import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")

# gthread keeps slow Postgres/Redis round-trips from blocking a whole worker
# while still bounding concurrency. Scale with `GUNICORN_WORKERS`.
_default_workers = min(4, max(2, multiprocessing.cpu_count()))
workers = _int("GUNICORN_WORKERS", _default_workers)
threads = _int("GUNICORN_THREADS", 4)
worker_class = "gthread"

# Timeouts sized for a JSON API: keep-alive matches nginx's upstream keepalive
# pool, timeout/graceful_timeout match nginx's proxy_read_timeout and
# compose's stop_grace_period.
keepalive = _int("GUNICORN_KEEPALIVE", 65)
timeout = _int("GUNICORN_TIMEOUT", 30)
graceful_timeout = _int("GUNICORN_GRACEFUL_TIMEOUT", 30)

# Recycle workers periodically so slow leaks cannot grow without bound.
max_requests = _int("GUNICORN_MAX_REQUESTS", 2000)
max_requests_jitter = 200

# Never fork after opening DB connections.
preload_app = False

# /dev/shm is a tmpfs in the container, so workers do not need a writable
# root filesystem for heartbeat files.
worker_tmp_dir = "/dev/shm"

accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOGLEVEL", "info")
access_log_format = '%({x-forwarded-for}i)s %(h)s "%(r)s" %(s)s %(b)s %(D)sus "%({user-agent}i)s" rid=%({x-request-id}i)s'

# Trust X-Forwarded-* only from the proxy. Port 8000 is never published, and
# the api container is not routable outside the compose networks, so "*" is
# equivalent to trusting the proxy here; override for other topologies.
forwarded_allow_ips = os.getenv("GUNICORN_FORWARDED_ALLOW_IPS", "*")
