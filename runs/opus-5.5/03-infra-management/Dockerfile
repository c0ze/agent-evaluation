# syntax=docker/dockerfile:1
#
# Production image for the Python (Flask) API.
# - slim, pinned base (bump deliberately; pin by digest in CI for full reproducibility)
# - dependencies installed only from the pinned requirements.txt, in their own layer
# - runs as an unprivileged user under gunicorn (not the Flask dev server)

ARG PYTHON_VERSION=3.13
FROM python:${PYTHON_VERSION}-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Fixed UID/GID so volume ownership and security policies are predictable.
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin app

WORKDIR /app

# Install dependencies before copying source so code changes do not bust this layer.
# requirements.txt pins exact versions; psycopg2-binary ships wheels, so no compiler is needed.
COPY requirements.txt .
RUN pip install --no-cache-dir --no-compile -r requirements.txt

# Application code is owned by root and only readable by the app user.
# .dockerignore keeps .env, VCS data and backups out of the build context.
COPY . .

USER app:app

EXPOSE 8000

# Gunicorn settings (bind, workers, timeouts, logging, app module) live in gunicorn.conf.py
# and can be tuned through environment variables without rebuilding.
CMD ["gunicorn", "--config", "/app/gunicorn.conf.py"]
