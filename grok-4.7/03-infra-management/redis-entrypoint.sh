#!/bin/sh
# Start Redis as the image's redis user. The password is read from the environment.
set -eu

if [ -z "${REDIS_PASSWORD:-}" ]; then
    echo "REDIS_PASSWORD is required" >&2
    exit 1
fi

umask 077
{
    printf '%s\n' \
        'bind 0.0.0.0' \
        'port 6379' \
        'protected-mode yes' \
        'daemonize no' \
        'maxmemory 192mb' \
        'maxmemory-policy allkeys-lru' \
        'save ""' \
        'appendonly no' \
        'dir /data'
    printf 'requirepass %s\n' "$REDIS_PASSWORD"
} > /tmp/redis.conf
mkdir -p /data
chown redis:redis /tmp/redis.conf /data

if command -v su-exec >/dev/null 2>&1; then
    exec su-exec redis redis-server /tmp/redis.conf
fi
if command -v gosu >/dev/null 2>&1; then
    exec gosu redis redis-server /tmp/redis.conf
fi

echo "refusing to run redis as root: su-exec/gosu not found" >&2
exit 1
