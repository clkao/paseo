#!/bin/bash
# What the agent's shell tool runs. $1 = label prefix.
C="$(cd "$(dirname "$0")" && pwd)/client.py"
python3 -I "$C" "$1-shell"
python3 -I "$C" "$1-shell" escapes
# nohup, and a nohup-equivalent (macOS nohup refuses to run without a console in some contexts)
nohup sh -c "sleep 3; python3 -I '$C' '$1-nohup-orphan'" </dev/null >/dev/null 2>&1 &
( trap '' HUP; sleep 3; python3 -I "$C" "$1-hupignore-orphan" ) </dev/null >/dev/null 2>&1 &
disown -a
echo "agent_cmd done (escaped clients report to the harness log in ~3s)"
