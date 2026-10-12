import os

import psycopg2
import redis
from flask import Flask, jsonify

app = Flask(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
REDIS_URL = os.environ.get("REDIS_URL", "")


def _db_ok():
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=3)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
    finally:
        conn.close()
    return True


def _cache_ok():
    return redis.Redis.from_url(REDIS_URL, socket_timeout=3).ping()


@app.get("/healthz")
def healthz():
    checks = {}
    for name, check in (("db", _db_ok), ("cache", _cache_ok)):
        try:
            check()
            checks[name] = "ok"
        except Exception as exc:
            checks[name] = "error: {}".format(exc.__class__.__name__)

    if all(value == "ok" for value in checks.values()):
        return jsonify(status="ok", checks=checks), 200
    return jsonify(status="error", checks=checks), 503


@app.get("/")
def index():
    return jsonify(service="api", status="ok")
