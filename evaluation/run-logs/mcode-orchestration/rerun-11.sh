#!/usr/bin/env bash
# Task 11 re-run from the template after the first attempt was killed by the orchestrator's
# background-job limit (not by mcode). Identical command and instruction to run.sh.
MCODE=/Users/arda/.minimax-code/bin/mcode
O=/Users/arda/projects/agent-eval-runs/mcode-run-orch
R=/Users/arda/projects/agent-eval-runs/agent-eval-mcode-m3.1-flash
MODEL=minimax/MiniMax-M3.1-Flash-Preview EFFORT=xhigh t=11-frontend-operations
body="Your task directory is $R/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
s=$(date +%s); echo "$t start $(date '+%F %T') (re-run)" >> $O/times.log
printf '%s' "$body" | "$MCODE" exec --cwd "$R" --model $MODEL --effort $EFFORT --prompt-mode coding \
  --permission full --max-steps 200 --timeout 2h --input - --output-format json \
  -o "$O/runs/$t.reply.md" > "$O/runs/$t.events.json" 2> "$O/runs/$t.stderr"
rc=$?; e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
date "+RUN END %F %T" >> $O/times.log
rm -f /Users/arda/.cache/mcode-quota.json; /Users/arda/.local/bin/mcode-quota status > "$O/quota-after.json"
