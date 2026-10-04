#!/usr/bin/env bash
# MiniMax M3.1 Flash (xhigh) through mcode exec: same protocol as gpt-run-orch/run-sol.sh and the
# muse run. One fresh request per task, four queues, no hints, no re-runs. Refuses a dirty repo.
MCODE=/Users/arda/.minimax-code/bin/mcode
O=/Users/arda/projects/agent-eval-runs/mcode-run-orch
R=/Users/arda/projects/agent-eval-runs/agent-eval-mcode-m3.1-flash
MODEL=minimax/MiniMax-M3.1-Flash-Preview EFFORT=xhigh

[ -z "$(git -C $R status --porcelain)" ] || { echo "$R has changes; the tasks must be clean" >&2; exit 4; }
quota() { rm -f /Users/arda/.cache/mcode-quota.json; /Users/arda/.local/bin/mcode-quota status > "$O/quota-$1.json"; }
quota before; date "+RUN START %F %T" >> $O/times.log
run_task() {
  local t=$1 body="Your task directory is $R/$1. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$t start $(date '+%F %T')" >> $O/times.log
  printf '%s' "$body" | "$MCODE" exec --cwd "$R" --model $MODEL --effort $EFFORT --prompt-mode coding \
    --permission full --max-steps 200 --timeout 2h --input - --output-format json \
    -o "$O/runs/$t.reply.md" > "$O/runs/$t.events.json" 2> "$O/runs/$t.stderr"
  local rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { for t in "$@"; do run_task $t; done; }
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; date "+RUN END %F %T" >> $O/times.log; quota after
