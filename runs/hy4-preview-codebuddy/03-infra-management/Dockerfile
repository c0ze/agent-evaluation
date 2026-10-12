# syntax=docker/dockerfile:1.7
# Minor-version pin keeps rebuilds reproducible. To pin by digest instead, run
# `docker build --pull` and record the resolved digest in this line.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=60 \
    FLASK_ENV=production \
    FLASK_DEBUG=0

# curl / ca-certificates are required by the HEALTHCHECK below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Non-root user with a fixed uid/gid (matches host bind-mount expectations).
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

WORKDIR /app

# Dependency manifest first: this layer is cached across source-code changes.
COPY requirements.txt ./
# Every requirement is pinned to an exact version (see RUNBOOK); add
# `--require-hashes` once hashes are generated for the full transitive set.
RUN pip install --no-cache-dir -r requirements.txt

# Application code: owned by root, world-readable, not writable by the app user.
COPY --chown=app:app app.py gunicorn.conf.py ./
RUN chmod -R a-w /app

USER 10001:10001
EXPOSE 5000

# Liveness probe: cheap, no database round-trip. Unhealthy after 3 failures.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/healthz || exit 1

# Production WSGI server, not `flask run`. Exec form so gunicorn gets SIGTERM
# directly and can drain in-flight requests.
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
