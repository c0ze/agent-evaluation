FROM python:3.13.7-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

# All runtime dependencies, including transitive dependencies, are pinned.
# Do not silently resolve unpinned packages or compile native dependencies.
COPY requirements.txt ./
RUN python -m pip install --only-binary=:all: --no-deps -r requirements.txt \
    && python -m pip check

COPY app.py healthcheck.py ./
USER 10001:10001
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=10s --start-period=20s --retries=3 \
    CMD ["python", "/app/healthcheck.py"]
CMD ["gunicorn", "--bind=0.0.0.0:5000", "--workers=2", "--worker-class=gthread", "--threads=2", "--timeout=30", "--graceful-timeout=30", "--keep-alive=5", "--worker-tmp-dir=/tmp", "--max-requests=1000", "--max-requests-jitter=100", "--access-logfile=-", "--error-logfile=-", "app:app"]
