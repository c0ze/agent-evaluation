# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Stage 1 - dependencies: pinned, reproducible, isolated in a virtualenv so
# the runtime image carries no pip cache or build leftovers.
# ---------------------------------------------------------------------------
FROM python:3.13-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip check

# ---------------------------------------------------------------------------
# Stage 2 - runtime: non-root, no shell tooling added, gunicorn as PID 1.
# ---------------------------------------------------------------------------
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_MODULE="app:app" \
    GUNICORN_BIND="0.0.0.0:8000" \
    WEB_CONCURRENCY="2" \
    HEALTHCHECK_PATH="/healthz"

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /bin/false app

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=app:app . .

USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:8000' + os.environ.get('HEALTHCHECK_PATH', '/healthz'), timeout=3).read()"

CMD ["sh", "-c", "exec gunicorn \"${APP_MODULE}\" --bind \"${GUNICORN_BIND}\" --workers \"${WEB_CONCURRENCY}\" --threads 4 --timeout 30 --graceful-timeout 30 --keep-alive 5 --max-requests 1000 --max-requests-jitter 100 --access-logfile - --error-logfile - --forwarded-allow-ips '*'"]
