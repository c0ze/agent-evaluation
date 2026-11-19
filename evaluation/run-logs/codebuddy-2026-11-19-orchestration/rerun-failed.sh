#!/usr/bin/env bash
# 2026-11-19: re-run, one at a time, the sessions that ended on TokenHub's gateway error
# "400 ... read body failed" (code 400001). Each failed attempt's replies and task directory are kept
# under interrupted/<tag>-gateway-400/, then the task directory is reset to the template and the task
# re-runs with the identical command (run.sh's run_task).
O=$(cd "$(dirname "$0")" && pwd)
S=$(dirname "$O")
rerun() { # tag model task
  local tag=$1 model=$2 t=$3 repo=$S/agent-eval-$1 a=$O/interrupted/$1-gateway-400
  mkdir -p $a/replies $a/tasks
  mv $O/$tag/replies/$t.events.jsonl $O/$tag/replies/$t.stderr $a/replies/
  cp -a $repo/$t $a/tasks/
  git -C $repo checkout -q HEAD -- $t && git -C $repo clean -qfdx -- $t
  echo "$tag $t rerun-after-gateway-400 $(date '+%F %T')" >> $O/times.log
  $O/rerun-one.sh $tag $model high $repo $t
  if grep -q '400001' $O/$tag/replies/$t.events.jsonl; then echo "$tag $t STILL 400 $(date '+%F %T')" >> $O/times.log; fi
}
for t in 11-frontend-operations 12-frontend-editorial 13-frontend-playful; do rerun hy4 custom-local:hy4 $t; done
for t in 01-feature-building 02-bug-fixing 03-infra-management 04-project-maintenance 05-technical-writing; do rerun hy4-flash custom-local:hy4-flash $t; done
for t in 10-general-operations 11-frontend-operations 12-frontend-editorial 13-frontend-playful; do rerun deepseek-v4.1-flash custom-local:deepseek/deepseek-flash $t; done
echo "RERUN DONE $(date '+%F %T')" >> $O/times.log
