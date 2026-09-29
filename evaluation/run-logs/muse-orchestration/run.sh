#!/usr/bin/env bash
ROOM=/Users/arda/projects/agent-eval-runs/agent-eval-muse; O=/Users/arda/projects/agent-eval-runs/muse-run-orch
queue() { local who=$1; shift; for t in "$@"; do
  s=$(date +%s); echo "$t start $(date '+%F %T') $who" >> $O/times.log
  tincan ask --to $who --from orch --room $ROOM --body-file $O/bodies/$t.md --timeout 0 --format json > $O/replies/$t.json 2> $O/replies/$t.err; rc=$?
  e=$(date +%s); echo "$t end $(date '+%F %T') $who rc=$rc secs=$((e-s))" >> $O/times.log
done; }
date '+RUN START %F %T' >> $O/times.log
queue muse-1 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue muse-2 02-bug-fixing 06-product-planning 10-general-operations &
queue muse-3 03-infra-management 07-creative-writing 11-frontend-operations &
queue muse-4 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; date '+RUN END %F %T' >> $O/times.log
