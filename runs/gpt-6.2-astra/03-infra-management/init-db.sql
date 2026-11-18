\set ON_ERROR_STOP on
\getenv api_password API_DB_PASSWORD
\getenv app_db POSTGRES_DB
CREATE ROLE app_api LOGIN PASSWORD :'api_password';
ALTER DATABASE :"app_db" OWNER TO app_api;
