---
id: 86k2tpskkhrpqw7z4z1rrt9w
title: "Plugins can wrap an agent's launch command (agent.open.before wrap), fail-closed"
status: ideation
source: CL, 2026-11-21, contract agreed by the spacedock-v1 first officer and the paseo-safehouse manager
started: 2026-11-21T19:22:06Z
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

A sandbox plugin such as Safehouse can only confine agents today through its own `safehouse-*` providers, one wrapper provider per real provider. A user who wants a provider's agents sandboxed needs a matching wrapper provider. Every provider change has to be mirrored, and a plugin cannot sandbox a provider it did not wrap.

If a plugin could choose, for each session, a launch wrapper that the daemon puts in front of the provider's command, one sandbox plugin would cover every provider that supports wrapping. The plugin must never lose the wrapper silently: an older host that ignores `wrap`, or a provider that cannot apply it, must fail the open instead of starting an unsandboxed agent.

## Proposed approach

Line references are to upstream main `2445adecd` (2026-11-21). The contract's anchor `0c02cfd` is not in this checkout.

### Design

**Hook request and result (`agent.open.before`)**

- The request carries a read-only `launchWrap: boolean`: true when the target provider can apply a wrap for this open. A hook that returns a different value fails the open; omitting it means unchanged.
- The result may carry `wrap?: readonly [executable: string, ...args: string[]]`. The daemon accepts it only when `executable` is an absolute path. The provider spawns `[...wrap, <provider command>, ...<provider args>]` as a direct argv exec with `shell: false` and the final merged hook env.
- One selection per open. `validateBeforeResult` applies the rule, so it holds for both merges, which both go through that function: hooks inside one plugin (`PluginHookHandlers.openSession`) and hooks across plugins (`PluginRuntime.before`).
  - A later result with no `wrap` keeps the earlier one.
  - A deep-equal `wrap` passes.
  - A different `wrap` fails the open.
- A wrap is kept for `history` opens. The existing history stripping removes tools, MCP servers and prompt additions only.
- The wrap lives on `AgentLaunchContext.wrap`, next to `env`. Launch context is never persisted, so the wrap is not stored in the agent's config or record.

**Admission, before any process starts**

- `AgentClient` gains an optional `supportsLaunchWrap?(): boolean | Promise<boolean>`. Absent means false. It is a separate member, not an `AgentCapabilityFlags` entry, because those flags are a protocol type sent to clients.
- `wrapClientProvider` forwards the member, so a derived provider (a profile that `extends` Codex) inherits its base's answer.
- `buildLaunchContext` is the single admission point. It resolves `supportsLaunchWrap()`, sends it as `request.launchWrap`, runs the hooks, and when the merged result has a `wrap` and support is false it detaches plugin tools and throws. All four opens call it before they spawn or close anything.
- Plugin providers answer from the live connection: `supportsLaunchWrap()` awaits `getConnection()` and tests for the new provider capability `session.launch_wrap`. The wrap crosses to the plugin as `ProviderSessionConfig.wrap`, and `requiredProviderCapabilities` adds `session.launch_wrap` for a `session.open` that has one. The two existing capability gates then reject an unsupported wrapped open without further code: the daemon adapter (`plugin-provider.ts:299`) and the process boundary (`runtime.ts:1490`).

**Providers in this change**

- `runAcpProvider`, command branch: the adapter advertises `session.launch_wrap` only when `options.command` is set, and `AcpRuntime.start` prepends `config.wrap` to the session's spawn. The connector branch does not advertise it, so the daemon rejects a wrapped open for it.
- Codex: `supportsLaunchWrap()` returns true. `prepareAppServerSpawn` takes the wrap from `launchContext` and prepends it. `createSession` and `resumeSession` pass it.
- Every other provider keeps the default and rejects.

**Errors**

- Unsupported wrapping: `LaunchWrapUnsupportedError`, `code: "launch_wrap_unsupported"`, with `provider`. It follows `ToolPolicyUnsupportedError` (`provider-options.ts:25`).
- Required plugin inactive: `RequiredPluginInactiveError`, `code: "required_plugin_inactive"`, with `pluginId`.

**Separate commit: `requiresPlugin`**

- An `agent.create.before` result may carry `requiresPlugin?: string`. `PluginRuntime.before` accepts only the id of the plugin that returned it. Later hooks follow the same keep, identical, conflict rule as `wrap`.
- The value is saved on the agent record as an optional field and held on the managed agent.
- `buildLaunchContext` checks it before the hooks run, for every reason and purpose. The plugin counts as active when it is loaded, its server process is running, and it has an `agent.open.before` hook registered. Otherwise the open throws `RequiredPluginInactiveError`.
- `PluginLifecycle` gains one query for that check.

### Mechanisms confirmed against upstream

1. **Hook path.** `buildLaunchContext` builds the request and calls `pluginLifecycle.before("agent.open.before")` (`agent-manager.ts:6341-6378`). `PluginRuntime.before` runs plugins in id order (`localeCompare`, `runtime.ts:760`) and feeds each validated result to the next (`runtime.ts:771-777`). Within a plugin, `PluginHookHandlers.openSession` does the same per handler (`plugins/lifecycle/index.ts:388-417`). `paseo-safehouse` sorts before `zerosub`.
2. **Old hosts fail closed already.** The `agent.open.before` schema is `.strict()` (`plugins/lifecycle/index.ts:102-121`) and validates each result both in the plugin process, which runs host code (`plugin-process.ts:115`), and in the daemon. An old host rejects a result with an unknown `wrap` key and the open fails. This is from reading; the checkout has no `node_modules`, so AC-1 proves it by test. The `agent.create.before` schema is strict as well (`:97-101`), so `requiresPlugin` has the same property.
3. **Manager opens.** Create (`agent-manager.ts:1617`), resume (`:1752`), import (`:1828`) and refresh (`:1937`) each call `buildLaunchContext` before the provider call. Refresh calls it before `closeReloadedSession` (`:1966`) and outside the `try`, so a rejection leaves the running session in place.
4. **`runAcpProvider` command branch.** Each session spawns its own process: `openSession` calls `AcpRuntime.start` with `input.config.env` (`acp-internal/connection.ts:321-335`), and the command branch spawns `launch.command` with `{...launch.env, ...options.env}` (`:486-498`). Per-session wrapping needs no process sharing change, and two concurrent opens on one connection are independent spawns. Antigravity registers `["agy", "acp", "--disable-telemetry"]` (`plugins/antigravity-provider/server/provider.ts:95`). Goose, Fx and Hoplite use the same helper.
5. **Codex.** `prepareAppServerSpawn` (`codex-app-server-agent.ts:8201-8234`) returns a spawn closure. `createSession` (`:8268`) and `resumeSession` (`:8305`) hand it to the session, which uses it for interactive start (`:3996`) and archived history reads (`:4392`). Reconnect reuses the closure. `importSession` delegates to `resumeSession` with the launch context (`:8389`, `provider-session-import.ts:35`). The startup coordinator retries only a SQLite initialization exit, through the same closure (`codex/app-server-startup.ts:100-118`), so a retry is never bare.
6. **Plugin provider capabilities.** `PROVIDER_CAPABILITIES` (`packages/plugin/src/server/provider.ts:6-25`) is the offered list. The connection's selected set is checked at connect (`runtime.ts:1432-1451`) and before each `session.open` (`plugin-provider.ts:298-303`, `runtime.ts:1489-1490`).

### Corrections to the contract

1. **The support flag needs a connection first.** A command-based plugin provider does not connect when the manager checks availability (`plugin-provider.ts:232`), so its negotiated capabilities are empty when the hook runs. `supportsLaunchWrap()` therefore connects before the hook. The capability probe it triggers would run at open in any case.
2. **A plugin session can reopen without hooks.** `PluginAgentSession` reopens its provider session from a captured config (`plugin-provider.ts:1192-1212`). Carrying the wrap in `ProviderSessionConfig` makes that reopen use the same wrap.
3. **`AgentCapabilityFlags` is not internal.** It is in `packages/protocol`. The opt-in is the separate `AgentClient` member above, so this change does not touch `packages/protocol`.

### Expected surface

Commit 1, launch wrap. About 190 production lines and 350 test lines, ±30%. No new dependency. No `packages/protocol` change.

| File | Change | Lines |
| --- | --- | --- |
| `packages/plugin/src/server/lifecycle.ts` | `launchWrap` on the request, `wrap` on request and result | 12 |
| `packages/plugin/src/server/provider.ts` | `session.launch_wrap`, `ProviderSessionConfig.wrap`, schema, required capability | 14 |
| `packages/plugin/src/server/acp-internal/connection.ts` | advertise in the command branch, prepend at spawn | 20 |
| `packages/server/src/server/plugins/lifecycle/index.ts` | schema, selection rule, read-only `launchWrap`, absolute path | 35 |
| `packages/server/src/server/agent/agent-sdk-types.ts` | `AgentLaunchContext.wrap`, `AgentClient.supportsLaunchWrap` | 10 |
| `packages/server/src/server/agent/agent-manager.ts` | resolve support, admission, detach on failure | 30 |
| `packages/server/src/server/agent/provider-registry.ts` | forward the member | 2 |
| `packages/server/src/server/agent/plugin-provider.ts` | answer from the connection, map the wrap into the session config | 15 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.ts` | opt in, prepend in `prepareAppServerSpawn` | 15 |
| `packages/server/src/server/agent/provider-options.ts` | `LaunchWrapUnsupportedError` | 14 |
| `docs/plugins.md` | the `wrap` contract, in the section that owns `agent.open.before` | 20 |

Commit 2, `requiresPlugin`. About 95 production lines and 150 test lines, ±30%.

| File | Change | Lines |
| --- | --- | --- |
| `packages/plugin/src/server/lifecycle.ts` | `requiresPlugin` on the create request and result | 4 |
| `packages/server/src/server/plugins/lifecycle/index.ts` | schema, keep rule, `PluginLifecycle` query | 15 |
| `packages/server/src/server/plugins/runtime.ts` | own-id check, active query | 18 |
| `packages/server/src/server/agent/agent-storage.ts` | optional record field | 2 |
| `packages/server/src/server/agent/agent-manager.ts` | carry on create, persist, check on every open | 32 |
| `packages/server/src/server/agent/provider-options.ts` | `RequiredPluginInactiveError` | 12 |
| `docs/plugins.md`, `docs/data-model.md` | the field and its rule | 12 |

Platforms: daemon only. The Plugin SDK types change; the app, CLI, relay and desktop do not.

### Questions for CL

1. **Provider processes that run outside an open stay unwrapped.** Is that acceptable for the first pull request? They are:
   - the ACP capability probe, catalog and session list (`acp-internal/connection.ts:77`, `:264`, `:290`);
   - Codex catalog, native archive and unarchive, importable-session listing, and version probes (`codex-app-server-agent.ts:8240`, `:8330`, `:8444`, `:8491`);
   - draft command and control listing, which calls `client.createSession` with no launch context and no hook when the provider has no `listCommands` or `listControls` (`agent-manager.ts:1349`, `:1390`).

   Recommendation: accept and document. The draft listing is the one that starts a real session.
2. **Connecting before the hook** (correction 1). Agree, or should `request.launchWrap` be false until the provider has connected once?
3. **Reopen without hooks** (correction 2). Should the reopen reuse the original wrap as designed, or fail when the session was wrapped?
4. **`requiresPlugin` shape.** The design allows one plugin id, which must be the returning plugin's own, and offers no way to clear it. After the user removes the plugin, the agent cannot open, history included. Is that the intended end state, or does the first version need a user-facing release?
5. **Who must detect the unsupported error?** A hook cannot observe a failed open, and `request.launchWrap` already tells it the answer up front. The typed error reaches callers of create and resume. If a plugin must read `launch_wrap_unsupported` through `paseo.agents`, implementation has to confirm the code survives the RPC error path.
6. **Wrap returned when `request.launchWrap` is false.** The design rejects the open. Confirm that a plugin never wants "wrap if you can".

## Acceptance criteria

**AC-1. An old host fails closed, and a new host reports support.**
On a host without this change, an `agent.open.before` result that has `wrap` fails the open. On a host with it, `request.launchWrap` is true for a supporting provider and false for any other.
Verified by: in `packages/server/src/server/plugins/lifecycle/handlers.test.ts`, the test where a hook returns `wrap` is written first and run against unmodified upstream main, where it must fail with an unrecognized-key error; that run is recorded in the implementation report. A second test returns a result with an unknown key and expects rejection, which fails if the schema ever loses `.strict()`. In `packages/server/src/server/agent/agent-manager.test.ts`, a recording hook sees `launchWrap: true` for a client that opts in and `false` for one that does not.

**AC-2. A command-based ACP session spawns `[...wrap, command, ...args]` with the merged env.**
Verified by: `packages/plugin/src/server/acp.test.ts` registers `runAcpProvider({ command })` with a fixture launcher that records its argv and env, then runs the rest. One test asserts the recorded argv equals `[...wrap args, command, ...command args]` and that a variable set through `config.env` is present; it fails if the wrap is dropped or the env is not the session's. A second test opens two sessions on one connection, one with a wrap and one without, and asserts the launcher ran exactly once and the other session spawned the bare command. `plugins/antigravity-provider/server/provider.test.ts` asserts the wrapped argv ends with `agy acp --disable-telemetry`.

**AC-3. One wrap per open, across handlers and across plugins.**
Verified by: `packages/server/src/server/plugins/lifecycle/handlers.test.ts` for two handlers in one plugin, and `packages/server/src/server/plugins/runtime.posix.test.ts` for two plugins whose ids sort like `paseo-safehouse` and `zerosub`. Each has three cases: the later hook omits `wrap` and the merged result still has it; the later hook returns the same value and the open passes; the later hook returns a different value and the open rejects. The first case fails if a later result replaces the request wholesale.

**AC-4. History opens are wrapped.**
Verified by: `packages/server/src/server/agent/providers/codex-app-server-agent.test.ts` drives `resumeSession` with a wrap through the `appServerProcess` test port and asserts the spawn input is `command: wrap[0]`, `args: [...wrap.slice(1), codex command, ..., "app-server"]` for purpose `interactive` and for purpose `history`, where the history case reads an archived thread. `handlers.test.ts` asserts a `history` open keeps `wrap` while tools and MCP servers are stripped. These fail if the history path builds its own spawn or the stripping deletes `wrap`.

**AC-5. An unsupported provider rejects before any spawn, and a missing launcher is never retried bare.**
Verified by:
- `agent-manager.test.ts`: with a client that does not opt in and a hook that returns `wrap`, create, resume, import and refresh each reject with `code === "launch_wrap_unsupported"`; the client's `createSession`, `resumeSession` and `importSession` are never called; plugin tools are detached; on refresh the existing session is not closed. The persisted record has no `wrap`.
- `packages/server/src/server/agent/provider-registry.test.ts`: a derived provider reports its base's `supportsLaunchWrap`.
- `packages/server/src/server/agent/plugin-provider.test.ts`: a connection without `session.launch_wrap` rejects a wrapped open and receives no `session.open`; a `runAcpProvider({ connector })` connection does not list the capability.
- `acp.test.ts` and `packages/server/src/server/agent/providers/codex-app-server-agent.spawn-error.test.ts`: with a wrap whose executable does not exist, the open rejects, the spawn count is one, and no spawn uses the bare provider command.

**AC-6. An agent that requires a plugin does not open while that plugin is inactive.**
Verified by: `runtime.posix.test.ts` asserts a create hook may return only its own id as `requiresPlugin`. `agent-manager.test.ts` creates an agent whose hook returned `requiresPlugin`, reports the plugin inactive, and asserts resume and refresh reject with `code === "required_plugin_inactive"` before the client is called, then open again once the plugin is active. `packages/server/src/server/agent/agent-storage.test.ts` round-trips the field and loads a record without it.

## References

The contract was agreed between the spacedock-v1 first officer (`846d9a2c`) and the paseo-safehouse manager (`7d469e54`). Its source documents live in the paseo-safehouse project and are not readable from this project:
- the proposal, `docs/dev/.spacedock-state/_handoff/paseo-launch-wrap-proposal.md`;
- the GPT-6.2-Astra review, `.local/launch-wrap-proposal/review-astra.md`.

If copies arrive, they go in `.spacedock/repo/handoff/launch-wrap/`. The contract was anchored to upstream main `0c02cfd`. Ideation works against current upstream main.

## Test plan

Run each file alone, from its package, with `npx vitest run <file> --bail=1`. Do not run a workspace suite.

| File | Covers |
| --- | --- |
| `packages/server/src/server/plugins/lifecycle/handlers.test.ts` | AC-1, AC-3, AC-4 |
| `packages/server/src/server/plugins/runtime.posix.test.ts` | AC-3, AC-6 |
| `packages/plugin/src/server/acp.test.ts` | AC-2, AC-5 |
| `packages/plugin/src/server/provider.test.ts` | `session.launch_wrap` is required for a `session.open` with a wrap |
| `plugins/antigravity-provider/server/provider.test.ts` | AC-2 |
| `packages/server/src/server/agent/agent-manager.test.ts` | AC-1, AC-5, AC-6 |
| `packages/server/src/server/agent/plugin-provider.test.ts` | AC-5 |
| `packages/server/src/server/agent/provider-registry.test.ts` | AC-5 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.test.ts` | AC-4 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.spawn-error.test.ts` | AC-5 |
| `packages/server/src/server/agent/agent-storage.test.ts` | AC-6 |

Order of work: write the AC-1 test first and run it on unmodified upstream main to record the old-host failure. Then the hook schema and selection rule, the manager admission, the ACP branch, Codex, and last the `requiresPlugin` commit.

After each change run `npm run typecheck` and `npm run lint`; run `npm run build:server` first when a server typecheck reports a stale `@getpaseo/plugin` declaration. Run `npm run format` before each commit. The full suites run in CI on the pull request.

Tests use fixture launcher scripts and the existing Codex `appServerProcess` port. They need no real provider CLI and no sandbox tool.

### Feedback Cycles

## Out of scope

- Wrapping for providers other than ACP command-based and Codex. Each gets its own follow-up pull request.
- The `runAcpProvider` connector branch.
- Safehouse's own changes that adopt `wrap`. Those belong to the paseo-safehouse project.

## Stage Report: ideation

- DONE: Read the current code at upstream/main (git show / git grep upstream/main; do not fetch, do not move main): the agent.open.before hook path, the manager's create/resume/import/refresh-close opens, runAcpProvider's command branch, Codex prepareAppServerSpawn, and the plugin provider connection capabilities. Confirm or correct each mechanism the contract assumes, with file:line.
  Read at upstream main 2445adecd, no fetch. Six mechanisms confirmed and three contract corrections, each with file:line, under "Mechanisms confirmed against upstream" and "Corrections to the contract".
- DONE: Write the final design, the expected surface (files, net LOC with tolerance, the requiresPlugin commit separately), and the stable error code or type for unsupported wrapping. Restate the six draft checks as **AC-N** with Verified by: clauses that can fail, naming the specific test files.
  Design, two per-commit file tables (about 190 and 95 production lines, each ±30%), `LaunchWrapUnsupportedError` / `launch_wrap_unsupported`, and AC-1 to AC-6 naming eleven test files.
- DONE: Name anything in the contract that is ambiguous or that current upstream contradicts, as questions for CL at the gate.
  Six questions under "Questions for CL"; the largest is provider processes that start outside an open and stay unwrapped.

### Summary

The contract holds against current upstream with one admission point (`buildLaunchContext`) and one merge rule (`validateBeforeResult`); no `packages/protocol` change and no new dependency. Old-host safety comes from the hook schema already being strict, which is established by reading only: the checkout has no `node_modules`, so nothing was executed, and AC-1 makes implementation prove it on unmodified main first. Three corrections: the support flag needs a provider connection before the hook, a plugin session reopens without hooks, and `AgentCapabilityFlags` is a protocol type, so the opt-in is a separate `AgentClient` member.
