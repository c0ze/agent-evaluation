FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FLASK_ENV=production \
    APP_MODULE=app:app \
    GUNICORN_WORKERS=2 \
    GUNICORN_THREADS=2 \
    GUNICORN_TIMEOUT=30

WORKDIR /app

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --no-create-home --shell /usr/sbin/nologin app

COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt

COPY --chown=root:app . .
RUN chmod -R u=rwX,g=rX,o= /app

USER 10001:10001

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=3).read()"]

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:5000 --workers \"${GUNICORN_WORKERS:-2}\" --threads \"${GUNICORN_THREADS:-2}\" --timeout \"${GUNICORN_TIMEOUT:-30}\" --graceful-timeout 15 --keep-alive 5 --access-logfile - --error-logfile - \"${APP_MODULE:-app:app}\""]
