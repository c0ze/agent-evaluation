FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FLASK_DEBUG=0

WORKDIR /app

# Create a dedicated non-root user and group with fixed IDs matching compose tmpfs mounts.
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

# Install pinned dependencies separately so code edits reuse the dependency layer.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files owned by root:app and keep /app read-only to the app user.
COPY --chown=root:app . .
RUN chmod -R a+rX,go-w /app

USER 10001:10001

EXPOSE 5000

# Override app:app via Compose command if the WSGI callable lives in another module.
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--threads", "4", \
     "--timeout", "60", \
     "--graceful-timeout", "30", \
     "--keep-alive", "5", \
     "--worker-tmp-dir", "/dev/shm", \
     "--forwarded-allow-ips", "*", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]
