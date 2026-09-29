FROM python:3.13-slim

# Minor-version pin balances reproducibility with security updates.
# For immutable builds, pin this image by digest as well.

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install dependencies first for layer caching; requirements.txt is
# version-pinned so installs are reproducible.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 5000

# The API must expose GET /healthz returning 200 (see RUNBOOK.md).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/healthz', timeout=4)"

# Production WSGI server. Assumes app.py exposes Flask object `app`;
# adjust the module if the real entrypoint differs.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "30", "app:app"]
