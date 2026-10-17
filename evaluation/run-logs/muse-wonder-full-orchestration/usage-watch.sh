#!/usr/bin/env bash
# Until run.sh logs RUN END: log Muse's quota windows every 2 minutes (every 10 while held). HOLD (no new task starts) while
# the 5-hour window is at 50% or more, or the weekly window at 85% or more, so tasks already running keep headroom;
# HOLD is removed once both are back under (after the 5-hour reset).
O=/tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/muse-full-orch
sleep 5
while ! grep -q "RUN END" $O/times.log; do
  line=$(python3 $O/quota.py | python3 -c '
import json,sys,time; d=json.load(sys.stdin)
print(time.strftime("%H:%M:%S"), "short", d.get("short_percent"), "weekly", d.get("percent"), "short_reset", d.get("short_reset_local","?").replace(" ","T"), "err", str(d.get("error")).replace(" ","_"))')
  echo "$line" >> $O/usage.log
  set -- $line
  if [ "$3" = None ]; then sleep 120; continue; fi
  if python3 -c "import sys; sys.exit(0 if float('$3') >= 50 or float('$5') >= 85 else 1)"; then
    [ -e $O/HOLD ] || { touch $O/HOLD; echo "$1 HOLD on" >> $O/usage.log; }
  elif [ -e $O/HOLD ]; then rm -f $O/HOLD; echo "$1 HOLD off" >> $O/usage.log; fi
  [ -e $O/HOLD ] && sleep 600 || sleep 120
done
echo "$(date +%H:%M:%S) watcher stopped" >> $O/usage.log
