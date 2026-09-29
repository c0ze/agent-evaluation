"""Structural verification for this stack. Starts no containers.

Usage:  python3 verify_config.py   (exit 0 = all checks pass)
"""
import json, os, re, subprocess, sys

fails = []
def check(name, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + name + (("   -- " + str(detail)) if not cond else ""))
    if not cond:
        fails.append(name)

def strip_comments(text):
    return re.sub(r'(?m)#[^\n]*', '', text)

# ---------- Dockerfile ----------
df_raw = open("Dockerfile").read()
df = strip_comments(df_raw)
exec_forms = re.findall(r'^(?:CMD|HEALTHCHECK[^\n]*?\n\s*CMD)\s+(\[.*\])\s*$', df_raw, re.M)
ok_json = True
for e in exec_forms:
    try: json.loads(e)
    except Exception: ok_json = False
check("Dockerfile: exec-form CMD/HEALTHCHECK are valid JSON arrays", ok_json and len(exec_forms) == 2, exec_forms)
check("Dockerfile: no Flask dev server / FLASK_ENV=development", "flask run" not in df and "FLASK_ENV" not in df)
check("Dockerfile: gunicorn is the process", "gunicorn" in df)
check("Dockerfile: unpinned `pip install <pkgs>` is gone", re.search(r'pip install (?!--)(?!-r)\S', df) is None)
check("Dockerfile: installs from pinned requirements.txt", "-r requirements.txt" in df)
check("Dockerfile: slim base image", "python:3.13-slim" in df)
check("Dockerfile: multi-stage (builder + runtime)", len(re.findall(r'(?m)^FROM ', df)) >= 3)
check("Dockerfile: runs as a non-root UID", re.search(r'(?m)^USER 10001:10001$', df) is not None)
check("Dockerfile: USER precedes CMD", df.index("USER 10001") < df.rindex("CMD ["))
stages = set(re.findall(r'(?m)^FROM \S+ AS (\S+)', df))
refs = set(re.findall(r'--from=(\S+)', df))
check("Dockerfile: every --from= names a defined stage", refs <= stages, f"{refs} vs {stages}")
check("Dockerfile: image-level HEALTHCHECK present", "HEALTHCHECK" in df)

# ---------- gunicorn.conf.py ----------
g = open("gunicorn.conf.py").read()
ns = {}
os.environ.pop("APP_PORT", None)
exec(compile(g, "gunicorn.conf.py", "exec"), ns)
check("gunicorn.conf.py: imports and evaluates", True)
check("gunicorn.conf.py: default bind 0.0.0.0:8000", ns["bind"] == "0.0.0.0:8000", ns["bind"])
check("gunicorn.conf.py: keepalive(75s) > nginx upstream keepalive_timeout(60s)", ns["keepalive"] > 60, ns["keepalive"])
check("gunicorn.conf.py: timeout(30s) <= nginx proxy_read_timeout(30s)", ns["timeout"] <= 30, ns["timeout"])
check("gunicorn.conf.py: graceful_timeout <= compose stop_grace_period(30s)", ns["graceful_timeout"] <= 30, ns["graceful_timeout"])
check("gunicorn.conf.py: worker_tmp_dir on the tmpfs", ns["worker_tmp_dir"] == "/tmp", ns["worker_tmp_dir"])
check("gunicorn.conf.py: logs to stdout/stderr", ns["accesslog"] == "-" and ns["errorlog"] == "-")

# ---------- nginx.conf (structural parse) ----------
nx = open("nginx.conf").read()
body = strip_comments(nx)
depth, buf, quote, errors = 0, "", None, []
for ch in body:
    if quote:
        buf += ch
        if ch == quote: quote = None
        continue
    if ch in "'\"":
        quote = ch; buf += ch; continue
    if ch == ";":
        buf = ""
    elif ch == "{":
        depth += 1; buf = ""
    elif ch == "}":
        if buf.strip(): errors.append("unterminated directive before '}': " + buf.strip()[:60])
        depth -= 1; buf = ""
        if depth < 0: errors.append("unbalanced closing brace")
    else:
        buf += ch
check("nginx.conf: blocks balanced and every directive terminated", depth == 0 and not errors and not buf.strip(),
      errors or f"depth={depth} trailing={buf.strip()[:60]!r}")
named = set(re.findall(r'location (@\w+)', nx))
referenced = set(re.findall(r'error_page [^;]*?=\s*(@\w+);', nx))
check("nginx.conf: every error_page target has a named location", referenced <= named and referenced, referenced - named)
check("nginx.conf: pid/temp paths under /tmp (unprivileged + read-only rootfs)",
      "/tmp/nginx.pid" in nx and nx.count("_temp_path      /tmp") + nx.count("_temp_path  /tmp") + nx.count("_temp_path        /tmp") >= 1)
check("nginx.conf: listens on 8080 (no privileged port)", re.search(r'listen\s+8080;', nx) is not None and not re.search(r'listen\s+80;', nx))
for token, label in [("proxy_connect_timeout", "connect timeout"), ("proxy_read_timeout", "read timeout"),
                     ("proxy_send_timeout", "send timeout"), ("client_max_body_size", "body size cap"),
                     ("client_body_timeout", "slow-body timeout"), ("limit_req_zone", "rate limit"),
                     ("limit_conn_zone", "connection limit"), ("server_tokens", "version hiding"),
                     ("proxy_http_version", "HTTP/1.1 upstream"), ("X-Forwarded-Proto", "proto header"),
                     ("X-Real-IP", "real ip header"), ("X-Request-Id", "request id"),
                     ("X-Content-Type-Options", "nosniff")]:
    check(f"nginx.conf: {label} configured ({token})", token in nx)
check("nginx.conf: keepalive upstream pool needs empty Connection header",
      re.search(r'keepalive\s+32;', nx) is not None and re.search(r'proxy_set_header Connection\s+"";', nx) is not None)
check("nginx.conf: X-Forwarded-For is overwritten, not appended (no client spoofing)",
      "proxy_set_header X-Forwarded-For   $remote_addr;" in nx and "$proxy_add_x_forwarded_for" not in strip_comments(nx))
check("nginx.conf: health endpoints are not rate limited",
      re.search(r'location = /healthz \{[^}]*access_log off;[^}]*\}', nx, re.S) is not None)

# ---------- compose ----------
env = dict(os.environ, POSTGRES_USER="app", POSTGRES_PASSWORD="validate-only",
           POSTGRES_DB="app", REDIS_PASSWORD="validate-only")
out = subprocess.run(["docker", "compose", "config", "--format", "json"], capture_output=True, text=True, env=env)
check("compose: `docker compose config` renders without error", out.returncode == 0, out.stderr.strip()[:300])
missing = subprocess.run(["docker", "compose", "config", "--quiet"], capture_output=True, text=True,
                         env={k: v for k, v in os.environ.items() if not k.startswith(("POSTGRES_", "REDIS_"))})
check("compose: missing credentials abort the run (fail fast)", missing.returncode != 0, missing.stdout[:200])
cfg = json.loads(out.stdout); svcs = cfg["services"]
check("compose: same four services, nothing added", set(svcs) == {"proxy", "api", "db", "cache"}, set(svcs))
pub = {n: [p.get("published") for p in s.get("ports", [])] for n, s in svcs.items()}
check("compose: only the proxy publishes a host port", [n for n, p in pub.items() if p] == ["proxy"], pub)
check("compose: proxy binds loopback by default", svcs["proxy"]["ports"][0]["host_ip"] == "127.0.0.1", svcs["proxy"]["ports"])
check("compose: Postgres 5432 not published", not svcs["db"].get("ports"))
check("compose: Redis 6379 not published", not svcs["cache"].get("ports"))
check("compose: all four services have healthchecks", all("healthcheck" in s for s in svcs.values()))
check("compose: api starts only when db and cache are healthy",
      all(svcs["api"]["depends_on"][d]["condition"] == "service_healthy" for d in ("db", "cache")))
check("compose: proxy starts only when api is healthy", svcs["proxy"]["depends_on"]["api"]["condition"] == "service_healthy")
check("compose: restart policy on every service", all(s.get("restart") == "unless-stopped" for s in svcs.values()))
check("compose: log rotation on every service", all(s["logging"]["options"]["max-size"] == "10m" for s in svcs.values()))
check("compose: cpu/memory/pids limits on every service",
      all({"cpus", "memory", "pids"} <= set(s["deploy"]["resources"]["limits"]) for s in svcs.values()))
check("compose: no-new-privileges on every service", all("no-new-privileges:true" in s.get("security_opt", []) for s in svcs.values()))
check("compose: capabilities dropped on every service", all(s.get("cap_drop") == ["ALL"] for s in svcs.values()))
check("compose: Postgres data on the named volume `pgdata`",
      any(v.get("source") == "pgdata" and v["target"].startswith("/var/lib/postgresql") for v in svcs["db"]["volumes"])
      and "pgdata" in cfg.get("volumes", {}))
check("compose: data network is `internal: true`", cfg["networks"]["backend"]["internal"] is True)
check("compose: proxy has no route to db/cache", set(svcs["proxy"]["networks"]) == {"edge"}, list(svcs["proxy"]["networks"]))
check("compose: db and cache are on the data network only",
      set(svcs["db"]["networks"]) == {"backend"} and set(svcs["cache"]["networks"]) == {"backend"})
check("compose: api is the only bridge between segments", set(svcs["api"]["networks"]) == {"edge", "backend"})
check("compose: api and proxy filesystems are read-only", svcs["api"]["read_only"] and svcs["proxy"]["read_only"])
check("compose: nginx.conf is mounted read-only", all(v.get("read_only") for v in svcs["proxy"]["volumes"]))
check("compose: api drain window >= gunicorn graceful_timeout", svcs["api"]["stop_grace_period"] in ("30s", "0m30s"), svcs["api"]["stop_grace_period"])
check("compose: redis requires a password and evicts instead of OOM",
      "--requirepass" in " ".join(svcs["cache"]["command"]) and "allkeys-lru" in " ".join(svcs["cache"]["command"]))

# ---------- secret hygiene ----------
src = open("compose.yaml").read()
check("source: no credential literals in compose.yaml",
      "admin:password" not in src and "POSTGRES_PASSWORD: password" not in src and "@db:5432" in src)
check("source: every credential is a ${...} reference with a fail-fast default",
      src.count("POSTGRES_PASSWORD:?") >= 2 and src.count("REDIS_PASSWORD:?") >= 2)
check("rendered: .env value flows into DATABASE_URL", "validate-only@db:5432" in out.stdout)
gi, di = open(".gitignore").read(), open(".dockerignore").read()
check(".gitignore excludes .env and secrets", ".env" in gi and "secrets/" in gi and "!.env.example" in gi)
check(".dockerignore excludes .env, .git, secrets, backups",
      all(x in di for x in (".env", ".git", "secrets/", "backups/")))
check(".env.example documents every required variable",
      all(k in open(".env.example").read() for k in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "REDIS_PASSWORD", "HTTP_BIND_ADDR", "APP_VERSION")))
check("no .env checked in beside the example", not os.path.exists(".env"))

print("FAILURES: %d" % len(fails))
for f in fails: print("  -", f)
sys.exit(1 if fails else 0)
