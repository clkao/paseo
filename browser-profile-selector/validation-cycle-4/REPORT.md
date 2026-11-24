# Browser profile selector validation, cycle 4

**PASSED on Linux.** All seven selector criteria and all three normalization criteria passed. Both unfiltered desktop controls passed, and each single-fix reversal failed at its expected assertion. An interrupted preliminary attempt downloaded React DevTools. All counted test runs completed with external networking disabled.

Linux x86_64 under Xvfb on `paseo-acl-prototype`. Candidate `1618e78ffee8806b55537a9dda2394dc89edc9ae`, parent `5a0bf1449286899f174ef7e1073f37c97cdc5443`, upstream `cba515ef7300bc00cc7c73cf69ee4d8c00907578`. The selector and normalization criteria and the previous validator's patch came from fork `dev-state` at `39d882b93436f2a804ecbd597e7347a388c45d52`. All observations below are from this cycle. macOS and Windows runtime coverage was outside the Linux assignment.

## Checklist 1 — DONE. Acceptance, package contracts and the full desktop regression

| Command | Observed output |
|---|---|
| `git -c credential.helper= fetch --no-tags https://github.com/clkao/paseo.git task/browser-profile-selector`, `git checkout --detach 1618e78ff`, `git rev-parse HEAD`, `git diff --quiet 5a0bf1449 1618e78ff -- package-lock.json` | Requested SHA, clean checkout and lockfile diff exit 0. [Preflight](preflight.log) |
| `node_modules/.bin/vitest --version`, `npm ls --depth=0 2>&1 \| tail -5` | Vitest 4.1.7, Node v26.13.1, npm 11.20.0. npm ls exited 1 with ELSPROBLEMS for React 19.3.1 in expo-two-way-audio and React/React DOM 19.2.6 in website. Used the supplied tree. [Exact five lines](logs/versions.log) |
| `../../node_modules/.bin/vitest run [--project browser] <file> --bail=1 --reporter=verbose` from the owning workspace | 351 passed in 34 serial, single-file invocations. Both changed packages are covered, including browser automation, IPC, popup, registry, preload, keyboard, renderer lifecycle, startup, project routing, menu and i18n contracts. [Every file, command and raw output](TESTS.md) |
| `npm run build:main --workspace=@getpaseo/desktop` | TypeScript build exited 0. [Build](logs/build.log) |
| `xvfb-run -a env PASEO_CAPTURE_HARNESS_GROUP=browser-profile PASEO_CAPTURE_HARNESS_OUT_DIR="$E/harness" npm run capture-harness --workspace=@getpaseo/desktop` | Both Electron phases completed. All six checks passed. [Command](logs/capture.log) · [Results](harness/results.json) |
| `npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` on an empty Metro cache | Exit 0. “Browser desktop browser E2E passed: WebContents 5 remained 5”. Initial 5,968-module bundle took 143.014 s. [Cache](cold/cache.log) · [Command](cold/command.log) · [Desktop](cold/desktop.log) · [Results](cold/result.json) |
| Same unfiltered command in a fresh warm fixture | Exit 0 with the same success message. Initial bundle took 4.538 s. Only the completed cold run's Metro transform cache and file map were reused as test state. [Cache](warm/cache.log) · [Command](warm/command.log) · [Desktop](warm/desktop.log) · [Results](warm/result.json) |
| `node "$E/tools/extra-checks.mjs"` | “Per-tab browser profile journey passed”, exit 0. Ran the cycle-3 validator's extra fixture steps against the cycle-4 app for the literal eight-second delay, legacy/Unicode fixtures, keyboard selection and unsupported URL. Both full runs above executed the committed test without a preload or source modification. [Command](supplemental/command.log) · [Fixture](tools/extra-journey.inc) · [Observations](supplemental/extra.json) |

`$E` is `~/acl-result/browser-profile-selector/validation-cycle-4`. All test tooling cleared inherited `PASEO_*`, used temporary OS, Paseo, XDG and Electron data locations, and set `PASEO_NODE_INSPECT=--inspect=127.0.0.1:0`. The fresh daemons, renderer, CDP endpoint, inspector and HTTP fixtures used loopback. The full runs each kept the same user data and ports across their internal restart. [Isolation wrapper](tools/isolated) · [Runtime paths and endpoints](logs/runtime-isolation.log)

**No-download exception in an interrupted attempt.** Electron downloaded React DevTools 8.0.0 into its empty user data during the first cold attempt, despite the cycle-3 wrapper's npm and Expo offline settings. I stopped that attempt (exit 143) and discarded its runtime and cache from the test inputs. Its temporary directory was retained separately until evidence review. All results counted here ran in fresh loopback-only network namespaces. For the full desktop launches I linked a temporary copy of an already-extracted Nov 19 extension into each fixture at Xvfb launch. The kernel reported “Network is unreachable” for an external route. No npm install ran. [Interrupted command](interrupted-cold/command.log) · [Interrupted Electron log](interrupted-cold/desktop.log) · [Pre-existing extension](logs/local-devtools.log) · [Fixture setup](tools/bin/xvfb-run) · [Network check](logs/network-isolation.log)

## Selector AC-1 — DONE. Independent accounts survived a full Electron restart

`npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` exited 0 cold and warm. In the cold run both blank tabs navigated to `http://127.0.0.1:45815/profile-account`. Electron PIDs 198958 and 201780 showed the following values before and after restart. The first restored request already carried each account's cookie. [Cold JSON](cold/profiles.json) · [Warm JSON](warm/profiles.json)

| Persisted tab ID | Read-only label | Displayed account | Cookie | Local storage | Screenshots |
|---|---|---|---|---|---|
| `d1e58c36-a438-488e-969f-0216a98377df` | Shared › Work | Alice | `account=Alice` | `Alice` | [Before](cold/before-alice.png) · [After](cold/after-alice.png) |
| `f9f91c82-ed3e-4309-8165-d5a36a11e350` | Desktop browser project 1 › Customer | Bob | `account=Bob` | `Bob` | [Before](cold/before-bob.png) · [After](cold/after-bob.png) |

## Selector AC-2 — DONE. Profile creation, group membership and keyboard selection

`npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` exited 0. A sibling workspace showed exactly Shared and Desktop browser project 1, with Customer present and workspace 2 checked. A foreign project showed exactly Shared and Desktop browser project 3, with Customer absent and workspace 3 checked. Work appeared in both Shared groups. Creating the automatic name displayed “A profile with this name already exists in this group.” Cancel retained the current selection and reopening showed one automatic row. `node "$E/tools/extra-checks.mjs"` selected Shared › default with Enter. [Groups and duplicate](cold/profiles.json) · [Pristine menu](cold/pristine-menu.png) · [Inline error](cold/duplicate-rejected.png) · [Keyboard result](supplemental/extra.json)

In `packages/desktop`, `vitest run src/features/browser-profile-catalog.test.ts --bail=1 --reporter=verbose` passed 5/5, including reopening the file, concurrent creates, stable distinct keys, accent and length collisions, and typed rejections for blank, reserved and duplicate names. All Vitest commands in these sections use the root executable. [Catalog tests](logs/desktop-src_features_browser-profile-catalog.test.ts.log)

## Selector AC-3 — DONE. Destination sessions, slow response and legacy restore

In `packages/app`, `vitest run src/desktop/browser/automation/handler.test.ts --bail=1 --reporter=verbose` passed 14/14 and `vitest run src/desktop/browser/store/state.test.ts --bail=1 --reporter=verbose` passed 18/18. They exercised agent creation with and without a URL, two workspaces, registration, rejection in an unknown workspace, and restoring saved non-default records with missing phase alongside valid siblings. [Handler tests](logs/app-src_desktop_browser_automation_handler.test.ts.log) · [Store tests](logs/app-src_desktop_browser_store_state.test.ts.log)

`npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` exited 0. The blank launcher and agent tab showed an editable workspace default, with zero example.com requests. The ordinary link from a named tab, cross-workspace plugin link and agent tab with a supplied URL all sent `account=Workspace` on the first request and displayed the destination workspace label. [Full journey](cold/profiles.json)

`node "$E/tools/extra-checks.mjs"` exited 0. The loopback server received the request at 77 ms, the tool returned at 203 ms and the server responded at 8,077 ms. The pending and loaded tab lists contained the same single new ID, `df27111c-0f13-4ca8-8dbc-c9bb2e976584`. The pre-feature record reopened as ID `289205e5-b559-428a-bfa8-a0fd9cbd4e9d` with the locked Shared › default label and `account=Alice`. [Replay output](supplemental/command.log) · [Recorded values](supplemental/extra.json)

## Selector AC-4 — DONE. Stable partition identity

In `packages/app`, `vitest run src/desktop/browser/profiles.test.ts --bail=1 --reporter=verbose` passed 3/3. The fixed vectors distinguished two workspace IDs and equal display names on different servers. Renaming the label preserved the partition. The same slug in Shared and a project resolved to distinct keys, and Shared › default equaled the historical literal `persist:paseo-browser`. [Resolver tests](logs/app-src_desktop_browser_profiles.test.ts.log)

## Selector AC-5 — DONE. Editable blank, first navigation and parked guest

In `packages/app`, `vitest run src/desktop/browser/store/state.test.ts --bail=1 --reporter=verbose` passed 18/18. `vitest run --project browser src/desktop/browser/resident-webviews.browser.test.ts --bail=1 --reporter=verbose` passed 18/18 on Chromium. They exercised persistence of pristine, in-flight and locked records, late profile writes, assigning the partition before navigation, preserving the lock through uncommitted or blocked loads, and reusing the resident guest on pane presentation. [Store](logs/app-src_desktop_browser_store_state.test.ts.log) · [Chromium](logs/app-src_desktop_browser_resident-webviews.browser.test.ts.log)

`node "$E/tools/extra-checks.mjs"` produced an editable Shared › default tab still at `about:blank` after an unsupported URL. `npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` exited 0 after the Customer first request carried Bob's cookie, the locked toolbar resisted click/Enter, and the parked agent tab navigated by ID under its workspace label. After relaunch the revisited blank tab `190f19f6-5ad4-4fe0-8f26-cc10c9c6af77` stayed locked on Customer. The never-navigated tab `c0772990-37c5-45fc-89f1-86cb0542e29a` stayed editable on Work. [Unsupported URL](supplemental/extra.json) · [Cold journey](cold/profiles.json)

## Selector AC-6 — DONE. Attachment rules and child popup session

In `packages/desktop`, `vitest run src/features/browser-webviews/index.test.ts --bail=1 --reporter=verbose` passed 10/10 for accepted forms, malformed and foreign names, invalid lengths, blocked URLs, sender and session mismatches. `PASEO_CAPTURE_HARNESS_GROUP=browser-profile npm run capture-harness --workspace=@getpaseo/desktop` under Xvfb passed 6/6. The named-profile child popup matched its opener's actual Electron session, cookie and local storage. [Attachment tests](logs/desktop-src_features_browser-webviews_index.test.ts.log) · [Harness log](logs/capture.log) · [Six results](harness/results.json)

## Selector AC-7 — DONE. Settings cleared open and closed profiles

In `packages/desktop`, `vitest run src/features/browser-profile.test.ts --bail=1 --reporter=verbose` passed 8/8 for directory discovery, shared, named, auto-workspace and legacy partitions, live guest reloads and exclusion of unrelated directories. [Profile tests](logs/desktop-src_features_browser-profile.test.ts.log)

`npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` exited 0. Settings cleared the two live named profiles and the workspace profile absent from the live guest list. All three returned an empty cookie and null local storage. Their locked labels and the named rows in a new blank tab's menu survived. The unrelated Electron session's sentinel still read `retained`. [Live partitions and clear result](cold/profiles.json) · [Signed-out Customer](cold/cleared-customer.png) · [Warm repeat](warm/profiles.json)

## Normalization AC-1 — DONE. Canonically equivalent names rejected in both directions

`vitest run src/features/browser-profile-catalog.test.ts --bail=1 --reporter=verbose` passed 5/5 in `packages/desktop`. `node "$E/tools/catalog-probe.cjs"` tested an empty catalog against just the automatic workspace name. Both U+00E9 → U+0065 U+0301 and the reverse returned `{"ok":false,"code":"duplicate"}` and left `saved: []`. [Named and automatic catalog tests](logs/desktop-src_features_browser-profile-catalog.test.ts.log) · [Automatic-only probe](logs/catalog-probe.log) · [Rendered rejection](supplemental/canonical-name-error.png)

## Normalization AC-2 — DONE. Old collision retained distinct labels and sessions

`vitest run src/desktop/browser/profiles.test.ts --bail=1 --reporter=verbose` passed 3/3 in `packages/app`. `node "$E/tools/extra-checks.mjs"` exited 0 after restoring the cycle-2 collision. The automatic tab displayed “Café 1 (Workspace)” with Alice's original ID, partition, cookie and storage. The named tab displayed the decomposed “Café 1” and retained Bob's original ID, partition, cookie and storage. [Before and after](supplemental/extra.json) · [Automatic tab](supplemental/old-automatic.png) · [Named tab](supplemental/old-named.png)

## Normalization AC-3 — DONE. Café and Cafe both selectable

`node "$E/tools/extra-checks.mjs"` created both display names in one project and selected each. The observed partition suffixes were `-cafe` and `-cafe-2`. The catalog test above also reopened distinct, stable entries. [Selections](supplemental/extra.json) · [Catalog tests](logs/desktop-src_features_browser-profile-catalog.test.ts.log)

## Checklist 2 — DONE. Follow-up patch comparison and three independent failures

`git diff --name-status 5a0bf1449 1618e78ff` returned the single modified file `packages/desktop/e2e/browser-tabs.e2e.mjs`. I applied the fetched cycle-3c follow-up patch to the parent blob in a scratch directory using `git apply --check` and `git apply`. The byte comparison against HEAD differed only in the comment giving the measured 141.8 s startup and 132.3 s Metro time. The 240,000 ms value and every executable line matched. [Comparison and diff](logs/patch-comparison.log)

Each `python3 "$E/tools/mutant.py" <name>` invocation temporarily changed this one test file, ran the full unfiltered `npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop`, and restored and compared the file with HEAD before the next invocation. Every restoration returned blob `1ad367c574ac3098d5ebd32d68b96b1278b80247`. [Mutation driver](tools/mutant.py) · [Exit codes and restoration hashes](logs/mutations.log)

| Change removed | Command argument and Metro cache | Observed full-run failure |
|---|---|---|
| Close the annotation regression's right pane | `mutant-split`, warm | Exit 1. “strict mode violation: getByRole('textbox', { name: 'Browser URL' }) resolved to 2 elements”. The profile journey found both the previous loaded pane and the new blank pane. [Diff](mutant-split/mutation.diff) · [Command](mutant-split/command.log) · [Screenshot](mutant-split/profile-failure.png) |
| Increase initial workspace readiness from 90 s to 240 s | `mutant-timeout`, empty | Exit 1. The first workspace row failed `toBeVisible` with “Timeout: 90000ms”. The empty-cache control with the 240 s assertion reached the workspace and finished the entire suite. [Diff](mutant-timeout/mutation.diff) · [Cache](mutant-timeout/cache.log) · [Command](mutant-timeout/command.log) |
| Dismiss the host chooser once after relaunch | `mutant-chooser`, warm | Exit 1. “locator.click: Timeout 90000ms exceeded” and “subtree intercepts pointer events”. The failure capture shows “Choose host” with the local and remote hosts over the restored workspace. [Diff](mutant-chooser/mutation.diff) · [Command](mutant-chooser/command.log) · [Window text](mutant-chooser/profile-failure.txt) · [Screenshot](mutant-chooser/profile-failure.png) |

## Checklist 3 — DONE. Repository checks

| Command at repository root | Observed output |
|---|---|
| `npm run lint` | Exit 0. “Found 0 warnings and 0 errors.” Checked 5,641 files. [Full output](logs/lint.log) |
| `npm run format:check` | Exit 0. “All matched files use the correct format.” Checked 6,150 files. [Full output](logs/format.log) |
| `env npm_config_script_shell="$E/tools/typecheck-shell" npm run typecheck` | Exit 0 across all workspaces that define typecheck, including app, desktop and the plugin example compiler. The stock plugin example script runs an npm install before its compiler. The cycle-3 script shell skipped that install and ran the original `tsgo -p tsconfig.examples.json --noEmit` using existing dependencies. [Full output](logs/typecheck.log) · [Exact shell](tools/typecheck-shell) |

`git status --porcelain=v1 --untracked-files=all` returned no entries after validation. The E2E file's working and committed blob hashes matched. The disk monitor sampled every second and recorded a minimum of 2,565,857,280 bytes (2.390 GiB), above the 1.5 GiB stop threshold. [Final Git checks](logs/final-worktree.log) · [Disk samples](logs/disk.log)
