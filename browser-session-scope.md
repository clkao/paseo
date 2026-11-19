---
id: 74gqm38tar8mhyynj7vsw23j
title: "Browser sessions scoped by project or workspace"
status: backlog
source: CL, 2026-11-19 (user request quoting PR #2089)
started:
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

## Proposed approach

Written in ideation.

## Acceptance criteria

Written in ideation.

## Test plan

Written in ideation.

### Feedback Cycles

## Out of scope

- Browser automation features beyond choosing the session.
- Syncing browser profiles between machines.
