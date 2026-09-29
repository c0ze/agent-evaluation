"""Gunicorn configuration for the API container.

Every value can be overridden with an environment variable so compose/.env can
tune the service without rebuilding the image.
"""
import os

# WSGI entry point, e.g. "app:app" or "myservice.wsgi:application".
wsgi_app = os.environ.get("APP_MODULE", "app:app")

bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")
workers = int(os.environ.get("GUNICORN_WORKERS", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "4"))
worker_class = "gthread"

# Worker timeout sits just below nginx's proxy_read_timeout (35s) so a stuck
# request is killed by gunicorn and logged here, not silently cut by the proxy.
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "30"))
graceful_timeout = int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", "20"))
keepalive = int(os.environ.get("GUNICORN_KEEPALIVE", "65"))  # > nginx upstream keepalive_timeout

# Recycle workers periodically to contain slow memory leaks.
max_requests = int(os.environ.get("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.environ.get("GUNICORN_MAX_REQUESTS_JITTER", "100"))

# The container root filesystem is read-only; heartbeat files go to tmpfs.
worker_tmp_dir = "/dev/shm"

# Only the nginx container talks to gunicorn; trust X-Forwarded-Proto from the
# private compose network. Override with a narrower CIDR if you pin subnets.
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "*")

# Log to stdout/stderr so Docker's logging driver captures everything.
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
