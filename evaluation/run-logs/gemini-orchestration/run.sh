#!/usr/bin/env bash
# Run the 13 tasks for one Gemini model through the Antigravity CLI (agy): one fresh `agy -p` per task,
# four at a time. usage: run.sh MODEL_VARIANT TAG REPO   (e.g. gemini-3.1-pro-high gemini-3.1-pro /path/repo)
# Each task gets its own empty HOME holding only a link to the user's agy OAuth token and a settings file,
# so no rules, memories, knowledge items, conversation summaries, user skills or MCP servers (the user's
# config has tincan) reach the model, and tasks can't see each other's agy history. The repo lives outside
# /home/arda, so no CLAUDE.md/GEMINI.md/AGENTS.md is discovered. Terminal commands run in agy's sandbox
# (no network; writes limited to the workspace and temp dirs), and URL tools are denied.
AGY=/home/arda/.local/share/mise/installs/antigravity-cli/1.2.2/antigravity
O=$(cd "$(dirname "$0")" && pwd)
MODEL=${1:?model variant} TAG=${2:?tag} REPO=${3:?repo}
mkdir -p $O/$TAG/replies $O/$TAG/homes

run_task() { # task
  local t=$1 h=$O/$TAG/homes/$t
  mkdir -p $h/.gemini/antigravity-cli
  ln -sf $HOME/.gemini/antigravity-cli/antigravity-oauth-token $h/.gemini/antigravity-cli/antigravity-oauth-token
  cat > $h/.gemini/antigravity-cli/settings.json <<EOF
{
  "trustedWorkspaces": ["$REPO"],
  "enableTerminalSandbox": true,
  "toolPermission": "proceed-in-sandbox",
  "permissions": {"allow": ["read_file($REPO)", "write_file($REPO)"], "deny": ["read_url(*)", "execute_url(*)"]}
}
EOF
  local body="Your task directory is $REPO/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$TAG $t start $(date '+%F %T')" >> $O/times.log
  (cd "$REPO" && env -i HOME="$h" USER="$USER" PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 TERM=dumb \
    timeout 7200 "$AGY" -p "$body" --model $MODEL --effort high --add-dir "$REPO" --output-format stream-json \
    > "$O/$TAG/replies/$t.events.jsonl" 2> "$O/$TAG/replies/$t.stderr" < /dev/null)
  local rc=$? e=$(date +%s); echo "$TAG $t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { for t in "$@"; do run_task $t; done; }

date "+$TAG RUN START %F %T" >> $O/times.log
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; date "+$TAG RUN END %F %T" >> $O/times.log
