#!/usr/bin/env bash
# Every 2 minutes while run.sh runs: log muse's quota windows; past 85% used, create HOLD (no new tasks).
# Each reading is a real (tiny) model call by muse-quota, outside the sandbox.
O=/Users/arda/projects/agent-eval-runs/muse-wonder-run-orch
sleep 5
while pgrep -f "muse-wonder-run-orch/run.sh" >/dev/null; do
  rm -f /Users/arda/.cache/muse-quota.json
  line=$(/Users/arda/.local/bin/muse-quota status | python3 -c '
import json,sys,time; d=json.load(sys.stdin)
print(time.strftime("%H:%M:%S"), "short", d.get("short_percent"), "weekly", d.get("percent"), "err", d.get("error"))')
  echo "$line" >> $O/usage.log
  set -- $line
  if python3 -c "import sys; sys.exit(0 if max(float('$3' if '$3'!='None' else 0), float('$5' if '$5'!='None' else 0)) >= 85 else 1)"; then
    [ -e $O/HOLD ] || { touch $O/HOLD; echo "$1 HOLD: a window passed 85%" >> $O/usage.log; }
  fi
  sleep 120
done
echo "$(date +%H:%M:%S) watcher stopped" >> $O/usage.log
