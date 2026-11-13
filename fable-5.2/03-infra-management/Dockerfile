# Pinned to a Python minor and Debian release. For byte-for-byte rebuilds, pin
# the digest too:  --build-arg PYTHON_IMAGE=python:3.13-slim-bookworm@sha256:...
ARG PYTHON_IMAGE=python:3.13-slim-bookworm
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

# Fixed UID/GID so file ownership is predictable across rebuilds and hosts.
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home --home-dir /app \
      --shell /usr/sbin/nologin app

WORKDIR /app

# Dependencies first: this layer is rebuilt only when requirements.txt changes.
# Versions come from the pinned requirements.txt, never from "latest on PyPI".
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code stays root-owned, so the runtime user cannot modify it.
# .dockerignore keeps .env, backups and deployment files out of the image.
COPY . .

USER 10001:10001
EXPOSE 5000

# Production WSGI server; bind, workers and timeouts live in gunicorn.conf.py.
CMD ["gunicorn", "--config", "/app/gunicorn.conf.py"]
