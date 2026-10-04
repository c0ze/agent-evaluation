#!/usr/bin/env bash
# Every 2 minutes while run.sh runs: log the Token Plan windows; past 85% used, create HOLD (no new tasks).
O=/Users/arda/projects/agent-eval-runs/mcode-m3-run-orch
while pgrep -f "mcode-m3-run-orch/run.sh" >/dev/null || [ ! -e $O/times.log ]; do
  rm -f /Users/arda/.cache/mcode-quota.json
  line=$(/Users/arda/.local/bin/mcode-quota status | python3 -c '
import json,sys,time; d=json.load(sys.stdin)
print(time.strftime("%H:%M:%S"), "5h", d.get("short_percent"), "weekly", d.get("percent"), "err", d.get("error"))')
  echo "$line" >> $O/usage.log
  set -- $line
  if python3 -c "import sys; sys.exit(0 if max(float('$3' if '$3'!='None' else 0), float('$5' if '$5'!='None' else 0)) >= 85 else 1)"; then
    [ -e $O/HOLD ] || { touch $O/HOLD; echo "$1 HOLD: a window passed 85%" >> $O/usage.log; }
  fi
  sleep 120
done
echo "$(date +%H:%M:%S) watcher stopped" >> $O/usage.log
