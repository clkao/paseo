#!/bin/sh
# overlay-setup.sh — create or resume the off-tree Spacedock overlay on a Paseo checkout.
# Adapted from the spacedock-v1 guide for a checkout with no fork yet.
# Usage: overlay-setup.sh DIR [README] [STATE_URL]
#   DIR        the code checkout
#   README     workflow README for the first setup (omit when STATE_URL already has it)
#   STATE_URL  repository holding the spec branch and the state branch; default: a local
#              bare repository DIR/.spacedock/state.git. The fork works too: only the two
#              workflow branches are fetched, not the code history.
#   SPEC_BRANCH (env) the spec branch name in STATE_URL; default main. The fork uses spacedock-spec.
# Layout: DIR/.spacedock/repo = spec repo (origin = STATE_URL, branch main)
#         DIR/.spacedock/dev/README.md -> ../repo/README.md
#         DIR/.spacedock/dev/.spacedock-state = linked worktree of the spec repo, branch dev-state
set -e
DIR=$1 README=${2:+$(cd "$(dirname "$2")" && pwd)/$(basename "$2")}
BRANCH=dev-state
SPEC_BRANCH=${SPEC_BRANCH:-main}

cd "$DIR"
STATE=${3:-$PWD/.spacedock/state.git}

# The clone's origin is the upstream: rename it. The fork becomes origin later.
if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote rename origin upstream
fi
for p in .spacedock/ .worktrees/; do
  grep -qxF "$p" .git/info/exclude || echo "$p" >> .git/info/exclude
done

case "$STATE" in
  /*) [ -d "$STATE" ] || git init -q --bare -b main "$STATE" ;;
esac

if [ ! -d .spacedock/repo/.git ]; then
  if git ls-remote --exit-code --heads "$STATE" "$SPEC_BRANCH" >/dev/null 2>&1; then
    git init -q .spacedock/repo                                 # resume: fetch the two branches only
    git -C .spacedock/repo remote add origin "$STATE"
    git -C .spacedock/repo fetch -q origin "$SPEC_BRANCH"
    git -C .spacedock/repo checkout -q -B "$SPEC_BRANCH" "origin/$SPEC_BRANCH"
    git -C .spacedock/repo branch -q --set-upstream-to="origin/$SPEC_BRANCH"
  else
    git init -q -b main .spacedock/repo                        # first setup
    cp "$README" .spacedock/repo/README.md
    cp "$0" .spacedock/repo/overlay-setup.sh
    git -C .spacedock/repo add README.md overlay-setup.sh
    git -C .spacedock/repo commit -qm "Add workflow spec"
    git -C .spacedock/repo remote add origin "$STATE"
    git -C .spacedock/repo push -q origin main
    git -C .spacedock/repo checkout -q --orphan "$BRANCH"
    git -C .spacedock/repo rm -rfq --cached .
    git -C .spacedock/repo commit -q --allow-empty -m "seed state"
    git -C .spacedock/repo push -q origin "$BRANCH"
    git -C .spacedock/repo checkout -qf main
  fi
fi

mkdir -p .spacedock/dev
ln -sfn ../repo/README.md .spacedock/dev/README.md
[ -d .spacedock/repo/_mods ] && ln -sfn ../repo/_mods .spacedock/dev/_mods
if [ ! -d .spacedock/dev/.spacedock-state ]; then
  git -C .spacedock/repo fetch -q origin "$BRANCH"
  git -C .spacedock/repo show-ref --verify --quiet "refs/heads/$BRANCH" ||
    git -C .spacedock/repo branch -q "$BRANCH" "origin/$BRANCH"
  git -C .spacedock/repo worktree add -q ../dev/.spacedock-state "$BRANCH"
fi
"${SPACEDOCK_BIN:-spacedock}" state ready --workflow-dir .spacedock/dev
