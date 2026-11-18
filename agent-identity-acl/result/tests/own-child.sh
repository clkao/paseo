#!/usr/bin/env bash
# Run from the provider's shell, in its private test workspace.
set -eu
root=$(dirname "$(pwd -P)")
[[ "$root" == /tmp/paseo-acl-* ]] && [[ -f "$root/7801/paseo.pid" ]] || exit 2
[[ -n "${PASEO_AGENT_ID:-}" ]] || exit 3
export PASEO_HOME="$root/7801"
printf 'Shell caller %s\n' "$PASEO_AGENT_ID"
exec paseo run --home "$PASEO_HOME" --no-wait --json --title acl-own-child \
  --provider claude --model claude-sonnet-5-5 'Reply only ACL_CHILD_READY. Use no tools.'
