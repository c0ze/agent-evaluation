#!/usr/bin/env bash
# Grok 4.7 (xhigh): one fresh `grok -p` per task, four at a time. A clean HOME keeps the personal
# ~/.claude/CLAUDE.md, user skills and plugins out; GROK_HOME stays ~/.grok for login. Memory off,
# web tools off, MCP tools denied, workspace sandbox (writes limited to the repo and /tmp).
O=/Users/arda/projects/agent-eval-runs/grok-run-orch
R=/Users/arda/projects/agent-eval-runs/agent-eval-grok-4.7
PY=/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/bin
CH=$(mktemp -d /tmp/grok-cleanhome.XXXX)
pgrep -f "grok-run-orch/run.sh" | grep -vx $$ >/dev/null && { echo "another grok run is going" >&2; exit 2; }
[ -z "$(git -C $R status --porcelain)" ] || { echo "$R has changes" >&2; exit 4; }
date "+RUN START %F %T" >> $O/times.log
run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$t start $(date '+%F %T')" >> $O/times.log
  HOME=$CH GROK_HOME=/Users/arda/.grok GROK_MEMORY=0 PATH="$PY:$PATH" /Users/arda/.local/bin/grok -p "$body" \
    -m grok-4.7 --reasoning-effort xhigh --cwd "$R" --sandbox workspace --disable-web-search --deny MCPTool \
    --always-approve --no-alt-screen --output-format json < /dev/null > "$O/replies/$t.json" 2> "$O/replies/$t.stderr"
  local rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { for t in "$@"; do run_task $t; done; }
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; date "+RUN END %F %T" >> $O/times.log; rm -rf "$CH"
