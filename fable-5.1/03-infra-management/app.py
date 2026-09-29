"""Minimal WSGI entrypoint for the API container.

The supplied deployment had no application module in this directory. This one
makes the stack self-consistent: gunicorn imports ``app:app`` and the health
checks in the Dockerfile, compose.yaml and nginx.conf hit a real endpoint. If
the real application lives elsewhere, keep its module as the gunicorn target
and give it a ``GET /healthz`` with the same semantics.
"""

import os

import psycopg2
import redis
from flask import Flask, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

# Fail at import time (clear error in the container logs) rather than on the first request.
DATABASE_URL = os.environ["DATABASE_URL"]
REDIS_URL = os.environ["REDIS_URL"]
CHECK_TIMEOUT_SECONDS = 2

app = Flask(__name__)
# Exactly one trusted proxy (nginx) sits in front of the API.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)


@app.get("/")
def index():
    return jsonify(service="api", status="ok")


def _check_database():
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=CHECK_TIMEOUT_SECONDS)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    finally:
        conn.close()


def _check_cache():
    client = redis.Redis.from_url(
        REDIS_URL,
        socket_connect_timeout=CHECK_TIMEOUT_SECONDS,
        socket_timeout=CHECK_TIMEOUT_SECONDS,
    )
    try:
        client.ping()
    finally:
        client.close()


@app.get("/healthz")
def healthz():
    """Readiness-style check: the process serves requests and its dependencies answer.

    Failure details are logged, not returned, so connection strings never leak.
    """
    checks = {}
    for name, check in (("database", _check_database), ("cache", _check_cache)):
        try:
            check()
            checks[name] = "ok"
        except Exception as exc:  # noqa: BLE001 - any failure must yield 503, never a crash
            app.logger.warning("health check %s failed: %s", name, type(exc).__name__)
            checks[name] = "error"
    healthy = all(state == "ok" for state in checks.values())
    body = jsonify(status="ok" if healthy else "degraded", checks=checks)
    return body, (200 if healthy else 503)
