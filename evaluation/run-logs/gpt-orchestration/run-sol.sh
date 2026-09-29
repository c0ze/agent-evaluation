#!/usr/bin/env bash
# GPT-6.1 Sol (xhigh, gand-business): same protocol as run.sh. Refuses to start until the model is
# available to the account, while another run on this account is going, or on a dirty repo.
CODEX=/Users/arda/.local/share/mise/installs/node/24.14.0/bin/codex
O=/Users/arda/projects/agent-eval-runs/gpt-run-orch
H=/Users/arda/.codex-gand-business
R=/Users/arda/projects/agent-eval-runs/agent-eval-gpt-6.1-sol
MODEL=gpt-6.1-sol EFFORT=xhigh TAG=sol

pgrep -f "gpt-run-orch/run.sh" >/dev/null && { echo "run.sh is still running" >&2; exit 2; }
[ -z "$(git -C $R status --porcelain)" ] || { echo "$R has changes; the tasks must be clean" >&2; exit 4; }
probe=$(mktemp -d)   # availability probe: a tiny low-effort request
CODEX_HOME=$H "$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s read-only -m $MODEL \
  -c model_reasoning_effort=low -C "$probe" -o "$probe/out" "Reply with OK" </dev/null >/dev/null 2>"$probe/err"
rc=$?; err=$(grep -o '"message":"[^"]*"' "$probe/err" | head -1); rm -rf "$probe"
[ $rc -eq 0 ] || { echo "$MODEL not available yet: ${err:-rc=$rc}" >&2; exit 3; }

restore() { [ -f "$H/AGENTS.md.bench-aside" ] && mv -n "$H/AGENTS.md.bench-aside" "$H/AGENTS.md"; date "+$TAG AGENTS.md restored %F %T" >> $O/times.log; }
trap restore EXIT
[ -f "$H/AGENTS.md" ] && mv -n "$H/AGENTS.md" "$H/AGENTS.md.bench-aside"
mkdir -p $O/$TAG; date "+$TAG RUN START %F %T (AGENTS.md set aside)" >> $O/times.log
run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$TAG $t start $(date '+%F %T')" >> $O/times.log
  CODEX_HOME=$H "$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s workspace-write \
    -m $MODEL -c model_reasoning_effort=$EFFORT -C "$R" --json -o "$O/$TAG/$t.reply.md" "$body" </dev/null \
    > "$O/$TAG/$t.events.jsonl" 2> "$O/$TAG/$t.stderr"
  local rc=$? e=$(date +%s); echo "$TAG $t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { for t in "$@"; do run_task $t; done; }
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; date "+$TAG RUN END %F %T" >> $O/times.log
