#!/usr/bin/env bash
# muse-wonder-1.0 at xhigh: same protocol as muse-run-orch (muse-spark-1.3) and the mcode runs. One fresh
# `muse exec` per task with the same instruction, four queues with the same task split, 2-hour limit per task,
# no hints, no re-runs. Blank slate: muse runs under sandbox.sb (no reads of the user's home outside this run,
# writes only in the repo, network HTTPS/localhost only) with a clean HOME (no user skills, rules or old sessions),
# so muse's own sandbox is replaced by the outer one (--disable-sandbox; Seatbelt sandboxes can't nest).
# Before each task it waits while $O/HOLD exists (usage-watch.sh creates it when a quota window passes 85%).
O=/Users/arda/projects/agent-eval-runs/muse-wonder-run-orch
R=/Users/arda/projects/agent-eval-runs/agent-eval-muse-wonder
MODEL=muse-wonder-1.0; EFFORT=xhigh
[ -z "$(git -C $R status --porcelain)" ] || { echo "$R has changes; the tasks must be clean" >&2; exit 4; }
quota() { rm -f /Users/arda/.cache/muse-quota.json; /Users/arda/.local/bin/muse-quota status > "$O/quota-$1.json"; }
quota before; date "+RUN START %F %T" >> $O/times.log
run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  while [ -e $O/HOLD ]; do sleep 30; done
  local s=$(date +%s); echo "$t start $(date '+%F %T')" >> $O/times.log
  /opt/homebrew/bin/timeout 7200 $O/muse-run $R --model $MODEL --reasoning-effort $EFFORT --workspace $R \
    --trust-workspace --no-foreign-personal-context --max-model-steps 200 --disable-approval --disable-sandbox \
    "$body" > "$O/runs/$t.reply.md" 2> "$O/runs/$t.stderr"
  local rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { for t in "$@"; do run_task $t; done; }
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; date "+RUN END %F %T" >> $O/times.log; quota after
