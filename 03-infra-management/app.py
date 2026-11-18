import os
from contextlib import closing

from flask import Flask
import psycopg2
import redis
from redis.backoff import NoBackoff
from redis.retry import Retry


app = Flask(__name__)
cache = redis.Redis.from_url(
    os.environ["REDIS_URL"],
    socket_connect_timeout=1,
    socket_timeout=1,
    retry=Retry(NoBackoff(), 0),
)


@app.get("/healthz")
def healthz():
    """Report readiness using the API's own database and cache connections."""
    try:
        connection = psycopg2.connect(connect_timeout=2, options="-c statement_timeout=1500")
        with closing(connection) as db:
            with db.cursor() as cursor:
                cursor.execute("SELECT 1")
        if cache.ping():
            return {"status": "ok"}
    except (psycopg2.Error, redis.RedisError) as exc:
        app.logger.warning("Readiness check failed (%s)", type(exc).__name__)
    return {"status": "unavailable"}, 503
