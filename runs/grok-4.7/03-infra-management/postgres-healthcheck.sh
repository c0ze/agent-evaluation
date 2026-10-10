#!/bin/sh
# Prove the database accepts queries with the runtime role and password.
set -eu
export PGPASSWORD="$POSTGRES_PASSWORD"
export PGCONNECT_TIMEOUT=3
# TCP only. The image's first-boot helper does not listen on TCP, so this
# stays failed until the real server is accepting clients.
exec psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null
