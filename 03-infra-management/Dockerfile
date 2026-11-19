# syntax=docker/dockerfile:1.7
#
# Small Python API image.
# Build:  docker build -t app-api:local .
# The runtime image contains no compiler toolchain, no source credentials and
# runs as an unprivileged user (uid/gid 10001).

# ---- dependency build stage -------------------------------------------------
FROM python:3.13-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

# A venv keeps site-packages in one directory that can be copied wholesale
# into the runtime stage.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Copy only the requirement file first so that source edits do not invalidate
# the dependency layer. Every requirement in requirements.txt is pinned to an
# exact version, so a rebuild resolves the same versions (no floating `latest`).
# To defend against a compromised index, generate a hashed lock file with
#   pip-compile --generate-hashes -o requirements.lock requirements.txt
# and install it with `pip install --require-hashes -r requirements.lock`.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ---- runtime stage ----------------------------------------------------------
FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:${PATH}"

# Print a Python traceback if the interpreter dies inside a C extension.
ENV PYTHONFAULTHANDLER=1

RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home \
            --home-dir /app --shell /usr/sbin/nologin app \
 && mkdir -p /app \
 && chown app:app /app

WORKDIR /app

COPY --from=builder --chown=root:root /opt/venv /opt/venv

# Application code is owned by root and only readable/executable by the
# runtime user; the API must never need to write next to its source.
COPY --chown=root:root . .

USER 10001:10001

EXPOSE 8000
STOPSIGNAL SIGTERM

# Liveness only: confirms gunicorn is serving. Readiness (DB/Redis checks) is
# exposed separately at /readyz -- see RUNBOOK.md.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3).status == 200 else 1)"]

# `exec` replaces the shell, so gunicorn is PID 1 and receives the stop signal
# directly (compose also sets init: true, which reaps any orphaned children).
# APP_MODULE lets the same image serve a different module name without a rebuild.
CMD ["sh", "-c", "exec gunicorn --config /app/gunicorn.conf.py \"${APP_MODULE:-app:app}\""]
