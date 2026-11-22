#!/usr/bin/env bash
# Rebuild the local integration branch: upstream main plus every open task branch.
#
# Usage: .spacedock/repo/integration.sh [task-branch ...]
# With no arguments it merges the branches listed in INTEGRATION_BRANCHES below.
# Run it from the paseo checkout. It never pushes.
#
# The branch is rebuilt from scratch each time, because task branches get rewritten.
# The worktree keeps its node_modules across rebuilds; run `npm ci` again only when
# package-lock.json changes (the script prints a warning).
set -euo pipefail

INTEGRATION_BRANCHES=(
  task/launch-wrap-hook
  task/browser-profile-selector
)

ROOT="$(git rev-parse --show-toplevel)"
WORKTREE="$ROOT/.worktrees/integration"
BRANCH="integration/local"
UPSTREAM_URL="https://github.com/getpaseo/paseo.git"

branches=("$@")
if [ "${#branches[@]}" -eq 0 ]; then branches=("${INTEGRATION_BRANCHES[@]}"); fi

git -C "$ROOT" fetch -q "$UPSTREAM_URL" main
base="$(git -C "$ROOT" rev-parse FETCH_HEAD)"

if [ ! -d "$WORKTREE" ]; then
  git -C "$ROOT" worktree add -q -B "$BRANCH" "$WORKTREE" "$base"
fi

if [ -n "$(git -C "$WORKTREE" status --porcelain)" ]; then
  echo "integration: $WORKTREE has uncommitted changes; stop." >&2
  exit 1
fi

old_lock="$(git -C "$WORKTREE" rev-parse -q --verify HEAD:package-lock.json || true)"
git -C "$WORKTREE" checkout -q -B "$BRANCH" "$base"
for branch in "${branches[@]}"; do
  git -C "$WORKTREE" merge -q --no-ff --no-edit "$branch"
done
new_lock="$(git -C "$WORKTREE" rev-parse HEAD:package-lock.json)"

echo "integration: $BRANCH at $(git -C "$WORKTREE" rev-parse --short HEAD) = upstream main $(git -C "$ROOT" rev-parse --short "$base") + ${branches[*]}"
if [ "$old_lock" != "$new_lock" ] || [ ! -d "$WORKTREE/node_modules" ]; then
  echo "integration: package-lock.json changed or node_modules is missing; run npm ci in $WORKTREE." >&2
fi
