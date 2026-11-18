#!/usr/bin/env bash
set -eu
root=${1:?pass the directory printed by setup.py}
[[ "$root" == /tmp/paseo-acl-* && -f "$root/7801/config.json" ]]
export PASEO_HOME="$root/7801"
unset PASEO_AGENT_ID PASEO_WORKSPACE_ID PASEO_AGENT_CWD
export PASEO_LISTEN=127.0.0.1:7801 PASEO_RELAY_ENABLED=false
export MCP_DEBUG=1 PASEO_LOG_CONSOLE_LEVEL=debug PASEO_LOG_LEVEL=debug
umask 077
exec paseo daemon run --home "$PASEO_HOME" >"$PASEO_HOME/foreground.log" 2>&1
