#!/usr/bin/env bash
# Run the 13 tasks for one model through Tencent's CodeBuddy Code CLI (headless `codebuddy -p`), one fresh
# session per task, four at a time. usage: run.sh TAG MODEL EFFORT REPO
# CodeBuddy's sign-in is tied to the user's real HOME, so HOME stays real, but user settings (plugins, hooks),
# MCP servers, session persistence and auto-memory are off, and the repo lives outside /home/arda so no
# CLAUDE.md/CODEBUDDY.md/AGENTS.md is discovered. CodeBuddy ignores Claude Code sandbox settings and its own
# sandbox needs Docker, so permission rules stand in for one: web tools and network/install commands are
# denied, and the transcripts are audited afterwards.
CB=/home/arda/.local/bin/codebuddy
NODE=/home/arda/.local/share/mise/installs/node/latest/bin
O=$(cd "$(dirname "$0")" && pwd)
TAG=${1:?tag} MODEL=${2:?model} EFFORT=${3:?effort} REPO=${4:?repo}
SETTINGS='{"autoMemoryEnabled":false,"permissions":{"allow":["Bash"],"deny":["Bash(curl:*)","Bash(wget:*)","Bash(pip install:*)","Bash(pip3 install:*)","Bash(python3 -m pip:*)","Bash(npm install:*)","Bash(npx:*)","Bash(uv pip:*)","Bash(uv add:*)","Bash(git clone:*)","Bash(ssh:*)","WebFetch","WebSearch"]}}'
mkdir -p $O/$TAG/replies

run_task() { # task
  local t=$1
  local body="Your task directory is $REPO/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$TAG $t start $(date '+%F %T')" >> $O/times.log
  (cd "$REPO" && env -i HOME="$HOME" USER="$USER" PATH=$NODE:/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 TERM=dumb \
    timeout 7200 "$CB" -p "$body" --model $MODEL --effort $EFFORT --setting-sources project --strict-mcp-config \
      --no-session-persistence --permission-mode acceptEdits --disallowedTools WebFetch WebSearch \
      --settings "$SETTINGS" --output-format stream-json --verbose \
    > "$O/$TAG/replies/$t.events.jsonl" 2> "$O/$TAG/replies/$t.stderr" < /dev/null)
  local rc=$? e=$(date +%s); echo "$TAG $t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
# Re-run one task with the identical command (usage: rerun-one.sh TAG MODEL EFFORT REPO TASK).
run_task "$5"
