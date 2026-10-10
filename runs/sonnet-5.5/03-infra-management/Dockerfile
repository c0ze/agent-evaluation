FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Fixed UID/GID so file ownership and `user:` overrides are predictable.
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home \
            --home-dir /nonexistent --shell /usr/sbin/nologin app

WORKDIR /app

# Dependencies first: this layer is only rebuilt when requirements.txt changes.
# psycopg2-binary ships its own libpq, so no compiler or -dev packages are needed.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Application code stays root-owned and read-only to the runtime user.
# .dockerignore keeps .env, .git and backups out of this COPY.
COPY . .

# Module:callable that gunicorn serves. Override with APP_MODULE if the app
# is not `app.py` exposing `app`.
ENV APP_MODULE=app:app \
    WEB_CONCURRENCY=2 \
    GUNICORN_CMD_ARGS="--bind 0.0.0.0:8000 --timeout 30 --graceful-timeout 30 --keep-alive 5 --max-requests 1000 --max-requests-jitter 100 --worker-tmp-dir /dev/shm --access-logfile - --error-logfile -"

USER 10001:10001
EXPOSE 8000

# `exec` makes gunicorn PID 1 so it receives SIGTERM directly and drains cleanly.
CMD ["sh", "-c", "exec gunicorn \"$APP_MODULE\""]
