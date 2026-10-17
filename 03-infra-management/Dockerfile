# Pin the patch version and slim variant: reproducible base, small surface.
# Bump deliberately after testing; do not use floating tags such as `python:3.13`.
FROM python:3.13.7-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dedicated non-root user/group to run the application.
RUN groupadd --system app \
    && useradd --system --gid app --no-create-home app

# Install dependencies before copying source so this layer is cached until
# requirements.txt changes. Exact versions come from the pinned
# requirements.txt (Flask, gunicorn, psycopg2-binary, redis) -- never from a
# floating `pip install flask ...` line.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source. .dockerignore keeps .env and other local files
# out of the image.
COPY --chown=app:app . .

USER app

EXPOSE 5000

# The application must expose GET /health returning HTTP 200 when it can
# serve traffic (see RUNBOOK.md). Uses only the Python standard library so
# no curl/wget has to be installed into the slim image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=3)"

# Production WSGI server (never `flask run`). Assumes the app module is
# `app.py` exposing `app` -- adjust the final argument (e.g. `wsgi:app`)
# if the project uses a different entrypoint. Tune workers/threads to the
# host (roughly 2 x vCPU workers is a common starting point).
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", \
     "--timeout", "30", "--graceful-timeout", "30", \
     "--access-logfile", "-", "--error-logfile", "-", "app:app"]
