#!/usr/bin/env bash
set -eu
root=${1:?pass the directory printed by setup.py}
port=${2:?specify 7801 or 7802}
[[ "$root" == /tmp/paseo-acl-* && ( "$port" == 7801 || "$port" == 7802 ) ]]
export PASEO_HOME="$root/$port"
unset PASEO_AGENT_ID PASEO_WORKSPACE_ID PASEO_AGENT_CWD
python3 - "$port" "$PASEO_HOME/config.json" <<'PY'
import json, socket, sys
port = int(sys.argv[1])
assert json.load(open(sys.argv[2]))["daemon"]["listen"] == f"127.0.0.1:{port}"
with socket.socket() as sock:
    sock.bind(("127.0.0.1", port))
PY
export MCP_DEBUG=1 PASEO_LOG_FILE_LEVEL=debug
exec paseo daemon start --home "$PASEO_HOME" --timeout 60
