---
id: 74gqm38tar8mhyynj7vsw23j
title: "Browser sessions scoped by project or workspace"
status: implementation
source: CL, 2026-11-19 (user request quoting PR #2089)
started: 2026-11-19T21:33:15Z
completed:
verdict:
score:
worktree: vm:paseo-acl-prototype:~/worktrees/browser-session-scope (agent a14826a1)
issue:
pr:
mod-block:
mandate:
gates:
    version: 1
    records:
        - id: gate:74gqm38tar8mhyynj7vsw23j:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:74gqm38tar8mhyynj7vsw23j-ideation-1
              briefing:
                id: briefing:74gqm38tar8mhyynj7vsw23j:ideation:attempt-1:revision-1
                digest: sha256:f9c1f5e683fe123c17c07f1bd35f19ae8a6d7633dd639902e235d3d922a740ec
                room-ref: '@review/ideation/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:74gqm38tar8mhyynj7vsw23j:ideation:1
                briefing: briefing:74gqm38tar8mhyynj7vsw23j:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-11-19T21:56:40.875299Z"
                decision: revise
                reason: 'CL accepts the direction and asks for the simpler version: (1) one global setting in Settings for browser sessions, Shared (default) / Per project / Per workspace, applying to new tabs only; clear-all only, extended to every scoped session on disk; keep the popup opener session, the agent new_tab resolution, the anchored attach gate and the hashed partition names; about 400 lines. (2) Drop the separate prototype: the per-tab persistent partitions that existed before #2089 already showed isolation and persistence; keep the capture-harness check for criterion 1 and the popup session in the test plan. (3) Restate the acceptance criteria in the template''s **AC-N** form.'
            - id: gate-attempt:74gqm38tar8mhyynj7vsw23j-ideation-2
              briefing:
                id: briefing:74gqm38tar8mhyynj7vsw23j:ideation:attempt-2:revision-1
                digest: sha256:e0ffa23cd09b16e3929a97ce677ae295ebe4f3218739881104b37db4e401086c
                room-ref: '@review/ideation/briefing-2'
              resolution:
                type: Resolution
                id: resolution:spacedock:74gqm38tar8mhyynj7vsw23j:ideation:2
                briefing: briefing:74gqm38tar8mhyynj7vsw23j:ideation:attempt-2:revision-1
                by: agent:first-officer
                at: "2026-11-19T21:58:50.981957Z"
                decision: approve
                reason: 'Cycle 2 meets all three revise asks: one global setting (new tabs only, clear-all), no separate prototype with the harness checks kept, AC-1..AC-11 in template form (ac-scan finds 11). Spot-checked named files and functions against upstream/main. Open item for implementation: confirm worktree workspaces carry projectId.'
                conn:
                    quote: can you get the design revised and approved, then find a way to dispatch implementation and validation on the vm?
                    source: CL in the Claude Code session, 2026-11-19
              application:
                target-stage: implementation
                state: consumed
---

> I noticed in PR #2089 all browser tabs now share the same session store. I'd like to see it possible to scope by project or workspace, so that you can operate the same site with different credentials.

## Problem

The desktop app's browser panes all use one Electron session, `persist:paseo-browser` (`packages/desktop/src/features/browser-profile.ts:1`). PR #2089 (`328361667`, "Keep browser sign-ins across tabs and restarts") made that change: before it, each tab had its own profile, and sign-ins did not survive a new tab or a restart.

Since #2089, cookies, local storage and other site data are shared by every browser tab in every project and workspace. A user cannot be signed in to the same site with two accounts at once, for example a staging admin account in one project and a customer test account in another. An agent's browser tools use that same session, so an agent in one project acts with the sign-ins of every other project.

The fix keeps #2089's value: sign-ins persist across tabs and restarts within a scope. Users who want one shared session keep it.

## Where the shared session is fixed today

- `packages/desktop/src/features/browser-profile.ts`: `PASEO_BROWSER_PROFILE_PARTITION`, the clear-data path, and the per-tab profile cleanup left from before #2089 (`COMPAT(browserProfile)`, remove after 2027-01-15).
- `packages/desktop/src/features/browser-webviews/index.ts:42`: `isPaseoBrowserWebviewAttach` admits a webview only when its partition equals that one partition. This is a security gate, so scoped partitions need an exact allow-rule, not a loose prefix match.
- `packages/desktop/src/main.ts:235`: popup windows use the same partition.
- `packages/desktop/src/preload.ts:120` passes the partition to the app. `packages/app/src/desktop/browser/resident-webviews.ts:307` sets it on each webview.
- The Settings screen action "clear browser data" (`browser-data-section.tsx`) clears the one shared profile.

## Scope questions for ideation

1. **Unit:** a session per project, per workspace, or a named profile that the user assigns to projects and workspaces. Named profiles cover both cases, plus "shared".
2. **Default:** what existing users get after the upgrade. Keeping their current sign-ins means the shared profile stays the default, or becomes every project's initial profile.
3. **Worktrees:** whether a worktree workspace uses its project's session or its own.
4. **Clearing data:** for each scope, and for all scopes at once.
5. **Agents:** an agent's browser tools use the session of the agent's workspace.
6. **Plugins:** whether a plugin may write cookies into a scoped session, for example to sign a workspace's browser in with credentials that the plugin holds. No plugin API reaches the browser session today. The plugin client API has only `navigation.openBrowser({ url, workspaceId })` (`packages/plugin/src/client/contracts.ts:40`). The desktop shell's only cookie code clears data. Plugin server code runs on the daemon host, which may be another machine, while the browser session lives in the desktop's Electron main process. So cookies would travel from the plugin server, through the plugin's client entry, to a new desktop API that Electron-only gating and user consent protect. Decide whether this is part of this task or a later task that builds on its scopes.

## Mechanism

Electron partitions isolate cookies and storage, and a `persist:` partition keeps them across restarts. Paseo relied on this before #2089: each tab had its own partition `persist:paseo-browser-<id>`, which `COMPAT(browserProfile)` still cleans up. The design reuses that mechanism with one partition per scope in place of one per tab.

## Scope decisions

One global setting decides how browser sessions are scoped. Questions 1 to 3 follow from it.

1. **Unit.** Settings has one choice for browser sessions: `Shared`, `Per project` or `Per workspace`. It applies to every project. There are no named profiles and no setting per project.
2. **Default.** `Shared`. The upgrade changes nothing and keeps every current sign-in until the user picks another value.
3. **Worktrees.** In `Per project`, a worktree workspace uses its project's session. In `Per workspace`, it has its own. `Per workspace` is the value for testing one app with two accounts in two worktrees: cookies do not separate by port, so `localhost:3000` and `localhost:3001` collide in one session.
4. **Clearing data.** Settings > General > Clear browser data clears every session: the shared one, every scoped one on disk, and the per-tab profiles left from before #2089. There is no clear action for one session.
5. **Agents.** An agent's browser tools use the session of the agent's workspace. `browser_new_tab` resolves the session from the request's workspace with the same resolver the pane uses. When the workspace or its project is unknown the tool fails; it does not fall back to the shared session.
6. **Plugins writing cookies.** A later task. It needs a new plugin client API, a consent prompt, and a desktop IPC that lets a daemon on another machine write credentials into the local browser. That is a separate security review, and it changes nothing here: the later API targets "the session of workspace X", which this task defines.

## Proposed approach

Electron only. The daemon, CLI, iOS, Android and browser web are not touched. `packages/protocol` does not change: the browser automation request already carries `workspaceId`, and the session is resolved inside the desktop app.

**The setting.** `desktop-settings.json`, owned by the main process (`packages/desktop/src/settings/desktop-settings.ts`), gains `browser.sessionScope` with the values `"shared"`, `"project"` and `"workspace"`. A missing or invalid value reads as `"shared"`. The Browser data section of Settings > General gains a row to choose it, above Clear browser data.

**A change applies to new tabs.** A tab's session is fixed when its webview is created. An open tab keeps its session until it closes or the app restarts; after a restart every tab uses the current setting. The row's hint says so. No site data is deleted by a change: each session stays on disk and is used again when the setting returns to the value that selects it.

**Partitions.** `Shared` uses `persist:paseo-browser`, as today. A scoped session uses `persist:paseo-browser-scope-<id>`, where `<id>` is the first 32 hex characters of the SHA-256 of `JSON.stringify(["v1", "project", serverId, projectId])` or `JSON.stringify(["v1", "workspace", serverId, workspaceId])`. Ids come from the daemon and a server id can be set by `PASEO_SERVER_ID`, so the derivation hashes a JSON tuple: no id can be crafted to land in another scope's partition, and the name is always a fixed-length directory name. Nothing is stored per scope.

**Resolver in the app.** A new module `packages/app/src/desktop/browser/session-scope.ts` turns `(setting, serverId, projectId, workspaceId)` into a partition. It hashes with WebCrypto (`crypto.subtle.digest`), which is asynchronous, so no dependency is added. `BrowserPanel` reads the workspace's `projectId` from the session store and passes it to `BrowserPane`. The pane creates its webview only after the partition is resolved.

**Resident webviews.** `prepareBrowserWebview` and `ensureResidentBrowserWebview` take the partition as an input in place of the one bridge constant. An existing webview is reused as it is, whatever the current setting.

**Attach security gate.** `isPaseoBrowserWebviewAttach` admits a webview when its URL is allowed and its partition is exactly `persist:paseo-browser` or matches `^persist:paseo-browser-scope-[0-9a-f]{32}$`. The rule is anchored at both ends, so the app's own session, the old per-tab partitions and any other name are refused. `registerAttachedPaseoBrowser` takes the partition the renderer used, checks it with the same rule, and accepts the guest only when `guest.session === session.fromPartition(partition)`.

**Popups.** A popup window uses its opener's session: `getBrowserPopupWindowOptions` receives the source guest and sets `webPreferences.session` to `sourceContents.session` in place of the fixed partition. OAuth and payment popups then see the sign-in of the tab that opened them.

**Clear browser data.** `paseo:browser:clear-profile` keeps its meaning of "clear everything". Main lists the directories in `<userData>/Partitions` whose names match `paseo-browser-scope-[0-9a-f]{32}`, clears each with the shared session and the legacy profiles, and reloads the guests of all of them. Reading the directory finds the sessions of projects and workspaces that no longer exist. The Settings text says the action clears all sessions.

**Agent browser tools.** `openBrowserTabForRequest` in `automation/handler.ts` resolves the partition from `serverId`, `workspaceId` and the workspace's project before it creates the resident webview. The other commands address a browser id whose webview already exists.

**Migration.** None. `persist:paseo-browser` keeps its name and its data. The `COMPAT(browserProfile)` cleanup of per-tab profiles stays as it is until 2027-01-15.

**Docs.** Rewrite the "In-app browser profile" and "In-app browser window opens" notes in `docs/architecture.md`, and the browser profile group paragraph in `docs/browser-capture-harness.md`.

**Limits.**
- A scoped session starts signed out. Sign-ins are not copied from the shared session.
- The session of a removed project or archived workspace stays on disk until Clear browser data runs.

## Expected surface

About 430 net lines, tolerance ±25%: about 230 product, 110 tests, 75 capture harness, 12 docs. No new dependency.

| File | Change | Net lines |
| --- | --- | --- |
| `packages/desktop/src/features/browser-profile.ts` | partition rule, list scoped sessions on disk, guests of a set of sessions | +35 |
| `packages/desktop/src/features/browser-webviews/index.ts` | gate and registration check | +10 |
| `packages/desktop/src/main.ts` | popup session, registration input, clear-all | +22 |
| `packages/desktop/src/preload.ts` | registration input type | +2 |
| `packages/desktop/src/settings/desktop-settings.ts` | `browser.sessionScope` | +12 |
| `packages/app/src/desktop/browser/session-scope.ts` (new) | hash, partition resolver, hook | +50 |
| `packages/app/src/desktop/browser/resident-webviews.ts` | partition input | +10 |
| `packages/app/src/desktop/browser/pane/index.electron.tsx`, `panel.tsx` | pass `projectId`, wait for the partition | +22 |
| `packages/app/src/desktop/browser/automation/handler.ts` | resolve before `new_tab` | +18 |
| `packages/app/src/desktop/browser/settings/browser-data-section.tsx`, i18n strings | session scope row, all-sessions wording | +40 |
| `packages/app/src/desktop/host.ts`, `packages/app/src/desktop/settings/desktop-settings.ts` | bridge type, settings field | +10 |
| Tests (files in the test plan) | | +110 |
| `packages/desktop/capture-harness/main.js`, `index.html` | two-partition, restart and popup checks | +75 |
| `docs/architecture.md`, `docs/browser-capture-harness.md` | rewrite the owning paragraphs | +12 |

## Acceptance criteria

**AC-1 — Two sign-ins to one site in two scoped sessions stay apart, and each survives an app restart.**
Verified by: capture harness group `browser-profile`, checks `scoped-isolation` and `scoped-restart-persistence`. Two guests on one origin, one in each of two scoped partitions, each set a different cookie and local storage value. The checks fail if either guest reads the other's value, or loses its own after the Electron process exits and a second one starts.

**AC-2 — With the setting at `Shared`, or never set, every tab uses `persist:paseo-browser` and its existing data.**
Verified by: `session-scope.test.ts`, the resolver returns `persist:paseo-browser` for `"shared"`; `desktop-settings.test.ts`, a settings file with no `browser` entry reads as `"shared"`; and the existing harness checks `shared-profile-data` and `process-restart-persistence`, unchanged.

**AC-3 — `Per project` gives one partition per project per server, and `Per workspace` gives one per workspace.**
Verified by: `session-scope.test.ts`. Two workspaces of one project share a partition in `"project"` and differ in `"workspace"`; another project and another server differ; ids built to collide by concatenation (`["a","bc"]` and `["ab","c"]`) differ.

**AC-4 — The attach gate admits only the shared partition and exact scoped partitions.**
Verified by: `browser-webviews/index.test.ts`. It rejects `persist:paseo-browser-tab-a`, `persist:paseo-browser-scope-` with 31 or 33 hex characters, uppercase hex, a valid name with a suffix, `persist:foreign`, and a missing partition. It fails if the rule becomes a prefix match.

**AC-5 — Registration rejects a guest whose session is not the session of the partition it claims.**
Verified by: `browser-webviews/index.test.ts`, registration with a mismatched session returns false.

**AC-6 — A popup opened from a scoped tab uses that tab's session.**
Verified by: harness check `scoped-popup-session`. It fails if the popup's session is not the opener's or the popup cannot read the opener's cookie.

**AC-7 — An agent's `browser_new_tab` creates its tab in the session of the agent's workspace, and fails for an unknown workspace.**
Verified by: `automation/handler.test.ts`. It asserts the partition passed to `ensureResidentBrowserWebview` for each setting value, and a failure response with no webview created when the workspace is not in the session store.

**AC-8 — Clear browser data clears the shared session, every scoped session on disk, and the legacy profiles.**
Verified by: `browser-profile.test.ts`, the session list built from a directory listing includes each name that matches the rule and skips the others, and guests of a scoped session are reloaded; and harness check `scoped-isolation`, which also asserts that each scoped partition has a directory `<userData>/Partitions/paseo-browser-scope-<id>`.

**AC-9 — A change of the setting applies to new tabs, and an open tab keeps its session.**
Verified by: `resident-webviews.browser.test.ts`. `ensureResidentBrowserWebview` called for an existing browser id with a different partition returns the same element with its original `partition` attribute; a new browser id gets the new partition.

**AC-10 — The setting survives a restart.**
Verified by: `desktop-settings.test.ts`, a patched `browser.sessionScope` is read back from disk, and an invalid value reads as `"shared"` without losing the other settings.

**AC-11 — Settings shows the three choices and the current one.**
Verified by: the UI evidence that `docs/qa.md` requires, taken in the desktop app: the row in each state, and one site signed in with two accounts in two projects under `Per project`.

## Test plan

Run one file at a time, never a workspace suite. From `packages/desktop`:

- `npx vitest run src/features/browser-webviews/index.test.ts --bail=1`
- `npx vitest run src/features/browser-profile.test.ts --bail=1`
- `npx vitest run src/settings/desktop-settings.test.ts --bail=1`

From `packages/app`:

- `npx vitest run src/desktop/browser/session-scope.test.ts --bail=1` (new file)
- `npx vitest run src/desktop/browser/automation/handler.test.ts --bail=1`
- `npx vitest run --project browser src/desktop/browser/resident-webviews.browser.test.ts --bail=1`

Real Electron, from the repository root (`docs/browser-capture-harness.md`):

- `PASEO_CAPTURE_HARNESS_GROUP=browser-profile npm run capture-harness --workspace=@getpaseo/desktop`

The group already runs two Electron processes in sequence, write then read. It gains two guests in two scoped partitions on the fixture origin, and a popup opened from one of them. AC-1 and AC-6 pass when `results.json` holds `scoped-isolation`, `scoped-restart-persistence` and `scoped-popup-session` with `pass: true`. If `scoped-popup-session` fails with the session override, the popup options drop the override and the check confirms that the popup inherits its opener's session.

Then `npm run typecheck`, `npm run lint` and `npm run format`. `npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` runs in CI to show the existing browser journey still passes.

The harness run and the builds need `npm install`. This checkout has no `node_modules` and the Mac has about 1.6 GiB free, so run them in CI or after disk is freed.

### Feedback Cycles

- Cycle 1: revise — ideation gate, CL; one global session setting, new tabs only, clear-all only, no separate prototype, criteria in **AC-N** form; surface about 950 → about 430 lines (±25%); AC narrowed: per-session clear, tab recreation and the toolbar menu dropped. The round recorder (`gate record --round`) was not run: this gate has no review-room briefing or log to record.

## Out of scope

- Browser automation features beyond choosing the session.
- Syncing browser profiles between machines.

## Stage Report: ideation

- DONE: Read the current code from upstream/main, not the checkout: local main is 485 commits behind. Use `git show upstream/main:<path>` and `git grep <pattern> upstream/main`. Do not fetch and do not move main.
  All reads used `git show`/`git grep` at upstream/main `ac633eb09`; no fetch, no checkout change.
- DONE: Answer scope questions 1-6 in the task with a recommendation for each. Say which ones need CL's choice.
  "Scope decisions": questions 1 (unit) and 2 (default) need CL's choice; 3-6 follow from them.
- DONE: Write the Proposed approach: partitions, the attach security gate, popups, preload/resident webviews, clear-data per scope, agent browser tools, the migration from the shared persist:paseo-browser profile, and protocol and platform effects (Electron only).
  "Proposed approach": hashed partition per scope, anchored gate rule, opener-session popups, no migration, no protocol change.
- DONE: Write the expected surface: files, estimated net LOC and a tolerance.
  "Expected surface": 14 rows, about 950 net lines, tolerance ±30%, no new dependency.
- DONE: Write the acceptance criteria. Each has a Verified by: clause that can fail, and at least one measures user value (two sign-ins to one site, kept apart, surviving a restart).
  11 criteria; criterion 1 is the user-value one, proved in real Electron across a restart.
- DONE: Write the test plan, naming the specific test files (run one at a time) and the capture-harness check from docs/browser-capture-harness.md.
  7 vitest files with their commands, plus the `browser-profile` harness group and its three new checks.
- DONE: Define the bounded prototype that proves the risk (the capture-harness check of two partitions), with aim, stop line and budget, but do not run it: it needs a desktop build and npm install, which need CL's approval at the gate. Free disk on this Mac is about 1.7 GiB.
  "Prototype": four checks, stop line per check, 2 hours. Not run. The checkout has no `node_modules` and 1.6 GiB free, so a full install will not fit; a 400 MB Electron-only run is offered.
- DONE: Decide cookie injection by plugins (scope question 6): in this task or a later task. Give the reason.
  Later task: it needs a plugin API, a consent prompt and a security review of its own, and builds on this task's scopes without changing them.

### Summary

The design gives each project a session mode (Shared, This project, Each workspace) stored in the main-owned desktop settings, and derives each scoped Electron partition by hashing the scope ids, so there is no profile table and nothing to migrate. Nothing was verified by running code: the isolation, restart, popup and directory-layout claims rest on Electron's documented behavior until the prototype runs. Two things I did not check in the code: whether every worktree workspace carries its project's `projectId`, and how the i18n string files are laid out, so the i18n line count is a guess.

## Stage Report: ideation (cycle 2)

- DONE: Rework the design to the simpler version.
  One global `browser.sessionScope` setting, new tabs only, clear-all only; scope decisions, approach and surface rewritten; about 430 net lines, ±25% (the target was about 400).
- DONE: Drop the separate prototype section.
  Removed; "Mechanism" cites the pre-#2089 per-tab partitions. The test plan keeps harness checks `scoped-isolation`, `scoped-restart-persistence` and `scoped-popup-session`.
- DONE: Restate every acceptance criterion in the template form.
  AC-1 to AC-11, each one line plus a Verified by: line. Criteria for per-session clear, tab recreation and the toolbar menu are gone; AC-9 now states that open tabs keep their session.

### Summary

The design is now one setting in Settings, a resolver that hashes the scope into a partition name, the anchored gate, opener-session popups and a clear-all that reads the scoped partitions from disk. Two claims are not yet proved in this app and are decided by harness checks during implementation: that `webPreferences.session` on a popup is honoured, and that scoped partitions sit under `<userData>/Partitions`. Still unchecked in the code: whether every worktree workspace carries its project's `projectId`, and the i18n file layout.

Implementation stage report from Paseo agent a14826a1.


---

Done: Browser sessions scoped by project or workspace completed implementation.

## Stage Report: implementation

- DONE: AC-1 through AC-10 passed. All 61 tests in the six planned Vitest files passed, run one file at a time with `--bail=1`. The two-process Electron harness recorded `pass: true` for all six checks, including `scoped-isolation`, `scoped-restart-persistence`, and `scoped-popup-session`. `npm run typecheck`, `npm run lint`, and `npm run format` passed. [Vitest commands and results](/home/exedev/acl-result/browser-session-scope/vitest.txt) · [Harness results](/home/exedev/acl-result/browser-session-scope/harness/results.json) · [Typecheck](/home/exedev/acl-result/browser-session-scope/typecheck.log) · [Lint](/home/exedev/acl-result/browser-session-scope/lint.log) · [Format](/home/exedev/acl-result/browser-session-scope/format.log)

- DONE: Directory and worktree provisioning both write the owning project’s `projectId`. The protocol requires it on every workspace descriptor, and the app copies it into the session store. The implementation reached `clkao/paseo` on November 19 at 22:13 UTC. The final push check at 22:16 UTC confirmed that the fork matched local HEAD. [Workspace identity evidence](/home/exedev/acl-result/browser-session-scope/workspace-project-id.txt) · [Final push](/home/exedev/acl-result/browser-session-scope/final-push.log)

- DONE: AC-11 screenshots were captured in the built Linux desktop app under Xvfb. Settings > General shows each selected state and all three choices. Under Per project, Staging and Customer retained different signed-in accounts at the same fixture URL after reload. Clear browser data then returned both open tabs to sign-in. UI verification used an isolated daemon on port 19767. [Shared](/home/exedev/acl-result/browser-session-scope/settings-shared.png) · [Per project](/home/exedev/acl-result/browser-session-scope/settings-project.png) · [Per workspace](/home/exedev/acl-result/browser-session-scope/settings-workspace.png) · [Choices](/home/exedev/acl-result/browser-session-scope/settings-choices.png) · [Staging admin](/home/exedev/acl-result/browser-session-scope/account-staging-admin.png) · [Customer test](/home/exedev/acl-result/browser-session-scope/account-customer-test.png) · [Clear-data results](/home/exedev/acl-result/browser-session-scope/clear-all.json)

### Summary

`task/browser-session-scope` is clean at `66805baff99fadd1942d36f70f02befdb3167eb3`, based on `upstream/main` at `95542dbfe6047ad45f9b5a10df5619278e53ac17`. The change spans 38 files, with 560 additions and 109 deletions: **451 net lines**, 4.9% above the 430-line estimate. [Per-file diffstat](/home/exedev/acl-result/browser-session-scope/branch.txt)

Electron 44 required waiting for the first `dom-ready` after each `did-attach` before reading the guest ID. Both the app and harness now use that sequence. The existing Settings > Browser page and the requested Settings > General row use the same control.
