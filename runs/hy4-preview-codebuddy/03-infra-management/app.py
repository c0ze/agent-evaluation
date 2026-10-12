"""Minimal JSON API.

Exposes the two endpoints the container/compose health checks depend on:
  /healthz  liveness  - process is up, no downstream I/O
  /readyz   readiness - Postgres and Redis are reachable
"""

from __future__ import annotations

import os

from flask import Flask, jsonify

app = Flask(__name__)


def _check_postgres() -> bool:
    import psycopg2  # imported lazily so /healthz never needs the driver

    try:
        with psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return True
    except Exception:
        app.logger.exception("postgres readiness check failed")
        return False


def _check_redis() -> bool:
    import redis

    try:
        return bool(redis.Redis.from_url(os.environ["REDIS_URL"], socket_timeout=3).ping())
    except Exception:
        app.logger.exception("redis readiness check failed")
        return False


@app.get("/healthz")
def healthz():
    return jsonify(status="ok")


@app.get("/readyz")
def readyz():
    pg, rd = _check_postgres(), _check_redis()
    payload = {"status": "ok" if (pg and rd) else "degraded", "postgres": pg, "redis": rd}
    return jsonify(payload), (200 if (pg and rd) else 503)


if __name__ == "__main__":
    # Local convenience only; containers run gunicorn (see Dockerfile CMD).
    app.run(host="127.0.0.1", port=5000)
