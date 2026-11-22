Title: feat(plugins): let an open hook wrap the provider's launch command, fail-closed

Base: getpaseo/paseo main · Head: clkao:task/launch-wrap-hook (e3fd597f, on 2445adec)

---

### Linked issue

{LINK: a Discussion that shows demand for per-session sandboxing or launch wrapping by plugins. CONTRIBUTING asks for one for a core feature. If none exists, open one first.}

### Type of change

- [ ] Bug fix
- [x] New feature
- [ ] Enhancement
- [ ] Refactor
- [ ] Docs

### Reasoning

A sandbox or container plugin needs to start each agent session through its own launcher. One example is a plugin that runs sessions under macOS Seatbelt.

Today the only ways to do that are the following, and neither is per session:
- a derived provider (`extends` with a replaced `command`), which works only for built-in providers;
- a `command` override on the provider's own ID, which applies to every session and has to repeat the provider's full invocation.

This PR lets an `agent.open.before` hook return a launch prefix, `wrap: [executable, ...args]`. Paseo then runs that session's harness as `[...wrap, command, ...args]`.

It fails closed in the same way that injected MCP servers already fail on a provider without MCP support:
- a provider that has not implemented the prefix rejects a wrapped open before it starts any process;
- an older host rejects the unknown `wrap` key, because the hook result schema is strict.

### Goals

- **`wrap` on the `agent.open.before` result.**
  - The executable is an absolute path on the daemon host, followed by literal args.
  - It is launch-only: it is never stored in the agent's config.
  - One selection per open. A later hook that omits `wrap` keeps it, an identical value passes, and a different value fails the open, within one plugin and across plugins.
  - It applies to interactive and history opens.
- **Support is visible before the first open.** `launchWrap` on each provider-list entry is declared statically: core providers opt in, and plugin providers set `ProviderRegistration.launchWrap`. A fresh daemon's first `agent.create.before` already sees it, with no provider connection.
- **Admission before any spawn.**
  - Core providers are default-deny.
  - Plugin providers need the `session.launch_wrap` connection capability.
  - An unsupported provider fails with `launch_wrap_unsupported` before create, resume or import, and before a refresh closes the current session.
  - A missing launcher is never retried without the prefix.
- **Two providers implement it:**
  - the Plugin SDK's command-based ACP providers (`runAcpProvider`, command branch: Antigravity, Goose, Fx, Hoplite);
  - Codex (`prepareAppServerSpawn`: create, resume, history, reconnect, import).
- **Separate commit, `requiresPlugins`.** An `agent.create.before` hook may add its own plugin ID. The agent then refuses to open while any listed plugin is inactive (`required_plugin_inactive`). This keeps a sandbox fail-closed if its plugin exits.
- **Windows.** Script launchers (`.cmd`/`.bat`) start through `spawnProcess` and its `cmd.exe` quoting, like any provider launcher.

### Non-goals

- **Other providers** (Claude, Pi, OMP, core ACP, OpenCode, Muse). Each one rejects a wrapped open until a follow-up PR covers all of its session paths.
- **The `runAcpProvider` connector branch,** which starts no process.
- **Work before the hook.** Draft command and control discovery, and the catalog lookup at create with no model set, still start unwrapped. This is a known follow-up.
- **Host-side probes,** version commands and diagnostics.
- **Paseo's host terminal tools.** A sandbox plugin must also keep sandboxed agents away from the daemon.
- **A user-facing "open without the required plugin" action.**
- **A plugin being removed while an open is already in flight.**

### QA

Each test file ran on its own from its package directory, as `vitest run <file> --bail=1`, on macOS with inherited `PASEO_*` variables cleared and an isolated test home. An independent validation then reran all of them at `e3fd597f`. For each criterion it made one deliberate break, which the tests caught, and then reverted it. Result: 1,129 passing tests across 16 files, plus 4 conditional skips (controls-only cases in `plugin-provider.test.ts`). [Validation report](https://github.com/clkao/paseo/blob/c31b2b8b435c59b5067e9108e3015d9ae3e694bf/launch-wrap-hook.md#stage-report-validation-cycle-2)

| Check | What it shows |
|---|---|
| **Old hosts fail closed:** `lifecycle/handlers.test.ts` | The test that a hook returns `wrap`, run against unmodified `2445adec`, fails with `unrecognized_keys ["wrap"]`. On this branch it passes. |
| **Cold daemon:** `agent-configuration.e2e.test.ts`, `index.posix.test.ts`, `provider-snapshot-manager.test.ts` | A never-connected plugin provider reports `launchWrap: true` to the first create hook, with zero connections. |
| **ACP argv:** `acp.test.ts` | Argv is `[...wrap, command, ...args]`, and arguments containing spaces stay single argv elements. Two opens on one connection give one wrapped launch and one bare launch, both with `shell: false`. |
| **Antigravity:** `plugins/antigravity-provider/server/provider.test.ts` | The wrapped argv ends with `agy acp --disable-telemetry` and carries the final hook env. |
| **One wrap per open:** `handlers.test.ts`, `runtime.posix.test.ts` | Across handlers and across plugins: an omitted `wrap` is kept, an equal one passes, a different one is rejected. |
| **History and Codex:** `codex-app-server-agent.test.ts` | Interactive and archived-history resume both spawn through the wrap. |
| **Admission:** `agent-manager.test.ts`, `plugin-provider.test.ts`, `provider-registry.test.ts` | Create, resume, import and refresh reject unsupported wrapping with no provider call. Refresh keeps its session, and tools detach. A missing capability sends no `session.open`. |
| **Missing launcher:** `acp.test.ts`, `codex-app-server-agent.spawn-error.test.ts` | The open fails, and there is no bare retry. |
| **Windows:** `process.test.ts`, `codex-app-server-agent.test.ts` | A `.cmd` wrapper takes the `cmd.exe` path with quoted args. A wrapped refresh with a `.cmd` provider command installs a replacement session. Both run on simulated `win32`. |
| **`requiresPlugins`:** `runtime.posix.test.ts`, `agent-manager.test.ts`, `agent-storage.test.ts` | Two plugins add their own IDs, and a foreign ID is rejected. Either plugin inactive blocks resume and refresh before any provider call. A legacy record loads. |

`npm run lint` and `npm run format` pass. `typecheck` passes for protocol, plugin, server and CLI. **The full root typecheck (app, desktop, website, plugin examples) was not run locally, for disk reasons. Please rely on CI for it.**

Platforms. This change is daemon-side and in the Plugin SDK. It has no UI.

| Platform | Tested | Notes |
|---|---|---|
| iOS / Android / Web | n/a | No client change. The protocol gains only an optional `launchWrap` field on provider-list entries. |
| Desktop macOS | yes | Unit and e2e tests on macOS. |
| Desktop Windows | simulated | `win32` behavior covered by tests. No real Windows run. |
| Desktop Linux | no | Not run. |

**Compatibility.**
- `ProviderSnapshotEntry` gains an optional `launchWrap?: boolean`. Old apps keep parsing new daemons.
- Hook results stay strict, so a plugin that returns `wrap` against an older host gets a failed open, not a silent unwrapped session.

**Size.** There are three commits:
- launch wrap: 34 files, +1,137/−15;
- `requiresPlugins`: 13 files, +283/−30;
- the Windows launcher fix: 9 files, +239/−111.

Production code is 154 lines in commit 1 and 96 lines in commit 2, before the Windows fix. Most of the rest is tests and fixture launchers.

### Checklist

- [x] Plugin changes follow the SDK import boundaries
- [x] One focused change (`requiresPlugins` is a separate commit and can be split into its own PR on request)
- [ ] `npm run typecheck` passes (protocol, plugin, server and CLI only; the full run is left to CI)
- [x] `npm run lint` passes
- [x] `npm run format` passes
- [x] QA evidence
- [x] Tests added or updated where it made sense
