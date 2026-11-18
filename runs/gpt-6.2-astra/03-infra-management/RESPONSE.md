# Deployment review

## Highest-risk original problems

- Compose published Postgres, Redis and the API on all host interfaces. The database password appeared in both the service configuration and the API URL. Only nginx now publishes a loopback port. The API uses a dedicated database owner with no cluster administration privileges. Missing passwords prevent startup.
- The API ran Flask's development server as root. The build installed unpinned packages, ignored the supplied requirements and copied the whole directory into the image. Gunicorn now runs as UID 10001. The build uses an allowlisted context and exact direct and transitive package versions. No application module was supplied, so a minimal Flask app provides the readiness route.
- Postgres had no named data volume. Its image-managed storage could be left behind on replacement, and the floating image tag could cross a database major version. The deployment now has a named volume, versioned image tags and a logical backup and restore procedure.
- Startup order only ensured containers had started. nginx could accept traffic before the API could serve it. The database and cache now check real operations, the API checks both dependencies, and the proxy checks the API over HTTP. nginx also sets forwarding headers and explicit request and upstream timeouts.
- The original services had no explicit log rotation, restart policies or resource limits. Each service now has bounded logs and local Compose CPU, memory and process limits.

## Verification performed

- Parsed Compose YAML with Ruby Psych, including merge keys. Checked all four services, published ports, network membership, health dependencies, resource and log settings, read-only config mounts, the named Postgres volume and agreement between the required variables and `.env.example`.
- Checked the Dockerfile's Gunicorn target, non-root UID, build inputs and 11 exact package pins. Parsed the Python module and API probe. Exercised the readiness handler with stubbed clients for success, database connection and query failures, Redis error and negative PING reply, and recovery. Verified SQL connections close after a query error.
- Checked nginx block structure, upstream address, header directives and timeouts. Ran `sh -n` on the shell probes and all six runbook command blocks.

Verification was offline. Docker, Compose and nginx executables were unavailable. Image pulls, dependency installation, native configuration validation, HTTP probes and a live restore remain unverified. No containers were started.
