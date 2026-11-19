---
id: 74gqm38tar8mhyynj7vsw23j
title: "Browser sessions scoped by project or workspace"
status: ideation
source: CL, 2026-11-19 (user request quoting PR #2089)
started: 2026-11-19T21:33:15Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate:
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

## Proof that decides whether design starts

- Electron partitions isolate cookies and storage per partition. This is documented Electron behavior. A spike in the capture harness (`docs/browser-capture-harness.md`) confirms that two partitions keep two sign-ins to one site apart, and that each survives a restart.
- Resident webviews (`resident-webviews.ts`) can carry a different partition per workspace without breaking tab reuse.

## Scope decisions

Two of the six questions need CL's choice at the gate: the unit (1) and the default (2). The other four follow from them.

1. **Unit. Needs CL's choice. Recommendation: a session mode per project, with three values.**
   - `Shared`: the project's tabs use the one shared session, as today.
   - `This project`: all workspaces of the project use one session that no other project uses.
   - `Each workspace`: every workspace of the project has its own session.

   This covers "scope by project or workspace" with no profile management. A session is identified by a value derived from the scope, so no list of profiles is created, renamed or deleted. Named profiles that the user assigns to projects cover one more case (two projects that share a session other than the shared one) and cost a create, rename, delete and assign UI, about 350 more lines. They can be added later as a fourth kind of scope without changing the sessions this task creates.
2. **Default. Needs CL's choice. Recommendation: `Shared` stays the default for existing and new projects.** Nothing moves, so every current sign-in is kept and the upgrade changes nothing until the user picks another mode. The other choice is `This project` for new projects, which keeps an agent away from the sign-ins of other projects by default, but makes each new project start signed out.
3. **Worktrees. Recommendation: a worktree workspace follows its project's mode.** In `This project` it uses the project's session. In `Each workspace` it has its own. The second mode is the one for testing one app with two accounts in two worktrees: cookies do not separate by port, so `localhost:3000` and `localhost:3001` collide in one session.
4. **Clearing data.** The browser pane's session menu clears the session that the tab uses. Settings > General > Clear browser data clears every session: the shared one, every scoped one on disk, and the per-tab profiles left from before #2089.
5. **Agents.** An agent's browser tools use the session of the agent's workspace. `browser_new_tab` resolves the session from the request's workspace with the same resolver the pane uses. When the workspace or its project is unknown the tool fails; it does not fall back to the shared session.
6. **Plugins writing cookies. Decision: a later task.** It needs a new plugin client API, a consent prompt, and a desktop IPC that lets a daemon on another machine write credentials into the local browser. That is a separate security review, and it changes nothing in this task: the later API targets "the session of workspace X", which this task defines.

## Proposed approach

Electron only. The daemon, CLI, iOS, Android and browser web are not touched. `packages/protocol` does not change: the browser automation request already carries `workspaceId`, and the session is resolved inside the desktop app.

**Partitions.** The shared session keeps the partition `persist:paseo-browser`. A scoped session uses `persist:paseo-browser-scope-<id>`, where `<id>` is the first 32 hex characters of the SHA-256 of `JSON.stringify(["v1", "project", serverId, projectId])` or `JSON.stringify(["v1", "workspace", serverId, workspaceId])`. Ids come from the daemon and a server id can be set by `PASEO_SERVER_ID`, so the derivation hashes a JSON tuple: no id can be crafted to land in another scope's partition, and the name is always a fixed-length directory name. The derivation needs no stored table, so two windows cannot disagree about a scope's partition.

**Where the mode lives.** `desktop-settings.json`, owned by the main process (`packages/desktop/src/settings/desktop-settings.ts`), gains `browser.sessionModeByProject`, a record from `JSON.stringify([serverId, projectId])` to `"project"` or `"workspace"`. A missing entry means `Shared`. All windows read the same file. Main sends an event to every window after a patch so each window refetches; no such event exists today.

**Resolver in the app.** A new module `packages/app/src/desktop/browser/session-scope.ts` turns `(mode, serverId, projectId, workspaceId)` into a partition. It hashes with WebCrypto (`crypto.subtle.digest`), which is asynchronous, so no dependency is added. `BrowserPanel` reads the workspace's `projectId` from the session store and passes it to `BrowserPane`. The pane creates its webview only after the partition is resolved.

**Resident webviews.** `prepareBrowserWebview` and `ensureResidentBrowserWebview` take the partition as an input in place of the one bridge constant. A webview's partition cannot change after its first navigation. When a project's mode changes, the app removes each resident webview of that project whose partition differs from the resolved one and the pane creates a new one at the tab's current URL. The tab keeps its id and URL and loses its back and forward history. No site data is deleted: the old session stays on disk and returns when the mode is switched back.

**Attach security gate.** `isPaseoBrowserWebviewAttach` admits a webview when its URL is allowed and its partition is exactly `persist:paseo-browser` or matches `^persist:paseo-browser-scope-[0-9a-f]{32}$`. The rule is anchored at both ends, so the app's own session, the old per-tab partitions and any other name are refused. `registerAttachedPaseoBrowser` takes the partition the renderer used, checks it with the same rule, and accepts the guest only when `guest.session === session.fromPartition(partition)`.

**Popups.** A popup window uses its opener's session: `getBrowserPopupWindowOptions` receives the source guest and sets `webPreferences.session` to `sourceContents.session` in place of the fixed partition. OAuth and payment popups then see the sign-in of the tab that opened them.

**Preload.** The sandboxed preload keeps the `profilePartition` literal and adds a second literal for the scoped prefix. `preload-sandbox.test.ts` guards both against drift from `browser-profile.ts`.

**Clear data per scope.** A new IPC `paseo:browser:clear-session` takes a partition, checks it with the gate's rule, clears that session and reloads its guests, webviews and popups. `paseo:browser:clear-profile` keeps its meaning of "clear everything": main lists the directories in `<userData>/Partitions` whose names match `paseo-browser-scope-[0-9a-f]{32}`, and clears each with the shared session and the legacy profiles. Reading the directory finds the sessions of projects and workspaces that no longer exist. The prototype confirms the directory layout.

**UI.** The browser pane toolbar gains a session menu next to the device-size menu. It shows the project's mode, lets the user change it, and has "Clear this session's data". The Settings text for Clear browser data says it clears all sessions.

**Agent browser tools.** `openBrowserTabForRequest` in `automation/handler.ts` resolves the partition from `serverId`, `workspaceId` and the workspace's project before it creates the resident webview. The other commands address a browser id whose webview already sits in the right session.

**Migration.** None. `persist:paseo-browser` keeps its name and its data, and is what every project uses until its mode changes. The `COMPAT(browserProfile)` cleanup of per-tab profiles stays as it is until 2027-01-15.

**Docs.** Rewrite the "In-app browser profile" and "In-app browser window opens" notes in `docs/architecture.md`, and the browser profile group paragraph in `docs/browser-capture-harness.md`.

**Limits.**
- A scoped session starts signed out. Sign-ins are not copied from the shared session.
- The session of a removed project or archived workspace stays on disk until Clear browser data runs.

## Expected surface

About 950 net lines, tolerance ±30%: about 480 product, 320 tests, 135 capture harness, 15 docs. No new dependency.

| File | Change | Net lines |
| --- | --- | --- |
| `packages/desktop/src/features/browser-profile.ts` | partition rule, scoped sessions, list sessions on disk, clear a set of sessions | +60 |
| `packages/desktop/src/features/browser-webviews/index.ts` | gate and registration check | +15 |
| `packages/desktop/src/main.ts` | popup session, registration input, `clear-session`, clear-all, settings event | +50 |
| `packages/desktop/src/preload.ts` | scoped prefix literal, `clearSession`, registration input | +12 |
| `packages/desktop/src/settings/desktop-settings.ts` | `browser.sessionModeByProject` | +30 |
| `packages/app/src/desktop/browser/session-scope.ts` (new) | scope key, hash, partition resolver, hook | +90 |
| `packages/app/src/desktop/browser/resident-webviews.ts` | partition input, removal on mismatch | +30 |
| `packages/app/src/desktop/browser/pane/index.electron.tsx`, `panel.tsx` | wait for partition, session menu | +120 |
| `packages/app/src/desktop/browser/automation/handler.ts` | resolve before `new_tab` | +25 |
| `packages/app/src/desktop/browser/settings/browser-data-section.tsx`, i18n strings | all-sessions wording, menu labels | +30 |
| `packages/app/src/desktop/host.ts`, `packages/app/src/desktop/settings/desktop-settings.ts` | bridge types, settings field, refetch on event | +30 |
| Tests (files in the test plan) | | +320 |
| `packages/desktop/capture-harness/main.js`, `index.html` | two-partition, restart and popup checks | +135 |
| `docs/architecture.md`, `docs/browser-capture-harness.md` | rewrite the owning paragraphs | +15 |

## Acceptance criteria

1. Two sign-ins to one site stay apart and survive a restart. Two guests on one origin, one in each of two scoped partitions, each set a different cookie and local storage value. Each reads only its own value, and still reads it after the Electron process exits and a second one starts.
   Verified by: capture harness group `browser-profile`, checks `scoped-isolation` and `scoped-restart-persistence`. They fail if either guest reads the other's value or loses its own.
2. A project in `Shared` mode keeps today's behavior and today's data: its tabs use `persist:paseo-browser`.
   Verified by: `session-scope.test.ts`, a project with no mode entry resolves to `persist:paseo-browser`; and the existing harness checks `shared-profile-data` and `process-restart-persistence`, unchanged.
3. The resolver separates scopes. `This project` gives one partition for all workspaces of a project and a different one for another project or another server. `Each workspace` gives a different partition per workspace. Ids built to collide by concatenation (`["a","bc"]` and `["ab","c"]`) get different partitions.
   Verified by: `session-scope.test.ts`.
4. The attach gate admits only the shared partition and exact scoped partitions.
   Verified by: `browser-webviews/index.test.ts`. It rejects `persist:paseo-browser-tab-a`, `persist:paseo-browser-scope-` with 31 or 33 hex characters, uppercase hex, a valid name with a suffix, `persist:foreign`, and a missing partition. It fails if the rule becomes a prefix match.
5. Registration rejects a guest whose session is not the session of the partition it claims.
   Verified by: `browser-webviews/index.test.ts`, registration with a mismatched session returns false.
6. A popup opened from a scoped tab uses that tab's session.
   Verified by: harness check `scoped-popup-session`. It fails if the popup's session is not the opener's or the popup cannot read the opener's cookie.
7. An agent's `browser_new_tab` creates its webview in the session of the agent's workspace, and fails when the workspace's project is unknown.
   Verified by: `automation/handler.test.ts`. It asserts the partition passed to `ensureResidentBrowserWebview` for a workspace in each mode, and a failure response, with no webview created, for an unknown workspace.
8. Clearing one session leaves the others. Clearing all sessions clears the shared one, every scoped one found on disk, and the legacy ones.
   Verified by: `browser-profile.test.ts`. One test asserts that clearing a scoped session calls no clear method on the shared session and reloads only guests of the cleared session. One asserts that clear-all covers a scoped directory name and skips names that do not match the rule.
9. Changing a project's mode moves its open tabs to the new session and keeps each tab's id and URL.
   Verified by: `resident-webviews.browser.test.ts`. After the resolved partition changes, the tab's webview element is a new one with the new `partition` attribute and the same browser id and `src`.
10. The mode is one value for all windows and survives a restart.
    Verified by: `desktop-settings.test.ts`, a patched `browser.sessionModeByProject` entry is read back from disk, and an invalid value is dropped without losing the other settings.
11. The session menu shows the current mode and changes it.
    Verified by: the UI evidence that `docs/qa.md` requires, taken in the desktop app: the menu open in each mode, and one site signed in with two accounts in two projects.

## Test plan

Run one file at a time, never a workspace suite. From `packages/desktop`:

- `npx vitest run src/features/browser-webviews/index.test.ts --bail=1`
- `npx vitest run src/features/browser-profile.test.ts --bail=1`
- `npx vitest run src/preload-sandbox.test.ts --bail=1`
- `npx vitest run src/settings/desktop-settings.test.ts --bail=1`

From `packages/app`:

- `npx vitest run src/desktop/browser/session-scope.test.ts --bail=1` (new file)
- `npx vitest run src/desktop/browser/automation/handler.test.ts --bail=1`
- `npx vitest run --project browser src/desktop/browser/resident-webviews.browser.test.ts --bail=1`

Real Electron, from the repository root (`docs/browser-capture-harness.md`):

- `PASEO_CAPTURE_HARNESS_GROUP=browser-profile npm run capture-harness --workspace=@getpaseo/desktop`

The group already runs two Electron processes in sequence, write then read. It gains two guests in two scoped partitions on the fixture origin, and a popup opened from one of them. Criteria 1 and 6 pass when `results.json` holds `scoped-isolation`, `scoped-restart-persistence` and `scoped-popup-session` with `pass: true`.

Then `npm run typecheck`, `npm run lint` and `npm run format`. `npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` runs in CI to show the existing browser journey still passes.

## Prototype (not run; needs approval at the gate)

- **Aim:** show on Electron 44.2.0, the version `packages/desktop` pins, that (a) two `persist:paseo-browser-scope-<id>` partitions keep two cookie and local storage values for one origin apart, (b) each survives a process restart, (c) a popup allowed by `setWindowOpenHandler` with `webPreferences.session` set to the opener's session reads the opener's cookie, and (d) each scoped partition has a directory `<userData>/Partitions/paseo-browser-scope-<id>`.
- **Method:** add the checks to the `browser-profile` group of the capture harness in a worktree on `upstream/main`, and run the command in the test plan.
- **Stop line:** stop and return to design if (a) or (b) fails. If (c) fails, the design keeps the opener's session by not overriding the popup's session, and the prototype confirms that instead. If (d) fails, clear-all uses a list of sessions that main records in `desktop-settings.json`.
- **Budget:** 2 hours and about 135 harness lines. No product code.
- **Needs approval:** `npm install` in a worktree and `npm run build:main`. This checkout has no `node_modules`, and the Mac has about 1.6 GiB free, which a full install of the monorepo will not fit. Either free disk first, or approve a smaller run: install only `electron@44.2.0` (about 400 MB) in an empty directory outside the repository and run a standalone script of about 150 lines that makes the same four checks. The smaller run proves the mechanism; the harness checks are then written and run during implementation, in CI.

### Feedback Cycles

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
