#!/usr/bin/env bash
# Pass 2: tasks 10-13 were stopped at 07:16:51 by "429 Subscription quota exhausted" (5-hour window resets 10:08:40 JST).
# They were reset to the template (partial output kept in interrupted/) and re-run here with the identical command,
# one per queue, after the window resets, as GPT-6 Astra's tasks 10-13 were.
O=/Users/arda/projects/agent-eval-runs/muse-wonder-run-orch
R=/Users/arda/projects/agent-eval-runs/agent-eval-muse-wonder
MODEL=muse-wonder-1.0; EFFORT=xhigh
TASKS=(10-general-operations 11-frontend-operations 12-frontend-editorial 13-frontend-playful)
[ -z "$(git -C $R status --porcelain -- "${TASKS[@]}")" ] || { echo "tasks 10-13 are not clean" >&2; exit 4; }
until [ "$(date +%H%M)" -ge 1010 ]; do sleep 60; done
reading() { rm -f /Users/arda/.cache/muse-quota.json; /Users/arda/.local/bin/muse-quota status; }
until reading > "$O/quota-before-pass2.json" && python3 -c "import json,sys; d=json.load(open('$O/quota-before-pass2.json')); sys.exit(0 if d.get('short_percent') is not None and d['short_percent'] < 50 else 1)"; do
  echo "$(date +%T) window not reset yet" >> $O/usage.log; sleep 300; done
date "+RUN2 START %F %T" >> $O/times.log
run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$t start $(date '+%F %T')" >> $O/times.log
  /opt/homebrew/bin/timeout 7200 $O/muse-run $R --model $MODEL --reasoning-effort $EFFORT --workspace $R \
    --trust-workspace --no-foreign-personal-context --max-model-steps 200 --disable-approval --disable-sandbox \
    "$body" > "$O/runs/$t.reply.md" 2> "$O/runs/$t.stderr"
  local rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
( while pgrep -f "muse-wonder-run-orch/resume.sh" >/dev/null; do
    sleep 60; d=$(reading); echo "$(date +%T) short $(echo "$d" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("short_percent"),"weekly",d.get("percent"),"err",d.get("error"))')" >> $O/usage.log
  done ) &
pids=(); for t in "${TASKS[@]}"; do run_task $t & pids+=($!); done
wait "${pids[@]}"
date "+RUN2 END %F %T" >> $O/times.log; reading > "$O/quota-after.json"
