---
id: xshxezx88m45p23m4rd0vjdr
title: "An agent can require its policy plugin to be active before it opens (fail-closed on plugin loss)"
status: backlog
source: CL, 2026-11-21, split out of launch-wrap-hook after code review
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

## Problem

A sandbox plugin that wraps an agent's launch (`launch-wrap-hook`) protects that agent only while the plugin is active. When the plugin exits or a user disables it, Paseo removes its hooks, and the agent's next open runs with no wrap: a sandboxed agent then runs unsandboxed with no warning. A plugin has no way to say "this agent must not open without me".

## Proposed approach

Draft for ideation, from the code review (`.spacedock/repo/reviews/launch-wrap-hook-neon.md`, finding 6, option 2):
- `agent.create.before` may return `requirePlugin: true`. Paseo then records the calling plugin's runtime ID on the agent, in a persisted `requiresPlugins: string[]`. A plugin never writes an ID itself, so the rule works when the plugin was installed with `--id`.
- Paseo refuses to open the agent with `required_plugin_inactive` while any plugin in the list is inactive. History opens are refused too. The user recovers by enabling the plugin again.

The first implementation is kept on branch `task/plugin-required-active` (`2dc585c14`, based on `14238df28`). Reuse it where it is correct. It had these defects:
1. **Material.** `PluginService`, the object that bootstrap passes to the agent manager, does not forward `isPluginActive`. So every required plugin counted as inactive on a real daemon. The paseo-safehouse demo confirmed this live: an isolated daemon on port 47911 failed with "This agent needs plugin paseo-safehouse active to open". Fix: add `isPluginActive` to `PluginRuntimePort` and forward it in `PluginService`. Test through the real `PluginService` wiring.
2. **Material.** `createAgentFromRecord` runs `agent.create.before` and deletes stored agent state before the requirement check refuses the open. Check the requirement first (review finding 5).
3. **Needs decision.** The runtime ID is not exposed to plugins, which the `requirePlugin: true` approach above resolves (review finding 6).
4. **Deferred risk.** A plugin can be deregistered while another plugin's async open hook runs. Re-check after `agent.open.before` (review finding 7).
5. **Deferred risk.** Imported agents cannot get a requirement, because `agent.create.before` does not run on import (review finding 8).
6. **Polish.** An empty list is persisted (review finding 10).

## Acceptance criteria

Written in ideation. At least one test goes through the real daemon wiring: bootstrap's `PluginService` with a real plugin. It shows that an agent with a requirement opens while the plugin is active, and is refused after the plugin stops.

## Test plan

Written in ideation.

### Feedback Cycles

## Out of scope

- A user-facing "open without the required plugin" action.
- Launch wrapping itself (`launch-wrap-hook`).
