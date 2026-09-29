"""Gunicorn configuration for the API container.

Values can be overridden per environment through the variables read below
(see .env.example); everything else keeps gunicorn's defaults.
"""

import os

bind = "0.0.0.0:8000"

# Threaded workers suit a small I/O-bound JSON API (database and Redis round trips).
worker_class = "gthread"
workers = int(os.environ.get("GUNICORN_WORKERS", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "4"))

# Request limits. nginx's proxy_read_timeout is aligned with `timeout`.
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "30"))
graceful_timeout = 30
keepalive = 5
max_requests = 1000  # recycle workers periodically to bound slow leaks
max_requests_jitter = 100

# Worker heartbeat files go on tmpfs; the container filesystem is read-only.
worker_tmp_dir = "/dev/shm"

# Log to stdout/stderr so Docker's logging driver collects everything.
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")
access_log_format = (
    '%({x-forwarded-for}i)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s '
    '"%(f)s" "%(a)s" %(L)s req_id=%({x-request-id}i)s'
)

# The API port is never published; only the nginx container on the internal
# network can reach it, so its X-Forwarded-* headers are trusted.
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "*")
