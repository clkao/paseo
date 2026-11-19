#!/usr/bin/env bash
set -eu
root=${1:?pass the directory printed by setup.py}
[[ "$root" == /tmp/paseo-acl-* && -f "$root/7801/paseo.pid" ]]
cp "$(dirname "$0")/own-child.sh" "$root/work/own-child.sh"
unset PASEO_AGENT_ID PASEO_WORKSPACE_ID PASEO_AGENT_CWD
export PASEO_HOME="$root/7801"
cd "$root/work"
exec paseo run --home "$PASEO_HOME" --new-workspace local --cwd "$PWD" --no-wait --json \
  --provider claude --model claude-sonnet-5-5 --title acl-parent \
  'Use the normal Paseo MCP list_hosts tool, then list_workspaces on the connected acl-destination using its returned serverId. Next run bash ./own-child.sh once from this working directory. It prints your shell ID and creates your own test child through the CLI. Report the shell ID and child ID. Do not send any other requests.'
