#!/usr/bin/env bash
# GPT-6.2 Astra (xhigh, a ChatGPT Team account): same protocol as run-sol62.sh / run-sol.sh.
# Started unattended by launchd (com.agent-eval.gpt62-astra) at 23:00 on 2026-11-18. Runs once:
# a marker file blocks re-runs and the launchd job removes itself at the end.
# If the model is not usable yet (e.g. the 5-hour quota has not reset), the probe retries every
# 10 minutes for up to 3 hours before giving up.
export PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
REAL_HOME=$HOME
CODEX=/opt/homebrew/bin/codex
B=/Users/Shared/agent-eval-runs
O=$B/gpt-run-orch
R=$B/agent-eval-gpt-6.2-astra
I=$REAL_HOME/.codex-eval
MODEL=gpt-6.2-astra EFFORT=xhigh TAG=astra62
LABEL=com.agent-eval.gpt62-astra PLIST=$REAL_HOME/Library/LaunchAgents/com.agent-eval.gpt62-astra.plist
MARK=$O/$TAG.started

unschedule() { rm -f "$PLIST"; launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null; }
log() { date "+$TAG $* %F %T" >> $O/times.log; }

[ -e "$MARK" ] && { echo "$TAG already started once ($MARK); not running again" >&2; unschedule; exit 6; }
touch "$MARK"
trap 'python3 -I $O/sync-auth.py "$REAL_HOME" >> $O/$TAG.launchd.log 2>&1; unschedule' EXIT
caffeinate -i -w $$ &   # keep the Mac from idle-sleeping while this script runs

python3 -I $O/sync-auth.py "$REAL_HOME"
export HOME=$I/home CODEX_HOME=$I/codex
[ -z "$(git -C $R status --porcelain)" ] || { log "ABORT repo not clean"; exit 4; }
[ -e "$CODEX_HOME/AGENTS.md" ] && { log "ABORT AGENTS.md present"; exit 5; }

for attempt in $(seq 1 19); do   # 19 probes, 10 min apart = 3 hours
  probe=$(mktemp -d)
  "$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s read-only -m $MODEL \
    -c model_reasoning_effort=low -C "$probe" -o "$probe/out" "Reply with OK" </dev/null >/dev/null 2>"$probe/err"
  rc=$?; err=$(grep -o '"message":"[^"]*"' "$probe/err" | head -1); rm -rf "$probe"
  [ $rc -eq 0 ] && break
  log "probe $attempt failed: ${err:-rc=$rc}"
  [ $attempt -eq 19 ] && { log "ABORT model not usable after 3 hours"; exit 3; }
  sleep 600
done

mkdir -p $O/$TAG; log "RUN START (isolated HOME/CODEX_HOME, codex $("$CODEX" --version), launchd)"
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
wait; log "RUN END"
