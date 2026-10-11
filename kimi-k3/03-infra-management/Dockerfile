# syntax=docker/dockerfile:1

# Pinned, minimal base image (no `latest`, slim variant to reduce attack surface).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first for layer caching. Versions are pinned in
# requirements.txt, so installs are reproducible.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Run as an unprivileged user.
RUN groupadd --system app && useradd --system --gid app --home /app app

# Copy application code and hand ownership to the non-root user.
COPY --chown=app:app . .
USER app

EXPOSE 8000

# Production WSGI server (gunicorn), not the Flask dev server.
# Adjust the module path (app:app) to your actual WSGI entrypoint.
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "4", \
     "--timeout", "30", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
