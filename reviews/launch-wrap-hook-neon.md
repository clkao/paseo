# Code review: `task/launch-wrap-hook` (`2445adecd..e3fd597ff`)

## Verdict

**Request changes — do not open the upstream PR yet.** The launch-wrap core (`14238df28`, minus `applyLaunchWrap`'s public export) is clean, well-scoped, and faithfully fail-closed across Codex and command-based `runAcpProvider`, with a sound protocol addition (`ProviderSnapshotEntry.launchWrap`). However, the branch has two guaranteed runtime/CI failures and three additional material defects: `PluginService` never forwards `isPluginActive` from `PluginRuntime`, so `requiresPlugins` rejects every open on a real daemon even while the required plugin is running; exporting `applyLaunchWrap` from `@getpaseo/plugin/server` breaks `packages/plugin/src/boundaries.test.ts` (verified failing); the new ACP and Antigravity wrap tests use POSIX `#!` shebangs in cross-platform test files and will fail on Windows CI; the commit-3 simulated-`win32` tests violate `docs/testing.md` (`vi.mock`, `vi.hoisted`, monkey-patched `process.platform`); and `createAgentFromRecord` runs create hooks and deletes committed timeline state before `requireActivePlugins` rejects an inactive plugin.

---

## Findings

### 1. `[material]` `PluginService` never forwards `isPluginActive` — `requiresPlugins` breaks every open on a real daemon

- **File and line:** `packages/server/src/server/plugins/index.ts:44-79,152-223`, `packages/server/src/server/plugins/lifecycle/index.ts:161`, `packages/server/src/server/bootstrap.ts:683,1036`, `packages/server/src/server/agent/agent-manager.ts:6452-6457`
- **Problem:** In a real daemon, `bootstrap.ts:683,1036` wires `pluginRuntime: PluginService` as `AgentManager`'s `pluginLifecycle`. `PluginService` forwards `emit`, `before`, `wait`, `detachTools`, `callTool`, and worktree-manager methods to `this.runtime` (`PluginRuntime`), but `isPluginActive` was added only to `PluginRuntime` (`runtime.ts:817`) and omitted from `PluginRuntimePort` and `PluginService`. Because `PluginLifecycle.isPluginActive` was made optional (`isPluginActive?(pluginId: string): boolean`), TypeScript did not catch that `PluginService` does not implement it. At runtime, `this.pluginLifecycle?.isPluginActive?.(pluginId) !== true` in `AgentManager.requireActivePlugins` evaluates `undefined !== true`, so every open of an agent with `requiresPlugins` — including the initial `createAgent` right after `agent.create.before` adds the plugin's own ID — fails with `RequiredPluginInactiveError` even when the plugin is running with an `agent.open.before` hook.
- **Why it matters to the maintainer:** Commit 2 (`2dc585c14`) does not work in production at all. No existing test caught it because `agent-manager.test.ts` passed a hand-rolled `pluginLifecycle` object literal and `runtime.posix.test.ts` tested `PluginRuntime.isPluginActive` directly instead of exercising `PluginService` or a real daemon. Making a contract method optional to avoid updating test stubs also goes directly against `docs/coding-standards.md` ("Optionality is a design decision, not a migration shortcut").
- **Concrete suggestion:** Add `isPluginActive` to `PluginRuntimePort` (`packages/server/src/server/plugins/index.ts:44-79`) and forward it on `PluginService` (`readonly isPluginActive: PluginLifecycle["isPluginActive"] = (pluginId) => this.runtime.isPluginActive?.(pluginId) ?? false;`). Make `isPluginActive(pluginId: string): boolean` required on `PluginLifecycle` (keeping narrow consumers on `Pick<PluginLifecycle, ...>`, as `paseo-worktree-service.ts:66` and `worktree-core.ts:48` already do) so the compiler enforces wiring. Add one end-to-end test in `packages/server/src/server/plugins/agent-configuration.e2e.test.ts` where a real plugin adds itself to `requiresPlugins`, creates and opens an agent while enabled, and fails to reopen once disabled.

---

### 2. `[material]` Exporting `applyLaunchWrap` from `@getpaseo/plugin/server` breaks `packages/plugin/src/boundaries.test.ts`

- **File and line:** `packages/plugin/src/server/index.ts:34`, `packages/plugin/src/server/process.ts:51-56`, `packages/plugin/src/boundaries.test.ts:95-102`, `packages/server/src/server/agent/providers/codex-app-server-agent.ts:1`
- **Problem:** Adding `applyLaunchWrap` to `@getpaseo/plugin/server` breaks the SDK boundary test `packages/plugin/src/boundaries.test.ts:95-102` (`publishes process capabilities without their Windows implementation helpers`). Verified by running `npx vitest run src/boundaries.test.ts --bail=1` in `packages/plugin`:
  ```
  AssertionError: expected [ 'applyLaunchWrap', 'defineAgentTool', 'execCommand', 'spawnProcess', 'terminateProcess' ]
  to deeply equal [ 'defineAgentTool', 'execCommand', 'spawnProcess', 'terminateProcess' ]
  ```
- **Why it matters to the maintainer:** Guaranteed CI failure on `@getpaseo/plugin`. More broadly, `applyLaunchWrap` was only worth sharing in commit 1 when it contained the Windows `.cmd`/`.bat` rejection logic. After commit 3 deleted that logic, `applyLaunchWrap` is a one-line array prepend (`{ command: wrap[0], args: [...wrap.slice(1), launch.command, ...launch.args] }`). Exposing it on the public `@getpaseo/plugin/server` surface expands the stable author API (and would require documenting it in `public-docs/plugins/reference.md` per `docs/plugins.md:285-287`) for zero complexity savings.
- **Concrete suggestion:** Remove `applyLaunchWrap` from `packages/plugin/src/server/index.ts` and `packages/plugin/src/server/process.ts`, and inline the one-line prepend in `packages/plugin/src/server/acp-internal/connection.ts:498` and `packages/server/src/server/agent/providers/codex-app-server-agent.ts:8217`. This fixes `boundaries.test.ts`, avoids expanding the public SDK surface, and drops the new runtime `@getpaseo/plugin/server` import from `codex-app-server-agent.ts`. (If you intentionally want custom third-party plugin providers to call a shared helper, export it from `@getpaseo/plugin/server/provider` next to `ProviderSessionConfig.wrap`, update `boundaries.test.ts`, and document it in `public-docs/plugins/providers.md`.)

---

### 3. `[material]` New ACP and Antigravity wrap tests use POSIX `#!` shebangs and `chmod` in cross-platform test files

- **File and line:** `packages/plugin/src/server/acp.test.ts:6289-6301,6359,6379,6398`, `plugins/antigravity-provider/server/provider.test.ts:659-687,705,722`
- **Problem:** Neither `acp.test.ts` nor `antigravity-provider/server/provider.test.ts` is a `*.posix.test.ts` file, so both run on Windows CI. Every existing test in both files launches Node fixture scripts via `[process.execPath, scriptPath, ...]` (`acp.test.ts:39`, `provider.test.ts:22`). The new wrap tests instead write `#!${process.execPath}` scripts with `chmod(..., 0o755)` and spawn `[fixture.launcher, ...]` and `agy` directly. Windows does not execute POSIX shebangs, so these spawns will fail on Windows CI.
- **Why it matters to the maintainer:** Breaks Windows CI and goes against the convention already established in the same files and in `docs/testing.md:197` ("Spawn Node entrypoints through `process.execPath`").
- **Concrete suggestion:** Use `wrap: [process.execPath, fixture.launcher, launchLog, "sandbox"]` in `acp.test.ts` (and drop the shebang and `chmod`). In `plugins/antigravity-provider/server/provider.test.ts`, reuse the existing `launchAgent(...)` helper at line 14 for the fake `agy` script and pass `wrap: [process.execPath, launcher, record]`. `process.execPath` is an absolute path, so this tests the exact same `[...wrap, command, ...args]` prepend and space-preserving argv delivery on both POSIX and Windows.

---

### 4. `[material]` Commit 3's simulated-`win32` tests violate `docs/testing.md` (`vi.mock`, `vi.hoisted`, monkey-patched `process.platform`), and the manager test never exercises `spawnProcess`

- **File and line:** `packages/plugin/src/server/process.test.ts:8-20,69-98`, `packages/server/src/server/agent/agent-manager.test.ts:16099-16146`
- **Problem:**
  - `process.test.ts` adds `vi.hoisted`, `vi.mock("node:child_process", ...)`, and `Object.defineProperty(process, "platform", { value: "win32" })`. `docs/testing.md:240` explicitly prohibits `vi.mock`, `vi.hoisted`, and monkey-patched globals ("If a test needs any of those, the production module is missing a port — fix the seam, then write the test against a fake adapter").
  - `agent-manager.test.ts:16099-16146` ("a wrapped refresh of a Windows command-script Codex spawns it through the wrap") injects a fake `appServerProcess.spawn` that never calls `spawnProcess`, yet still monkey-patches `process.platform` to `"win32"` and mutates private fields on `CodexAppServerAgentClient` via `Object.assign(client, { goalsEnabledPromise, autoReviewEnabledPromise })`. Once commit 3 removed the `win32` check from `applyLaunchWrap` and `AgentManager`, nothing in that test's execution path depends on `process.platform` except `detached: process.platform !== "win32"`, which the test does not assert.
- **Why it matters to the maintainer:** `docs/testing.md:236-243` is an explicit maintainer boundary against mocked module internals and global monkey-patching. Additionally, `process.test.ts` already tests real shell quoting against the real child process on Windows (`lines 45-67`), and `packages/server/src/utils/spawn.launch-regression.test.ts:297-335` already tests real `.cmd`/`.bat` launches on Windows.
- **Concrete suggestion:**
  - In `packages/plugin/src/server/process.ts` and `process-internal/windows-command.ts`, either extract a small pure `resolveSpawnInvocation(command, args, options, platform)` helper (no `vi.mock`, no `process.platform` mutation) so a unit test verifies `.cmd` quoting directly, or test a real `.cmd` wrapper on `process.platform === "win32"` matching `spawn.launch-regression.test.ts`.
  - In `agent-manager.test.ts:16099-16146`, remove the `process.platform` monkey-patch (and either delete the redundant test now that `.cmd` is not special-cased in `AgentManager`, or keep a minimal reload-passes-updated-wrap test using `LaunchWrapRecordingClient` instead of constructing a raw `CodexAppServerAgentClient` and poking its private promises).

---

### 5. `[material]` `createAgentFromRecord` runs `agent.create.before` hooks and deletes committed agent state before `requireActivePlugins` rejects

- **File and line:** `packages/server/src/server/agent/agent-manager.ts:1562-1648,4211-4214`
- **Problem:** When a stored agent without a provider persistence handle is reopened via `createAgentFromRecord(agentId)`, it forwards `requiresPlugins: record.requiresPlugins` to `createAgentInternal`. Inside `createAgentInternal`:
  1. Line 1598 runs `agent.create.before` hooks for all other active plugins even though a required plugin is already inactive.
  2. Line 1621 calls `await this.deleteAgentState(resolvedAgentId)`, which deletes the retained timeline, tool policies, and **`durableTimelineStore.deleteAgent(agentId)`** (`lines 4211-4214`).
  3. Line 1622 runs `prepareSessionConfig` (which can trigger default-model catalog lookup).
  4. Only at line 1632 does `buildLaunchContext` call `this.requireActivePlugins(opening?.requiresPlugins)` and throw `RequiredPluginInactiveError`.
- **Why it matters to the maintainer:** A rejected open on a stored agent must fail before mutating durable state or running hooks/probes. Calling `deleteAgentState` before checking `requiresPlugins` destroys committed timeline rows on a failed open.
- **Concrete suggestion:** Check `this.requireActivePlugins(record.requiresPlugins)` at the start of `createAgentFromRecord` (before `createAgentInternal`), and similarly check `this.requireActivePlugins(requiresPlugins)` before `prepareSessionConfig` / `client.isAvailable()` in `resumeAgentFromPersistence` and `reloadAgentSessionInternal`. Keep the check in `buildLaunchContext` as well so a newly-added requirement from `agent.create.before` is still verified before launch.

---

### 6. `[needs decision]` `requiresPlugins` fails when a plugin is installed with `--id`, because the SDK does not expose the plugin's runtime ID

- **File and line:** `packages/server/src/server/plugins/runtime.ts:779-785,1786-1802`, `packages/plugin/src/server/contracts.ts:43-69`, `docs/plugins.md:75-78`, `public-docs/plugins/hooks.md:279-282`
- **Problem:** `docs/plugins.md:75-78` documents that a plugin's runtime ID is its daemon config key and can be overridden with `paseo plugin install <path> --id another-runtime-id`. `requireOwnPluginRequirement` checks `id === loaded.id` (the runtime ID), and `public-docs/plugins/hooks.md:281` shows authors hardcoding `"my-sandbox"`. However, neither `PluginServerContext` nor `PluginHookContext` exposes the plugin's runtime ID, so any plugin installed under a custom `--id` cannot name itself in `requiresPlugins` and will fail every `agent.create.before`.
- **Why it matters to the maintainer:** A public SDK contract that breaks under a documented install flag (`--id`) will either require a breaking API change later or force an immediate follow-up SDK surface addition. It is also worth deciding whether `requiresPlugins` belongs in this PR at all (the PR draft checklist already notes it can move to its own PR).
- **Concrete suggestion:** Pick one before merging:
  1. Expose `readonly pluginId: string` on `PluginServerContext` (or `PluginHookContext`) so hooks write `requiresPlugins: [...(request.requiresPlugins ?? []), server.pluginId]` (also useful for metadata key prefixing recommended in `hooks.md:109`).
  2. Or simplify the hook API to a boolean/opt-in (e.g., `requirePlugin?: boolean` on the `agent.create.before` return, with `PluginRuntime` appending `loaded.id` automatically), which works under `--id` and eliminates `requireOwnPluginRequirement` altogether (only choose this if later plugins do not need to edit the array directly; they can still read `requiresPlugins?: readonly string[]`).
  3. Or move commit 2 (`requiresPlugins`) to a follow-up PR and settle the runtime-ID design there.

---

### 7. `[deferred risk]` Dynamic `agent.open.before` hook unregistration while an earlier plugin's async hook runs bypasses `requiresPlugins`

- **File and line:** `packages/server/src/server/agent/agent-manager.ts:6383-6416`, `packages/server/src/server/plugins/runtime.ts:760-778,1326-1336`
- **Problem:** `requireActivePlugins` checks plugin activity once before `pluginLifecycle.before("agent.open.before", request)`. `PluginRuntime.before` snapshots `plugins`, then awaits each plugin sequentially. If an earlier plugin (sorting before required plugin `B`) awaits async work and during that window plugin `B` removes its `agent.open.before` handler via its cleanup callback (`hooks.changed`), `runtime.ts:767` sees `!loaded.hooks.includes("agent.open.before")`, skips `B`, and lets the open proceed unwrapped. (If `B`'s process exits or is stopped, `this.request` fails on the closed child, so crash/stop is safe; only dynamic hook removal hits the skip.)
- **Why it matters to the maintainer:** Validation cycle 2 already logged that activity is sampled before async hooks; this is the specific fail-open case inside that window.
- **Concrete suggestion:** Re-check `this.requireActivePlugins(opening?.requiresPlugins)` after `pluginLifecycle.before("agent.open.before", request)` resolves (or verify inside `PluginRuntime.before` that every required plugin actually executed an `agent.open.before` handler during the call).

---

### 8. `[deferred risk]` Imported agents (`importProviderSession`) can be wrapped on open but can never set `requiresPlugins`

- **File and line:** `packages/server/src/server/agent/agent-manager.ts:1823-1906`, `docs/plugins.md:493-516`, `public-docs/plugins/hooks.md:274-286`
- **Problem:** `importProviderSessionInternal` calls `buildLaunchContext` with `reason: "import"`, so `agent.open.before` runs and can return a `wrap`, but `agent.create.before` does not fire on import. Consequently, a sandbox plugin has no way to persist `requiresPlugins` on an imported agent; if the plugin is later disabled, resuming that imported agent opens unwrapped without error.
- **Why it matters to the maintainer:** A sandbox plugin author who wraps all `agent.open.before` opens and relies on `requiresPlugins` for fail-closed persistence could assume imported agents are protected too.
- **Concrete suggestion:** Document this limit explicitly in `docs/plugins.md` under `### Plugin requirements` and in `public-docs/plugins/hooks.md` (and `.zh-CN.md`) under `### Require your plugin for every open` (noting that a sandbox plugin that requires durable enforcement should reject `reason: "import"` in `agent.open.before` if it does not want unwrapped resumes later).

---

### 9. `[polish]` `sessionConfigSchema.wrap` accepts an empty executable string `[""]`

- **File and line:** `packages/plugin/src/server/provider.ts:895`
- **Problem:** `wrap: z.tuple([z.string()], z.string()).optional()` allows `[""]` across the provider protocol boundary, whereas `plugin-process-protocol.ts:193` uses `z.tuple([z.string().min(1)], z.string()).optional()` for `command` and `lifecycle/index.ts:125` enforces `isAbsolute` (which rejects `""`).
- **Why it matters to the maintainer:** Minor inconsistency between sibling tuple schemas in the provider boundary.
- **Concrete suggestion:** Change `packages/plugin/src/server/provider.ts:895` to `wrap: z.tuple([z.string().min(1)], z.string()).optional()`.

---

### 10. `[polish]` Returning an empty `requiresPlugins: []` persists an empty array to agent storage

- **File and line:** `packages/server/src/server/plugins/lifecycle/index.ts:316-321`, `packages/server/src/server/plugins/runtime.ts:1801`, `packages/server/src/server/agent/agent-projections.ts:102`
- **Problem:** `validateBeforeResult` checks `...(requiresPlugins ? { requiresPlugins } : {})` where `[]` is truthy, `requireOwnPluginRequirement` only normalizes `if (after.length > 0)`, and `toStoredAgentRecord` writes `agent.requiresPlugins ? [...agent.requiresPlugins] : undefined`. A create hook that returns `{ ...request, requiresPlugins: [...(request.requiresPlugins ?? [])] }` without adding itself persists `requiresPlugins: []` onto the agent record.
- **Why it matters to the maintainer:** Leaves noisy empty arrays in stored JSON files instead of omitting the optional field.
- **Concrete suggestion:** Guard with `requiresPlugins?.length` in `agent-projections.ts:102` (and `validateBeforeResult` at `lifecycle/index.ts:320` when `previous.requiresPlugins` is empty/absent).

---

### 11. `[polish]` Minor fit issues: post-hoc mutation of `client.supportsLaunchWrap` and placement of `RequiredPluginInactiveError`

- **File and line:** `packages/server/src/server/agent/provider-registry.ts:631,747-756`, `packages/server/src/server/agent/provider-options.ts:52-60`
- **Problem:**
  - `createResolvedProviderClient` mutates `client.supportsLaunchWrap = resolved.contract.supportsLaunchWrap === true;` after `wrapClientProvider` returns, while `wrapClientProvider` already constructs the returned `AgentClient` object literal and forwards `requireLaunchWrap` on line 631. Also, `PluginAgentClient` defines `requireLaunchWrap()` without `supportsLaunchWrap`, so direct consumers of `PluginAgentClientRegistry` see `supportsLaunchWrap === undefined` unless wrapped by `provider-registry.ts`.
  - `RequiredPluginInactiveError` is placed in `provider-options.ts`, which owns provider option validation and provider-level policy errors (`ProviderOptionsValidationError`, `ToolPolicyUnsupportedError`, `LaunchWrapUnsupportedError`). Plugin-active enforcement is a plugin-lifecycle / agent-open error, not a provider-option error.
- **Why it matters to the maintainer:** Keeps `wrapClientProvider` declarative (`docs/coding-standards.md:12`) and avoids turning `provider-options.ts` into a catch-all error bag.
- **Concrete suggestion:** Pass `supportsLaunchWrap` into `wrapClientProvider` (or stamp it inside the returned object literal alongside `requireLaunchWrap`), and consider placing `RequiredPluginInactiveError` in `plugins/lifecycle/index.ts` (or a dedicated agent-open error module if more arrive).

---

### 12. `[polish]` Test suite size (~1,161 added lines vs ~420 estimate) has avoidable fixture duplication

- **File and line:** `packages/plugin/src/server/acp.test.ts:6274-6449` (+178), `plugins/antigravity-provider/server/provider.test.ts:656-725` (+72), `packages/server/src/server/agent/plugin-provider.test.ts:3493-3525` (+33), `packages/server/src/server/agent/agent-manager.test.ts:16056-16146` (+90)
- **Problem:** The tests genuinely exercise real behavior through real interfaces, which is good, and the production code is lean (~238 net lines). However, ~200+ lines of the test diff are avoidable duplication:
  - `plugins/antigravity-provider/server/provider.test.ts:656-687` re-implements the fake `agy` script instead of reusing `launchAgent(...)` at line 14 of the same file.
  - `packages/server/src/server/agent/plugin-provider.test.ts:3493-3525` builds a 33-line `ReadableStream`/`WritableStream` ACP connector stub to test `runAcpProvider({ connector })`, duplicating `acp.test.ts:6438-6448` (`plugin-provider.test.ts:3464-3469` already verifies that a registration without `launchWrap` sets `supportsLaunchWrap: false`, and `lines 3444-3462` already verify that a connection without `session.launch_wrap` rejects `requireLaunchWrap`).
  - `packages/server/src/server/agent/agent-manager.test.ts:16056-16097` rebuilds a fresh `AgentManager`, `AgentStorage`, and `mkdtempSync` instead of adding optional `requiresPlugins` / `active` hooks to `createLaunchWrapManager` right above it; and `lines 16099-16146` (48 lines) can be dropped or collapsed as noted in Finding 4.
  - `packages/server/src/server/plugins/lifecycle/handlers.test.ts:1012-1135` (+126 lines) spreads 7 tiny schema/merge assertions across full boilerplate blocks; grouping the merge matrix with `test.each` or a one-line `invokeOpen(...handlers)` helper cuts ~40 lines while reading more clearly.
- **Why it matters to the maintainer:** Smaller, non-duplicated fixtures match `docs/testing.md:154-156` ("Extract complex setup into reusable helpers") and make the PR much faster to review.
- **Concrete suggestion:** Reuse `launchAgent` in `antigravity-provider/server/provider.test.ts`, drop the duplicate ACP connector test in `plugin-provider.test.ts`, extend `createLaunchWrapManager` for the `requiresPlugins` test in `agent-manager.test.ts`, and add a small `invokeOpen` helper in `handlers.test.ts`.

---

### 13. `[polish]` Small doc gaps and one ambiguous Chinese parenthetical in `hooks.zh-CN.md`

- **File and line:** `docs/plugins.md:465,544-652`, `public-docs/plugins/hooks.md:34,285`, `public-docs/plugins/hooks.zh-CN.md:32,277`
- **Problem:**
  - `docs/plugins.md:465` still says "`agent.open.before` contributes launch-only `env`, `tools`, and `mcpServers` on every open" immediately before the new `### Launch wrap` heading (and `public-docs/plugins/hooks.md:34` / `hooks.zh-CN.md:32` similarly omit launch wrap from the overview paragraph).
  - `docs/plugins.md` under `## Contribute a provider` (`lines 544-652`) documents `ProviderRegistration.command`, `status`, `installation`, `getCatalogCacheKey`, and `icon`, but has no cross-link to `ProviderRegistration.launchWrap` (which is only mentioned under `## Lifecycle hooks`).
  - `public-docs/plugins/hooks.md:285` says "Every later open checks the list before the open hooks run" — the initial create open also checks it (so a plugin that adds itself to `requiresPlugins` without registering `agent.open.before` fails on create itself). `docs/plugins.md:510` gets this right with "Every open checks the list".
  - `public-docs/plugins/hooks.zh-CN.md:277` reads `只要列表中的插件未激活（已加载、服务端进程在运行、注册了 \`agent.open.before\` 钩子），打开就会以 \`required_plugin_inactive\` 失败。` In Chinese, putting the definition of "active" directly after `未激活` ("not active") makes the parenthetical read at first glance like a definition of `未激活`. (Heading count, levels, order, and `{#id}` anchors between `hooks.md` and `hooks.zh-CN.md` all match, and spacing/terminology follow `docs/website-i18n.md`.)
- **Why it matters to the maintainer:** Keeps docs internally consistent (`CLAUDE.md`: "Integrate, don't append") and avoids confusing Chinese readers on the definition of an active plugin.
- **Concrete suggestion:** Update the summary sentences at `docs/plugins.md:465`, `public-docs/plugins/hooks.md:34`, and `hooks.zh-CN.md:32` to include `wrap` / launch wrap; add a one-line mention + link for `ProviderRegistration.launchWrap` under `## Contribute a provider` in `docs/plugins.md`; change "Every later open" / "之后每次打开" to "Every open" / "每次打开" in `hooks.md:285` and `hooks.zh-CN.md:277`; and clarify the Chinese parenthetical to `（激活指已加载、服务端进程在运行且注册了 \`agent.open.before\` 钩子）`.
