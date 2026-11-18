FROM python:3.13.9-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN groupadd --gid 10001 app \
    && useradd --no-log-init --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --disable-pip-version-check --no-cache-dir \
        --only-binary=:all: --no-deps -r requirements.txt \
    && python -m pip check
COPY app.py .

USER 10001:10001
EXPOSE 5000
CMD ["gunicorn", "--bind=0.0.0.0:5000", "--workers=2", "--threads=2", "--worker-tmp-dir=/dev/shm", "--timeout=35", "--access-logfile=-", "app:app"]

