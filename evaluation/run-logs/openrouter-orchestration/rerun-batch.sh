#!/usr/bin/env bash
# Re-run the tasks interrupted when /tmp filled up, four at a time, each with rerun-one-or.sh (identical command).
S=${S:?set S to the scratch directory holding the run repositories}; O=$S/kimi-orchestration
SX='{"name":"Step 5 Preview","reasoning":true,"tool_call":true,"limit":{"context":1000000,"output":64000},"variants":{"high":{"reasoning":{"effort":"high"}}}}'
one() { local tag=$1 t=$2 model extra=""
  case $tag in qwen3.8-max) model=qwen/qwen3.8-max-0902;; step-5-preview) model=stepfun/step-5-preview; extra=$SX;; hy4-preview) model=tencent/hy4-preview;; esac
  bash $O/rerun-one-or.sh $tag $model $S/agent-eval-$tag "$extra" -- $t; }
export -f one; export S O SX
xargs -P 4 -L 1 bash -c 'one "$0" "$1"' < $S/rerun-list.txt
