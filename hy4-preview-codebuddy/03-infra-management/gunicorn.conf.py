"""Gunicorn settings for the API container.

Workers are sized off the CPU limit set in compose; keep the two in sync.
"""

import multiprocessing
import os

bind = "0.0.0.0:5000"
workers = int(os.getenv("WEB_CONCURRENCY", (multiprocessing.cpu_count() * 2) + 1))
worker_class = "sync"
worker_tmp_dir = "/tmp"  # writable; /app is read-only for the app user

# Failure containment: a hung worker is killed, a leaky worker is recycled.
timeout = 30
graceful_timeout = 30
# Must exceed nginx's keepalive_timeout (15s) so nginx closes idle
# connections first instead of racing the upstream close (which yields 502s).
keepalive = 65
max_requests = 1000
max_requests_jitter = 100

# Logs go to stdout/stderr so `docker compose logs` and the json-file driver
# rotation in compose.yaml are the single source of truth.
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)s'

# Behind nginx: trust X-Forwarded-* only from the compose network (RFC1918).
# The api port is not published to the host, so nginx is the only possible peer.
forwarded_allow_ips = os.getenv(
    "FORWARDED_ALLOW_IPS", "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
)
