---
id: 86k2tpskkhrpqw7z4z1rrt9w
title: "Plugins can wrap an agent's launch command (agent.open.before wrap), fail-closed"
status: implementation
source: CL, 2026-11-21, contract agreed by the spacedock-v1 first officer and the paseo-safehouse manager
started: 2026-11-21T19:22:06Z
completed:
verdict:
score:
worktree:
issue:
pr: https://github.com/getpaseo/paseo/pull/10480
mod-block:
mandate:
gates:
    version: 1
    records:
        - id: gate:86k2tpskkhrpqw7z4z1rrt9w:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:86k2tpskkhrpqw7z4z1rrt9w-ideation-1
              briefing:
                id: briefing:86k2tpskkhrpqw7z4z1rrt9w:ideation:attempt-1:revision-1
                digest: sha256:bc57537f933e592b413b55a4189f5c338407595736c268e83ff6870d511c88d5
                room-ref: '@review/ideation/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:86k2tpskkhrpqw7z4z1rrt9w:ideation:1
                briefing: briefing:86k2tpskkhrpqw7z4z1rrt9w:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-11-21T19:35:26.841394Z"
                decision: revise
                reason: 'CL accepts the direction; consensus with the paseo-safehouse manager changes one point. Revise: (1) replace request.launchWrap with provider-level launch-wrap support visible at create time through the plugin API provider list (static per provider: core AgentClient opt-in, plugin providers declare at registration; runAcpProvider command branch supports), an optional provider-snapshot field; open-time admission stays as designed. (2) AC-2 adds an argument containing spaces. (3) Follow-up scope: draft command/control discovery plus the create-time catalog lookup with no model (agent-manager.ts:1607-1617). (4) Record documented limits: guarantee needs Safehouse daemon access Off; Windows shell-needing prefixes rejected in v1. Answers: connect-first as designed; reopen reuses the original wrap; no RPC requirement for the error code; wrap with unsupported rejects; requiresPlugin v1 own-id, no release. (5) Reference .spacedock/repo/handoff/launch-wrap/README.md.'
            - id: gate-attempt:86k2tpskkhrpqw7z4z1rrt9w-ideation-2
              briefing:
                id: briefing:86k2tpskkhrpqw7z4z1rrt9w:ideation:attempt-2:revision-1
                digest: sha256:b6e9aa755a28b2c3d03a6d0a4d6d2a2ca1af7dafdfd758202c9984975412c38a
                room-ref: '@review/ideation/briefing-2'
              resolution:
                type: Resolution
                id: resolution:spacedock:86k2tpskkhrpqw7z4z1rrt9w:ideation:2
                briefing: briefing:86k2tpskkhrpqw7z4z1rrt9w:ideation:attempt-2:revision-1
                by: person:captain
                at: "2026-11-21T19:46:51.725525Z"
                decision: approve
                reason: 'CL approved the cycle-2 design: provider-level launchWrap visible before first connect, unchanged open-time admission, requiresPlugins own-id union, AC-1..AC-6, documented limits; implementation on CL''s Mac.'
              application:
                target-stage: implementation
                state: consumed
        - id: gate:86k2tpskkhrpqw7z4z1rrt9w:validation
          stage: validation
          attempts:
            - id: gate-attempt:86k2tpskkhrpqw7z4z1rrt9w-validation-1
              briefing:
                id: briefing:86k2tpskkhrpqw7z4z1rrt9w:validation:attempt-1:revision-1
                digest: sha256:8f9107afafc757af631309aa2ee723c46515e0ae3a19dfa1f8fbfd4cca216171
                room-ref: '@review/validation/briefing-1'
              resolution:
                type: Resolution
                id: resolution:spacedock:86k2tpskkhrpqw7z4z1rrt9w:validation:1
                briefing: briefing:86k2tpskkhrpqw7z4z1rrt9w:validation:attempt-1:revision-1
                by: person:captain
                at: "2026-11-21T23:56:18.039707Z"
                decision: revise
                reason: 'CL rejects validation at 2dc585c14; back to implementation. Material: applyLaunchWrap (packages/plugin/src/server/process.ts:55-59) throws for a Windows .cmd/.bat wrapper or provider command, after refresh has closed the session. Both wrapped paths already spawn through spawnProcess, which handles Windows command scripts through cmd.exe with tested quoting, and the provider command is only an argument to the wrapper. Remove the check; add simulated-win32 tests that a .cmd wrapper takes the shell path with quoted args and that a wrapped refresh with a .cmd provider command does not fail. Docs: no shell except Windows script launchers through cmd.exe like any provider launcher; docs/plugins.md:485 ''before any session harness starts''; add wrap and requiresPlugins to public-docs/plugins/hooks.md and wrap to the lifecycle/index.ts:291 diagnostic list. Deferred: full typecheck to CI; activity sampled before async hooks. Test size accepted.'
            - id: gate-attempt:86k2tpskkhrpqw7z4z1rrt9w-validation-2
              briefing:
                id: briefing:86k2tpskkhrpqw7z4z1rrt9w:validation:attempt-2:revision-1
                digest: sha256:177f8b777b18287133b6ac7a6087453c98e41bfd32d85dcca4e9cf27ed6e04b9
                room-ref: '@review/validation/briefing-2'
              resolution:
                type: Resolution
                id: resolution:spacedock:86k2tpskkhrpqw7z4z1rrt9w:validation:2
                briefing: briefing:86k2tpskkhrpqw7z4z1rrt9w:validation:attempt-2:revision-1
                by: person:captain
                at: "2026-11-22T00:12:10.579424Z"
                decision: approve
                reason: 'CL approved validation cycle 2 at e3fd597ff: Windows script launchers through spawnProcess, AC-1..AC-6 hold (1,129 tests, 16 files). Deferred: full typecheck to upstream CI; activity sampled before async hooks. Delivery: CL pushes task/launch-wrap-hook to the fork and opens the upstream PR.'
              application:
                target-stage: done
                state: superseded
            - id: gate-attempt:86k2tpskkhrpqw7z4z1rrt9w-validation-3
              briefing:
                id: briefing:86k2tpskkhrpqw7z4z1rrt9w:validation:attempt-3:revision-1
                digest: sha256:53791f1d8ef1994f19009530ccc390a8d5e9c30ad855ca23163f9e04baebe25d
                room-ref: '@review/validation/briefing-3'
              resolution:
                type: Resolution
                id: resolution:spacedock:86k2tpskkhrpqw7z4z1rrt9w:validation:3
                briefing: briefing:86k2tpskkhrpqw7z4z1rrt9w:validation:attempt-3:revision-1
                by: person:captain
                at: "2026-11-22T02:56:11.448658Z"
                decision: revise
                reason: 'CL: send it back. Fix the AC-2 Antigravity assertion (use the registration''s command) and the AC-5 ACP launch-attempt count; remove the daemon-access sentence at docs/plugins.md:497.'
            - id: gate-attempt:86k2tpskkhrpqw7z4z1rrt9w-validation-4
              briefing:
                id: briefing:86k2tpskkhrpqw7z4z1rrt9w:validation:attempt-4:revision-1
                digest: sha256:1c1024759e8f58355d2f3ccc0cf82145efd36a00e30dc8a805b2fa81859a6a89
                room-ref: '@review/validation/briefing-4'
              resolution:
                type: Resolution
                id: resolution:spacedock:86k2tpskkhrpqw7z4z1rrt9w:validation:4
                briefing: briefing:86k2tpskkhrpqw7z4z1rrt9w:validation:attempt-4:revision-1
                by: person:captain
                at: "2026-11-22T03:15:54.907209Z"
                decision: approve
                reason: 'CL: approve the wrap validation (cycle 4, 9f9f39ce1).'
              application:
                target-stage: done
                state: superseded
---

## Problem

A sandbox plugin such as Safehouse can only confine agents today through its own `safehouse-*` providers, one wrapper provider per real provider. A user who wants a provider's agents sandboxed needs a matching wrapper provider. Every provider change has to be mirrored, and a plugin cannot sandbox a provider it did not wrap.

If a plugin could choose, for each session, a launch wrapper that the daemon puts in front of the provider's command, one sandbox plugin would cover every provider that supports wrapping. The plugin must never lose the wrapper silently: an older host that ignores `wrap`, or a provider that cannot apply it, must fail the open instead of starting an unsandboxed agent.

## Proposed approach

Line references are to upstream main `2445adecd` (2026-11-21).

### Design

**Provider-level support, readable at create time**

A sandbox plugin picks the provider in `agent.create.before`, so it must know there whether the provider can apply a wrap. Support is a static property of the provider, published in the provider snapshot as optional `launchWrap: boolean`. A hook reads it with `paseo.providers.snapshot()` (`packages/client/src/index.ts:885`). Absent means unsupported, which is also what an older host reports.

- Core providers declare it in the provider contract table beside `supportsExactMcpPreapproval` (`provider-registry.ts:149-162`). The registry copies it onto the provider definition (`:670`) and onto the client it builds, as `AgentClient.supportsLaunchWrap`. A derived provider (a profile that `extends` Codex) takes its base's contract, so it inherits the value. Codex is true. Every other core provider is false.
- Plugin providers declare it at registration: `ProviderRegistration.launchWrap?: boolean`. `runAcpProvider` sets it to true for the command branch and leaves it unset for the connector branch. A provider that spreads the helper's result, as Antigravity, Goose, Fx and Hoplite do, carries it with no change of its own.
- The declaration reaches the snapshot without a provider connection. It travels in the registration metadata that the plugin process sends when it initializes, so a fresh daemon reports it before the provider has ever connected. See mechanism 7.

**Hook result (`agent.open.before`)**

- The result may carry `wrap?: readonly [executable: string, ...args: string[]]`. The daemon accepts it only when `executable` is an absolute path. The provider spawns `[...wrap, <provider command>, ...<provider args>]` through `spawnProcess` with the final merged hook env: no shell, except Windows script launchers, which go through cmd.exe like any provider launcher, with each argument quoted. Each element stays one argv element, so an argument with spaces is passed whole. The provider command is only an argument to the wrapper.
- One selection per open. `validateBeforeResult` applies the rule, so it holds for both merges, which both go through that function: hooks inside one plugin (`PluginHookHandlers.openSession`) and hooks across plugins (`PluginRuntime.before`).
  - A later result with no `wrap` keeps the earlier one.
  - A deep-equal `wrap` passes.
  - A different `wrap` fails the open.
- A wrap is kept for `history` opens. The existing history stripping removes tools, MCP servers and prompt additions only.
- The wrap lives on `AgentLaunchContext.wrap`, next to `env`. Launch context is never persisted, so the wrap is not stored in the agent's config or record.

**Admission at open, before any process starts**

The default is deny. `buildLaunchContext` is the single admission point: all four opens call it before they spawn or close anything. When the merged hook result has a `wrap`:

- For a core provider it requires `client.supportsLaunchWrap === true`.
- For a plugin provider it requires the registration's declaration and the capability `session.launch_wrap` on the live connection. The daemon connects to learn this; it does not treat a provider that has not connected yet as unsupported.
- On rejection it detaches plugin tools and throws `LaunchWrapUnsupportedError`. A wrap returned for an unsupported provider always rejects; there is no "wrap if possible".

The wrap crosses to the plugin as `ProviderSessionConfig.wrap`, and `requiredProviderCapabilities` adds `session.launch_wrap` for a `session.open` that has one. The two existing capability gates then reject an unsupported wrapped open as a second line: the daemon adapter (`plugin-provider.ts:299`) and the process boundary (`runtime.ts:1490`).

A plugin session can reopen its provider session without running hooks (`plugin-provider.ts:1192-1212`). The reopen reuses the original wrap, because the captured session config carries it.

**Providers in this change**

- `runAcpProvider`, command branch: the adapter advertises `session.launch_wrap` only when `options.command` is set, and `AcpRuntime.start` prepends `config.wrap` to the session's spawn.
- Codex: `prepareAppServerSpawn` takes the wrap from `launchContext` and prepends it. `createSession` and `resumeSession` pass it.
- Every other provider rejects.

**Errors**

- `LaunchWrapUnsupportedError`, `code: "launch_wrap_unsupported"`, with `provider`. It follows `ToolPolicyUnsupportedError` (`provider-options.ts:25`).
- It is a daemon-side typed error. Nothing requires the code to be readable through `paseo.agents`; a plugin learns support from the provider snapshot.

### Protocol compatibility

`ProviderSnapshotEntrySchema` (`packages/protocol/src/messages.ts:420`) and the `ProviderSnapshotEntry` interface (`agent-types.ts:124`) each gain `launchWrap: z.boolean().optional()` / `launchWrap?: boolean`.

- An old app parses a new daemon's snapshot: the schema is a non-strict object, and the generated validator keeps unknown keys.
- A new app or plugin against an old daemon reads `undefined`, which means unsupported. That is the correct answer for an old daemon, so no `server_info.features` flag is needed.
- The field is a pure optional leaf: no transform, default, or narrowing.
- The compact snapshot codec spreads entry fields in both directions (`provider-snapshot-codec.ts:72-80`, `:109-119`), so the field passes through it unchanged.
- The app does not read the field.

### Documented limits

`docs/plugins.md` states these beside the `wrap` contract.

The guarantee: once an open selects a wrapper, a supported provider runs that session's harness through it, or fails before it starts the harness without it.

1. It covers the harness process only. Paseo's host terminal tools (`create_terminal`, `send_terminal_keys`) run outside the wrapper, so the guarantee requires Safehouse daemon access to be Off. With it on, the agent can reach those tools.
2. Work before the open hook is not wrapped: draft command and control discovery (`agent-manager.ts:1349`, `:1390`), and the catalog lookup during create when no model is set (`agent-manager.ts:1607-1617`, through `resolveDefaultModelId` at `:6251-6257`). These are the scope of the follow-up task **launch-wrap-discovery-coverage**.
3. Host-side operations are not wrapped: availability and capability probes, catalog and session listing, version and update commands, usage queries, and Codex native archive and unarchive.
4. Losing the plugin that chose the wrap is not covered: a later open without it runs unwrapped. Task **plugin-required-active** addresses it.

### Mechanisms confirmed against upstream

1. **Hook path.** `buildLaunchContext` builds the request and calls `pluginLifecycle.before("agent.open.before")` (`agent-manager.ts:6341-6378`). `PluginRuntime.before` runs plugins in id order (`localeCompare`, `runtime.ts:760`) and feeds each validated result to the next (`runtime.ts:771-777`). Within a plugin, `PluginHookHandlers.openSession` does the same per handler (`plugins/lifecycle/index.ts:388-417`). `paseo-safehouse` sorts before `zerosub`.
2. **Old hosts fail closed already.** The `agent.open.before` schema is `.strict()` (`plugins/lifecycle/index.ts:102-121`) and validates each result both in the plugin process, which runs host code (`plugin-process.ts:115`), and in the daemon. An old host rejects a result with an unknown `wrap` key and the open fails. This is from reading; the checkout has no `node_modules`, so AC-1 proves it by test.
3. **Manager opens.** Create (`agent-manager.ts:1617`), resume (`:1752`), import (`:1828`) and refresh (`:1937`) each call `buildLaunchContext` before the provider call. Refresh calls it before `closeReloadedSession` (`:1966`) and outside the `try`, so a rejection leaves the running session in place.
4. **`runAcpProvider` command branch.** Each session spawns its own process: `openSession` calls `AcpRuntime.start` with `input.config.env` (`acp-internal/connection.ts:321-335`), and the command branch spawns `launch.command` with `{...launch.env, ...options.env}` (`:486-498`). Two concurrent opens on one connection are independent spawns. Antigravity registers `["agy", "acp", "--disable-telemetry"]` (`plugins/antigravity-provider/server/provider.ts:95`).
5. **Codex.** `prepareAppServerSpawn` (`codex-app-server-agent.ts:8201-8234`) returns a spawn closure. `createSession` (`:8268`) and `resumeSession` (`:8305`) hand it to the session, which uses it for interactive start (`:3996`) and archived history reads (`:4392`). Reconnect reuses the closure. `importSession` delegates to `resumeSession` with the launch context (`:8389`, `provider-session-import.ts:35`). The startup coordinator retries only a SQLite initialization exit, through the same closure (`codex/app-server-startup.ts:100-118`), so a retry is never bare.
6. **Plugin provider capabilities.** `PROVIDER_CAPABILITIES` (`packages/plugin/src/server/provider.ts:6-25`) is the offered list. The connection's selected set is checked at connect (`runtime.ts:1432-1451`) and before each `session.open` (`plugin-provider.ts:298-303`, `runtime.ts:1489-1490`).
7. **Registration metadata reaches the snapshot with no connection.** Registration metadata can carry the declaration. The path today, which `requiresConfiguration` and `command` already take:
   - the plugin process turns each registration into `PluginProviderMetadata` when it initializes (`plugins/plugin-process.ts:267-280`; type at `plugins/plugin-process-protocol.ts:21-31`, sent at `:135`);
   - the daemon rebuilds a registration from that metadata (`plugins/index.ts:771-777`);
   - `plugin-provider.ts:995-1008` turns it into a provider definition, and the registry keeps static contract fields from it (`provider-registry.ts:959-962`);
   - the snapshot manager builds each provider's initial entry from the definition alone, with status `loading` (`provider-snapshot-manager.ts:880-891`), and every later entry spreads that base (`:1068`, `:1080`, `:1091`).

   A command-based plugin provider does not connect for availability either (`plugin-provider.ts:232`). So a fresh daemon's first `agent.create.before` sees `launchWrap: true` for Antigravity once the plugin's server entry has loaded, which is the same precondition as the provider being listed at all. The new field is added at each of the four steps.

### Expected surface

One change, launch wrap. About 215 production lines and 420 test lines, ±30%. No new dependency. The prepend stays inside the ACP shim and Codex; `@getpaseo/plugin/server` exports nothing new.

| File | Change | Lines |
| --- | --- | --- |
| `packages/protocol/src/agent-types.ts`, `messages.ts` | optional `launchWrap` on the provider snapshot entry | 2 |
| `packages/plugin/src/server/lifecycle.ts` | `wrap` on the open request and result | 8 |
| `packages/plugin/src/server/provider.ts` | `ProviderRegistration.launchWrap`, `session.launch_wrap`, `ProviderSessionConfig.wrap`, schema, required capability | 18 |
| `packages/plugin/src/server/acp.ts` | declare `launchWrap` for the command branch | 2 |
| `packages/plugin/src/server/acp-internal/connection.ts` | advertise in the command branch, prepend at spawn | 20 |
| `packages/plugin/src/server/process.ts`, `process-internal/windows-command.ts` | `resolveSpawnInvocation` with an explicit platform, the seam for the Windows launcher test | 20 |
| `packages/server/src/server/plugins/plugin-process-protocol.ts`, `plugin-process.ts`, `index.ts` | carry `launchWrap` in registration metadata | 4 |
| `packages/server/src/server/plugins/lifecycle/index.ts` | schema, selection rule, absolute path | 30 |
| `packages/server/src/server/agent/agent-sdk-types.ts` | `AgentLaunchContext.wrap`, `AgentClient.supportsLaunchWrap`, snapshot entry field | 10 |
| `packages/server/src/server/agent/provider-registry.ts` | contract field, definition field, stamp on the client | 12 |
| `packages/server/src/server/agent/provider-snapshot-manager.ts` | copy the field into the initial entry | 1 |
| `packages/server/src/server/agent/agent-manager.ts` | admission, detach on failure | 30 |
| `packages/server/src/server/agent/plugin-provider.ts` | definition field, live capability check, map the wrap into the session config | 20 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.ts` | prepend in `prepareAppServerSpawn` | 12 |
| `packages/server/src/server/agent/provider-options.ts` | `LaunchWrapUnsupportedError` | 14 |
| `docs/plugins.md` | the `wrap` contract, the provider property and the limits, in the section that owns `agent.open.before` | 28 |

Platforms: daemon, plus one optional field in `packages/protocol`. The Plugin SDK types change. The app, CLI, relay and desktop need no change.

## Acceptance criteria

**AC-1. Support is a provider property a create hook can read, on a cold daemon too; an old host fails closed.**
The provider snapshot reports `launchWrap: true` for Codex, a provider derived from Codex, and a command-based `runAcpProvider` provider, and no `launchWrap` for a connector-based one and for every other core provider. A plugin provider reports it before its first connection. On a host without this change, an `agent.open.before` result that has `wrap` fails the open.
Verified by:
- `packages/server/src/server/plugins/agent-configuration.e2e.test.ts`: on a fresh daemon, a plugin registers `runAcpProvider({ command })` with a `connect` spy, and an `agent.create.before` hook calls `paseo.providers.snapshot()`. The test creates an agent and asserts the hook saw `launchWrap === true` for that provider while the spy had zero calls. It fails if support comes from connection negotiation.
- `packages/server/src/server/plugins/index.posix.test.ts`: `launchWrap` in registration metadata survives to the provider definition; a connector registration has none.
- `packages/server/src/server/agent/provider-snapshot-manager.test.ts` and `packages/server/src/server/agent/provider-registry.test.ts`: the `loading` entry already has the value; Codex and a provider that extends Codex are true; Claude is absent.
- `packages/protocol/src/messages.providers-snapshot.test.ts`: an entry parses with `launchWrap` and without it.
- `packages/server/src/server/plugins/lifecycle/handlers.test.ts`: the test where a hook returns `wrap` is written first and run against unmodified upstream main, where it must fail with an unrecognized-key error; that run is recorded in the implementation report. A second test returns a result with an unknown key and expects rejection, which fails if the schema ever loses `.strict()`.

**AC-2. A command-based ACP session spawns `[...wrap, command, ...args]` with the merged env.**
Verified by: `packages/plugin/src/server/acp.test.ts` registers `runAcpProvider({ command })` with a fixture launcher that records its argv as JSON and its env, then runs the rest.
- One test asserts the recorded argv equals `[...wrap args, command, ...command args]` and that a variable set through `config.env` is present. It fails if the wrap is dropped or the env is not the session's.
- One test configures a command argument that contains spaces and a wrap argument that contains spaces, and asserts each arrives as a single argv element. It fails if any layer joins or re-splits the argv.
- One test opens two sessions on one connection, one with a wrap and one without, and asserts the launcher ran exactly once and the other session spawned the bare command.
- `plugins/antigravity-provider/server/provider.test.ts` asserts the wrapped argv ends with `agy acp --disable-telemetry`.

**AC-3. One wrap per open, across handlers and across plugins.**
Verified by: `packages/server/src/server/plugins/lifecycle/handlers.test.ts` for two handlers in one plugin, and `packages/server/src/server/plugins/runtime.posix.test.ts` for two plugins whose ids sort like `paseo-safehouse` and `zerosub`. Each has three cases: the later hook omits `wrap` and the merged result still has it; the later hook returns the same value and the open passes; the later hook returns a different value and the open rejects. The first case fails if a later result replaces the request wholesale.

**AC-4. History opens are wrapped.**
Verified by: `packages/server/src/server/agent/providers/codex-app-server-agent.test.ts` drives `resumeSession` with a wrap through the `appServerProcess` test port and asserts the spawn input is `command: wrap[0]`, `args: [...wrap.slice(1), codex command, ..., "app-server"]` for purpose `interactive` and for purpose `history`, where the history case reads an archived thread. `handlers.test.ts` asserts a `history` open keeps `wrap` while tools and MCP servers are stripped. These fail if the history path builds its own spawn or the stripping deletes `wrap`.

**AC-5. An unsupported provider rejects before any spawn, and a missing launcher is never retried bare.**
Verified by:
- `packages/server/src/server/agent/agent-manager.test.ts`: with a client that does not opt in and a hook that returns `wrap`, create, resume, import and refresh each reject with `code === "launch_wrap_unsupported"`; the client's `createSession`, `resumeSession` and `importSession` are never called; plugin tools are detached; on refresh the existing session is not closed. The persisted record has no `wrap`.
- Windows script launchers are not rejected. On `win32`, a `.cmd` wrap resolves to the `cmd.exe` path of `spawnProcess` with quoted arguments (`packages/plugin/src/server/process.test.ts`). A wrapped refresh of a Codex client whose provider command is a `.cmd` starts a new session through the real `spawnProcess` (`agent-manager.test.ts`).
- `packages/server/src/server/agent/plugin-provider.test.ts`: a registration that declares `launchWrap` but whose connection lacks `session.launch_wrap` rejects a wrapped open and receives no `session.open`; a session reopen sends the original wrap.
- `acp.test.ts`: a `runAcpProvider({ connector })` connection does not list the capability.
- `acp.test.ts` and `packages/server/src/server/agent/providers/codex-app-server-agent.spawn-error.test.ts`: with a wrap whose executable does not exist, the open rejects, the spawn count is one, and no spawn uses the bare provider command.

## References

The contract was agreed between the spacedock-v1 first officer (`846d9a2c`) and the paseo-safehouse manager (`7d469e54`). Its source documents live in the paseo-safehouse project and are not readable from this project:
- the proposal, `docs/dev/.spacedock-state/_handoff/paseo-launch-wrap-proposal.md`;
- the GPT-6.2-Astra review, `.local/launch-wrap-proposal/review-astra.md`.

If copies arrive, they go in `.spacedock/repo/handoff/launch-wrap/`. The contract was anchored to upstream main `0c02cfd`. Ideation works against current upstream main.

A copy of the binding parts of the contract, with its first-PR acceptance checks and documented limits, is in `.spacedock/repo/handoff/launch-wrap/README.md`. The ideation gate replaced its request flag with the provider-level property described above.

## Test plan

Run each file alone, from its package, with `npx vitest run <file> --bail=1`. Do not run a workspace suite.

| File | Covers |
| --- | --- |
| `packages/protocol/src/messages.providers-snapshot.test.ts` | AC-1 |
| `packages/server/src/server/plugins/agent-configuration.e2e.test.ts` | AC-1 (cold daemon) |
| `packages/server/src/server/plugins/index.posix.test.ts` | AC-1 |
| `packages/server/src/server/agent/provider-snapshot-manager.test.ts` | AC-1 |
| `packages/server/src/server/agent/provider-registry.test.ts` | AC-1 |
| `packages/server/src/server/plugins/lifecycle/handlers.test.ts` | AC-1, AC-3, AC-4 |
| `packages/server/src/server/plugins/runtime.posix.test.ts` | AC-3 |
| `packages/plugin/src/server/acp.test.ts` | AC-2, AC-5 |
| `packages/plugin/src/server/provider.test.ts` | `session.launch_wrap` is required for a `session.open` with a wrap |
| `plugins/antigravity-provider/server/provider.test.ts` | AC-2 |
| `packages/server/src/server/agent/agent-manager.test.ts` | AC-5; a wrapped refresh with a Windows script provider command spawns through the real `spawnProcess` |
| `packages/server/src/server/agent/plugin-provider.test.ts` | AC-5 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.test.ts` | AC-4 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.spawn-error.test.ts` | AC-5 |
| `packages/plugin/src/server/process.test.ts` | a Windows script wrapper resolves to cmd.exe with each argument quoted, through an injected platform |
| `packages/plugin/src/boundaries.test.ts` | the `@getpaseo/plugin/server` surface is unchanged |

Order of work: write the AC-1 strict-schema test first and run it on unmodified upstream main to record the old-host failure. Then the provider property through to the snapshot, the hook schema and selection rule, the manager admission, the ACP branch, and Codex.

After each change run `npm run typecheck` and `npm run lint`. Run `npm run build:client` after the protocol change and `npm run build:server` when a server typecheck reports a stale `@getpaseo/plugin` declaration. Run `npm run format` before each commit. The full suites run in CI on the pull request.

Tests use fixture launcher scripts run as Node through `process.execPath`, and the existing Codex `appServerProcess` port. They need no real provider CLI and no sandbox tool, and use no `vi.mock` or patched `process.platform`.

### Feedback Cycles

- Cycle 1: revise — ideation gate, CL, after consensus with the paseo-safehouse manager. The launch-wrap support signal moves from `request.launchWrap` to a provider-level property visible at create time (provider list through the plugin API); AC-2 adds an argument containing spaces; follow-up scope names draft discovery and the create-time catalog lookup; documented limits record daemon access Off and the Windows rejection; reference `.spacedock/repo/handoff/launch-wrap/README.md`. Surface may grow by one optional provider-snapshot field in `packages/protocol`.
- Validation cycle 1: revise — CL, at 2dc585c14. Material: the Windows command-script rejection in applyLaunchWrap fails after refresh has closed the session; remove it and rely on spawnProcess, which already handles .cmd/.bat through cmd.exe. Polish: docs/plugins.md:485 wording, public hook reference, lifecycle diagnostic list. Deferred: full typecheck in CI; activity sampled before async hooks. Test-size overrun accepted. The round recorder was not run: no review-room briefing or log exists.
- Delivery rework (after validation cycle 2 approval): CL, from the Gemini 4 Neon code review (`.spacedock/repo/reviews/launch-wrap-hook-neon.md`). The PR splits: `requiresPlugins` moves to task `plugin-required-active` (branch `task/plugin-required-active` keeps 2dc585c14); this task drops commit 2 and AC-6 is removed. Material fixes for the wrap: no public `applyLaunchWrap` export (SDK boundary test), wrap tests spawn Node through `process.execPath` instead of shebang scripts, simulated-win32 tests without `vi.mock` or patched `process.platform`. Polish: empty wrap executable, fit issues, fixture duplication, doc gaps.
- Validation cycle 3: revise — CL, at 30a6f4e6c. Behavior correct; fix the AC-2 Antigravity assertion to use the registration's command, make the AC-5 ACP missing-launcher test count spawn attempts, and remove the daemon-access sentence at docs/plugins.md:497.

## Out of scope

- Wrapping for providers other than ACP command-based and Codex. Each gets its own follow-up pull request.
- The `runAcpProvider` connector branch.
- Draft command and control discovery and the create-time catalog lookup. They belong to the follow-up task launch-wrap-discovery-coverage.
- `requiresPlugins`, which moved to task plugin-required-active.
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

## Stage Report: ideation (cycle 2)

- DONE: Move the support signal.
  `request.launchWrap` is gone. Support is static per provider: the registry contract table for core providers, `ProviderRegistration.launchWrap` for plugin providers, published as optional `launchWrap` on the provider snapshot entry. "Protocol compatibility" states the back-compat case, the surface table lists `packages/protocol`, and AC-1 is rewritten around the property with the strict-schema test kept. Open-time admission is unchanged.
- DONE: AC-2: add a configured argument that contains spaces, wrapped correctly.
  AC-2 has a test with a spaced command argument and a spaced wrap argument, each asserted as one argv element.
- DONE: Documented limits.
  New "Documented limits" section: harness only with Safehouse daemon access Off, Windows shell-needing prefixes rejected (also an admission rule and an AC-5 case), and discovery plus the create-time catalog lookup assigned to the follow-up launch-wrap-discovery-coverage.
- DONE: Record the answers.
  Folded into the design: the daemon connects to learn live support, a reopen reuses the original wrap, no RPC requirement for the error code, a wrap for an unsupported provider rejects, the requirement is the plugin's own id with no release. The "Questions for CL" section is removed.
- DONE: Reference .spacedock/repo/handoff/launch-wrap/README.md.
  Cited under References.
- DONE: Cold-daemon visibility.
  Confirmed by reading: registration metadata reaches the snapshot's initial `loading` entry with no connection (mechanism 7: `plugin-process.ts:267-280`, `plugins/index.ts:771-777`, `plugin-provider.ts:995-1008`, `provider-snapshot-manager.ts:880-891`). AC-1 creates through a never-connected provider and asserts `launchWrap === true` with zero `connect` calls.
- DONE: requiresPlugins as an array.
  `requiresPlugins?: string[]`: a plugin appends only its own id, merges union, any inactive plugin blocks the open. AC-6 and the commit 2 table are updated.

### Summary

Support moved from the open request to a provider property, which a command-based plugin provider can declare with no connection because registration metadata already feeds the snapshot. One interpretation to check: with the request flag gone, nothing needs a connection before the hooks, so the live capability check connects during admission, after the hooks and only for a wrapped open. As before, nothing was executed; the checkout has no `node_modules`.

## Stage Report: implementation

- DONE: In .worktrees/launch-wrap-hook on branch task/launch-wrap-hook created from upstream/main 2445adec, land commit 1 (launch wrap) and commit 2 (requiresPlugins) as designed; AC-1 to AC-6 pass, each Verified by test run one file at a time with --bail=1, with AC-1's old-host test first run and recorded failing on unmodified upstream main.
  Commit 1 `14238df28`, commit 2 `2dc585c14`, head `2dc585c14`. Old host: on unmodified 2445adec, `handlers.test.ts` "a session-open hook can select a launch wrap" failed with `ZodError unrecognized_keys ["wrap"]` at `lifecycle/index.ts:402`. The unknown-key test passed. All 17 named files then passed in full, one at a time (e.g. agent-manager 322, codex-app-server-agent 235, plugin-provider 114, acp 97, runtime.posix 77).
  - AC-1: cold-daemon e2e. The plugin's `connect` always throws, the create hook still sees `launchWrap: true` with 0 connects, and it sees `null` once the snapshot-manager line is removed (falsified). Registry: Codex and `my-codex` true, every other core provider false. Metadata reaches the definition: command true, connector absent.
  - AC-2: a recording launcher gets argv `[log, tag, node, agent, "--profile name with spaces"]` with each element whole. Two opens on one connection: the launcher ran once and the other session's agent logs `new:bare`. Antigravity: `[record, agy, acp, --disable-telemetry]` with the hook env. Dropping `wrap` from `openSession` fails 4 of 5 (falsified).
  - AC-3: handlers and two plugins (started as zerosub then paseo-safehouse, run by id order), each tested with an omitted, a same and a different wrap.
  - AC-4: Codex `resumeSession` with purpose interactive and history spawns `/opt/sandbox/bin/run --profile "a b" /opt/codex/bin/codex --profile x app-server`. A history open keeps `wrap` while tools, MCP servers and the prompt are stripped.
  - AC-5: create, resume, import and refresh each reject with `launch_wrap_unsupported` and make no client call. Refresh does not close the existing session, attached tools are removed (removing the detach fails it), and the record has no wrap. A win32 `.cmd` wrap is rejected. Declared but no `session.launch_wrap` gives no `session.open`; a connector does not offer it; a rewind reopen resends the wrap. A missing launcher fails with ENOENT: one ACP spawn, and Codex spawned only `[launcher…]`.
  - AC-6: merged `["paseo-safehouse","zerosub"]`; adding another plugin's ID fails; removing one fails. With either plugin inactive, resume and refresh reject `required_plugin_inactive` with that plugin's ID and make no client call. Storage round-trips the list and loads a record without it.
- FAILED: npm run typecheck, npm run lint and npm run format pass; the actual diff per commit (production vs test lines) is reported against the estimate (about 215+420 and 105+190, ±30%), and packages/protocol changes are limited to the optional launchWrap snapshot field.
  Lint and format pass. The root `npm run typecheck` fails, only in app, website, desktop and plugin-examples. Their deps are not installed: a full `npm ci --ignore-scripts=false` hit ENOSPC in Skia's Android libs (free space went from 5.8 GiB to 0) and npm rolled back. I then installed only highlight, plugin, protocol, client, server, relay, cli and plugins (1.4 GB). Those workspaces typecheck clean, so both commits used `LEFTHOOK_EXCLUDE=typecheck`; CI must run the full typecheck. Diff: commit 1 is 154 production + 36 docs (≈190 vs 215, in range) and 932 test (vs 420, +122%, out of range: fixture launcher and agent scripts plus a four-path manager test). Commit 2 is 96 + 14 docs (≈110 vs 105) and 143 test (vs 190, −25%). `packages/protocol` changes only the optional `launchWrap` field (schema + interface).
- DONE: Report the branch head and both commit SHAs; do not push, open no pull request, and note anything in the design that the code contradicted.
  Head `2dc585c14`; nothing pushed, no PR. Design notes:
  1. Windows: the provider command is not known at manager admission, so `buildLaunchContext` checks only `wrap[0]`. A command-script provider command is rejected at the spawn site by the shared `applyLaunchWrap`, before any spawn.
  2. The live check for a plugin provider connects. For `runAcpProvider` that runs the connection's unwrapped initialize probe; docs limit 3 covers it.
  3. `PluginLifecycle.isPluginActive` is optional and a missing one counts as inactive (fail closed), so existing test lifecycles compile unchanged.
  4. `public-docs/plugins/hooks.md` (the public hook reference) is not updated; the design named only `docs/plugins.md`.
  5. The repo's `typecheck:examples` script ran `npm --prefix plugin-examples/markdown-panel install` (4.8 MB, git-ignored).

### Summary

Both commits landed on `task/launch-wrap-hook` from 2445adec. Codex and command-based `runAcpProvider` sessions spawn `[...wrap, command, ...args]`. Support is published as an optional `launchWrap` snapshot field before the provider first connects. Every wrapped open on an unsupported provider is rejected before a spawn. `requiresPlugins` blocks opens while a listed plugin is inactive. Each AC was proven by tests and the key ones were falsified by mutation. The open item is the root typecheck: it could not run locally because the full install does not fit on this Mac's disk (1.9 GiB free now), so CI has to run it.

## Stage Report: validation

- DONE: Independently reproduce each AC-1 to AC-6 Verified by clause and make one reversible deliberate break per criterion.
  On `2dc585c14`, 40 selected tests passed in 15 files. Each of six independent scratch mutations failed its selected test with exit 1. All edits were restored byte-for-byte.
- DONE: Check the diff against the approved design and the launch-wrap handoff contract and classify departures.
  One material Windows refresh regression is described below. The stage tested the provider-level capability approved at the ideation gate.
- DONE: Report the typecheck, test-size and public hook reference gaps for CL and recommend PASSED or REJECTED.
  **REJECTED.** A supported provider with a Windows command-script launch can close a running session before telling the caller that refresh is unsupported.

### Acceptance evidence

1. **AC-1.** The create hook saw `launchWrap: true` with zero connections. Command registration published the field, the connector omitted it, Codex and its derived provider advertised it while loading, and the schema accepted both shapes. Removing the loading-entry field failed on Codex. Running the head selection test against server source archived from `2445adecd` with the existing dependencies failed at `lifecycle/index.ts:402` with `unrecognized_keys ["wrap"]`. The unknown-key rejection passed on head.
2. **AC-2.** The ACP fixture recorded argv elements containing spaces intact and the session token. Two opens shared a connection, with one launcher invocation and one bare session. Antigravity received the env and the suffix `agy acp --disable-telemetry`. Removing the session env from ACP spawn yielded `token: null` where `"one"` was expected.
3. **AC-3.** Both handler and cross-plugin tests retained an omitted wrap, accepted an equal wrap and rejected a different one. Using reference equality rejected the second handler’s equal argv.
4. **AC-4.** Both Codex resume purposes used the captured launcher and exact argv. Archived history retained the wrap while dropping tools, MCP servers and prompt additions. Appending an extra wrapper argument to resume failed the history argv assertion.
5. **AC-5.** Unsupported create, resume, import and refresh returned the typed error with no provider call. Refresh preserved the session, tools detached, and the supported open left the record free of its wrapper. Live capability denial sent zero session opens, connector support was absent, and rewind reused the prefix. Both missing launchers failed. The committed ACP test counts successful starts only. An independent ACP spawn trace counted one bare initialization probe followed by exactly one failed wrapped session attempt, both with `shell: false`. Codex recorded one wrapped attempt. Changing the admission error code failed the manager assertion. The separate Windows provider-command case below failed on unmodified production code.
6. **AC-6.** Two plugins added their own IDs. Foreign additions and removals failed. Either inactive ID blocked resume and refresh before provider calls. Storage retained both IDs and accepted a legacy record. Including the active plugin in the inactive error added an unexpected `zerosub` and failed the manager assertion.

Each row ran from the file’s package directory as `npx --no-install vitest run <package-relative file> --bail=1 -t '<filter>'`, with inherited `PASEO_*` variables cleared. The cold-daemon fixture used a temporary home and an ephemeral port.

| File | Test name filter | Passed |
| --- | --- | ---: |
| `packages/server/src/server/plugins/agent-configuration.e2e.test.ts` | `create hook reads launch-wrap` | 1 |
| `packages/server/src/server/plugins/index.posix.test.ts` | `launch-wrap declaration` | 1 |
| `packages/server/src/server/agent/provider-snapshot-manager.test.ts` | `loading entries already report launch-wrap` | 1 |
| `packages/server/src/server/agent/provider-registry.test.ts` | `launch-wrap support comes` | 1 |
| `packages/protocol/src/messages.providers-snapshot.test.ts` | `launch-wrap support` | 1 |
| `packages/server/src/server/plugins/lifecycle/handlers.test.ts` | `wrap\|unknown key\|omits requiresPlugins` | 8 |
| `packages/server/src/server/plugins/runtime.posix.test.ts` | `open-hook launch wrap across plugins\|create-hook plugin requirements across plugins` | 7 |
| `packages/plugin/src/server/acp.test.ts` | `runAcpProvider launch wrap` | 5 |
| `packages/plugin/src/server/provider.test.ts` | `Provider launch wrap` | 2 |
| `plugins/antigravity-provider/server/provider.test.ts` | `runs a wrapped session` | 1 |
| `packages/server/src/server/agent/agent-manager.test.ts` | `wrapped open rejects\|receives the wrap\|Windows command-script wrap\|every plugin it requires` | 4 |
| `packages/server/src/server/agent/plugin-provider.test.ts` | `declared launch wrap\|declares no launch wrap\|reopen sends the wrap\|neither declares nor offers launch wrap` | 4 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.test.ts` | `spawns a wrapped` | 2 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.spawn-error.test.ts` | `missing launch wrap` | 1 |
| `packages/server/src/server/agent/agent-storage.test.ts` | `required plugins are persisted` | 1 |

### Findings

1. **Material.** On simulated `win32`, a native wrapper and Codex prefix `fixture.cmd` yielded `closed: true, code: null, spawns: 0`. The scratch check exercised `reloadAgentSession` with a close-recording current session and the real Codex open implementation behind a fixture process port. Manager admission checks the wrapper extension only, then closes the session at `agent-manager.ts:1987`. Codex first checks the provider command at `codex-app-server-agent.ts:8218`, where `applyLaunchWrap` throws a plain Error. Move the provider-command check into admission and cover the refresh outcome for both script positions. The existing Windows test covers the wrapper position.
2. **Deferred risk.** The full typecheck remains unverified for app, desktop, website and plugin examples. Implementation recorded the failed attempt. Validation reused the installed dependencies and skipped the root script because its plugin-examples step runs an install.
3. **Deferred risk.** The ACP negotiation probe starts a process before admission finishes. The handoff explicitly exempts capability probes. Reserve the “before anything starts” wording in `docs/plugins.md:485` for session harnesses. The optional activity query defaults to inactive, consistent with the approved fail-closed rule.
4. **Deferred risk.** Activity is sampled before asynchronous open hooks. A hook registration change during that interval marks the session stale for a later prompt. The AC-6 tests establish behavior for plugins inactive at entry and do not cover in-flight deregistration.
5. **Polish.** `git diff --numstat 2445adecd 14238df28` gives 935 test lines added and 3 removed, net 932 versus about 420 (+122%). The fixture scripts and manager path coverage account for much of the increase. Commit two added 143 net test lines versus about 190, within tolerance.
6. **Polish.** `public-docs/plugins/hooks.md:59` and its open-hook reference omit `requiresPlugins` and `wrap`. The immutable-target diagnostic in `plugins/lifecycle/index.ts:291` also omits `wrap` from its list of mutable fields.

### Summary

Return the Windows provider-command check to implementation so an unsupported refresh preserves the running session and returns `launch_wrap_unsupported`. The task worktree was clean at `2dc585c14` after validation.

## Stage Report: implementation (cycle 2)

- DONE: Apply the authorized fix in the feedback context: remove the Windows command-script check from applyLaunchWrap, add the two simulated-win32 tests, and make the three doc changes; run each changed or added test file on its own with --bail=1, plus lint and format.
  - Code: `applyLaunchWrap` no longer rejects `.cmd`/`.bat`. I also removed the manager's own win32 `.cmd` admission check in `requireLaunchWrap`, because it contradicts the new contract. This drops AC-5's clause "with the platform set to win32 and a command-script wrap, a supporting client rejects", and its test goes with it; CL should confirm.
  - Tests, simulated win32:
    1. `process.test.ts`: a `.cmd` wrapper runs through `spawnProcess` with `shell: true`, the command is quoted, and `"work profile"` stays one quoted element. A delegating spawn spy keeps the two real-spawn tests real.
    2. `agent-manager.test.ts`: a wrapped refresh of a real `CodexAppServerAgentClient` whose command is `C:\codex\codex.cmd` spawns `C:\Sandbox\run.cmd --profile "work profile" C:\codex\codex.cmd app-server` and does not error. Against the stale plugin dist it failed with "A launch wrap cannot start C:\Sandbox\run.cmd" (falsified).
  - Docs: the wrap contract in `docs/plugins.md` now reads "no shell, except Windows script launchers, which go through cmd.exe like any provider launcher". Fail closed now reads "before any session harness starts". `public-docs/plugins/hooks.md` gains `wrap` and `requiresPlugins` in the hook table, in the create and open sections, and in two new subsections. Per `docs/website-i18n.md` the same change went into `hooks.zh-CN.md`; headings match in count, level, order and anchor (34/34, checked by script, since `content-translations.test.ts` cannot load without website deps). The open-hook diagnostic now lists `wrap`.
  - Runs: `process.test.ts` 3/3, `handlers.test.ts` 38/38, `agent-manager.test.ts` 322/322. Plugin and server typecheck clean; lint and format pass.
- DONE: Commit on task/launch-wrap-hook in .worktrees/launch-wrap-hook (a new commit on top of 2dc585c14, no history rewrite) and report the new head; do not push.
  New head `e3fd597ff` (parent `2dc585c14`), committed with `LEFTHOOK_EXCLUDE=typecheck` as before; nothing pushed.

### Summary

The Windows script-launcher rejection is gone from both `applyLaunchWrap` and the manager's admission, so a `.cmd` wrapper or provider command starts through `spawnProcess`'s cmd.exe path and a wrapped refresh no longer fails after closing the session. Both behaviors are proven on simulated win32. The public hook reference and its Chinese translation now document `wrap` and `requiresPlugins`. Removing the manager check changes an AC-5 clause, which is flagged for CL.

## Stage Report: validation (cycle 2)

- DONE: Check the simulated Windows refresh and script-wrapper spawn at `e3fd597ff`. Make and revert one deliberate break per new test.
  1. A wrapped Codex refresh with a `.cmd` provider command completed and issued the expected replacement spawn through `C:\Sandbox\run.cmd`. Temporarily reinstating provider-command rejection in Codex spawn preparation made that test exit 1 with `validator: rejected provider command script`. A separate check of the original cycle-1 combination, an `.exe` wrapper around `codex.cmd`, observed exactly one replacement spawn and a new session registered as `idle` on the same agent.
  2. The process test recorded exactly one Node spawn with `shell: true`, the quoted `.cmd` launcher path, and `"work profile"` as one quoted argument. Forcing script launchers to select `shell: false` made it exit 1 with `expected false to be true`. Both production edits and the temporary test variant were restored byte-for-byte. These are simulated Windows observations at the spawn boundary.
- DONE: Re-run the AC-1 to AC-6 files individually with `--bail=1` using the worktree’s installed dependencies.
  All 15 acceptance-plan files plus `process.test.ts` exited 0. The 16 complete-file runs had 1,129 passing tests and four conditional skips. The skips are controls-only cases under the settings variant of `plugin-provider.test.ts`.
- DONE: Check `docs/plugins.md`, both public hook references, and the lifecycle diagnostic.
  The internal guide scopes admission to session harnesses and describes the Windows script-launcher exception. The English and zh-CN hook tables, sections and examples document launch-only `wrap` and persistent, own-ID `requiresPlugins`. All 34 headings match in level, order and anchor. Both new links resolve in each locale and the two example snippets match. The handler tests exercised the immutable-field diagnostic listing `wrap`.
- DONE: Record the cycle-2 recommendation and the effect of dropping the former AC-5 clause.
  **PASSED.** Removing the manager’s extension check lets a supported provider use the Windows script launcher as CL directed. No other acceptance criterion depended on that check. The independent static support and live capability checks still reject before session dispatch. Existing tests also confirm that an unsupported refresh preserves its current session, a missing launcher never retries bare, and an inactive required plugin blocks opening.

### Test results

From each package directory, the command was `<worktree>/node_modules/.bin/vitest run <file> --bail=1` with inherited `PASEO_*` variables cleared and an isolated test home. Each file below ran separately, without a name filter. The two mutation runs selected the individual Windows tests with `-t`.

| Package and directory | Files and passing test counts |
| --- | --- |
| `packages/protocol/src` | `messages.providers-snapshot.test.ts` 8 |
| `packages/server/src/server/plugins` | `agent-configuration.e2e.test.ts` 3, `index.posix.test.ts` 39, `lifecycle/handlers.test.ts` 38, `runtime.posix.test.ts` 77 |
| `packages/plugin/src/server` | `acp.test.ts` 97, `provider.test.ts` 8, `process.test.ts` 3 |
| `plugins/antigravity-provider/server` | `provider.test.ts` 10 |
| `packages/server/src/server/agent` | `provider-snapshot-manager.test.ts` 98, `provider-registry.test.ts` 53, `agent-manager.test.ts` 322, `plugin-provider.test.ts` 114, `agent-storage.test.ts` 20 |
| `packages/server/src/server/agent/providers` | `codex-app-server-agent.test.ts` 235, `codex-app-server-agent.spawn-error.test.ts` 4 |

### Summary

The cycle-1 Windows refresh regression is resolved at `e3fd597ff`. The task worktree is clean at that commit. Native Windows execution was outside the simulated checks, and the full repository typecheck remains deferred to CI.

## Stage Report: implementation (cycle 3)

- DONE: task/launch-wrap-hook carries only launch wrap (with the Windows launcher handling) on 2445adec: no requiresPlugins code, tests or docs; task/plugin-required-active is untouched.
  Rebuilt with `git rebase --onto 14238df28 2dc585c14`. The one conflict, in `agent-manager.test.ts`, dropped the old win32 rejection test, the requiresPlugins test and the monkey-patched refresh test. The replayed Windows commit also dropped the requiresPlugins sections from `hooks.md` and its zh-CN pair, with the message reworded. Head `30a6f4e6c`: `14238df28` launch wrap, `a503685dc` Windows launchers (was e3fd597ff), `30a6f4e6c` review fixes. `git diff 2445adec` adds no `requiresPlugins`, `isPluginActive`, `applyLaunchWrap`, `vi.mock`, `chmod` or `#!`, and `docs/data-model.md` matches upstream. `task/plugin-required-active` is still `2dc585c14`; nothing pushed.
- DONE: Review findings 2, 3, 4, 9, 11, 12 and 13 are fixed; boundaries.test.ts passes unchanged; every changed test file passes on its own with --bail=1; lint, format and the protocol/plugin/server/CLI typecheck pass.
  - 2: the prepend is inlined in `acp-internal/connection.ts` and `prepareAppServerSpawn`; `@getpaseo/plugin/server` `index.ts` matches upstream, and `boundaries.test.ts` passes 106/106 unchanged.
  - 3: the ACP and Antigravity wrap fixtures run as `[process.execPath, script, …]`, with no shebang or chmod. Antigravity reuses `launchAgent`, and the recorded argv ends `acp --disable-telemetry`.
  - 4: `spawnProcess` and `execCommand` share an internal `resolveSpawnInvocation(command, args, shell, platform)`, and the Windows quoting helpers take a platform with a `process.platform` default. Behavior is unchanged: windows-command 15/15 and the spawn regression tests pass.
    - `process.test.ts` asserts that a `.cmd` wrapper with `"work profile"` resolves to `shell: true`, a quoted command and one quoted argument on `win32`, and to a direct exec on linux.
    - `agent-manager.test.ts` refreshes a real `CodexAppServerAgentClient` whose provider command is `C:\codex\codex.cmd`, through the production `spawnProcess`. The wrap `[process.execPath, recording-app-server.cjs, log]` records each launch and then answers as the app server. Create and refresh each record `["C:\codex\codex.cmd", "app-server", …]`, and the agent is not in error. No mocks, no patched globals.
  - 9: `sessionConfigSchema.wrap` requires a non-empty executable; handlers covers the empty and relative cases.
  - 11: `wrapClientProvider` sets `supportsLaunchWrap` in its returned literal, and `PluginAgentClient` sets it from the registration (tested).
  - 12: the duplicate connector test in `plugin-provider.test.ts` is gone (the case stays in `acp.test.ts`); handlers uses an `invokeOpen` helper and `test.each`.
  - 13: the summaries in `docs/plugins.md`, `hooks.md` and `hooks.zh-CN.md` name the launch wrap, and "Contribute a provider" points to `ProviderRegistration.launchWrap`. The other two doc gaps were in requiresPlugins text, which has gone. The hook-doc pair has 33/33 matching headings.
  - Runs, one file at a time with `--bail=1`, all green across 19 files, e.g. boundaries 106, acp 97, handlers 38, agent-manager 321, codex 235, plugin-provider 113. Lint and format pass.
  - Typecheck: protocol, server and cli pass with `npm run typecheck`; the plugin package passes with `tsgo --noEmit`, because its npm script runs `npm install` for the examples; plugins passes too.
  - Branch diff against 2445adec: production 164, docs 77, test 953 net lines.
- DONE: The entity's approach, surface and test plan no longer mention requiresPlugins, AC-6 is removed, and the report gives the new head and commits; nothing is pushed.
  The design, errors, documented limits, mechanism 2, the single-change surface table, the test plan and out-of-scope are rewritten, and AC-6 is deleted. The Windows passages now state the approved cmd.exe behavior. Two stale AC-5 phrases need CL to change them:
  1. "With the platform set to win32 and a command-script wrap, a supporting client rejects the same way" contradicts the approved cycle-2 behavior.
  2. AC-5 places the connector check in `plugin-provider.test.ts`; it now lives in `acp.test.ts`.

### Summary

The branch now holds only the launch wrap: the original commit, the Windows launcher fix with its requiresPlugins material removed, and one review-fix commit. The wrap prepend no longer widens the SDK surface. Windows launcher behavior is tested through an injected platform and a refresh that uses the real spawn path, with Node fixtures that also run on Windows. AC-5 still carries two stale phrases (the win32 rejection and where the connector check lives) that only CL can change.

## Stage Report: validation (cycle 3)

- DONE: Independently reproduce AC-1 to AC-5 on `task/launch-wrap-hook` at `30a6f4e6c`.
  On macOS, each file used `npx --no-install vitest run <package-relative file> --bail=1` from its package. The 16 files in the test plan reported 1,209 passed and four skipped in `plugin-provider.test.ts`. The focused reruns below add `-t '<test name>'`. Every command started with inherited `PASEO_*` variables cleared.
- DONE: AC-1. A create hook can read provider support before the first connection, and the old host rejects a wrap.
  `messages.providers-snapshot` (8), `provider-registry` (53), `provider-snapshot-manager` (98), `index.posix` (39), and `agent-configuration.e2e` (3) passed. The schema accepted both field shapes. Registration distinguished command and connector providers. Loading Codex and derived Codex advertised support, Claude omitted it, and the create hook saw true with zero connects.
  Removing the field from loading entries failed both the snapshot test and the real create hook (`launchWrap: null, connects: 0`). Changing the open schema from strict to stripping caused the unknown-key test in `handlers.test.ts` to resolve. All three tests passed after restoration. Running the head test `a session-open hook can select a launch wrap` against the archived server plugin sources at `2445adec` failed at `lifecycle/index.ts:402` with `unrecognized_keys ["wrap"]`.
- FAILED: AC-2. The Antigravity regression test does not verify the provider's configured command.
  `acp.test.ts` (97) exercised the merged env, spaced arguments and two sessions sharing one connection. Splitting command arguments on spaces failed the argv test (eight elements received, five expected). Restored, it passed.
  `plugins/antigravity-provider/server/provider.test.ts` supplies its own launch including `--disable-telemetry`. Removing that flag from the production registration still passed the entire file (10/10). A temporary test opened the same provider without a launch override, using a Node fixture named `agy` on PATH. It recorded exactly `agy acp --disable-telemetry` at head and failed when the production flag was removed. Use the registration's command in the permanent assertion.
- DONE: AC-3. One wrap per open, within a plugin and across plugins.
  `handlers.test.ts` (38) and `runtime.posix.test.ts` (73) passed omission, equality and conflict cases. Selecting only the later result dropped the first wrap and failed the omission test in each file. Both passed after restoration.
- DONE: AC-4. Interactive and archived history resumes use the wrap.
  `codex-app-server-agent.test.ts` (235) checked the complete spawn argv for both purposes. Dropping the wrap only for history produced the Codex command at argv[0] and failed the history assertion. The restored test passed. The history hook test also kept the wrap while removing tools and MCP servers.
- FAILED: AC-5. The ACP missing-launcher test does not assert the number of failed launch attempts.
  `agent-manager.test.ts` (321) covered create, resume, import and refresh rejection, untouched provider calls, tool detachment, the live session and the stored record. Omitting cleanup on admission failure failed the four-path test. Restoring it passed. `plugin-provider.test.ts` (113 passed, four skipped) checked live capability rejection before session.open and reuse of the original wrap on reopen. SDK `provider.test.ts` (8) and `acp.test.ts` checked capability requirements and the connector exclusion.
  `process.test.ts` (3) exercised quoting with injected win32 and Linux values. A real macOS refresh carried a .cmd provider argument through the wrapper. `codex-app-server-agent.spawn-error.test.ts` (4) counted exactly one failed wrapper spawn. Node's `child_process.spawn` diagnostics on the ACP case likewise showed one bare capability probe before open, one missing-launcher attempt during open and no bare retry.
  Temporarily attempting the same missing wrapper twice on ACP spawn error still passed the committed missing-launcher test. Both attempts were visible in the diagnostic trace. Count session spawn attempts independently of the fixture's successful process starts.
- DONE: Exercise bootstrap's PluginService through to the agent manager with a hook that returns a wrap.
  `npx --no-install vitest run src/server/plugins/launch-wrap-fresh-validator.e2e.test.ts --bail=1` reported one passed. The temporary test installed a directory plugin over WebSocket on a fresh daemon, created an agent, and observed exactly `[[process.execPath, "profile with spaces"]]` at the provider's createSession boundary.
- DONE: Run the existing boundary and contract tests of the changed packages.
  SDK `boundaries` (106) and `windows-command` (15) passed. Protocol `messages.wire-compat` (19), `provider-snapshot-codec` (2), `messages.plugins` (22), `messages` (30), and `agent-feature-schemas` (10) passed.
  Server `plugin-process` (2), `compiler` (86), `internal-seam.e2e` (2), `lifecycle.e2e` (18), `create-agent-lifecycle-dispatch` (1), `session.lifecycle-boundary` (1), `wire-compat` (10), `projected-timeline-contract` (3), `hub-cli-contract` (1), and `timeline-reconnect-contract.e2e` (2) passed. `node --test scripts/daemon-launch-contract.test.mjs` passed one.
- FAILED: Live provider user-message contract.
  `user-message-contract.real.e2e.test.ts` reported one failure and three skips. Pi hit EPERM creating its session directory. Retrying with a writable temporary `PI_CODING_AGENT_DIR` reached the provider, which reported “No API key found for openai-codex.”
- DONE: Check the diff exclusions, lint and formatting.
  `git diff -U0 2445adec..30a6f4e6c` contained none of the forbidden names, mock calls, platform patches, chmod calls or shebang fixtures. `git diff --check` passed. `npm run lint` reported zero warnings and errors. `npm run format:check` reported all matched files correctly formatted.
- FAILED: Run the protocol, plugin, server and CLI typechecks.
  `npm run typecheck --workspace=@getpaseo/<package>` passed for protocol, server and CLI. In packages/plugin, `tsgo --noEmit` passed. `tsgo -p tsconfig.examples.json --noEmit` returned four TS2307 errors for the missing `@tanstack/react-query`. The base examples and config from `2445adec` reproduced the same four errors with the installed dependencies. Both plugin compiler commands used the installed binary because the npm script invokes an install.

Local command output and reproducible probe sources are in `/tmp/paseo-wrap-validation.uUKdD625` (per-file `results`, `mutation-summary.log`, and `mutations.py`). The code worktree is clean at `30a6f4e6c`.

### Summary

Recommend REJECTED for the two reproducible gaps in the permanent AC-2 and AC-5 assertions. Independent probes confirmed both production behaviors at the reviewed head. The live Pi contract and plugin-example typecheck remain environment-limited.

## Stage Report: implementation (cycle 4)

- DONE: The Antigravity wrapped-launch test uses the registration's command and fails when --disable-telemetry is removed from the registration.
  The test reads `createAntigravityProvider().command` and checks its executable is `agy`. It builds the launch the daemon would pass (resolved executable, declared arguments), with Node running the fake agent standing in for `agy`. It asserts the exact wrapped argv `[record, node, agent, "acp", "--disable-telemetry"]` and the hook env. Break: with the registration changed to `["agy", "acp"]` it failed (`argv: [ …(4) ]` vs `[ …(5) ]`). Restored, `provider.ts` is unchanged and the file passes 10/10.
- DONE: The ACP missing-launcher test counts spawn attempts and fails on a second attempt or a bare retry.
  The test subscribes to Node's built-in `child_process` diagnostics channel for the open only, so the connect probe is excluded. That channel publishes every spawn attempt, including one that fails with ENOENT; this is a real observation point, not a mock. The test asserts exactly one attempt, with spawnargs `[missing, "--profile", "a b", node, agent]`, plus ENOENT and no agent start beyond the probe. Breaks in `openSession`:
  1. Retrying the same missing wrap once on failure failed the test (two attempts of five args).
  2. Retrying without the wrap failed it too (a second attempt of two args, the bare command).
  `connection.ts` was restored byte-for-byte and the test passes.
- DONE: The daemon-access sentence is gone from docs/plugins.md; changed tests, lint and format pass; one new commit, head reported, nothing pushed.
  Limit 1 in `docs/plugins.md` now ends at "run outside the wrap." `hooks.md` and `hooks.zh-CN.md` had no equivalent sentence; their limit bullets name only the terminal tools, probes and discovery. `acp.test.ts` 97/97 and Antigravity `provider.test.ts` 10/10 pass, each run alone with `--bail=1`. Lint and format pass, and the plugin (`tsgo --noEmit`) and plugins typechecks pass. One commit, `9f9f39ce1` (26+/9−), on `30a6f4e6c`; head `9f9f39ce1`; nothing pushed; `task/plugin-required-active` is still `2dc585c14`.

### Summary

The AC-2 Antigravity test now depends on the registration's declared command, and the AC-5 ACP test counts real spawn attempts through Node's diagnostics channel. Each was shown to fail on the deliberate break and to pass when restored. The daemon-access sentence is removed. AC-5's two stale phrases from cycle 3 still await CL.

## Stage Report: validation (cycle 4)

- DONE: Independently reproduce each AC-1 to AC-5 Verified by clause on task/launch-wrap-hook head 9f9f39ce1.
  On macOS, from each package or plugin directory, `npx --no-install vitest run <file> --bail=1` ran each of the 16 files in the Test plan separately. All 16 exited 0, with 1,209 tests passed and four conditional cases skipped in `plugin-provider.test.ts`. Every dev-tool command started with inherited `PASEO_*` variables cleared.
- DONE: AC-1. Publish provider support before connection and reject unknown hook fields.
  Snapshot schema 8 passed, daemon configuration E2E 3, plugin registration 39, snapshot manager 98, registry 53, lifecycle handlers 38. The cold hook saw support at zero connections. Codex and its derived provider opted in, other core providers and the connector did not. Dropping the snapshot field produced `{ launchWrap: null, connects: 0 }` against expected `true`.
  With production sources restored to `2445adec`, the current handler test filtered by `-t 'can select a launch wrap'` failed with `Unrecognized key: "wrap"`. Replacing the current strict open schema with a stripping schema made the unknown-key test resolve a request when rejection was expected.
- DONE: AC-2. Wrap the command with the session environment and preserve argv boundaries.
  ACP 97 passed, SDK provider 8, Antigravity 10. The recording launcher saw arguments containing spaces intact, and only the selected session on a shared connection went through it. Omitting the session environment changed the recorded token from `"one"` to `null`.
  Removing `--disable-telemetry` **from the Antigravity production registration** failed `provider.test.ts -t 'runs a wrapped session'`. Recorded argv ended in `acp` and the expected final element was missing.
- DONE: AC-3. Preserve one wrap across handlers and across plugins.
  Handlers 38 passed, runtime 73. At both levels omission preserved the earlier value, an identical value passed, and a different value rejected. Changing the merge to use only the later value failed both omission tests. In each, the later environment survived but the earlier wrap disappeared.
- DONE: AC-4. Apply the wrapper to interactive and archived-history resumes.
  Codex 235 passed. Dropping the wrap only for history produced the bare Codex command in the archived-thread assertion. Deleting the wrap during history stripping separately failed the handler assertion while tools and MCP servers were empty.
- DONE: AC-5. Reject unsupported opens before session creation and do not retry a missing launcher.
  Agent manager 321 passed, plugin provider 113 passed with four conditional skips, Codex spawn error 4, process 3. Unsupported create, resume, import and refresh returned `launch_wrap_unsupported` with unchanged client call counts. Refresh kept the existing session. The stored record omitted the wrap. Omitting rejection cleanup left `sandbox_status` attached where the test expected `[]`.
  The plugin provider tests checked live capability admission, no rejected `session.open` delivery, and the original wrap on reopen. The process resolver exercised Windows quoting with an injected platform. A Codex refresh also passed a Windows-style provider command through a real child on macOS.
  Adding a second ACP launch attempt after the first launcher's error failed `acp.test.ts -t 'when the launcher is missing'`. The diagnostic channel recorded two identical missing-launcher argv arrays where the assertion expected one. All filtered mutation tests returned to green after restoration.
- DONE: Run package boundary and contract tests and exercise bootstrap's real PluginService.
  SDK boundaries 106 passed. Additional individual runs passed for `windows-command` (15), `provider-snapshot-codec` (2), `messages.wire-compat` (19), `messages.plugins` (22), `ws-outbound` (14), `plugin-process` (2), `compiler` (86), `lifecycle.e2e` (18), `session.lifecycle-boundary` (1), `projected-timeline-contract` (3), `timeline-reconnect-contract.e2e` (2) and `hub-cli-contract` (1).
  A temporary case in `agent-manager.test.ts -t 'validates a directory plugin wrap'` passed. It installed a directory plugin over WebSocket, returned a wrap from `server.addHook("agent.open.before", …)`, and created an agent through the daemon. A real Node child recorded `["validator-codex", "argument with spaces", "app-server"]` as the first three provider arguments. The test supplied discovery and used the Codex session implementation with real process spawning.
- DONE: Check the diff and documentation.
  `git diff --check 2445adec..9f9f39ce1` exited 0. Searching the diff found zero occurrences of `requiresPlugins`, `isPluginActive`, `applyLaunchWrap`, `vi.mock`, `vi.hoisted`, chmod or shebangs. The Windows helpers read the platform default and accept an injected platform. The diff contains no platform patch. The launch-wrap section in `docs/plugins.md` describes host tools running outside the wrapper and imposes no daemon-access setting.
- DONE: Run lint, formatting and package source typechecks.
  `npm run lint` returned “0 warnings and 0 errors.” `npm run format:check` returned “All matched files use the correct format.” `node_modules/.bin/tsgo -p packages/<package>/<config> --noEmit` exited 0 for protocol, plugin, server and CLI. Server used `tsconfig.server.typecheck.json`, the others used `tsconfig.json`.
- FAILED: The plugin workspace typecheck, client loader, and live-provider contract could not complete in this checkout.
  `npm run typecheck -w packages/protocol -w packages/plugin -w packages/server -w packages/cli` exited 2. The plugin examples reported four TS2307 errors for missing `@tanstack/react-query`. The plugin script invoked a nested npm install and reported “up to date.” Running the examples compiler directly against base production sources gave the same four errors.
  From their packages, `vitest run src/plugins/evaluate.test.ts --bail=1` failed to load `react-i18next`, and `vitest run src/server/daemon-e2e/user-message-contract.real.e2e.test.ts --bail=1` stopped when Pi received EPERM creating its session directory. Both failures reproduced with base production sources.

### Summary

**PASSED** for AC-1 through AC-5 at `9f9f39ce1`. Both specified regression mutations failed committed tests for the intended reason. The broader environment failures reproduced on the base revision. Per-command output and the temporary probe and mutation scripts are in `/tmp/paseo-validate-wrap.vcRsrC` on this machine.

## Stage Report: implementation (cycle 5)

- DONE: task/launch-wrap-hook is rebased onto upstream main e03fe0d8e with all five conflicts resolved, launch-wrap behavior unchanged and upstream changes kept; the report explains each resolution.
  New head `c027b0141`: `d067ee652` feat (was 14238df28), `6bdfa8249` Windows cmd.exe (was a503685dc), `3a991b397` internal prepend + seam (was 30a6f4e6c), `c027b0141` test pins (was 9f9f39ce1). Commits 2–4 replay with byte-identical +/- lines. `git diff e03fe0d8e c027b0141` equals `git diff 2445adecd 9f9f39ce1` except one merged import list in `provider.test.ts`.
  Conflicts, all textual, all in commit 1 except one in commit 3:
  1. `plugin-provider.ts` imports: upstream #10487 (provider troubleshooting) added `diagnostic-utils` imports; kept both those and `LaunchWrapUnsupportedError`. Commit 3: upstream added `this.label = registration.label` in the `PluginAgentClient` constructor where we set `supportsLaunchWrap`; kept both lines.
  2. `provider.test.ts`: upstream #10496 (session metrics) added a `Provider metrics` describe and its imports; kept it whole and appended our `Provider launch wrap` describe; import list is the union.
  3. `acp.test.ts`: upstream #10428, #10524, #10614 appended ACP tool-row, paging and legacy Auto Accept tests; took upstream's file, added `chmod` to the fs import, appended our `runAcpProvider launch wrap` describe unchanged.
  4. `agent-manager.test.ts`: upstream #10483, #10496 appended an import-metrics test; took upstream's file and appended our launch-wrap client, manager helper and tests unchanged.
  5. `index.posix.test.ts`: upstream #10487, #10470 added the `docsUrl` http(s) test at the same spot; kept it and placed our registration-metadata test after it.
  Design check: upstream's changes in the wrap's path are orthogonal: provider `docsUrl` and `providers` in plugin metadata, `session.metrics` capability, Codex MCP-startup logging, and ACP open gaining an `isConnectionClosed` argument and session paging. `buildLaunchContext`, the `session.launch_wrap` gates, `mapSessionConfig`, `prepareAppServerSpawn` and the ACP command-branch spawn are untouched by upstream, and our sites are present at HEAD (`acp.ts:185`, `connection.ts:90,338,505-525`, `provider.ts:816`, `plugin-process.ts:295`, `index.ts:779`).
- DONE: After CL's approved npm ci, every changed or conflicted test file and boundaries.test.ts pass on their own with --bail=1; lint, format and the protocol/plugin/server/CLI typechecks pass; or the item is SKIPPED with the reason.
  `npm ci` (CL-approved 2026-11-24, `PASEO_*` cleared) exited 0 and ran install scripts (patches applied, lefthook synced). Free disk went from 13 GiB to 11 GiB. `npm run build:server` refreshed the stale declarations. Each file was run alone from its package with `npx --no-install vitest run <file> --bail=1`, all exit 0: ACP 122, process 3, SDK provider 13, boundaries 106, snapshot schema 8, Antigravity 17, agent manager 333, plugin provider 119 (+4 conditional skips), registry 53, snapshot manager 101, Codex spawn-error 4, Codex 235, configuration E2E 3, handlers 38, runtime 73. Counts grew from cycle 4 only by upstream's tests in the same files, and every launch-wrap case is included.
  `index.posix.test.ts`: 40 passed. One upstream test from #10470, "reaps compiler children after starting and reloading a client-only directory plugin", fails with `spawnSync ps EPERM`. This agent cannot run `ps` at all: `ps -p $$` gives "operation not permitted" both inside and outside the tool sandbox. The test does not touch launch-wrap code. With that one test excluded through `-t`, the file exits 0 (40 passed, 1 skipped), including the launch-wrap registration test. CI should cover it.
  `npm run lint`: 0 warnings, 0 errors. `npm run format:check`: clean. `node_modules/.bin/tsgo --noEmit` exited 0 for protocol, plugin, CLI (`tsconfig.json`) and server (`tsconfig.server.typecheck.json`). No test exposed a resolution error and no code commit was added; head is still `c027b0141` and the worktree is clean.
- DONE: Nothing pushed; the report gives the new head and commits.
  Local branch `task/launch-wrap-hook` at `c027b0141`; nothing pushed.

### Summary

Rebased the four launch-wrap commits onto upstream `e03fe0d8e` (v0.17.4). All five conflicts were adjacent-append or import collisions, and upstream did not change how plugin providers connect or open sessions. The net feature diff is unchanged. After the approved `npm ci`, all 16 named test files pass on their own, except one upstream zombie-reaping test that needs `ps`, which this agent cannot run. Lint, format and the four typechecks also pass.
