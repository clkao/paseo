# REJECTED — Browser profile selector validation, cycle 3b

Linux, paseo-acl-prototype, 2026-11-22 UTC. The approved reinstall completed, but the installed tree still failed the mandatory lockfile preflight. The acceptance criteria remain unverified on this candidate.

## Preflight — FAILED

An initial read-only git status ran before inherited PASEO_* variables were cleared. The recorded pre-check, checkout, install and subsequent checks ran after clearing them. The worktree was clean before checkout and at the end. The fetched task head and the detached checkout were both `5a0bf1449286899f174ef7e1073f37c97cdc5443`. The on-disk lockfile and HEAD both had blob ID `6429b4be0d2897f6eccf6b0423622aa4b10d5d94`. [Checkout](logs/checkout.log) · [Final status and workspace resolution](logs/final-status.log)

From `~/worktrees/browser-profile-selector`, the install ran once under Node v26.13.1 and npm 11.20.0. The install environment disabled Playwright browser downloads, npm audit and funding output. Although LEFTHOOK=0 was set, the repository prepare script reported syncing the pre-commit hook. No additional install or browser download ran.

```bash
unset ${!PASEO_@}
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_config_audit=false npm_config_fund=false LEFTHOOK=0
npm ci --ignore-scripts=false
# added 2727 packages in 1m
# exit 0
python3 ~/acl-result/browser-profile-selector/validation-cycle-3b/logs/check-lock.py
# Missing non-optional lockfile entries: 40
# By workspace: {'app': 16, 'cli': 8, 'desktop': 8, 'relay': 8}
# exit 1
```

All 40 expected manifests were absent at their locked paths and missing from the installed lock. Node resolution from two affected workspaces independently showed different package versions. The count and distribution match the first attempt. [Install output](logs/npm-ci.log) · [Checker](logs/check-lock.py) · [All 40 paths](logs/lock.log)

| Resolution command | Locked | Resolved |
| --- | --- | --- |
| `(cd packages/app && node -p "require('@typescript-eslint/scope-manager/package.json').version")` | 8.71.2 | 8.72.1 |
| `(cd packages/desktop && node -p "require('vitest/package.json').version")` | 4.1.6 | 4.1.7 |

Free space was 7.84 GiB before installation and 3.09 GiB afterward. The lowest sample during installation was 2.92 GiB, above the 1.5 GiB stop threshold. [Disk samples in bytes](logs/disk.log)

## Checklist 1 — SKIPPED

The lockfile stop condition applied before the individual Vitest files, app and desktop boundary and contract suites, Electron capture harness and full browser-tabs e2e. No test daemon, Electron process or Xvfb instance launched. The VM’s Paseo home and daemon were untouched. The following commands produced no output because they did not run.

```bash
# For each applicable test from its workspace, individually
vitest run <file> --bail=1
PASEO_CAPTURE_HARNESS_GROUP=browser-profile npm run capture-harness --workspace=@getpaseo/desktop
npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop
```

## Checklist 2 — SKIPPED

Preflight stopped the run before production mutations for Neon 1, 2, 3, 8, 9, 10 or normalization AC-1 through AC-3. No mutation commands ran or produced output. Findings 4, 11, 13 and 14 received no inspection sign-off. Item 5’s boot count, delayed response, bitmap checks and launch count remain unverified.

## Checklist 3 — SKIPPED

The trigger, grouped menu, long-label chevron and error screenshots were not captured. The preflight stop preceded `npm run lint`, `npm run format:check` and `npm run typecheck`. Each has no output.

## Selector AC-1 — SKIPPED

Browser-tabs e2e did not run. No before/after account, ID, label, cookie or storage evidence.

## Selector AC-2 — SKIPPED

Catalog unit file and browser-tabs e2e did not run. No group, creation, collision or keyboard-selection output.

## Selector AC-3 — SKIPPED

Automation handler and store state files, slow loopback fixture and browser-tabs e2e did not run. No registration, destination-profile or legacy-restore output.

## Selector AC-4 — SKIPPED

The app profiles unit file did not run. No partition identity or legacy alias output.

## Selector AC-5 — SKIPPED

Store state and Chromium resident-webview files and browser-tabs e2e did not run. No phase, navigation, parking or restart output.

## Selector AC-6 — SKIPPED

Desktop webviews unit file and Electron browser-profile harness did not run. No registration, partition or opener-session output.

## Selector AC-7 — SKIPPED

Desktop profile unit file and Settings e2e did not run. No evidence of clearing open and closed sessions or preserving the unrelated sentinel.

## Name normalization AC-1 — SKIPPED

Catalog creation regression did not run. No output for either spelling order against named or automatic rows.

## Name normalization AC-2 — SKIPPED

Profiles unit file and cycle-2 collision replay did not run. No caption or original-session output.

## Name normalization AC-3 — SKIPPED

Catalog unit file and selector journey did not run. No creation or selection output for Café and Cafe.
