#!/usr/bin/env bash
# GPT-6.2 Sol (xhigh, a ChatGPT Team account): same protocol as run-sol.sh (GPT-6.1 Sol).
# Isolation: a dedicated HOME and CODEX_HOME holding only the login, so no personal skills,
# plugins, AGENTS.md or config apply. Refuses to start on a dirty repo or if the model is unavailable.
CODEX=$(command -v codex)
B=/Users/Shared/agent-eval-runs
O=$B/gpt-run-orch
R=$B/agent-eval-gpt-6.2-sol
I=$HOME/.codex-eval
MODEL=gpt-6.2-sol EFFORT=xhigh TAG=sol62
export HOME=$I/home CODEX_HOME=$I/codex

[ -z "$(git -C $R status --porcelain)" ] || { echo "$R has changes; the tasks must be clean" >&2; exit 4; }
[ -e "$CODEX_HOME/AGENTS.md" ] && { echo "$CODEX_HOME/AGENTS.md exists; isolation broken" >&2; exit 5; }
probe=$(mktemp -d)   # availability probe: a tiny low-effort request
"$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s read-only -m $MODEL \
  -c model_reasoning_effort=low -C "$probe" -o "$probe/out" "Reply with OK" </dev/null >/dev/null 2>"$probe/err"
rc=$?; err=$(grep -o '"message":"[^"]*"' "$probe/err" | head -1); rm -rf "$probe"
[ $rc -eq 0 ] || { echo "$MODEL not available: ${err:-rc=$rc}" >&2; exit 3; }

mkdir -p $O/$TAG; date "+$TAG RUN START %F %T (isolated HOME/CODEX_HOME, codex $("$CODEX" --version))" >> $O/times.log
run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$TAG $t start $(date '+%F %T')" >> $O/times.log
  "$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s workspace-write \
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
