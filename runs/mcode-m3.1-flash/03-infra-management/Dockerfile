# syntax=docker/dockerfile:1.7
#
# Image for the small JSON API. Priorities, in order:
#   1. no secrets in the image or in the build context
#   2. run as a non-root user
#   3. production WSGI server, not the Flask dev server
#   4. reproducible installs (pinned requirements, resolved once, at build time)
#
# Build from this directory:  docker compose build api
FROM python:3.13-slim-bookworm

# PYTHONDONTWRITEBYTECODE: no stray .pyc files in the image layer.
# PYTHONUNBUFFERED: logs reach `docker compose logs` immediately.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH

# Fixed uid/gid so bind-mounted files have predictable ownership.
RUN groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app

# Dependencies first: this layer is only invalidated when requirements.txt
# changes, so ordinary code edits do not re-run pip.
COPY requirements.txt ./

# psycopg2-binary ships wheels, so no compiler toolchain is needed in the
# final image. --no-compile keeps image size down. `pip install -r` uses the
# exact == pins, so the resolved dependency set is reproducible.
# (For a stronger guarantee add --require-hashes with a generated
#  requirements.lock; that needs a network resolve and is out of scope here.)
RUN python -m venv "$VIRTUAL_ENV" \
 && pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --no-compile -r requirements.txt

# Copy only the application source. Never `COPY . .`: the build context
# contains .env, which must stay out of the image (see .dockerignore).
COPY --chown=app:app app.py ./

# Drop to the unprivileged user for the rest of the build and for runtime.
USER 10001:10001

# Not published to the host: nginx reaches the API over the internal network.
EXPOSE 8000

# Runtime tuning lives in two places on purpose:
#   * safety-relevant defaults are pinned below, so the image is correct on its
#     own (e.g. when run with `docker run` or by a different orchestrator);
#   * capacity knobs (workers/threads) are overridden in compose.yaml through
#     GUNICORN_CMD_ARGS, which gunicorn appends to this list, so tuning does
#     not require editing the image or duplicating flags in two places.
# --forwarded-allow-ips must cover the nginx container IP: gunicorn ignores
# X-Forwarded-* from any source outside this list, and ProxyFix is how the app
# learns the real client address and scheme. `*` is acceptable here because the
# API port is never published to the host, so only a container on the internal
# network can reach it. Narrow it to a fixed proxy IP if that changes.
STOPSIGNAL SIGTERM
CMD ["gunicorn", \
     "--bind=0.0.0.0:8000", \
     "--worker-class=gthread", \
     "--timeout=30", \
     "--graceful-timeout=30", \
     "--keep-alive=5", \
     "--max-requests=1000", \
     "--max-requests-jitter=100", \
     "--access-logfile=-", \
     "--error-logfile=-", \
     "--capture-output", \
     "--forwarded-allow-ips=*", \
     "app:app"]
