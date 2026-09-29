#!/usr/bin/env bash
# Run the 13 tasks for GPT-6 Luna (max, gand-business) and GPT-6 Astra (xhigh, gmail-business):
# one fresh `codex exec` per task, four at a time per model. The accounts' AGENTS.md is set aside
# for the run and restored on exit.
CODEX=/Users/arda/.local/share/mise/installs/node/24.14.0/bin/codex
O=/Users/arda/projects/agent-eval-runs/gpt-run-orch
HOMES=(/Users/arda/.codex-gand-business /Users/arda/.codex-gmail-business)
restore() { for h in "${HOMES[@]}"; do [ -f "$h/AGENTS.md.bench-aside" ] && mv -n "$h/AGENTS.md.bench-aside" "$h/AGENTS.md"; done; date '+AGENTS.md restored %F %T' >> $O/times.log; }
trap restore EXIT
for h in "${HOMES[@]}"; do [ -f "$h/AGENTS.md" ] && mv -n "$h/AGENTS.md" "$h/AGENTS.md.bench-aside"; done
date '+AGENTS.md set aside %F %T' >> $O/times.log

run_task() { # model effort home repo task
  local model=$1 effort=$2 home=$3 repo=$4 t=$5 tag; tag=${model#gpt-6-}
  mkdir -p $O/$tag
  local body="Your task directory is $repo/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$tag $t start $(date '+%F %T')" >> $O/times.log
  CODEX_HOME=$home "$CODEX" exec --ignore-user-config --ephemeral --skip-git-repo-check -s workspace-write \
    -m "$model" -c model_reasoning_effort="$effort" -C "$repo" --json -o "$O/$tag/$t.reply.md" "$body" \
    > "$O/$tag/$t.events.jsonl" 2> "$O/$tag/$t.stderr"
  local rc=$? e=$(date +%s); echo "$tag $t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { local model=$1 effort=$2 home=$3 repo=$4; shift 4; for t in "$@"; do run_task $model $effort $home $repo $t; done; }
model_run() { # model effort home repo
  local m=$1 e=$2 h=$3 r=$4 tag=${1#gpt-6-}
  date "+$tag RUN START %F %T" >> $O/times.log
  queue $m $e $h $r 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
  queue $m $e $h $r 02-bug-fixing 06-product-planning 10-general-operations &
  queue $m $e $h $r 03-infra-management 07-creative-writing 11-frontend-operations &
  queue $m $e $h $r 04-project-maintenance 08-social-media 12-frontend-editorial &
  wait; date "+$tag RUN END %F %T" >> $O/times.log
}
model_run gpt-6-luna max /Users/arda/.codex-gand-business /Users/arda/projects/agent-eval-runs/agent-eval-gpt-6-luna &
model_run gpt-6-astra xhigh /Users/arda/.codex-gmail-business /Users/arda/projects/agent-eval-runs/agent-eval-gpt-6-astra &
wait
