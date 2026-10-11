# syntax=docker/dockerfile:1
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    WEB_CONCURRENCY=2

WORKDIR /app

# Unprivileged runtime user with a fixed UID so file ownership is predictable
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

# Install pinned dependencies before copying code so code edits reuse this layer
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Code is root-owned, so the runtime user can read but not modify it.
# .dockerignore keeps .env and other local files out of the image.
COPY . .

USER app
EXPOSE 5000

# Production WSGI server instead of `flask run`. Assumes app.py defines a Flask object named `app`.
# The port is not published by compose, so only the proxy can reach it and trusting its X-Forwarded-* headers is safe.
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--timeout", "30", \
     "--graceful-timeout", "30", \
     "--access-logfile", "-", \
     "--forwarded-allow-ips", "*", \
     "app:app"]
