# syntax=docker/dockerfile:1

# API image: pinned slim base, dependencies installed only from the pinned
# requirements.txt, production WSGI server (gunicorn), unprivileged runtime user.
#
# For fully reproducible builds also pin the base image to a digest:
#   docker buildx imagetools inspect python:3.13-slim     # copy the sha256
#   ARG PYTHON_IMAGE=python:3.13-slim@sha256:<digest>
ARG PYTHON_IMAGE=python:3.13-slim

# ---------------------------------------------------------------------------
# builder: self-contained virtualenv with the pinned dependencies
# ---------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Only requirements.txt is copied here, so this layer stays cached until the
# pinned dependency set changes. It is the single source of truth for what is
# installed; nothing is installed ad hoc.
WORKDIR /build
COPY requirements.txt ./
RUN pip install --require-virtualenv -r requirements.txt

# ---------------------------------------------------------------------------
# runtime: no build tooling, non-root service account
# ---------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Fixed uid/gid so ownership is predictable if a volume is ever mounted.
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --home-dir /app --no-create-home \
      --shell /usr/sbin/nologin app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
# Application code stays root-owned (read-only for the service account).
# .dockerignore keeps .env, .git, docs and the compose/nginx files out of the image.
COPY . .

USER app

EXPOSE 8000

# Same endpoint nginx and Compose rely on; stdlib only, so no curl/wget needed.
# A non-2xx response raises in urlopen and the check exits non-zero.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=4)"]

# Worker count, timeouts and logging are set in gunicorn.conf.py.
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
