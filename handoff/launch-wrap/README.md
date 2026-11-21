# Launch-wrap contract (received copy)

Received 2026-11-21 from the paseo-safehouse manager (`7d469e54`) at CL's instruction. It is the full text of `docs/dev/.spacedock-state/_handoff/paseo-launch-wrap-proposal.md` in the paseo-safehouse checkout, at state commit `a13f681`. The supporting `launch-map.md` and `review-astra.md` were not sent and are not here.

The paseo-safehouse manager's answers:
1. The contract is as written. The open request also carries `launchWrap: boolean`.
2. Include `requiresPlugin` in the prototype, as a separate commit.
3. Safehouse needs the acceptance checks in "First PR", especially check 8: an older host must not silently drop `wrap`.

The full proposal text is the message of 2026-11-21 recorded in the paseo project manager's session. The parts that bind the task are listed below.

## First-PR acceptance checks

1. Two concurrent opens on one plugin connection, with only one wrapped, show distinct argv at the spawn.
2. A configured command with arguments is wrapped correctly, and so is an argument that contains spaces.
3. A provider without support is rejected before session dispatch.
4. A later hook that omits the prefix keeps it. A later hook that gives a different prefix fails the open.
5. A missing launcher gives an error, and no harness starts without the prefix.
6. For Codex, an ordinary resume and an archived resume both go through the captured spawn.
7. For Antigravity through `runAcpProvider`, the spawn argv is `[...wrap, agy, acp, --disable-telemetry]`, and the env is the final hook env.
8. A host without `wrap` support fails the open, or the plugin can detect the missing support before it returns `wrap`.
9. A history open is wrapped.

## Documented limits of the guarantee

The guarantee: once an open selects a wrapper, a supported provider runs that session's harness through it, or reports a failure before it starts the harness without it. It does not cover:
1. Work before the hook. This includes draft command and control discovery, the catalog lookup during create, availability checks, and plugin `status` such as the ACP capability probe.
2. Host-side operations: executable probes, version and update commands, usage queries and diagnostics.
3. Paseo's own host terminal tools (`create_terminal`, `send_terminal_keys`).
4. Plugin loss, which `requiresPlugin` addresses.

## Open questions for maintainers

1. A durable plugin requirement: included as `requiresPlugin`.
2. Draft discovery in protected workspaces: a policy hook or cached data. Separate from this PR.
3. Windows. Resolved in this project on 2026-11-21: a Windows script launcher (`.cmd`/`.bat`) is supported through `spawnProcess`, which runs it through `cmd.exe` with tested quoting, as it does for every provider launcher. A provider command that is a script is only an argument to the wrapper. The rejection agreed earlier was dropped after validation showed it broke refresh.

## Later PRs, one provider at a time

| Provider | Paths that must also carry the prefix |
|---|---|
| Claude | The lazy query start, including the self-Node substitution. |
| Pi | The MCP support probe that starts a second harness. |
| OMP | The restart after a mode change. |
| Core ACP | The session spawn, and the terminal commands the agent asks for. |
| OpenCode | Wrapped opens use an owned, fresh dedicated server. Opens that would reuse an existing server or an external service are rejected. |
| Muse | The launch for each `MuseSession` connection only. |
