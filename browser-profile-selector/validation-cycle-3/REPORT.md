# REJECTED · Browser profile selector validation, cycle 3

Linux, paseo-acl-prototype, 2026-11-22. The checkout was clean at `5a0bf1449286899f174ef7e1073f37c97cdc5443`. The installed dependency tree failed the required lockfile check. The dispatch explicitly requires stopping on this result. Product behavior at this commit remains unverified.

## Preflight — FAILED

From `~/worktrees/browser-profile-selector`, after clearing inherited variables with `unset ${!PASEO_@}`:

```sh
git fetch https://github.int.exe.xyz/clkao/paseo.git task/browser-profile-selector
git checkout --detach 5a0bf1449
git rev-parse HEAD:package-lock.json
git hash-object package-lock.json
python3 ~/acl-result/browser-profile-selector/validation-cycle-3/logs/check-lock.py
(cd packages/desktop && node -p "require('vitest/package.json').version")
(cd packages/app && node -p "require('@typescript-eslint/scope-manager/package.json').version")
```

Both lockfile blob IDs were `6429b4be0d2897f6eccf6b0423622aa4b10d5d94`. The comparison exited 1. Forty non-optional entries were missing from both the installed lock and their expected filesystem locations (16 app, 8 desktop, 8 CLI, 8 relay). Two workspace resolution checks confirmed the practical effect.

| Workspace | Package | Locked | Resolved |
| --- | --- | --- | --- |
| desktop | vitest | 4.1.6 | 4.1.7 |
| app | @typescript-eslint/scope-manager | 8.71.2 | 8.72.1 |

The worktree was clean before checkout and after preflight. Free space stayed above 7.8 GiB. No dependency install, browser download, test daemon or Electron process was started. The VM's Paseo home and daemon were untouched. [Fetch and checkout output](logs/preflight.log) · [Dependency checker](logs/check-lock.py) · [Full mismatch list, resolution output and final status](logs/lock-and-status.log)

## Checklist 1 — SKIPPED

Dependency preflight stopped the run before the individual Vitest files, changed-package boundary and contract tests, Electron capture harness, and full browser-tabs e2e. These commands produced no output. Inspection of the harness launcher found that its two Electron processes use default user data. A future run needs the same temporary `XDG_CONFIG_HOME` for both phases.

## Checklist 2 — SKIPPED

No production mutations, test-failure demonstrations or requested review sign-offs were performed after the stop. Findings 1, 2, 3, 8, 9 and 10, the inspections for 4, 11, 13 and 14, the item-5 e2e changes and the three normalization regressions have no cycle-3 validation result.

## Checklist 3 — SKIPPED

No screenshots were captured. The lint, format and typecheck commands were not run. Also, the root typecheck delegates to a plugin example script that invokes npm install. A rerun under the same no-install rule needs to run the example compiler against existing dependencies without that install step.

## Acceptance results

Each section below records the corresponding verification commands as skipped. None produced test output. No result from cycle 2 or the implementation report counts toward cycle 3.

### AC-1 — SKIPPED

Account isolation and restart persistence. The desktop browser-tabs e2e was blocked at dependency preflight.

### AC-2 — SKIPPED

Menu groups, creation and duplicate rejection. The catalog test and full-app menu journeys were blocked at dependency preflight.

### AC-3 — SKIPPED

Destination profiles, delayed first document and legacy restoration. The automation handler, store and full-app routing tests were blocked at dependency preflight.

### AC-4 — SKIPPED

Stable project and workspace identity. The app profiles unit test was blocked at dependency preflight.

### AC-5 — SKIPPED

Pristine and locked phases. The store test, Chromium resident-webview test and Electron navigation journey were blocked at dependency preflight.

### AC-6 — SKIPPED

Guest registration and opener session. The desktop webviews test and browser-profile capture harness were blocked at dependency preflight.

### AC-7 — SKIPPED

Clearing live and closed sessions. The desktop profile test, capture harness and Settings journey were blocked at dependency preflight.

### Name normalization AC-1 — SKIPPED

Both canonical spellings against named and automatic rows. The catalog test and mutation were blocked at dependency preflight.

### Name normalization AC-2 — SKIPPED

Qualification of the existing collision while preserving sessions. The resolver test, collision replay and mutation were blocked at dependency preflight.

### Name normalization AC-3 — SKIPPED

Creation and selection of Café and Cafe. The catalog test, selector exercise and mutation were blocked at dependency preflight.
