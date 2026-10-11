"""Small Flask API with health check endpoint verifying database and cache connectivity."""
import os
from flask import Flask, jsonify
import psycopg2
import redis

app = Flask(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")
REDIS_URL = os.environ.get("REDIS_URL")


@app.route("/")
def index():
    return jsonify({
        "status": "ok",
        "service": "api",
        "version": "1.0.0"
    })


@app.route("/health")
def health():
    status = {"status": "healthy", "checks": {}}
    healthy = True

    # Verify PostgreSQL connectivity
    if DATABASE_URL:
        try:
            conn = psycopg2.connect(DATABASE_URL, connect_timeout=3)
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
            conn.close()
            status["checks"]["database"] = "ok"
        except Exception as err:
            status["checks"]["database"] = f"error: {str(err)}"
            healthy = False
    else:
        status["checks"]["database"] = "not_configured"

    # Verify Redis connectivity
    if REDIS_URL:
        try:
            r = redis.from_url(REDIS_URL, socket_timeout=3)
            if r.ping():
                status["checks"]["cache"] = "ok"
            else:
                status["checks"]["cache"] = "ping_failed"
                healthy = False
        except Exception as err:
            status["checks"]["cache"] = f"error: {str(err)}"
            healthy = False
    else:
        status["checks"]["cache"] = "not_configured"

    if healthy:
        return jsonify(status), 200
    else:
        status["status"] = "unhealthy"
        return jsonify(status), 503


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
