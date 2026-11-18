# Where the spacedock-v1 guide was not sufficient

Setup of the off-tree workflow on the Paseo checkout, 2026-11-18, spacedock 0.29.0-pre0. Each point says what happened and what fixed it.

1. **Discovery needs `commissioned-by: spacedock@<version>`.** The guide names only `state:` and `state-branch:` as required frontmatter. A hand-written README with any other `commissioned-by` value is VALID with `--workflow-dir`, but `spacedock status --boot`, `spacedock new` and `spacedock claude` from the root report "no commissioned Spacedock workflow found". Fix: `commissioned-by: spacedock@0.29.0-pre0`. Source: `internal/status/discover_walkup.go:26`.
2. **No README content.** "Write the README by hand" gives no sections or stage keys. I read the plugin's `skills/commission/references/templates/development.md` and the commission skill, outside the guide. `context-sections` needs a matching `## Review-finding disposition` section, which only the template says.
3. **The script breaks with a relative README path.** It runs `cd "$DIR"` before `cp "$README"`. Fix: make the path absolute first.
4. **No-fork case.** The script clones a fork and needs a state URL. With no fork it must rename `origin` to `upstream`, not clone, and create the local bare state repository before `git ls-remote`. The guide said to adapt it but did not say that `state ready` accepts a state repository without `origin` ("local-only"). I chose a local bare repository `.spacedock/state.git` so that the push path is the same one a real state remote will use.
5. **`spacedock new` does not commit in split-root.** The task file stays untracked on `dev-state` until `spacedock state commit <slug>`. The guide does not mention it.
6. **`state ready` is hidden.** Neither `spacedock --help` nor `spacedock state --help` lists it. It exists (`spacedock state` lists `init|new|ready|sweep|commit`).
7. **"done" with no fork.** The guide says the pr-merge hook fails when `origin` is not writable, but it does not say what to use. I set done = merge into local `main`, with no mod, until the fork exists.
8. **The script is not kept anywhere.** On a new machine you need the script to get the state repository. I commit it into the spec repository and keep the guide as the bootstrap copy.

Proved: `git status --porcelain --untracked-files=all` of the code checkout is empty, `spacedock status` from the root shows the workflow and one task, and the script resumed the layout in a fresh test repository from `.spacedock/state.git`.
