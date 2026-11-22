#!/bin/bash
set -eu
unset ${!PASEO_@}
D=$(cd "$(dirname "$0")/.." && pwd)
T=$(cat /tmp/p3-followup-root)
name=$1
warmSource=${2:-}
base="$T/$name"
test ! -e "$T/STOP"
test ! -e "$base"
mkdir -p "$base/tmp" "$D/$name"
if [[ -n $warmSource ]]; then
  cp -al "$T/$warmSource/tmp/metro-cache" "$base/tmp/"
  for file in "$T/$warmSource/tmp/metro-file-map-"*; do
    [[ ! -f "$file" ]] || cp "$file" "$base/tmp/"
  done
fi
export TZ=UTC
cd /home/exedev/worktrees/browser-profile-selector
log="$D/$name/command.log"
{
  echo "Working directory $PWD"
  echo "Started $(date -u +%FT%TZ), warm Metro source: ${warmSource:-none}"
  du -sh "$base/tmp"
  echo "Command: $D/tools/isolated $base env NODE_OPTIONS=--require=$D/tools/timing.cjs PASEO_DESKTOP_BROWSER_E2E_ARTIFACT_DIR=$D/$name npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop"
  set +e
  "$D/tools/isolated" "$base" env NODE_OPTIONS="--require=$D/tools/timing.cjs" PASEO_DESKTOP_BROWSER_E2E_ARTIFACT_DIR="$D/$name" npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop
  rc=$?
  echo "Finished $(date -u +%FT%TZ), exit=$rc"
  exit "$rc"
} > "$log" 2>&1
