#!/usr/bin/env bash
# Resume GPT-6 Astra (xhigh; tasks 01-09 ran on gmail-business, these on gmail-personal): run the tasks that were interrupted when the account
# ran out of credits, each from a clean copy of the template, same protocol as run.sh.
CODEX=/Users/arda/.local/share/mise/installs/node/24.14.0/bin/codex
O=/Users/arda/projects/agent-eval-runs/gpt-run-orch
H=/Users/arda/.codex-gmail-personal
R=/Users/arda/projects/agent-eval-runs/agent-eval-gpt-6-astra
TASKS=(10-general-operations 11-frontend-operations 12-frontend-editorial 13-frontend-playful)

pgrep -f "gpt-run-orch/run.sh" >/dev/null && { echo "main run.sh still running; wait for it" >&2; exit 2; }
line=$(/Users/arda/.local/bin/codex-accounts all 2>/dev/null | grep '^gmail-personal')
echo "$line"
case "$line" in *BLOCKED*) echo "gmail-personal is still blocked" >&2; exit 3;; esac
for t in "${TASKS[@]}"; do   # every resumed task must start from the template
  diff -rq --exclude=__pycache__ /Users/arda/projects/agent-evaluation-2026-09-23/_templates/$t $R/$t >/dev/null || { echo "$t is not a clean template copy" >&2; exit 4; }
done

restore() { [ -f "$H/AGENTS.md.bench-aside" ] && mv -n "$H/AGENTS.md.bench-aside" "$H/AGENTS.md"; date '+astra-resume AGENTS.md restored %F %T' >> $O/times.log; }
trap restore EXIT
[ -f "$H/AGENTS.md" ] && mv -n "$H/AGENTS.md" "$H/AGENTS.md.bench-aside"
date '+astra RESUME START %F %T (AGENTS.md set aside)' >> $O/times.log

run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "astra $t start $(date '+%F %T') [resumed]" >> $O/times.log
  CODEX_HOME=$H "$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s workspace-write \
    -m gpt-6-astra -c model_reasoning_effort=xhigh -C "$R" --json -o "$O/astra/$t.reply.md" "$body" </dev/null \
    > "$O/astra/$t.events.jsonl" 2> "$O/astra/$t.stderr"
  local rc=$? e=$(date +%s); echo "astra $t end $(date '+%F %T') rc=$rc secs=$((e-s)) [resumed]" >> $O/times.log
}
for t in "${TASKS[@]}"; do run_task $t & done   # four tasks, four at a time
wait
date '+astra RESUME END %F %T' >> $O/times.log
