ARG PYTHON_IMAGE=python:3.13.7-slim-bookworm
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Every runtime dependency, including transitive dependencies, is pinned.
# --no-deps prevents the installer from silently adding unlocked packages.
COPY requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir --only-binary=:all: --no-deps -r requirements.txt \
    && python -m pip check \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

COPY --chown=10001:10001 app.py ./app.py
USER 10001:10001

EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=8s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health/ready', timeout=6).close()"]

CMD ["gunicorn", "--bind=0.0.0.0:5000", "--workers=2", "--worker-class=gthread", "--threads=4", "--timeout=30", "--graceful-timeout=30", "--keep-alive=5", "--worker-tmp-dir=/tmp", "--access-logfile=-", "--error-logfile=-", "app:app"]
