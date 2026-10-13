#!/usr/bin/env bash
# Pass 2: tasks 10-13 were stopped at 07:16:51 by "429 Subscription quota exhausted" (5-hour window resets 10:08:40 JST).
# They were reset to the template (partial output kept in interrupted/) and are re-run here with the identical command,
# ONE AT A TIME (at Arda's request: they're the heaviest tasks). Before each task the 5-hour window is read; if it is
# exhausted or more than GATE% used, the script sleeps until the window resets, so each task starts with headroom.
O=/Users/arda/projects/agent-eval-runs/muse-wonder-run-orch
R=/Users/arda/projects/agent-eval-runs/agent-eval-muse-wonder
MODEL=muse-wonder-1.0; EFFORT=xhigh; GATE=45
TASKS=(10-general-operations 11-frontend-operations 12-frontend-editorial 13-frontend-playful)
[ -z "$(git -C $R status --porcelain -- "${TASKS[@]}")" ] || { echo "tasks 10-13 are not clean" >&2; exit 4; }
reading() { rm -f /Users/arda/.cache/muse-quota.json; /Users/arda/.local/bin/muse-quota status > "$1"; }
log_reading() { python3 -c 'import json,sys,time; d=json.load(open(sys.argv[1])); print(time.strftime("%H:%M:%S"), "short", d.get("short_percent"), "weekly", d.get("percent"), "err", d.get("error"))' "$1" >> $O/usage.log; }
wait_for_headroom() {  # $1 = file to keep the reading in
  while :; do
    reading "$1"; log_reading "$1"
    python3 -c "import json,sys; d=json.load(open('$1')); sys.exit(0 if d.get('short_percent') is not None and not d.get('error') and d['short_percent'] <= $GATE else 1)" && return
    # Sleep until the 5-hour window resets (+2 min), or 10 minutes if the reading has no reset time.
    local secs=$(python3 -c "import json,time; d=json.load(open('$1')); r=d.get('short_reset_at'); print(int(max(60, r - time.time() + 120)) if r and r > time.time() else 600)")
    echo "$(date +%T) waiting ${secs}s for the 5-hour window to reset" >> $O/usage.log
    sleep $secs
  done
}
# Muse reset all quotas (both windows read 0% at 09:46) after fixing a too-fast drain, so this starts at once;
# the headroom check before each task still applies.
date "+RUN2 START %F %T (sequential)" >> $O/times.log
for t in "${TASKS[@]}"; do
  wait_for_headroom "$O/quota-before-$t.json"
  body="Your task directory is $R/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  s=$(date +%s); echo "$t start $(date '+%F %T')" >> $O/times.log
  /opt/homebrew/bin/timeout 7200 $O/muse-run $R --model $MODEL --reasoning-effort $EFFORT --workspace $R \
    --trust-workspace --no-foreign-personal-context --max-model-steps 200 --disable-approval --disable-sandbox \
    "$body" > "$O/runs/$t.reply.md" 2> "$O/runs/$t.stderr"
  rc=$?; e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
  reading "$O/quota-after-$t.json"; log_reading "$O/quota-after-$t.json"
done
date "+RUN2 END %F %T" >> $O/times.log; cp "$O/quota-after-13-frontend-playful.json" "$O/quota-after.json"
