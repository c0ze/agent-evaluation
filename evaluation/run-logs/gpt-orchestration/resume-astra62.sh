#!/usr/bin/env bash
# Resume GPT-6.2 Astra (xhigh, a ChatGPT Team account): re-run task 11, which was cut off at 23:34 on 2026-11-18 when the
# workspace ran out of credits, from a clean copy of the template. Same protocol as run-astra62.sh. Its partial output
# is kept in astra62-interrupted/.
export PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
REAL_HOME=$HOME
CODEX=/opt/homebrew/bin/codex
B=/Users/Shared/agent-eval-runs
O=$B/gpt-run-orch
R=$B/agent-eval-gpt-6.2-astra
I=$REAL_HOME/.codex-eval
TPL=${TPL:?set TPL to the _templates directory of the main repository}
MODEL=gpt-6.2-astra EFFORT=xhigh TAG=astra62
TASKS=(11-frontend-operations)

pgrep -f "gpt-run-orch/run-astra62.sh" >/dev/null && { echo "run-astra62.sh is still running" >&2; exit 2; }
for t in "${TASKS[@]}"; do   # every resumed task must start from the template
  diff -rq --exclude=__pycache__ "$TPL/$t" "$R/$t" >/dev/null || { echo "$t is not a clean template copy" >&2; exit 4; }
done
python3 -I $O/sync-auth.py "$REAL_HOME"
trap 'python3 -I $O/sync-auth.py "$REAL_HOME"' EXIT
export HOME=$I/home CODEX_HOME=$I/codex
[ -e "$CODEX_HOME/AGENTS.md" ] && { echo "AGENTS.md present; isolation broken" >&2; exit 5; }

probe=$(mktemp -d)
"$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s read-only -m $MODEL \
  -c model_reasoning_effort=low -C "$probe" -o "$probe/out" "Reply with OK" </dev/null >/dev/null 2>"$probe/err"
rc=$?; err=$(grep -o '"message":"[^"]*"' "$probe/err" | head -1); rm -rf "$probe"
[ $rc -eq 0 ] || { echo "$MODEL not usable: ${err:-rc=$rc}" >&2; exit 3; }

date "+$TAG RESUME START %F %T (isolated HOME/CODEX_HOME, codex $("$CODEX" --version))" >> $O/times.log
run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$TAG $t start $(date '+%F %T') [resumed]" >> $O/times.log
  caffeinate -i "$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s workspace-write \
    -m $MODEL -c model_reasoning_effort=$EFFORT -C "$R" --json -o "$O/$TAG/$t.reply.md" "$body" </dev/null \
    > "$O/$TAG/$t.events.jsonl" 2> "$O/$TAG/$t.stderr"
  local rc=$? e=$(date +%s); echo "$TAG $t end $(date '+%F %T') rc=$rc secs=$((e-s)) [resumed]" >> $O/times.log
}
for t in "${TASKS[@]}"; do run_task $t; done
date "+$TAG RESUME END %F %T" >> $O/times.log
