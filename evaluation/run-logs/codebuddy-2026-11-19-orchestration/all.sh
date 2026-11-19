#!/usr/bin/env bash
# The three CodeBuddy models of 2026-11-19, one after another in Arda's order (hy4, hy4-flash, DeepSeek V4.1 Flash), each
# task one at a time via run.sh, all at --effort high,
# through the user's Tencent Cloud TokenHub plan (custom-local models). Stops before the next model if any reply so far
# hit the plan's rate limit (429), so no task starts into a known limit.
O=/tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/cb-orch
S=/tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad
for spec in hy4:custom-local:hy4 hy4-flash:custom-local:hy4-flash deepseek-v4.1-flash:custom-local:deepseek/deepseek-flash; do
  tag=${spec%%:*}; model=${spec#*:}
  if grep -l -s -E 'usage exceeds frequency limit|exceeds frequency limit|insufficient (balance|quota)' $O/*/replies/*.events.jsonl $O/*/replies/*.stderr >/dev/null 2>&1; then
    echo "STOP before $tag: a reply hit the rate limit $(date '+%F %T')" >> $O/times.log; exit 3
  fi
  $O/run.sh $tag $model high $S/agent-eval-$tag
done
echo "ALL DONE $(date '+%F %T')" >> $O/times.log
