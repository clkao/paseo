---
title: "Plugins sign in a browser profile with credentials they hold."
status: backlog
source: "CL, 2026-11-20. Follow-up to browser-profile-selector, which it depends on."
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate:
id: 21frdkyw0tb77v3patbvxd0q
---

## Problem

A user who keeps a site's credentials in a plugin, for example a secrets manager or a test-account broker, has to sign in by hand in each browser profile. An agent then sees the sign-in, or the user pastes secrets where the agent can read them. No plugin API reaches the browser today:

- the plugin hooks are server-side and cover agents and workspaces (`agent.create`, `agent.open.before`, `workspace.create`, lifecycle events);
- the browser sessions live in the desktop app's Electron main process;
- the plugin client API has only `navigation.openBrowser`.

## Proposed approach

Draft, for ideation.

- **Hook.** A new client-side before hook, Electron only:

  ```js
  client.before("browser.profile.open", async ({ profile, url }) => ({ cookies }))
  ```

  Here `profile` is `{ scope: "shared" | "project", projectId?, workspaceId?, slug }`.
- **When it fires.** The main process asks for cookies before a tab's first navigation in a profile, for a user's tab and for an agent's `browser_new_tab` alike.
- **Where the cookies come from.** The plugin client entry gets them from its own server side through its RPC.
- **Check, then set.** Main checks that the target partition matches the allowed profile prefixes (`paseo-shared-*`, `paseo-project-<scope id>-*`), then sets the cookies with `session.cookies.set`. The persistent profile keeps them, so later opens can return nothing until they expire.
- **Consent.** The user approves each plugin per scope ("Plugin X may sign in profiles of project Y"). The approval is stored in the plugin's settings. A plugin never names a partition.
- **Access control.** It aligns with the later agent access control: the same prefix grant limits which profiles a plugin may sign in.

## Acceptance criteria

Written in ideation. At least one measures the value: a profile opens signed in through a consenting plugin, the secret appears in no agent transcript or environment, and a plugin without consent for that scope is refused.

## Test plan

To be written in ideation. This task needs a security review of its own, because it carries credentials from a plugin into the browser.

### Feedback Cycles

## Out of scope

The agent access control itself, and other storage types (local storage, IndexedDB).
