#!/usr/bin/env bash
# Re-run Grok 4.7 task 13 on cachyos (2026-10-16), same flags as run.sh/resume-13.sh on the Mac:
# fresh repo from the template tree, clean HOME, GROK_HOME for login only, memory off, web off,
# MCP denied, workspace sandbox, xhigh. Calls the grok binary directly (the ~/.local/bin mise wrapper hangs).
# usage: resume-13-cachyos.sh REPO OUTDIR
R=${1:?repo} O=${2:?outdir}
G=/home/arda/.grok/bin/grok
t=13-frontend-playful
mkdir -p "$O/replies"
[ -z "$(git -C "$R" status --porcelain)" ] || { echo "$R has changes" >&2; exit 4; }
CH=$(mktemp -d "$O/cleanhome.XXXX")
body="Your task directory is $R/$t. Read TASK.md there and complete it. Work only inside that directory; do not read or change anything else in the repository. Do not use the network. When you finish, reply with a one-paragraph summary, whether you completed every deliverable, and your exact model ID."
s=$(date +%s); echo "$t start $(date '+%F %T') [cachyos re-run, $($G --version)]" >> "$O/times.log"
(cd "$R" && env -i HOME="$CH" USER="$USER" PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 TERM=dumb \
  GROK_HOME=/home/arda/.grok GROK_MEMORY=0 timeout 7200 "$G" -p "$body" \
  -m grok-4.7 --reasoning-effort xhigh --cwd "$R" --sandbox workspace --disable-web-search --deny MCPTool \
  --always-approve --no-alt-screen --output-format json < /dev/null > "$O/replies/$t.json" 2> "$O/replies/$t.stderr")
rc=$? e=$(date +%s); echo "$t end $(date '+%F %T') rc=$rc secs=$((e-s)) [cachyos re-run]" >> "$O/times.log"
rm -rf "${CH:?}"; exit $rc
