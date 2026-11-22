---
id: 86k2tpskkhrpqw7z4z1rrt9w
title: "Plugins can wrap an agent's launch command (agent.open.before wrap), fail-closed"
status: validation
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

- The result may carry `wrap?: readonly [executable: string, ...args: string[]]`. The daemon accepts it only when `executable` is an absolute path. The provider spawns `[...wrap, <provider command>, ...<provider args>]` as a direct argv exec with `shell: false` and the final merged hook env. Each element stays one argv element, so an argument with spaces is passed whole.
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
- On Windows it rejects a wrap when the wrap executable or the provider command needs a shell to start (a command script).
- On rejection it detaches plugin tools and throws `LaunchWrapUnsupportedError`. A wrap returned for an unsupported provider always rejects; there is no "wrap if possible".

The wrap crosses to the plugin as `ProviderSessionConfig.wrap`, and `requiredProviderCapabilities` adds `session.launch_wrap` for a `session.open` that has one. The two existing capability gates then reject an unsupported wrapped open as a second line: the daemon adapter (`plugin-provider.ts:299`) and the process boundary (`runtime.ts:1490`).

A plugin session can reopen its provider session without running hooks (`plugin-provider.ts:1192-1212`). The reopen reuses the original wrap, because the captured session config carries it.

**Providers in this change**

- `runAcpProvider`, command branch: the adapter advertises `session.launch_wrap` only when `options.command` is set, and `AcpRuntime.start` prepends `config.wrap` to the session's spawn.
- Codex: `prepareAppServerSpawn` takes the wrap from `launchContext` and prepends it. `createSession` and `resumeSession` pass it.
- Every other provider rejects.

**Errors**

- `LaunchWrapUnsupportedError`, `code: "launch_wrap_unsupported"`, with `provider`. It follows `ToolPolicyUnsupportedError` (`provider-options.ts:25`).
- `RequiredPluginInactiveError`, `code: "required_plugin_inactive"`, with `pluginIds`.
- These are daemon-side typed errors. Nothing requires the code to be readable through `paseo.agents`; a plugin learns support from the provider snapshot.

**Separate commit: `requiresPlugins`**

- An `agent.create.before` result may carry `requiresPlugins?: string[]`.
- `PluginRuntime.before` compares what each plugin received with what it returned. The plugin may add its own id and nothing else. It may not remove an id. The merged value is the union, so two policy plugins each add themselves and neither conflicts with the other.
- The list is saved on the agent record as an optional field and held on the managed agent. Nothing releases it in this version.
- `buildLaunchContext` checks it before the hooks run, for every reason and purpose. A plugin counts as active when it is loaded, its server process is running, and it has an `agent.open.before` hook registered. If any listed plugin is inactive, the open throws `RequiredPluginInactiveError` naming the inactive ones.
- `PluginLifecycle` gains one query for that check.

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
4. On Windows, a prefix that needs a shell is rejected in this version.
5. Plugin loss is covered by `requiresPlugins`, not by `wrap`.

### Mechanisms confirmed against upstream

1. **Hook path.** `buildLaunchContext` builds the request and calls `pluginLifecycle.before("agent.open.before")` (`agent-manager.ts:6341-6378`). `PluginRuntime.before` runs plugins in id order (`localeCompare`, `runtime.ts:760`) and feeds each validated result to the next (`runtime.ts:771-777`). Within a plugin, `PluginHookHandlers.openSession` does the same per handler (`plugins/lifecycle/index.ts:388-417`). `paseo-safehouse` sorts before `zerosub`.
2. **Old hosts fail closed already.** The `agent.open.before` schema is `.strict()` (`plugins/lifecycle/index.ts:102-121`) and validates each result both in the plugin process, which runs host code (`plugin-process.ts:115`), and in the daemon. An old host rejects a result with an unknown `wrap` key and the open fails. This is from reading; the checkout has no `node_modules`, so AC-1 proves it by test. The `agent.create.before` schema is strict as well (`:97-101`), so `requiresPlugins` has the same property.
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

Commit 1, launch wrap. About 215 production lines and 420 test lines, ±30%. No new dependency.

| File | Change | Lines |
| --- | --- | --- |
| `packages/protocol/src/agent-types.ts`, `messages.ts` | optional `launchWrap` on the provider snapshot entry | 2 |
| `packages/plugin/src/server/lifecycle.ts` | `wrap` on the open request and result | 8 |
| `packages/plugin/src/server/provider.ts` | `ProviderRegistration.launchWrap`, `session.launch_wrap`, `ProviderSessionConfig.wrap`, schema, required capability | 18 |
| `packages/plugin/src/server/acp.ts` | declare `launchWrap` for the command branch | 2 |
| `packages/plugin/src/server/acp-internal/connection.ts` | advertise in the command branch, prepend at spawn | 20 |
| `packages/server/src/server/plugins/plugin-process-protocol.ts`, `plugin-process.ts`, `index.ts` | carry `launchWrap` in registration metadata | 4 |
| `packages/server/src/server/plugins/lifecycle/index.ts` | schema, selection rule, absolute path | 30 |
| `packages/server/src/server/agent/agent-sdk-types.ts` | `AgentLaunchContext.wrap`, `AgentClient.supportsLaunchWrap`, snapshot entry field | 10 |
| `packages/server/src/server/agent/provider-registry.ts` | contract field, definition field, stamp on the client | 12 |
| `packages/server/src/server/agent/provider-snapshot-manager.ts` | copy the field into the initial entry | 1 |
| `packages/server/src/server/agent/agent-manager.ts` | admission, Windows shell rejection, detach on failure | 40 |
| `packages/server/src/server/agent/plugin-provider.ts` | definition field, live capability check, map the wrap into the session config | 20 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.ts` | prepend in `prepareAppServerSpawn` | 12 |
| `packages/server/src/server/agent/provider-options.ts` | `LaunchWrapUnsupportedError` | 14 |
| `docs/plugins.md` | the `wrap` contract, the provider property and the limits, in the section that owns `agent.open.before` | 28 |

Commit 2, `requiresPlugins`. About 105 production lines and 190 test lines, ±30%.

| File | Change | Lines |
| --- | --- | --- |
| `packages/plugin/src/server/lifecycle.ts` | `requiresPlugins` on the create request and result | 4 |
| `packages/server/src/server/plugins/lifecycle/index.ts` | array schema, `PluginLifecycle` query | 12 |
| `packages/server/src/server/plugins/runtime.ts` | own-id append check, union, active query | 28 |
| `packages/server/src/server/agent/agent-storage.ts` | optional record field | 2 |
| `packages/server/src/server/agent/agent-manager.ts` | carry on create, persist, check every listed plugin on every open | 34 |
| `packages/server/src/server/agent/provider-options.ts` | `RequiredPluginInactiveError` | 13 |
| `docs/plugins.md`, `docs/data-model.md` | the field and its rule | 12 |

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
- `packages/server/src/server/agent/agent-manager.test.ts`: with a client that does not opt in and a hook that returns `wrap`, create, resume, import and refresh each reject with `code === "launch_wrap_unsupported"`; the client's `createSession`, `resumeSession` and `importSession` are never called; plugin tools are detached; on refresh the existing session is not closed. The persisted record has no `wrap`. With the platform set to `win32` and a command-script wrap, a supporting client rejects the same way.
- `packages/server/src/server/agent/plugin-provider.test.ts`: a registration that declares `launchWrap` but whose connection lacks `session.launch_wrap` rejects a wrapped open and receives no `session.open`; a `runAcpProvider({ connector })` connection does not list the capability; a session reopen sends the original wrap.
- `acp.test.ts` and `packages/server/src/server/agent/providers/codex-app-server-agent.spawn-error.test.ts`: with a wrap whose executable does not exist, the open rejects, the spawn count is one, and no spawn uses the bare provider command.

**AC-6. An agent does not open while any plugin it requires is inactive.**
Verified by:
- `packages/server/src/server/plugins/runtime.posix.test.ts`: two plugins each add their own id in `agent.create.before` and the merged `requiresPlugins` holds both; a plugin that adds another plugin's id fails the create; a plugin that removes an id fails the create.
- `packages/server/src/server/agent/agent-manager.test.ts`: an agent requires two plugins. With both active it opens. With either one reported inactive, resume and refresh reject with `code === "required_plugin_inactive"` before the client is called, and the error names that plugin. The second case fails if the check tests only the first id.
- `packages/server/src/server/agent/agent-storage.test.ts` round-trips the list and loads a record without it.

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
| `packages/server/src/server/plugins/runtime.posix.test.ts` | AC-3, AC-6 |
| `packages/plugin/src/server/acp.test.ts` | AC-2, AC-5 |
| `packages/plugin/src/server/provider.test.ts` | `session.launch_wrap` is required for a `session.open` with a wrap |
| `plugins/antigravity-provider/server/provider.test.ts` | AC-2 |
| `packages/server/src/server/agent/agent-manager.test.ts` | AC-5, AC-6 |
| `packages/server/src/server/agent/plugin-provider.test.ts` | AC-5 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.test.ts` | AC-4 |
| `packages/server/src/server/agent/providers/codex-app-server-agent.spawn-error.test.ts` | AC-5 |
| `packages/server/src/server/agent/agent-storage.test.ts` | AC-6 |

Order of work: write the AC-1 strict-schema test first and run it on unmodified upstream main to record the old-host failure. Then the provider property through to the snapshot, the hook schema and selection rule, the manager admission, the ACP branch, Codex, and last the `requiresPlugins` commit.

After each change run `npm run typecheck` and `npm run lint`. Run `npm run build:client` after the protocol change and `npm run build:server` when a server typecheck reports a stale `@getpaseo/plugin` declaration. Run `npm run format` before each commit. The full suites run in CI on the pull request.

Tests use fixture launcher scripts and the existing Codex `appServerProcess` port. They need no real provider CLI and no sandbox tool.

### Feedback Cycles

- Cycle 1: revise — ideation gate, CL, after consensus with the paseo-safehouse manager. The launch-wrap support signal moves from `request.launchWrap` to a provider-level property visible at create time (provider list through the plugin API); AC-2 adds an argument containing spaces; follow-up scope names draft discovery and the create-time catalog lookup; documented limits record daemon access Off and the Windows rejection; reference `.spacedock/repo/handoff/launch-wrap/README.md`. Surface may grow by one optional provider-snapshot field in `packages/protocol`.
- Validation cycle 1: revise — CL, at 2dc585c14. Material: the Windows command-script rejection in applyLaunchWrap fails after refresh has closed the session; remove it and rely on spawnProcess, which already handles .cmd/.bat through cmd.exe. Polish: docs/plugins.md:485 wording, public hook reference, lifecycle diagnostic list. Deferred: full typecheck in CI; activity sampled before async hooks. Test-size overrun accepted. The round recorder was not run: no review-room briefing or log exists.

## Out of scope

- Wrapping for providers other than ACP command-based and Codex. Each gets its own follow-up pull request.
- The `runAcpProvider` connector branch.
- Draft command and control discovery and the create-time catalog lookup. They belong to the follow-up task launch-wrap-discovery-coverage.
- A way to release `requiresPlugins` from an agent.
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
