import os
from contextlib import closing
from pathlib import Path

import psycopg2
from flask import Flask
from redis import Redis
from redis.backoff import NoBackoff
from redis.exceptions import RedisError
from redis.retry import Retry

app = Flask(__name__)

password_file = Path(os.environ["DATABASE_PASSWORD_FILE"])
database_password = password_file.read_bytes().rstrip(b"\n").decode("utf-8")
if not database_password:
    raise RuntimeError("The API database password file is empty.")

cache = Redis.from_url(
    os.environ["REDIS_URL"],
    socket_connect_timeout=1,
    socket_timeout=1,
    retry=Retry(NoBackoff(), 0),
)


@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.get("/readyz")
def readiness():
    try:
        with closing(
            psycopg2.connect(
                host=os.environ["DATABASE_HOST"],
                dbname=os.environ["DATABASE_NAME"],
                user=os.environ["DATABASE_USER"],
                password=database_password,
                connect_timeout=2,
                options="-c statement_timeout=1500",
            )
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        if cache.ping():
            return {"status": "ready"}
    except (psycopg2.Error, RedisError):
        pass
    return {"status": "unavailable"}, 503
