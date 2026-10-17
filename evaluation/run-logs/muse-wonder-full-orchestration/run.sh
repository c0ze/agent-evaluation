#!/usr/bin/env bash
# muse-wonder-full-1.0 at xhigh on cachyos: same protocol as the muse-wonder run on the Mac. One fresh `muse exec` per
# task with the same instruction and flags, 2-hour limit per task, no hints. Blank slate: per-task clean HOME inside
# bubblewrap (sandboxed), which replaces Muse's own shell sandbox (--disable-sandbox) as Seatbelt did on the Mac.
# Two workers take tasks in order from a shared queue; before starting a task a worker waits while HOLD exists
# (usage-watch.sh), so the run spreads over 5-hour quota windows when needed.
O=/tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/muse-full-orch
R=/tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/agent-eval-muse-wonder-full
MODEL=muse-wonder-full-1.0; EFFORT=xhigh
B=$O/bin/muse-bin-1.4.10-R6427.1
[ -z "$(git -C $R status --porcelain)" ] || { echo "$R has changes; the tasks must be clean" >&2; exit 4; }
python3 $O/quota.py > $O/quota-before.json; date "+RUN START %F %T" >> $O/times.log
ls -d $R/[01]*/ | xargs -n1 basename > $O/queue
next_task() { flock $O/queue.lock bash -c 'head -1 '$O'/queue; sed -i 1d '$O'/queue'; }
run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$t start $(date '+%F %T')" >> $O/times.log
  timeout 7200 $O/muse-run $O/homes/$t --model $MODEL --reasoning-effort $EFFORT --workspace $R \
    --trust-workspace --no-foreign-personal-context --max-model-steps 200 --disable-approval --disable-sandbox \
    "$body" > "$O/runs/$t.reply.md" 2> "$O/runs/$t.stderr"
  local rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
worker() {
  while :; do
    while [ -e $O/HOLD ]; do sleep 30; done
    t=$(next_task); [ -n "$t" ] || break
    run_task $t
  done
}
worker & sleep 20; worker & wait
date "+RUN END %F %T" >> $O/times.log; python3 $O/quota.py > $O/quota-after.json
