# syntax=docker/dockerfile:1
FROM python:3.13-slim

# No bytecode, unbuffered logs, no pip cache: smaller image, predictable runtime.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install pinned dependencies before copying source so this layer is cached
# independently of application changes. Versions come only from requirements.txt.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# .dockerignore keeps .env (secrets), docs and VCS data out of the image.
COPY . .

# Dedicated unprivileged user. Application code stays root-owned and read-only
# to the runtime user; gunicorn needs no write access to /app.
RUN groupadd --system app && \
    useradd --system --gid app --no-create-home --home-dir /app app
USER app

EXPOSE 5000

# Production WSGI server. Flask's built-in server is single-process and is not
# safe for production; FLASK_ENV=development also risks the Werkzeug debugger.
# The application must expose a Flask `app` object in app.py and GET /health.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "2", "--timeout", "30", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
