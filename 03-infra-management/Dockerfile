# syntax=docker/dockerfile:1
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dedicated non-root user with a fixed UID/GID
RUN groupadd --gid 10001 app \
 && useradd --uid 10001 --gid app --shell /usr/sbin/nologin --create-home app

# Install pinned dependencies FIRST (layer cache + reproducible installs).
# requirements.txt is the single source of truth; psycopg2-binary needs no
# compiler toolchain, keeping the image slim.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code last; owned by the runtime user, not root.
COPY --chown=app:app . .

USER app

EXPOSE 8000

# Image-level health check (compose.yaml also defines one; identical command).
# Expects the app to serve GET /healthz returning 200.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"]

# Production WSGI server (NOT `flask run`). Adjust "wsgi:app" if the entry
# point differs (e.g. "app:app"). Logs go to stdout/stderr for `docker logs`.
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--threads", "4", \
     "--timeout", "30", \
     "--graceful-timeout", "15", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "wsgi:app"]
