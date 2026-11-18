#!/bin/sh
(
    set -eu

    API_DB_PASSWORD="$(cat /run/secrets/postgres_api_password)"
    if [ -z "$API_DB_PASSWORD" ]; then
        echo "The API database password file is empty." >&2
        exit 1
    fi
    export API_DB_PASSWORD

    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv api_password API_DB_PASSWORD
\getenv database POSTGRES_DB
BEGIN;
CREATE ROLE api LOGIN PASSWORD :'api_password';
ALTER DATABASE :"database" OWNER TO api;
COMMIT;
SQL
)
