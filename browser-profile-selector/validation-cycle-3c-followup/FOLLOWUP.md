# Browser profile selector, cycle 3c follow-up

**PASSED with the test-only patch.** Both complete runs restored Alice and Bob under their original tab IDs and profiles, cleared live and dormant profile data and retained the unrelated session sentinel. All three issues were in test setup.

Candidate `5a0bf1449286899f174ef7e1073f37c97cdc5443`, Linux/Xvfb on paseo-acl-prototype, 2026-11-22. All runs used the unfiltered command `npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop`.

| Patch round | Metro cache | Launch to workspace ready | Outcome |
|---|---|---:|---|
| 1, split cleanup | Empty | Timed out after 95.460 s from launch | Exit 1. The sidebar wait itself consumed 90.006 s. [Log](r1-cold/command.log) |
| 2, added startup timeout | Empty | 141.758 s | Exit 1 after Electron relaunched. The “Choose host” dialog intercepted the workspace click. [Log](r2-cold/command.log) · [Screenshot](r2-cold/window-restore.png) |
| 3, added relaunch dialog handling | Empty | 141.789 s | Exit 0. The cold Metro bundle took 132.287 s for 5,968 modules. [Log](r3-cold/command.log) · [Bundle timing](r3-cold/metro-bundles.log) · [Results](r3-cold/result.json) |
| 3, same final patch | Warm | 14.337 s | Exit 0. The warm bundle took 5.115 s for 5,968 modules. [Log](r3-warm/command.log) · [Bundle timing](r3-warm/metro-bundles.log) · [Results](r3-warm/result.json) |

## Issues and test changes

1. **Two browser URL fields.** The preceding regression deliberately split the original workspace to test annotation. Its launcher pane remained open, so the profile journey opened a browser alongside the existing one. I closed the right pane's sole launcher tab through the visible tab rail and asserted that one rail remained. The regression already selects tabs and verifies the split through these rails. Cleaning up at the point of creation preserves strict, user-facing selectors throughout the profile journey. [Original failure](https://github.com/clkao/paseo/blob/631ed213c2daf1f5fa57feef95d986bac98871b3/browser-profile-selector/validation-cycle-3c/e2e-retry/profile-failure.png) · [Observed transition from one to two rails and back](r2-cold/pane-observation.log)
2. **Cold renderer startup.** Building the initial Metro bundle exceeded the 90-second sidebar assertion. The patch gives only that startup assertion a named 240-second budget. Readiness is still measured by the visible workspace row. [Cold timeout](r1-cold/command.log) · [First successful cold startup](r2-cold/metro-bundles.log)
3. **Host chooser after relaunch.** The dev launcher passed its desktop package directory as an open-project request. The plugin regression had registered a second host, so the restored app asked which host should open that directory. Both the intended row and the restored tabs were present behind the chooser. The overlay blocked the click for 90 seconds. The patch registers a one-use Playwright handler on the relaunched page that presses Escape if the chooser appears. [Pending path](r2-cold/desktop.log) · [Window contents](r2-cold/restore-ui.log) · [Click failure](r2-cold/command.log)

## Reproduction and hand-off

Each run used the cycle-3c isolation wrapper, temporary OS and daemon homes, separate Electron user data, dynamically allocated ports and the existing installed binaries. The warm run reused only the final cold run's Metro transform cache and file map. A test-runner preload recorded monotonic times around launch and sidebar readiness. No installation or download was performed. One preliminary read-only remote-ref lookup used the parent shell environment. I repeated that lookup with the inherited Paseo variables cleared. [Isolation wrapper](tools/isolated) · [Run command](tools/run.sh) · [Timing observer](tools/timing.cjs) · [Disk monitor](disk.log) · [Remote refs](pre-push-refs.log)

The patch affects one desktop E2E test file. Formatting and lint passed. [Test-only patch](test-fix.patch) · [Formatting](format-check.log) · [Lint](lint.log) · [Restoration and patch applicability](worktree.log)
