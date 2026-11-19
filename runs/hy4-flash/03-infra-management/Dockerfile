# Pin the base image by digest for fully reproducible builds, e.g.
#   FROM python:3.13-slim-bookworm@sha256:<digest>
# A fixed variant tag is used here so the image stays buildable without a
# network lookup of a digest. See RUNBOOK.md.
FROM python:3.13-slim-bookworm

# Don't write bytecode or buffer stdout/stderr: Python output goes straight to
# Docker's log driver so `docker logs` shows the application in real time.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies from the pinned manifest *before* copying application
# code so the dependency layer is cached and rebuilds are reproducible. Every
# version in requirements.txt is pinned with == (use `pip freeze`/a lock file
# or --require-hashes with a hash manifest for supply-chain-grade pinning).
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --upgrade pip==25.2 \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as an unprivileged, fixed UID/GID given numerically so the build does
# not depend on useradd/groupadd being present in the slim base image.
# Binding to 8000 (>1024) needs no NET_BIND_SERVICE capability.
RUN chown -R 10001:10001 /app
USER 10001:10001

EXPOSE 8000

# Liveness probe: the application must expose GET /healthz (override via
# HEALTHCHECK_PATH). A 200 response is required; urllib is in the stdlib so no
# extra packages or shell tools are needed in the slim image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import os,sys,urllib.request; \
p=os.environ.get('HEALTHCHECK_PATH','/healthz'); \
r=urllib.request.urlopen('http://127.0.0.1:8000'+p, timeout=4); \
sys.exit(0 if r.status==200 else 1)" || exit 1

# Production WSGI server instead of the Flask development server. Gunicorn's
# access/error logs are written to stdout/stderr for the container log driver.
CMD ["gunicorn", "app:app", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--threads", "2", \
     "--timeout", "30", \
     "--graceful-timeout", "30", \
     "--keep-alive", "5", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
