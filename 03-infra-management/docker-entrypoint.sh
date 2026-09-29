#!/bin/sh
# Run gunicorn as the container user. Runtime secrets stay in the environment.
set -eu

bind="${GUNICORN_BIND:-0.0.0.0:5000}"
workers="${WEB_CONCURRENCY:-2}"
timeout="${GUNICORN_TIMEOUT:-30}"
graceful="${GUNICORN_GRACEFUL_TIMEOUT:-20}"
app="${GUNICORN_APP:-app:app}"
forwarded="${FORWARDED_ALLOW_IPS:-*}"

exec gunicorn \
    --bind "$bind" \
    --workers "$workers" \
    --timeout "$timeout" \
    --graceful-timeout "$graceful" \
    --access-logfile - \
    --error-logfile - \
    --forwarded-allow-ips "$forwarded" \
    "$app"
