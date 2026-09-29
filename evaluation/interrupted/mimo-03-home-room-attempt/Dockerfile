# syntax=docker/dockerfile:1

# Pinned minor version keeps rebuilds reproducible; replace with a digest
# (python:3.13-slim@sha256:...) once you mirror base images internally.
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

# ---------------------------------------------------------------------------
# builder: resolve dependencies once into a self-contained virtualenv so the
# runtime image carries no build toolchain and no pip cache.
# ---------------------------------------------------------------------------
FROM base AS builder

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
# Only the pinned requirements file busts this layer, not application edits.
COPY requirements.txt ./
# Versions are pinned in requirements.txt, so the resolve is deterministic for
# the direct dependencies; `pip check` fails the build on a broken graph.
RUN pip install --no-cache-dir -r requirements.txt \
 && pip check

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM base AS runtime

# Fixed high UID/GID: predictable ownership for bind mounts and audit rules.
RUN groupadd --gid 10001 app \
 && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin app

COPY --from=builder --chown=root:root /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
# Source is owned by root and only readable by the runtime user: the process
# cannot rewrite its own code even if it is compromised.
COPY --chown=root:root . /app

ENV APP_PORT=8000 \
    GUNICORN_WORKERS=2 \
    GUNICORN_THREADS=4 \
    GUNICORN_TIMEOUT=30

USER 10001:10001
EXPOSE 8000

# Liveness is owned by the image so `docker run` users get it too; compose
# overrides the interval/retries per environment.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import os, sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('APP_PORT', '8000') + '/healthz', timeout=4).status == 200 else 1)"]

# Exec form: gunicorn is PID 1 and receives SIGTERM directly, so `docker
# compose stop` drains in-flight requests instead of killing a shell.
# `wsgi:app` is the entrypoint the original `flask run` discovered implicitly;
# override it at deploy time if your module is named differently.
CMD ["gunicorn", "--config", "/app/gunicorn.conf.py", "wsgi:app"]
