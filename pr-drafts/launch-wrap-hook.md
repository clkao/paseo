Title: feat(plugins): let an open hook wrap the provider launch, fail-closed

Base: getpaseo/paseo main · Head: clkao:task/launch-wrap-hook (9f9f39ce, on 2445adec)

---

### Linked issue

Discussion: https://discord.com/channels/1481169421832814616/1491287786370633929/1573786425298649162

### Type of change

- [ ] Bug fix
- [x] New feature
- [ ] Enhancement
- [ ] Refactor
- [ ] Docs

### Reasoning

This PR adds one extension point. It does not add a sandbox to core.

A sandbox plugin or a container plugin must start each agent session with its own launcher. Today a plugin can do this only in two ways:
- A derived provider (`extends` with a new `command`). This works only for built-in providers.
- A `command` override on the provider ID. This applies to all sessions of that provider. The override must also repeat the full invocation of the provider.

Neither way is a choice for one session. So each sandbox plugin keeps a copy of each provider that it wraps.

With this PR, an `agent.open.before` hook can return `wrap: [executable, ...args]`. Paseo then starts the session harness as `[...wrap, command, ...args]`. One plugin can wrap all providers that support the wrap. The plugin does not need a copy of each provider.

The hook fails closed. Injected MCP servers already use this rule on a provider without MCP support. A provider that does not support the wrap rejects the open before it starts a process. An older host rejects the unknown `wrap` key, because the hook result schema is strict.

### Goals

- **The hook result.** `agent.open.before` can return `wrap`.
  - The first element is an absolute path on the daemon host. The other elements are literal arguments.
  - Paseo uses the wrap for the launch only. Paseo does not store it in the agent configuration.
  - One wrap applies to one open. A later hook can keep it or repeat it. A different wrap fails the open.
  - The wrap applies to interactive opens and to history opens.
- **Support is visible before the first open.** Each provider in the provider list has an optional `launchWrap` field.
  - Core providers set it in the registry.
  - Plugin providers set it in `ProviderRegistration.launchWrap`.
  - A plugin can read it in `agent.create.before`, before the first connection to the provider.
- **Admission before any process starts.**
  - An open with a wrap for a provider without support fails with `launch_wrap_unsupported`.
  - This check occurs before create, resume and import. It also occurs before a refresh closes the current session.
  - Paseo does not start the harness without the wrap after a launcher failure.
- **Providers in this PR.**
  - The command-based ACP providers of the Plugin SDK (`runAcpProvider`): Antigravity, Goose, Fx and Hoplite.
  - Codex (`prepareAppServerSpawn`).
- **Windows.** A `.cmd` or `.bat` launcher starts through `spawnProcess` and its `cmd.exe` quoting, as for each provider launcher.

### Non-goals

- **Other providers.** Claude, Pi, OMP, core ACP, OpenCode and Muse show `launchWrap: false`. A plugin reads this value and keeps its current launch path for these providers. If a plugin returns a wrap for one of them, the open fails before a process starts.

  A provider can show `launchWrap: true` only when every process that it starts for an open uses the wrap. In this PR, one spawn point covers each of Codex and the ACP command branch. The other providers start more processes during an open. Each provider gets a follow-up PR that wraps these paths and tests them:

  | Provider | Launch paths that the follow-up must wrap |
  |---|---|
  | Claude | The lazy query start on the first prompt (`providers/claude/query.ts:85`), with the substitution that uses the Node of Paseo |
  | Pi | The MCP support probe, which starts a second harness (`providers/pi/agent.ts:2897-2929`) |
  | OMP | The restart after a mode change |
  | Core ACP | The session spawn, and the terminal commands that the agent requests (`providers/acp-agent.ts:3018-3039`) |
  | OpenCode | A wrapped open needs a new dedicated server. An open that reuses a shared server or an external server must fail. |
  | Muse | The launch for each `MuseSession` connection |

  This list comes from a read of the source. Each follow-up PR verifies its own paths.
- **Processes outside an open.** The wrap comes from the open hook, so it applies only to processes that Paseo starts for an open. These processes run without the wrap:
  - the capability probe of an ACP connection, which starts the harness once to read its `initialize` result when Paseo first connects to the provider, at create
  - session listing
  - draft command discovery
  - the catalog lookup at create when no model is set
  - availability probes and version commands

  These processes do not receive a prompt. A follow-up can wrap them with a wrap for each provider instead of each open.
- **Requests to the daemon.** Work that the agent asks the daemon to do, for example a host terminal or a new agent, runs as the daemon. The wrap does not apply to it.
- **A stopped plugin.** If the plugin that returns the wrap stops, later opens run without its hooks, as for every hook today. A separate PR proposes a way for an agent to require its plugin.

### QA

Each test file ran separately on macOS, with `vitest run <file> --bail=1`. A second agent did an independent validation at `9f9f39ce`. For each acceptance criterion, it changed the code to break the behavior, saw the test fail, and restored the code.

Result: 1,209 tests passed in 16 files. Four tests are conditional skips. The validator also installed a directory plugin on a real daemon, and a real child process received the wrapped launch. [Commands and output for each file](https://github.com/clkao/paseo/blob/7b06de28d99abacc12c9b1eb0ac095cca5cd1cca/launch-wrap-hook.md#stage-report-validation-cycle-4)

| Behavior | Test files |
|---|---|
| A host without this change rejects a hook result with `wrap` (`unrecognized_keys ["wrap"]` on `2445adec`). | `plugins/lifecycle/handlers.test.ts` |
| A provider that never connected shows `launchWrap: true` to the first `agent.create.before`. | `plugins/agent-configuration.e2e.test.ts`, `plugins/index.posix.test.ts`, `agent/provider-snapshot-manager.test.ts` |
| ACP starts `[...wrap, command, ...args]` without a shell. An argument with spaces stays one argument. Two opens on one connection, with one wrap, start one wrapped and one bare harness. | `packages/plugin/src/server/acp.test.ts` |
| Antigravity starts `[...wrap, agy, acp, --disable-telemetry]`, from its own registration, with the final hook environment. | `plugins/antigravity-provider/server/provider.test.ts` |
| A later hook keeps or repeats a wrap. A different wrap fails the open, in one plugin and across two plugins. | `plugins/lifecycle/handlers.test.ts`, `plugins/runtime.posix.test.ts` |
| Codex interactive resume and archived history resume start through the wrap. | `agent/providers/codex-app-server-agent.test.ts` |
| A provider without support fails create, resume, import and refresh before a provider call. Refresh keeps the current session. | `agent/agent-manager.test.ts`, `agent/plugin-provider.test.ts`, `agent/provider-registry.test.ts` |
| A missing launcher fails the open after one launch attempt, with no start of the bare harness. | `packages/plugin/src/server/acp.test.ts`, `agent/providers/codex-app-server-agent.spawn-error.test.ts` |
| With the platform `win32`, a `.cmd` wrap resolves to `cmd.exe` with quoted arguments. A wrapped refresh with a `.cmd` provider command starts a new session through the real `spawnProcess`. | `packages/plugin/src/server/process.test.ts`, `agent/agent-manager.test.ts` |

`npm run lint` and `npm run format` pass. The typecheck passes for protocol, plugin, server and CLI. I did not run the full root typecheck (app, desktop, website). The plugin examples typecheck fails in my checkout because `@tanstack/react-query` is not installed, and it fails in the same way on `2445adec`. CI must run these.

| Platform | Tested | Notes |
|---|---|---|
| iOS, Android, Web | n/a | No client change. The provider list gets one optional field. |
| Desktop macOS | yes | Unit and e2e tests. |
| Desktop Windows | simulated | Tests give `win32` as the platform. I did not run it on Windows. |
| Desktop Linux | no | Not run. |

**Compatibility.**
- An old app reads the provider list of a new daemon, because `launchWrap` is optional.
- A plugin that returns `wrap` to an old host gets a failed open, not a session without the wrap.

### Checklist

- [x] Plugin changes follow the SDK import boundaries
- [x] One focused change
- [ ] `npm run typecheck` passes (protocol, plugin, server and CLI only. CI runs the rest.)
- [x] `npm run lint` passes
- [x] `npm run format` passes
- [x] QA evidence
- [x] Tests added or updated where it made sense
