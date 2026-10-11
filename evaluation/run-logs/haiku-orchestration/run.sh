#!/usr/bin/env bash
# Run the 13 tasks for Haiku 5.5 (claude-haiku-5-5, xhigh): one fresh headless `claude -p` per task,
# four at a time. The repo lives outside /home/arda so ~/CLAUDE.md and project memory are not
# discovered; user settings (plugins, hooks), MCP servers and the parent session's environment are
# all excluded. Bash is allowed without prompts (headless mode cannot answer them) but runs inside
# Claude Code's sandbox, which blocks the network and
# confines writes to the repo and the session temp area.
CLAUDE=/home/arda/.local/share/mise/installs/claude/2.1.296/claude
O=$(cd "$(dirname "$0")" && pwd)
REPO=${REPO:?set REPO to the run repository}
MODEL=claude-haiku-5-5 EFFORT=xhigh
SETTINGS='{"permissions":{"allow":["Bash"]},"sandbox":{"enabled":true,"autoAllowBashIfSandboxed":true,"allowUnsandboxedCommands":false,"network":{"allowedDomains":[]}}}'

run_task() { # task
  local t=$1
  local body="Your task directory is $REPO/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
  local s=$(date +%s); echo "$t start $(date '+%F %T')" >> $O/times.log
  (cd "$REPO" && env -i HOME="$HOME" USER="$USER" PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 TERM=dumb \
    timeout 7200 "$CLAUDE" -p "$body" --model $MODEL --effort $EFFORT \
      --setting-sources project --strict-mcp-config --settings "$SETTINGS" \
      --permission-mode acceptEdits --disallowedTools WebFetch WebSearch \
      --no-session-persistence --output-format stream-json --verbose \
    > "$O/replies/$t.events.jsonl" 2> "$O/replies/$t.stderr" < /dev/null)
  local rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s))" >> $O/times.log
}
queue() { for t in "$@"; do run_task $t; done; }

mkdir -p $O/replies
date '+RUN START %F %T' >> $O/times.log
queue 01-feature-building 05-technical-writing 09-incident-analysis 13-frontend-playful &
queue 02-bug-fixing 06-product-planning 10-general-operations &
queue 03-infra-management 07-creative-writing 11-frontend-operations &
queue 04-project-maintenance 08-social-media 12-frontend-editorial &
wait; date '+RUN END %F %T' >> $O/times.log
