#!/bin/bash
# Agent channel probe. Run OUTSIDE Agent Safehouse (it blocks Unix-socket bind).
# Usage: run-all.sh            (all steps, 3 model runs: claude, codex sandboxed, codex unsandboxed)
#        SKIP_MODEL=1 run-all.sh  (no-model steps only)
set -u
P="$(cd "$(dirname "$0")" && pwd)"; D="$(dirname "$P")"; L="$D/logs/outside"; C="$P/client.py"
T=/tmp/agent-channel-probe; mkdir -p "$T" "$L"
H="python3 -I $P/harness.py"
step() {
  local avail_k; avail_k=$(df -k / | awk 'NR==2{print $4}')
  echo; echo "=== $1 (free: $((avail_k/1024)) MiB)"
  if [ "$avail_k" -lt 1572864 ]; then echo "STOP: less than 1.5 GiB free"; exit 2; fi
}
step "0 environment"
{ claude --version; codex --version 2>/dev/null; python3 --version; node --version; uname -a; } > "$L/env.log" 2>&1; cat "$L/env.log"

step "1 baseline: bash -c, node spawn, python subprocess, sibling, escapes, nohup"
$H --log "$L/baseline.harness.log" --client-log "$L/baseline.clients.log" --sibling --grace 5 -- bash -c "
python3 -I $C bash-c
python3 -I $C bash-c escapes
bash $P/agent_cmd.sh bash-agentcmd
node -e 'const cp=require(\"child_process\"); cp.spawnSync(\"python3\",[\"-I\",\"$C\",\"node-spawnSync\"],{stdio:\"inherit\"}); cp.spawnSync(\"python3\",[\"-I\",\"$C\",\"node-spawn-stdio3-inherit\"],{stdio:[0,1,2,3]})'
python3 -I -c 'import subprocess,sys; subprocess.run([sys.executable,\"-I\",\"$C\",\"py-subprocess-default\"]); subprocess.run([sys.executable,\"-I\",\"$C\",\"py-subprocess-pass_fds3\"],pass_fds=(3,))'
" >/dev/null 2>&1

step "2 daemon restart: harness A exits, agent keeps running, harness B adopts the recorded root PID"
$H --log "$L/restart-daemon.harness.log" --client-log "$L/restart-daemon.clients.log" --detach-after 3 -- \
  bash -c "for i in 1 2 3 4 5 6 7 8 9 10; do python3 -I $C fake-agent-tick\$i; sleep 1; done" >/dev/null 2>&1
sleep 0.5
$H --log "$L/restart-daemon.harness.log" --adopt "$T/state.json" --duration 8 2>/dev/null

step "3 agent restart: agent#1 leaves an orphan, then agent#2 starts with a new pair"
$H --log "$L/restart-agent.harness.log" --client-log "$L/restart-agent.clients.log" --runs 2 --grace 6 -- \
  bash -c "python3 -I $C agent-start; (python3 -I $C orphan-of-earlier-agent loop 6 &); sleep 1.5" >/dev/null 2>&1

step "4 codex seatbelt without a model: default, then --allow-unix-socket"
$H --log "$L/codex-seatbelt.harness.log" --client-log "$T/codex-seatbelt.clients.log" --grace 5 -- \
  codex sandbox -- bash "$P/agent_cmd.sh" codex-seatbelt-default > "$L/codex-seatbelt.stdout.log" 2>&1
$H --log "$L/codex-seatbelt.harness.log" --client-log "$T/codex-seatbelt.clients.log" --grace 5 -- \
  codex sandbox --allow-unix-socket "$T/d.sock" --allow-unix-socket "/private$T/d.sock" -- bash "$P/agent_cmd.sh" codex-seatbelt-allowsock >> "$L/codex-seatbelt.stdout.log" 2>&1
cp "$T/codex-seatbelt.clients.log" "$L/" 2>/dev/null

if [ "${SKIP_MODEL:-0}" = 1 ]; then echo "SKIP_MODEL=1: done"; exit 0; fi
PROMPT_TAIL="Then reply with its output and nothing else."

step "5 claude -p (model run): Bash tool + stdio MCP server"
W="$T/claude-outside"; mkdir -p "$W"; cd "$W"
echo "{\"mcpServers\":{\"probe\":{\"type\":\"stdio\",\"command\":\"python3\",\"args\":[\"-I\",\"$P/mcp_server.py\",\"claude-mcp\"]}}}" > "$W/mcp.json"
$H --log "$L/claude.harness.log" --client-log "$L/claude.clients.log" --grace 8 -- \
  claude -p "Use the Bash tool to run exactly this command, once: bash $P/agent_cmd.sh claude   $PROMPT_TAIL" \
  --model haiku --tools Bash --allowedTools Bash --mcp-config "$W/mcp.json" --strict-mcp-config --no-session-persistence \
  < /dev/null > "$L/claude.stdout.log" 2> "$L/claude.stderr.log"

for MODE in workspace-write bypass; do
  step "6 codex exec (model run), sandbox=$MODE: shell tool + stdio MCP server"
  W="$T/codex-$MODE"; mkdir -p "$W"; cd "$W"
  if [ $MODE = bypass ]; then SB=(--dangerously-bypass-approvals-and-sandbox); else SB=(-s workspace-write); fi
  $H --log "$L/codex-$MODE.harness.log" --client-log "$T/codex-$MODE.clients.log" --grace 8 -- \
    codex exec --skip-git-repo-check --ephemeral "${SB[@]}" -C "$W" \
    -c 'mcp_servers.probe.command="python3"' -c "mcp_servers.probe.args=[\"-I\",\"$P/mcp_server.py\",\"codex-$MODE-mcp\"]" \
    "Run exactly this shell command once: bash $P/agent_cmd.sh codex-$MODE   $PROMPT_TAIL" \
    < /dev/null > "$L/codex-$MODE.stdout.log" 2> "$L/codex-$MODE.stderr.log"
  cp "$T/codex-$MODE.clients.log" "$L/" 2>/dev/null
done
cp "$T/mcp-probe.log" "$L/" 2>/dev/null
step "done; logs in $L"
grep -h -E 'ACCEPT|REFUSE|PAIR|FAILED' "$L"/*.harness.log | cut -c1-200
