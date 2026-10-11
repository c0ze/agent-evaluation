# Pin to a minimal, secure, official Python base image
FROM python:3.13-slim

# Prevent Python from writing bytecode (.pyc) and ensure unbuffered stdout/stderr logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production \
    PORT=5000

WORKDIR /app

# Create a dedicated non-root group and user
RUN groupadd -g 10001 app && \
    useradd -u 10001 -g app -s /bin/sh -d /app app && \
    chown -R app:app /app

# Copy dependency definition first for optimal Docker layer caching
COPY requirements.txt ./

# Upgrade pip and install pinned dependencies reproducibly without cache
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code and set ownership to non-root user
COPY --chown=app:app . .

# Switch to non-root user
USER app

# Document service port
EXPOSE 5000

# Container healthcheck using standard library urllib
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health')" || exit 1

# Run using production WSGI server (Gunicorn) with access and error logging
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "2", "--timeout", "30", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
