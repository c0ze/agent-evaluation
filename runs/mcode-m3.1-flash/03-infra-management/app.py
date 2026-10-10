"""Minimal JSON API for the deployment.

This module exists so the health checks in compose.yaml probe something real
instead of a guess. It is deliberately small:

  GET /health  liveness  - "the process is up and serving". No dependency
                          calls, so a database outage never triggers a
                          restart loop.
  GET /ready   readiness - "dependencies are usable". Backs the proxy's
                          `depends_on: condition: service_healthy`, so nginx
                          is only declared healthy once the API can actually
                          serve traffic.

Replace the `/` body with the real application; keep the two health
endpoints and their semantics (liveness cheap, readiness checks deps).
"""

import os
import time

# Only the web framework is imported at startup. The database and cache
# drivers are imported inside the readiness checks, so a broken or missing
# driver shows up as /ready returning 503 rather than the process failing to
# boot - which is what keeps /health honest as a liveness signal.
from flask import Flask, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)

# Trust exactly one reverse proxy hop (nginx), so request.remote_addr and
# url_scheme are the real client values instead of the proxy's. The X-Forwarded-*
# headers nginx sets are only honoured from that hop.
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1,
    x_port=0,
    x_prefix=0,
)

# Seconds. Kept short so a hung dependency fails the probe instead of
# stalling it; the probe is retried by the healthcheck interval.
DEPENDENCY_TIMEOUT = float(os.environ.get("DEPENDENCY_TIMEOUT", "2"))


def _database_url() -> str:
    """Build a DSN from discrete parts, so passwords need no URL escaping.

    A password containing '@', ':' or '/' breaks a hand-written
    postgres:// URL; libpq keyword arguments do not have that failure mode.
    An explicit DATABASE_URL still wins if it is set.
    """
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    return " ".join(
        [
            f"host={os.environ.get('POSTGRES_HOST', 'db')}",
            f"port={os.environ.get('POSTGRES_PORT', '5432')}",
            f"user={os.environ.get('POSTGRES_USER', 'app')}",
            f"password={os.environ.get('POSTGRES_PASSWORD', '')}",
            f"dbname={os.environ.get('POSTGRES_DB', 'app')}",
            "connect_timeout=3",
        ]
    )


def _redis_url() -> str:
    url = os.environ.get("REDIS_URL")
    if url:
        return url
    host = os.environ.get("REDIS_HOST", "cache")
    port = os.environ.get("REDIS_PORT", "6379")
    password = os.environ.get("REDIS_PASSWORD", "")
    auth = f":{password}@" if password else ""
    return f"redis://{auth}{host}:{port}/0"


def check_postgres() -> tuple[bool, str]:
    started = time.monotonic()
    conn = None
    try:
        import psycopg2

        conn = psycopg2.connect(_database_url(), connect_timeout=3)
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return True, f"{(time.monotonic() - started) * 1000:.1f}ms"
    except Exception as exc:  # noqa: BLE001 - reported, never fatal to serving
        return False, type(exc).__name__
    finally:
        # psycopg2's connection context manager only ends the transaction, it
        # does not close the socket, so closing is explicit.
        if conn is not None:
            conn.close()


def check_redis() -> tuple[bool, str]:
    started = time.monotonic()
    client = None
    try:
        import redis

        client = redis.Redis.from_url(
            _redis_url(),
            socket_timeout=DEPENDENCY_TIMEOUT,
            socket_connect_timeout=DEPENDENCY_TIMEOUT,
        )
        client.ping()
        return True, f"{(time.monotonic() - started) * 1000:.1f}ms"
    except Exception as exc:  # noqa: BLE001
        return False, type(exc).__name__
    finally:
        # The client owns a connection pool; release it per probe so a
        # frequent probe cannot accumulate idle sockets in the worker.
        if client is not None:
            client.close()


@app.get("/health")
def health():
    """Liveness: process is up. Must not touch dependencies."""
    return jsonify(status="ok"), 200


@app.get("/ready")
def ready():
    """Readiness: dependencies are usable."""
    db_ok, db_detail = check_postgres()
    cache_ok, cache_detail = check_redis()
    healthy = db_ok and cache_ok
    return (
        jsonify(
            status="ok" if healthy else "degraded",
            checks={"postgres": db_ok, "redis": cache_ok},
            details={"postgres": db_detail, "redis": cache_detail},
        ),
        200 if healthy else 503,
    )


@app.get("/")
def index():
    return jsonify(service=os.environ.get("SERVICE_NAME", "api"), status="ok"), 200


if __name__ == "__main__":
    # Local debugging only. Compose runs gunicorn (see Dockerfile CMD).
    app.run(host="127.0.0.1", port=8000, debug=False)
