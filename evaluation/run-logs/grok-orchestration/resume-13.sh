#!/usr/bin/env bash
# Re-run Grok 4.7 task 13 from the template after the usage balance ran out; same settings as run.sh.
O=/Users/arda/projects/agent-eval-runs/grok-run-orch
R=/Users/arda/projects/agent-eval-runs/agent-eval-grok-4.7
PY=/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/bin
t=13-frontend-playful
pgrep -f "grok-run-orch/(run|resume-13).sh" | grep -vx $$ >/dev/null && { echo "another grok run is going" >&2; exit 2; }
diff -rq /Users/arda/projects/agent-evaluation-2026-09-23/_templates/$t $R/$t >/dev/null || { echo "$t is not a clean template copy" >&2; exit 4; }
CH=$(mktemp -d /tmp/grok-cleanhome.XXXX)
body="Your task directory is $R/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
s=$(date +%s); echo "$t start $(date '+%F %T') [resumed]" >> $O/times.log
HOME=$CH GROK_HOME=/Users/arda/.grok GROK_MEMORY=0 PATH="$PY:$PATH" /Users/arda/.local/bin/grok -p "$body" \
  -m grok-4.7 --reasoning-effort xhigh --cwd "$R" --sandbox workspace --disable-web-search --deny MCPTool \
  --always-approve --no-alt-screen --output-format json < /dev/null > "$O/replies/$t.json" 2> "$O/replies/$t.stderr"
rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s)) [resumed]" >> $O/times.log
rm -rf "$CH"; exit $rc
