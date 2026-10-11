# syntax=docker/dockerfile:1

# Build stage: install pinned dependencies in an isolated layer
FROM python:3.13-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /src

# Install dependencies first so layer is cached independently of app code
COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt

# Runtime stage: slim image, no build tools, non-root user
FROM python:3.13-slim AS runtime

# Create an unprivileged user/group
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app

# Copy only the installed dependency tree from the builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=app:app . .

USER app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 5000

# Production WSGI server; entrypoint module/object documented in RUNBOOK.md
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "30", "--access-logfile", "-", "app:app"]