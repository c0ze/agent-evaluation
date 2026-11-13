#!/usr/bin/env bash
# Gemini 4 Hydrogen (gemini-4-hydrogen-xhigh, --effort xhigh) through the Antigravity CLI on the ThinkPad: the same
# protocol as the Gemini 3.1 Pro / 3.8 Flash runs (run-logs/gemini-orchestration/run.sh). One fresh `agy -p` per task,
# four queues with the usual split, 2-hour limit per task, no hints. Each task gets its own empty HOME holding only a
# settings file, so no rules, memories, knowledge items, conversation summaries, user skills or MCP servers reach the
# model and tasks can't see each other's history. agy 1.5 reads its OAuth token from the system keyring over DBus
# (no token file to link), so DBus is the one thing passed through. The repo lives outside /home/arda, so no
# CLAUDE.md/GEMINI.md/AGENTS.md is discovered. Terminal commands run in agy's sandbox (no network, home directory
# read-only and hidden, writes limited to the workspace and temp dirs), and URL tools are denied. agy self-updates in
# place, so the binary (1.5.8) is pinned as a copy in bin/.
AGY=/tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/hydrogen-orch/bin/antigravity-1.5.8
O=/tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/hydrogen-orch
REPO=/tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/agent-eval-gemini-hydrogen
MODEL=gemini-4-hydrogen-xhigh EFFORT=xhigh
mkdir -p $O/replies $O/homes
[ -z "$(git -C $REPO status --porcelain)" ] || { echo "$REPO has changes; the tasks must be clean" >&2; exit 4; }

run_task() { # task
  local t=$1 h=$O/homes/$1
  mkdir -p $h/.gemini/antigravity-cli
  cat > $h/.gemini/antigravity-cli/settings.json <<JSON
{
  "trustedWorkspaces": ["$REPO"],
  "enableTerminalSandbox": true,
  "toolPermission": "proceed-in-sandbox",
  "permissions": {"allow": ["read_file($REPO)", "write_file($REPO)"], "deny": ["read_url(*)", "execute_url(*)"]}
}
JSON
  local body="Your task directory is $REPO/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$t start $(date '+%F %T')" >> $O/times.log
  (cd "$REPO" && env -i HOME="$h" USER="$USER" PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 TERM=dumb \
    DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
    timeout 7200 "$AGY" -p "$body" --model $MODEL --effort $EFFORT --add-dir "$REPO" --output-format stream-json \
    > "$O/replies/$t.events.jsonl" 2> "$O/replies/$t.stderr" < /dev/null)
  local rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { for t in "$@"; do run_task $t; done; }

date "+RUN START %F %T" >> $O/times.log
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; date "+RUN END %F %T" >> $O/times.log
