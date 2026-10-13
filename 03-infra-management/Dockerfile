# syntax=docker/dockerfile:1
FROM python:3.13.7-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ENVIRONMENT=production

WORKDIR /app

# Install dependencies first for layer caching; versions pinned in requirements.txt.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user, then copy only application code (see .dockerignore).
RUN addgroup --system app && adduser --system --ingroup app --uid 10001 app
COPY --chown=app:app . .
USER app

EXPOSE 5000

# App must expose GET /health returning HTTP 200.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=2).status==200 else 1)"

# Production server (not `flask run`). Tune workers to host CPU in .env if needed.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "30", "--graceful-timeout", "30", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
