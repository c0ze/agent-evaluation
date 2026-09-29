# syntax=docker/dockerfile:1

# Pinned minor version keeps rebuilds reproducible; replace with a digest
# (python:3.13-slim@sha256:...) once base images are mirrored internally.
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

# ---------------------------------------------------------------------------
# builder: install dependencies once into a self-contained virtualenv, so the
# runtime image carries no pip cache and no build toolchain.
# ---------------------------------------------------------------------------
FROM base AS builder

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
# Only requirements.txt busts this layer, not application edits.
COPY requirements.txt ./
# Pinned requirements instead of the original `pip install flask psycopg2
# redis`, which floated to whatever was newest on every build and needed a C
# toolchain for psycopg2. `pip check` fails the build on an inconsistent graph.
RUN pip install --no-cache-dir -r requirements.txt \
 && pip check

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM base AS runtime

# Fixed high UID/GID: predictable ownership for volumes and host audit rules.
RUN groupadd --gid 10001 app \
 && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin app

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
# Code stays owned by root and is only readable by the service account, so a
# compromised process cannot rewrite its own source.
COPY --chown=root:root . /app

ENV APP_PORT=8000 \
    GUNICORN_WORKERS=2 \
    GUNICORN_THREADS=4 \
    GUNICORN_TIMEOUT=30

USER 10001:10001
EXPOSE 8000

# Shipped with the image so plain `docker run` gets it too; compose tunes the
# interval and start period per environment.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["python", "-c", "import os, sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('APP_PORT', '8000') + '/healthz', timeout=4).status == 200 else 1)"]

# Production WSGI server instead of the Flask development server, in exec form
# so gunicorn is PID 1 and SIGTERM drains in-flight requests instead of killing
# a shell. FLASK_ENV=development (debugger + reloader) is gone: it is remote
# code execution if the debug console is ever reachable.
# `wsgi:app` is the entrypoint the original `flask run` discovered implicitly;
# adjust if the application module is named differently.
CMD ["gunicorn", "--config", "/app/gunicorn.conf.py", "wsgi:app"]
