"""Minimal JSON API supplied because the original deployment had no app source."""

import os
from contextlib import closing

import psycopg2
import redis
from flask import Flask, jsonify
from redis.backoff import NoBackoff
from redis.retry import Retry

app = Flask(__name__)


@app.get("/")
def index():
    return jsonify(service="api", status="ok")


@app.get("/health/live")
def live():
    return jsonify(status="alive")


@app.get("/health/ready")
def ready():
    """Test real dependency access with bounded I/O; never expose exceptions."""
    try:
        # Separate fields avoid URL-encoding problems with password characters.
        with closing(psycopg2.connect(
            host=os.environ["POSTGRES_HOST"],
            port=int(os.environ["POSTGRES_PORT"]),
            user=os.environ["POSTGRES_USER"],
            password=os.environ["POSTGRES_PASSWORD"],
            dbname=os.environ["POSTGRES_DB"],
            connect_timeout=2,
            options="-c statement_timeout=2000 -c lock_timeout=2000",
        )) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                if cursor.fetchone() != (1,):
                    return jsonify(status="unavailable"), 503

        with redis.Redis(
            host=os.environ["REDIS_HOST"],
            port=int(os.environ["REDIS_PORT"]),
            password=os.environ["REDIS_PASSWORD"],
            socket_connect_timeout=2,
            socket_timeout=2,
            retry=Retry(NoBackoff(), 0),
        ) as cache:
            if cache.ping() is not True:
                return jsonify(status="unavailable"), 503
    except (psycopg2.Error, redis.exceptions.RedisError, KeyError, ValueError):
        return jsonify(status="unavailable"), 503

    return jsonify(status="ready")
