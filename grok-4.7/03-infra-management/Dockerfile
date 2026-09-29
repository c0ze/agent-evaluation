FROM python:3.13-slim

# Bytecode is disabled so the unprivileged process does not need a writable /app.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/app \
    WEB_CONCURRENCY=2 \
    GUNICORN_BIND=0.0.0.0:5000 \
    GUNICORN_TIMEOUT=30 \
    GUNICORN_GRACEFUL_TIMEOUT=20 \
    GUNICORN_APP=app:app \
    FORWARDED_ALLOW_IPS=*

WORKDIR /app

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --home-dir /home/app --create-home --shell /bin/false app

COPY requirements.txt ./
RUN pip install --no-cache-dir --only-binary=:all: -r requirements.txt

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

COPY . ./
RUN chown -R root:app /app \
    && find /app -type d -exec chmod 755 {} + \
    && find /app -type f -exec chmod 644 {} +

USER app

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD ["python", "-c", "import urllib.request; raise SystemExit(0 if urllib.request.urlopen('http://127.0.0.1:5000/healthz', timeout=3).getcode() == 200 else 1)"]

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
