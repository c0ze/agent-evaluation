#!/usr/bin/env bash
# 2026-11-19: HY4 tasks 11 and 13 hit the gateway 400 (code 400001) again on their first re-run.
# Retry each up to three more times; every failed attempt is archived as interrupted/hy4-gateway-400/<task>.attemptN.
O=$(cd "$(dirname "$0")" && pwd); S=$(dirname "$O"); repo=$S/agent-eval-hy4; a=$O/interrupted/hy4-gateway-400
for t in 11-frontend-operations 13-frontend-playful; do
  for n in 2 3 4; do
    grep -q '400001' $O/hy4/replies/$t.events.jsonl || break
    mkdir -p $a/replies/attempt$n $a/tasks/attempt$n
    mv $O/hy4/replies/$t.events.jsonl $O/hy4/replies/$t.stderr $a/replies/attempt$n/; cp -a $repo/$t $a/tasks/attempt$n/
    git -C $repo checkout -q HEAD -- $t && git -C $repo clean -qfdx -- $t
    echo "hy4 $t rerun-after-gateway-400 (attempt $n) $(date '+%F %T')" >> $O/times.log
    $O/rerun-one.sh hy4 custom-local:hy4 high $repo $t
  done
  grep -q '400001' $O/hy4/replies/$t.events.jsonl && echo "hy4 $t STILL 400 after retries $(date '+%F %T')" >> $O/times.log
done
echo "RETRY DONE $(date '+%F %T')" >> $O/times.log
