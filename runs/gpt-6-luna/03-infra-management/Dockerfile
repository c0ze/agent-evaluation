FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN addgroup --system --gid 10001 app \
    && adduser --system --uid 10001 --ingroup app --home /app app

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY --chown=app:app . .

USER 10001:10001
EXPOSE 8000

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:8000 --workers 2 --threads 2 --timeout 60 --access-logfile - --error-logfile - \"${APP_MODULE:-app:app}\""]
