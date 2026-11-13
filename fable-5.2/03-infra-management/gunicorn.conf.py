"""Gunicorn settings for the API container. Every value can be overridden by env."""

import os

# WSGI entry point as "module:callable". "app:app" is what `flask run` picked up
# by default in the old image; change WSGI_APP if the application lives elsewhere.
wsgi_app = os.environ.get("WSGI_APP", "app:app")

bind = "0.0.0.0:" + os.environ.get("PORT", "5000")

# Sized for the 1 CPU / 512 MiB limit in compose.yaml. Threads suit an
# I/O-bound JSON API; raise workers together with the CPU limit.
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "4"))

# Kept just under nginx's proxy_read_timeout (35s) so a stuck request is
# ended by gunicorn, which logs it, rather than by the proxy.
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "30"))
graceful_timeout = 30
keepalive = 5

# Recycle workers periodically so a slow leak cannot grow into the memory limit.
max_requests = 2000
max_requests_jitter = 200

# The root filesystem is read-only; worker heartbeat files go to tmpfs.
worker_tmp_dir = "/dev/shm"

# Errors to stderr for `docker compose logs`. Access logging is done once, by nginx.
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")
