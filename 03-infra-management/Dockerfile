# syntax=docker/dockerfile:1.7
# ---- builder stage: compile deps into a clean wheel layer ----
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# OS-level deps for psycopg2-binary build (kept in builder only)
RUN apt-get update \
    && apt-get install --no-install-recommends -y build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt


# ---- runtime stage: slim image, non-root user, production server ----
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Defaults; override via compose env
    GUNICORN_WORKERS=2 \
    GUNICORN_TIMEOUT=30 \
    PORT=8000

# Runtime-only OS libs for psycopg2 / healthcheck
RUN apt-get update \
    && apt-get install --no-install-recommends -y libpq5 curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 app \
    && useradd  --system --uid 1001 --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app

# Bring in installed packages from the builder
COPY --from=builder /install /usr/local

# Application source only — no .env, .git, tests, etc.
COPY --chown=app:app app/ ./app/

USER app

EXPOSE 8000

# Use tini as PID 1 so signals and zombies are handled correctly
ENTRYPOINT ["/usr/bin/tini", "--"]

# Production WSGI server (gunicorn), not flask dev server
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} \
                  --workers ${GUNICORN_WORKERS} \
                  --timeout ${GUNICORN_TIMEOUT} \
                  --access-logfile - \
                  --error-logfile - \
                  app.wsgi:app"]