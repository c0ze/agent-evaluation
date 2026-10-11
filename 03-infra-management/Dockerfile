FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Unprivileged user for running the application.
RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app

# Install pinned dependencies first so the layer is reused unless
# requirements.txt changes (fast, reproducible builds).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code with correct ownership, then drop privileges.
COPY --chown=app:app . ./
USER app

EXPOSE 5000

# Production WSGI server. Assumes the Flask app object is exposed as `app`
# in `app.py` at the project root; adjust the module path if not.
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--threads", "4", \
     "--worker-tmp-dir", "/dev/shm", \
     "--timeout", "60", \
     "--graceful-timeout", "30", \
     "--access-logfile", "-", \
     "app:app"]
