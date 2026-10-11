#!/usr/bin/env bash
# Run the 13 tasks for one OpenRouter model through opencode (same protocol as run.sh, used for Kimi K3): one fresh
# `opencode run` per task, four at a time. usage: run-or.sh TAG OPENROUTER_MODEL_ID REPO [EXTRA_MODEL_JSON]
# Variant high. EXTRA_MODEL_JSON registers a model opencode's catalog lacks (Mistral Large 4). The small (title)
# model is set to the model under test. A session that ends with no output and leaves the task untouched (an
# intermittent opencode/OpenRouter failure seen in testing) is retried once and logged as such.
# Each task gets its own empty HOME/XDG dirs holding only an opencode config, so no AGENTS.md/CLAUDE.md,
# skills, plugins (--pure), MCP servers or session history reach the model. The repo lives outside /home/arda.
# opencode has no OS sandbox: web tools, paths outside the repo and common network commands are denied by
# permission rules, and the transcripts are audited afterwards. Budget guard: a task is not started when the
# OpenRouter credit left would drop below $MARGIN.
OC=/home/arda/.local/share/mise/installs/opencode/1.18.30/opencode
O=$(cd "$(dirname "$0")" && pwd)
TAG=${1:?tag} MODEL=openrouter/${2:?model} REPO=${3:?repo} EXTRA=${4:-} VARIANT=high MARGIN=${MARGIN:-3}
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
  python3 - "$h/.config/opencode/opencode.json" "$MODEL" "$EXTRA" <<'PY'
import json, sys
path, model, extra = sys.argv[1:4]
cfg = {"$schema": "https://opencode.ai/config.json", "autoupdate": False, "share": "disabled", "small_model": model,
  "permission": {"webfetch": "deny", "websearch": "deny", "edit": "allow", "external_directory": "deny",
    "bash": {"*": "allow", "curl *": "deny", "wget *": "deny", "pip install*": "deny", "pip3 install*": "deny",
             "python3 -m pip install*": "deny", "npm install*": "deny", "npx *": "deny", "uv pip install*": "deny",
             "uv add*": "deny", "git clone*": "deny", "ssh *": "deny"}}}
if extra:
    cfg["provider"] = {"openrouter": {"models": {model.split("/", 1)[1]: json.loads(extra)}}}
json.dump(cfg, open(path, "w"), indent=1)
PY
  local body="Your task directory is $REPO/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local try
  for try in 1 2; do
    local s=$(date +%s); echo "$TAG $t start $(date '+%F %T') credit_left=$left" >> $O/times.log
    (cd "$REPO" && env -i HOME="$h" XDG_CONFIG_HOME="$h/.config" XDG_DATA_HOME="$h/.local/share" XDG_CACHE_HOME="$h/.cache" \
      XDG_STATE_HOME="$h/.local/state" USER="$USER" PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 TERM=dumb \
      OPENROUTER_API_KEY="$OPENROUTER_API_KEY" OPENCODE_DISABLE_CLAUDE_CODE=1 \
      timeout 7200 "$OC" run --pure --auto --print-logs --log-level WARN -m $MODEL --variant $VARIANT --format json "$body" \
      > "$O/$TAG/replies/$t.events.jsonl" 2> "$O/$TAG/replies/$t.stderr" < /dev/null)
    local rc=$? e=$(date +%s)
    if [ "$try" = 1 ] && ! grep -q '"type":"step_finish"' "$O/$TAG/replies/$t.events.jsonl" \
       && [ -z "$(cd "$REPO" && git status --porcelain -- "$t")" ]; then
      echo "$TAG $t end $(date '+%F %T') rc=$rc secs=$((e-s)) empty-session-retrying" >> $O/times.log
      mv "$O/$TAG/replies/$t.events.jsonl" "$O/$TAG/replies/$t.empty1.events.jsonl"; mv "$O/$TAG/replies/$t.stderr" "$O/$TAG/replies/$t.empty1.stderr"
      rm -rf "$h/.local" "$h/.cache"; continue
    fi
    echo "$TAG $t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log; break
  done
}
queue() { for t in "$@"; do run_task $t; done; }

echo "$TAG RUN START $(date '+%F %T') credit_left=$(credit_left)" >> $O/times.log
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; echo "$TAG RUN END $(date '+%F %T') credit_left=$(credit_left)" >> $O/times.log
