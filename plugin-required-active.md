---
id: xshxezx88m45p23m4rd0vjdr
title: "An agent can require its policy plugin to be active before it opens (fail-closed on plugin loss)"
status: ideation
source: CL, 2026-11-21, split out of launch-wrap-hook after code review
started: 2026-11-22T01:09:03Z
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

A plugin enforces policy on an agent through its hooks: `agent.open.before` adds env, tools, MCP servers and instructions on every open, and a sandbox plugin adds a launch wrap (`launch-wrap-hook`). That policy holds only while the plugin is active. When the plugin crashes, fails to load, or is disabled, reloaded or uninstalled, Paseo drops its hooks and the agent's next open runs without the policy and without a warning. A sandboxed agent then runs unsandboxed. A plugin has no way to say "this agent must not open without me".

## Design

An agent can require the plugin that created it. While a required plugin is not active, every open of that agent fails with `required_plugin_inactive`. The user recovers by making the plugin active again (enable, reload, fix and reinstall under the same ID). Sandboxing is the motivating case; the mechanism is not tied to the wrap and works for any policy a plugin applies in its hooks.

The task is based on `upstream/main` (`2445adecd`) and has no dependency on `launch-wrap-hook`. Branch `task/plugin-required-active` (`2dc585c14`) sits on the launch-wrap commit `14238df28`; its non-wrap parts are reused, and the two pieces it borrows from launch-wrap (the `createHookChild` test helper in `runtime.posix.test.ts` and the `LaunchWrapRecordingClient` in `agent-manager.test.ts`) are rewritten against `upstream/main` fixtures (`createReloadChild`, `createTestAgentClient`).

### Declaring the requirement

1. **Create-time signal.** On a host with this feature, every `agent.create.before` request a plugin receives carries `requirePlugin: false`. A plugin that wants the requirement returns `requirePlugin: true`. A host without the feature sends no such field and its strict create schema (`packages/server/src/server/plugins/lifecycle/index.ts:97-101`) rejects it, so a plugin checks `request.requirePlugin !== undefined` before setting it. This is the support signal Safehouse asked for (`.spacedock/repo/handoff/plugin-required-active/safehouse-input.md`): Safehouse offers the wrap only when the provider reports `launchWrap` and the request carries `requirePlugin`.
2. **Paseo records the runtime ID.** `PluginRuntime.before` (`runtime.ts:755-807`) sends each plugin its own `requirePlugin: false`, and when that plugin's result is `true` it appends `loaded.id`, the runtime ID, to a daemon-only `requiresPlugins: string[]` on the create result. The flag is stripped before the next plugin's request, so one plugin cannot see or clear another's choice. A plugin never writes an ID, so the rule works when the plugin was installed with `--id` (`plugins/index.ts:340-345`).
3. **Within one plugin**, `requirePlugin` follows the create hook's "omitted means unchanged" rule (`lifecycle/index.ts:292-299`): a later handler that omits it keeps the earlier value.
4. **A plugin with no `agent.open.before` hook cannot require itself.** Its create hook fails with "requirePlugin needs an agent.open.before hook", because such an agent could never open (see "Active" below).
5. **Import.** `agent.create.before` does not run on import (`agent-manager.ts:1803-1890`), so an imported agent's only hook is its first `agent.open.before` (`reason: "import"`, `agent-manager.ts:1826-1840`). On import opens only, the open request carries `requirePlugin: false` and the plugin may return `true`, with the same per-plugin recording as create. On other opens the field is absent, and `validateBeforeResult` (`lifecycle/index.ts:269-291`) fails a result that adds it.
6. **Persistence.** `requiresPlugins` is an optional field of the stored agent record (`agent-storage.ts:49-65`), carried on `ManagedAgentBase` (`agent-manager.ts:476-490`) and written by `toStoredAgentRecord` (`agent-projections.ts:101`) only when non-empty. `AgentStorage.applySnapshot` keeps the stored list as a union with the snapshot's, the same way it keeps `background` (`agent-storage.ts:410-411`), so an open path that forgets the field cannot erase a requirement. Nothing removes a requirement in this version. `createAgentFromRecord` unions the stored list with what its re-run create hooks add.

### Active

A plugin is **active** when the runtime has it published (`this.plugins`, `runtime.ts:370`), its child process is running, and it has an `agent.open.before` hook registered. Every lifecycle exit already removes it from `this.plugins`: stop/disable/remove/reload through `PluginService.stopPlugin` → `PluginRuntime.stopPluginById` (`plugins/index.ts:509-586,675-679`, `runtime.ts:460-468`), the global switch (`plugins/index.ts:601-618`), daemon stop (`runtime.ts:1068-1075`), a crash (`handleChildClose`, `runtime.ts:1647-1660`), and a failed load or cancelled start never publishes (`runtime.ts:410-434`). Dropping the open hook at runtime (`hooks.changed`, `runtime.ts:1312-1321`) also makes it inactive.

`PluginRuntime.isPluginActive(pluginId)` implements this. `PluginRuntimePort` (`plugins/index.ts:44-79`) gains it and `PluginService` forwards it (`?? false` when the port lacks it), next to the existing forwards at `plugins/index.ts:152-223`. AgentManager types its dependency as `PluginLifecycle & { isPluginActive(pluginId: string): boolean }` with the method required, so bootstrap's `pluginLifecycle: pluginRuntime` (`bootstrap.ts:683,1035-1037`) fails typecheck if `PluginService` stops forwarding it. The workspace and worktree consumers keep their narrow `Pick<PluginLifecycle, …>` types (`paseo-worktree-service.ts:66`, `worktree-core.ts:48`).

### Enforcing it on every open

Two checks, for every `reason` and `purpose` (history included):

1. **Pre-check, before any side effect.** `requireActivePlugins(ids)` throws `RequiredPluginInactiveError` when any listed plugin is not active. It runs:
   - in `createAgentFromRecord` on the stored list, before `createAgentInternal` runs create hooks and `deleteAgentState` deletes the timeline (`agent-manager.ts:1554-1578,1587-1606,4189`);
   - in `createAgentInternal` on the hook-produced list, after the create hooks and before `deleteAgentState` and `prepareSessionConfig` (`agent-manager.ts:1606-1612`);
   - in `resumeAgentFromPersistenceInternal` right after the record read, before `prepareSessionConfig` and `client.isAvailable()` (`agent-manager.ts:1733-1750`);
   - in `reloadAgentSessionInternal` before it cancels an in-flight run (`agent-manager.ts:1912-1915`), so a refused reload leaves the live session and its turn untouched.
2. **Post-check, after the open hooks.** `PluginRuntime.before("agent.open.before")` returns a daemon-only `hookPluginIds: string[]` listing the plugins whose open hook ran on this open (`PluginBeforeResults`, `lifecycle/index.ts:38-40`). `buildLaunchContext` (`agent-manager.ts:6341-6420`) refuses the open when a required ID is missing from that list, before any provider session starts. This closes the window where a required plugin drops its open hook while an earlier plugin's async hook runs and the runtime skips it (`runtime.ts:767-769`). A plugin stopped or crashed mid-open either fails the open through its rejected request (`runtime.ts:460-468,1647-1655`) or is missing from `hookPluginIds`; both refuse.

`RequiredPluginInactiveError` (`code: "required_plugin_inactive"`, `pluginIds: string[]`, message "This agent needs plugin X active to open") lives in `plugins/lifecycle/index.ts`, not `provider-options.ts`, since it is a plugin-lifecycle error. The code is a stable server-side identifier on the error object; clients receive the message through the existing failure paths (`agent_create_failed` status at `session.ts:4926-4935`, prompt and resume errors). No protocol message or client change.

### Live agents when a required plugin goes inactive

A plugin leaving already bumps the session-open generation (`runtime.ts:405-408` → `agent-manager.ts:1017-1019`, wired at `bootstrap.ts:1058-1060`). The next prompt calls `reloadStalePluginSession` (`agent-prompt.ts:148`, `agent-manager.ts:1021-1040`), which now fails the pre-check, so the prompt is refused with `required_plugin_inactive` and the live session is left as it is. A turn already running continues in the process that was opened under the policy; that plugin's attached tools stop working because their instance ID no longer matches (`runtime.ts:962-964`). When the plugin returns, the generation bumps again and the next prompt reloads the session through the plugin.

### Daemon start

`PluginService.start()` resolves only after every configured plugin has loaded or failed (`plugins/index.ts:255-286`, awaiting each `startConfigured`). Bootstrap awaits it before resuming interrupted agents and before accepting client connections (`bootstrap.ts:1958-1963`), so neither restart recovery nor a client can open an agent before its plugin is loaded. The one earlier opener is the schedule service: it starts at `bootstrap.ts:1497` and ticks every second (`schedule/service.ts:30,312-333`) while plugins are still compiling. A scheduled run that opens an agent with a requirement in that window fails the pre-check, and the run is recorded as `failed` with the `required_plugin_inactive` message (`schedule/service.ts:821-831`). The agent's record and timeline are untouched, and the next run after the plugin loads succeeds. A plugin that fails to load, or plugins switched off globally, leave the agent refused until the plugin is active.

### Resolution of the review defects (`.spacedock/repo/reviews/launch-wrap-hook-neon.md`)

1. `PluginService` did not forward `isPluginActive`, so every required plugin counted as inactive on a real daemon (the paseo-safehouse demo hit this live): forwarded through `PluginRuntimePort`, required on AgentManager's dependency type, and proved by AC-1 through bootstrap's real `PluginService`.
2. `createAgentFromRecord` ran create hooks and deleted state before refusing: pre-checks run before hooks, `deleteAgentState`, catalog lookups, availability probes and run cancellation (AC-3).
3. Runtime ID not exposed to plugins: replaced by `requirePlugin: true`; Paseo records `loaded.id` (AC-2).
4. Open hook unregistered mid-open: post-check against `hookPluginIds` (AC-5).
5. Imported agents could not get a requirement: the import open carries `requirePlugin` (AC-6). See question 2.
6. Empty list persisted: the list exists only when a plugin opted in, and `toStoredAgentRecord` omits an empty list (AC-7).

### Limits

- A daemon older than this change strips the unknown `requiresPlugins` key when it loads the record (`agent-storage.ts:49`, plain `z.object`), so after a downgrade the agent opens without the requirement and the next write erases it. Data model has no migrations (`docs/data-model.md`).
- A plugin reinstalled under a different ID does not satisfy a requirement recorded under the old ID.
- A reload (`plugins/index.ts:509-521`) briefly makes the plugin inactive; a prompt in that window is refused.

## Expected surface

Platforms: daemon only. The plugin SDK types change additively; no app, CLI or `packages/protocol` change. Backward compatibility: `requirePlugin` is optional in the SDK request types and absent on older hosts; an old plugin on a new host passes `false` through; `requiresPlugins` is an optional stored field that old records lack.

| File | Change | Net LOC |
| --- | --- | --- |
| `packages/plugin/src/server/lifecycle.ts` | `requirePlugin?: boolean` on the create request and the open request, with doc comments | +10 |
| `packages/server/src/server/plugins/lifecycle/index.ts` | schemas, create/open result merge, `PluginBeforeResults` fields, `RequiredPluginInactiveError` | +35 |
| `packages/server/src/server/plugins/runtime.ts` | per-plugin `requirePlugin` collection for create and import open, `hookPluginIds`, `isPluginActive`, no-open-hook rejection | +45 |
| `packages/server/src/server/plugins/index.ts` | port member and `PluginService.isPluginActive` forward | +8 |
| `packages/server/src/server/agent/agent-manager.ts` | dependency type, field plumbing through create/resume/reload/import/`registerSession`, pre- and post-checks | +75 |
| `packages/server/src/server/agent/agent-storage.ts`, `agent-projections.ts` | optional field, sticky union in `applySnapshot`, omit empty | +10 |
| `docs/plugins.md`, `docs/data-model.md` | "Plugin requirements" subsection under Lifecycle hooks; record field row | +15 |
| `public-docs/plugins/hooks.md`, `hooks.zh-CN.md` | "Require your plugin for every open" under `agent.create.before`, import note under `agent.open.before` | +50 |
| Tests (five files, see Test plan) | | +300 |

Total about +550 lines, tolerance ±150 (production +185 ±45, docs +65 ±20, tests +300 ±90). No new dependency.

## Acceptance criteria

- **AC-1** An agent created through a real plugin that returns `requirePlugin: true` opens while that plugin is active and is refused with `required_plugin_inactive` after the plugin is disabled, through bootstrap's real `PluginService`; after re-enabling, it opens again.
  Verified by: new test in `packages/server/src/server/plugins/agent-configuration.e2e.test.ts` using `createTestPaseoDaemon` and a plugin written to a temp directory and installed with `client.installDirectoryPlugin`: create succeeds; the stored record has `requiresPlugins: [<runtime id>]`; after `client.disablePlugin`, `agentManager.reloadAgentSession` and a close-then-resume both reject with `code: "required_plugin_inactive"` and the recording client sees no new launch; after `client.enablePlugin`, resume launches once. Fails if `PluginService` does not forward `isPluginActive` (create itself is refused) or if any open path skips the check.
- **AC-2** The requirement uses the runtime ID: a plugin installed with `--id other-id` and returning `requirePlugin: true` produces `requiresPlugins: ["other-id"]`; two plugins that both opt in produce both IDs; a plugin whose request lacks the opt-in leaves the list absent; each plugin receives `requirePlugin: false` regardless of an earlier plugin's choice.
  Verified by: `packages/server/src/server/plugins/runtime.posix.test.ts`, new `describe("create-hook plugin requirements")`, driving `PluginRuntime.before("agent.create.before")` with hook children started under chosen runtime IDs. Fails if the runtime records the manifest ID, forwards one plugin's flag to the next, or emits an empty list.
- **AC-3** A refused open has no side effects: for a stored record without a persistence handle and an inactive required plugin, `createAgentFromRecord` rejects with `required_plugin_inactive`, no `agent.create.before` or `agent.open.before` hook runs, the durable timeline rows and the record are unchanged, and the provider client's create count stays 0; for a live agent with a running turn, a refused `reloadAgentSession` does not cancel the turn.
  Verified by: new tests in `packages/server/src/server/agent/agent-manager.test.ts` with a stub lifecycle counting `before` calls. Fails if the check moves after the create hooks, `deleteAgentState`, or `cancelAgentRunBefore`.
- **AC-4** Every open path enforces it: `reloadAgentSession` (refresh), `resumeAgentFromPersistence` with `purpose: "interactive"` and `"history"`, `createAgentFromRecord`, and `reloadStalePluginSession` after `invalidatePluginSessions()` all reject while the plugin is inactive and succeed once it is active.
  Verified by: `packages/server/src/server/agent/agent-manager.test.ts`, one table-driven test over the paths. Fails if any path omits the pre-check.
- **AC-5** The open is refused when a required plugin's open hook did not run, even if the plugin reports active at the pre-check.
  Verified by: `packages/server/src/server/agent/agent-manager.test.ts`, a stub lifecycle whose `isPluginActive` returns true but whose open result's `hookPluginIds` omits the required ID: the open rejects with `required_plugin_inactive` and the client's resume count is unchanged; and `runtime.posix.test.ts`, asserting `hookPluginIds` lists exactly the plugins whose open hook ran, excluding one that removed its hook. Fails without the post-check.
- **AC-6** An import open can declare the requirement: with `reason: "import"` the request carries `requirePlugin: false`, a `true` result is recorded on the imported agent, and a later resume is refused while that plugin is inactive; on a non-import open, returning `requirePlugin` fails the open.
  Verified by: `runtime.posix.test.ts` (signal present only on import; rejection on resume) and `agent-manager.test.ts` (an imported agent through a test client with `importSession` stores the list and is refused on resume). Fails if the import path drops the result or the field is accepted on other reasons.
- **AC-7** Storage: a record with `requiresPlugins` round-trips, a record without it still loads and is written without the key, an agent with no opt-in never stores `[]`, and an `applySnapshot` from a managed agent lacking the field keeps the stored list.
  Verified by: `packages/server/src/server/agent/agent-storage.test.ts`. Fails if empty lists are written or a snapshot erases the list.
- **AC-8** `isPluginActive` is true only while the plugin is published with a running child and an open hook: false for a plugin with only a create hook, an unknown ID, after `stopPluginById`, after the child exits, and after `hooks.changed` drops the open hook; a create hook returning `requirePlugin: true` from a plugin without an open hook fails the create.
  Verified by: `runtime.posix.test.ts`. Fails if activity ignores the child state or the hook list.
- **AC-9** Within one plugin, a later create handler that omits `requirePlugin` keeps the earlier `true`.
  Verified by: `packages/server/src/server/plugins/lifecycle/handlers.test.ts`. Fails if the merge drops the field.

## Test plan

Run only the touched files, one at a time, from `packages/server` with every `PASEO_*` variable cleared:

- `npx vitest run src/server/plugins/runtime.posix.test.ts --bail=1`
- `npx vitest run src/server/plugins/lifecycle/handlers.test.ts --bail=1`
- `npx vitest run src/server/agent/agent-storage.test.ts --bail=1`
- `npx vitest run src/server/agent/agent-manager.test.ts --bail=1 -t "requir"` (the file is ~16k lines; filter to the new tests, then run the whole file once with output piped to `/tmp`)
- `npx vitest run src/server/plugins/agent-configuration.e2e.test.ts --bail=1 > /tmp/pra-e2e.txt 2>&1`

Then `npm run typecheck`, `npm run lint`, `npm run format`. `runtime.posix.test.ts` is POSIX-only by name; the new e2e test writes a TypeScript plugin and uses no shebangs or `chmod`, so it runs on Windows CI. Full-suite coverage comes from CI.

## Questions for the gate

1. **Live sessions.** When a required plugin goes inactive, the design leaves a live session running and refuses the next open (the next prompt). The alternative is to close every live agent that requires the plugin at the moment it leaves. Keeping live sessions is recommended: the running process was opened under the policy, and closing agents on a plugin reload would interrupt work. Confirm or choose closing.
2. **Import.** The design lets `agent.open.before` declare `requirePlugin` on import opens (about +20 production lines and AC-6). The leaner option is documentation only: a policy plugin that needs durable enforcement rejects `reason: "import"`. Recommended: keep it, since otherwise Safehouse must refuse imports for every wrap-capable provider.
3. **Scheduled runs at daemon start.** A scheduled run that opens a required agent before plugins finish loading fails and is recorded as failed (see "Daemon start"). The alternative is a startup barrier: requirement checks wait for `PluginService.start()` to settle. Recommended: accept the failure for this task; the barrier needs a promise that resolves even when `start()` is never called, which adds a hang risk for a one-time window.
4. **History opens are refused.** An archived agent with a requirement cannot load provider history while the plugin is inactive. This matches the task source; confirm.

### Feedback Cycles

## Out of scope

- A user-facing "open without the required plugin" action, and any way to release a requirement.
- Launch wrapping itself (`launch-wrap-hook`).
- Opens of agents without a requirement before plugins load; they run without plugin hooks today.
- Showing the requirement in the app.

## Stage Report: ideation

- DONE: Read the current code at upstream/main: plugin lifecycle, PluginService/PluginRuntime wiring in bootstrap, agent.create.before and agent.open.before paths, every open path, and branch task/plugin-required-active (2dc585c14). Give file:line for each mechanism.
  Design cites upstream/main `2445adecd` lines for start/stop/disable/remove/reload/crash/failed load (`plugins/index.ts`, `runtime.ts`), bootstrap wiring (`bootstrap.ts:683,1035-1037,1058-1060,1497,1958-1963`), and create/resume/reload/import/history/createAgentFromRecord/stale-reload paths in `agent-manager.ts`, `agent-loading.ts`, `agent-prompt.ts`.
- DONE: Write the final design as a general capability based on upstream/main with no dependency on launch-wrap-hook.
  "Design" section: plugin-agnostic requirement keyed by runtime ID; the only launch-wrap borrowings in 2dc585c14 are two test fixtures, rewritten against upstream/main fixtures.
- DONE: Resolve each of the six listed defects.
  "Resolution of the review defects" maps 1-6 to mechanisms and to AC-1, AC-3, AC-2, AC-5, AC-6, AC-7.
- DONE: Include the create-time support signal from safehouse-input.md.
  `requirePlugin: false` present in each plugin's `agent.create.before` request (and import opens) on supporting hosts.
- DONE: Say what happens at daemon start when an agent opens before its plugin finishes loading.
  Clients and restart recovery cannot open before `PluginService.start()` settles; schedule ticks can, and such a run fails with `required_plugin_inactive` and leaves state untouched (question 3).
- DONE: Write the expected surface (files, net LOC with tolerance), the stable error code, and AC-N criteria with Verified by: clauses naming test files; at least one AC through bootstrap's real PluginService with a real plugin.
  ~+550 ±150 LOC across 9 production/doc files and 5 test files; `required_plugin_inactive`; AC-1..AC-9, AC-1 in `agent-configuration.e2e.test.ts` via `createTestPaseoDaemon`.
- DONE: Name anything ambiguous, or any choice that belongs to CL, as questions for the gate.
  Four questions: live sessions on plugin loss, import support, scheduled runs at daemon start, history opens refused.

### Summary

Designed a general "agent requires its plugin" capability on upstream/main: plugins opt in with `requirePlugin: true` (signalled by `requirePlugin: false` in the request), Paseo records the runtime ID, and every open is refused with `required_plugin_inactive` by a side-effect-free pre-check plus a post-check that the required plugin's open hook actually ran. Live sessions keep running and the next prompt is refused; at daemon start only schedule ticks can hit the not-yet-loaded window. No code was changed and no prototype was needed; four choices are left for CL at the gate.
