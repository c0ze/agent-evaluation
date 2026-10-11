#!/usr/bin/env bash
# Run the 13 tasks for Kimi K3 (moonshotai/kimi-k3 on OpenRouter, variant high) through opencode: one fresh
# `opencode run` per task, four at a time. usage: run.sh REPO   (OPENROUTER_API_KEY must be set)
# Each task gets its own empty HOME/XDG dirs holding only an opencode config, so no AGENTS.md/CLAUDE.md,
# skills, plugins (--pure), MCP servers or session history reach the model. The repo lives outside /home/arda.
# opencode has no OS sandbox: web tools, paths outside the repo and common network commands are denied by
# permission rules, and the transcripts are audited afterwards. Budget guard: a task is not started when the
# OpenRouter credit left would drop below $MARGIN.
OC=/home/arda/.local/share/mise/installs/opencode/1.18.30/opencode
O=$(cd "$(dirname "$0")" && pwd)
REPO=${1:?repo} TAG=kimi-k3 MODEL=openrouter/moonshotai/kimi-k3 VARIANT=high MARGIN=${MARGIN:-5}
: "${OPENROUTER_API_KEY:?}"
mkdir -p $O/$TAG/replies $O/$TAG/homes

credit_left() { curl -sS -m 20 https://openrouter.ai/api/v1/credits -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(round(d["total_credits"]-d["total_usage"],2))'; }

run_task() { # task
  local t=$1 h=$O/$TAG/homes/$t left
  left=$(credit_left)
  if python3 -c "import sys; sys.exit(0 if float('$left') < $MARGIN else 1)"; then
    echo "$TAG $t held $(date '+%F %T') credit_left=$left" >> $O/times.log; return
  fi
  mkdir -p $h/.config/opencode
  cat > $h/.config/opencode/opencode.json <<'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "autoupdate": false,
  "share": "disabled",
  "permission": {
    "webfetch": "deny", "websearch": "deny", "edit": "allow", "external_directory": "deny",
    "bash": {"*": "allow", "curl *": "deny", "wget *": "deny", "pip install*": "deny", "pip3 install*": "deny",
             "python3 -m pip install*": "deny", "npm install*": "deny", "npx *": "deny", "uv pip install*": "deny",
             "uv add*": "deny", "git clone*": "deny", "ssh *": "deny"}
  }
}
EOF
  local body="Your task directory is $REPO/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$TAG $t start $(date '+%F %T') credit_left=$left" >> $O/times.log
  (cd "$REPO" && env -i HOME="$h" XDG_CONFIG_HOME="$h/.config" XDG_DATA_HOME="$h/.local/share" XDG_CACHE_HOME="$h/.cache" \
    XDG_STATE_HOME="$h/.local/state" USER="$USER" PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 TERM=dumb \
    OPENROUTER_API_KEY="$OPENROUTER_API_KEY" OPENCODE_DISABLE_CLAUDE_CODE=1 \
    timeout 7200 "$OC" run --pure --auto -m $MODEL --variant $VARIANT --format json "$body" \
    > "$O/$TAG/replies/$t.events.jsonl" 2> "$O/$TAG/replies/$t.stderr" < /dev/null)
  local rc=$? e=$(date +%s); echo "$TAG $t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { for t in "$@"; do run_task $t; done; }

echo "$TAG RUN START $(date '+%F %T') credit_left=$(credit_left)" >> $O/times.log
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; echo "$TAG RUN END $(date '+%F %T') credit_left=$(credit_left)" >> $O/times.log
