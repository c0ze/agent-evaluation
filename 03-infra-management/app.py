"""Minimal runnable JSON API; replace/extend routes with the real application."""

import os

import psycopg2
import redis
from flask import Flask, jsonify
from redis.backoff import NoBackoff
from redis.retry import Retry


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024


@app.get("/")
def index():
    return jsonify(service="small-api")


@app.get("/health/live")
def live():
    return jsonify(status="ok")


@app.get("/health/ready")
def ready():
    """Verify authenticated access without writing application data."""
    connection = None
    cache = None
    try:
        connection = psycopg2.connect(
            host=os.environ["POSTGRES_HOST"],
            port=int(os.environ.get("POSTGRES_PORT", "5432")),
            user=os.environ["POSTGRES_USER"],
            password=os.environ["POSTGRES_PASSWORD"],
            dbname=os.environ["POSTGRES_DB"],
            connect_timeout=2,
            options="-c statement_timeout=2000",
        )
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            if cursor.fetchone() != (1,):
                raise RuntimeError("Unexpected database health result")
        cache = redis.Redis(
            host=os.environ["REDIS_HOST"],
            port=int(os.environ.get("REDIS_PORT", "6379")),
            password=os.environ["REDIS_PASSWORD"],
            socket_connect_timeout=1,
            socket_timeout=1,
            retry=Retry(NoBackoff(), 0),
        )
        if not cache.ping():
            raise RuntimeError("Unexpected cache health result")
    except (psycopg2.Error, redis.exceptions.RedisError, KeyError, ValueError, RuntimeError):
        # Do not expose connection strings, credentials, or exception messages.
        return jsonify(status="unavailable"), 503
    finally:
        if connection is not None:
            connection.close()
        if cache is not None:
            cache.close()
    return jsonify(status="ok")
