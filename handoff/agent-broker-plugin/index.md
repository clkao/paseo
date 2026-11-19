---
id: pxtsensqs4cvrks95q1regca
title: "Agents act under a verified identity, and the user grants what they may do (broker plugin)"
status: ideation  # handoff: not a task of the paseo workflow; to be filed by the plugin's owner project
source: CL, 2026-11-19
started: 2026-11-19
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate: agent-broker-plugin (ideation prototype)
---

## Problem

Any agent that Paseo runs can direct any other agent, and it can appear as any sender. The CLI sends the agent ID it finds in its environment (`PASEO_AGENT_ID`), and the agent tool endpoint takes the caller from its URL (`callerAgentId`). The daemon checks neither, and the recipient shows whatever the caller claimed. A live test accepted a forged sender on the CLI, on the tool endpoint, and through a connected host (`.spacedock/repo/research/forged-caller-identity/`).

What this means for a user who runs several agents, for example a Spacedock first officer and its workers:
- the "Sent by" name on an agent message cannot be trusted;
- any agent can prompt, stop or redirect agents that it has nothing to do with.

## Proposed approach

A broker plugin is the only route from an agent to the daemon (`design.md` beside this file):
- **Token:** at `agent.session_open`, the plugin creates a token for the launch. A sidecar holds the token; the agent never does.
- **Wiring:** the plugin points the agent's CLI (`PASEO_HOST`) and a `paseo-acl` MCP server at the sidecar.
- **Endpoint:** the broker endpoint verifies the token, ignores any identity the agent claims, applies the grants the user has given, and forwards allowed requests over the plugin's own daemon session with the verified agent as sender.
- **Requirements:** the daemon runs with `daemon.mcp.injectIntoAgents: false`. A sandbox gives each agent only its own sidecar socket.
- **Core:** no core change is required. `design.md` lists optional core changes for later.

Explored and not chosen (records in `.spacedock/repo/research/`):
- `forged-caller-identity`: a rule inside the daemon;
- `os-user-broker`: a broker that identifies agents by OS user;
- `agent-channel-probe`: identity from the peer process, or from an inherited socketpair.

## Acceptance criteria

Draft. Ideation finalizes them after the prototype reports.

**AC-1: "Sent by" is true.** A message that agent P sends to its child B through the broker shows P as the sender in B's timeline. A request from agent A that claims to be P is refused.
Verified by: a test that runs from inside A's sandbox and from inside P's, and reads B's stored timeline. It fails if the broker trusts the claimed ID.

**AC-2: No grant, no authority.** Without a grant, an agent cannot send to, read, control or create on behalf of another agent. A request with no caller ID is refused.
Verified by: the same test with an empty grant list. Each refusal carries a reason code.

**AC-3: Orchestrators work with one grant.** With `direct` on `started-by:self`, P directs every agent it starts, and no other agent.
Verified by: P creates two children through the broker and directs both. A third agent, not started by P, is refused.

**AC-4: No route around the broker.** From inside an agent's sandbox, the daemon listener, `$PASEO_HOME` and other agents' sidecar sockets are unreachable.
Verified by: the connection and read attempts fail inside the sandbox stand-in.

**AC-5: The token never reaches the agent.** No token appears in an agent's environment, files or stored timeline.
Verified by: a grep of the environment and timelines of each test agent for the issued tokens.

Platforms: daemon host (Linux, macOS), the CLI, and the app, through the plugin's settings screen for grants.

## Ideation work

The design depends on mechanisms the plugin system has not shown yet, such as setting `PASEO_HOST` at session open and setting the sender through the plugin's own session. A bounded prototype on the VM tests them before the design is final.

### Prototype mandate

- **Aim:** a Paseo plugin that is the only route from an agent to the daemon.
  - At `agent.session_open`, the plugin creates a token for the agent and starts a sidecar that holds the token. It sets `PASEO_HOST` to the sidecar's Unix socket and adds an MCP server (`paseo-acl`) whose tools match the built-in ones the tests need. The MCP server is a stdio bridge to the sidecar.
  - The sidecar adds the token to each request. The plugin's endpoint verifies the token, ignores claimed IDs, applies grants (rule 1: an agent directs only the agents it started), and forwards allowed requests over the plugin's own daemon session with the verified caller as sender.
- **Stop line:** P-1 to P-5 pass, and every open item below has an answer. P-6 comes after the stop line.
- **Budget:** one working day of one agent. Push access to `clkao/paseo` ends at about 2026-11-20 19:20 UTC, so push before 19:00 UTC.
- **Where:** VM `paseo-acl-prototype`, workspace `agent-identity-acl` (`wks_d70f4643277e6dda`). Code goes on branch `acl/broker-plugin` of `clkao/paseo`, in the top-level directory `acl-broker-plugin/`. The report goes to `~/acl-result/broker-plugin/` on the VM.
- **Approval:** CL asked for this on 2026-11-19.

### Prototype checks

The forge tests are scripts the harness runs from inside agent A's sandbox. They are not requests to a model.

- **P-1 Forge refused.** From A, through the broker:
  - the CLI with `PASEO_AGENT_ID` set to P's ID, directing B (P's child);
  - a `paseo-acl` tool call that claims P;
  - a request with no caller ID.

  Each is refused with a reason code. **Control:** a test-only switch that makes the plugin trust claimed IDs lets the first two through.
- **P-2 No route around the broker.** From inside A's sandbox: connecting to the test daemon's listener, reading the test daemon's `PASEO_HOME`, and connecting to P's sidecar socket all fail.
- **P-3 Honest calls work.** P directs its own child B through the CLI and through the `paseo-acl` tools, and B's timeline records P as the sender. The tokens never appear in an agent's environment or in an agent's transcript (grep the stored timelines).
- **P-4 Parentage.** A child that P creates through the broker carries `paseo.parent-agent-id` = P. An agent's attempt to set or change `paseo.parent-*` labels through the broker is stripped or refused.
- **P-5 Lifecycle.**
  - After the plugin reloads, the old sidecar sockets fail. They work again once the session reopens.
  - After an agent restarts, the old token is refused.
- **P-6 (after the stop line).** One grant for a connected host, or `ask` routed to an operator permission request.

### Open items to answer

1. Can `agent.session_open` set `PASEO_HOST` in the agent's launch environment?
2. Can the plugin's SDK session set the sender on a send (`sourceAgentId`) and the caller on a create (`callerAgentId`), so that the daemon stamps the right parent?
3. What does `injectIntoAgents: false` remove? Voice mode's `speak` tool is expected to go. List what else goes.
4. Does Codex's own sandbox (workspace-write) block the sidecar socket? Which setting allows it?
5. How much of the CLI's WebSocket protocol is needed for `paseo send`, `run`, `ls`, `logs` and `wait`? Measure what the broker must carry.
6. Measure the memory of one sidecar per agent against one sidecar process for all agents.

### Sandbox stand-in

The design leaves isolation to a sandbox. On the VM, the provider command is a wrapper (`docs/custom-providers.md`, custom binaries) that runs the agent in a stand-in. Use `bubblewrap` if it is installed, or install it with apt (approved). The stand-in:
- hides the test daemon's socket directory and `PASEO_HOME`;
- binds only that agent's sidecar socket into the agent;
- keeps network access for the LLM gateway.

Identity must come only from the token, never from a UID or PID. State the stand-in in the report.


## Test plan

Ideation writes it from the prototype's scripts.

### Feedback Cycles

## Out of scope

- Grants across connected hosts. The first release refuses agent requests that name another host.
- In-process tools, such as OpenCode's bridge and native tool catalogs.
- An `ask` decision that routes to an operator approval.
- Core changes to Paseo. `design.md` lists them as optional follow-ups.

## Prototype result (2026-11-19)

Reported by VM agent `bc3097af` (Codex, astra). The report is on the VM in `~/acl-result/broker-plugin/` (`REPORT.md`, `tests/`). It has not been copied here. The first officer has not checked the logs; they are not reachable from this Mac.

Code: branch `acl/broker-plugin` of `clkao/paseo`, head `6ce0b15`, based on upstream `95542dbf`. Everything is under `acl-broker-plugin/`. Lint, format and typecheck pass.

| Check | Result |
|---|---|
| P-1 Forge refused | **Incomplete.** All three refusal cases pass against the plugin with an in-memory SDK fixture, and the no-ID case also passes against a live daemon. Two checks were not run: the live impersonation trials (CLI and tool claiming P), and the control that trusts claimed IDs. The report does not say why. |
| P-2 No route around the broker | Pass. From A's shell, the daemon listener, its `PASEO_HOME` and P's socket all return `ENOENT`, and A can open its own socket. |
| P-3 Honest calls | Pass. B records P as sender on CLI and MCP messages. The token scan of environments and timelines finds zero matches. |
| P-4 Parentage | Pass. B's stored parent is P, and the reserved labels are stripped. |
| P-5 Lifecycle | Pass. The old socket returns `ECONNREFUSED` after reload. After reopen, the old token returns `INVALID_TOKEN` and the new one is accepted. |
| P-6 Grant or ask | Deferred at the stop line. |

| Open item | Answer |
|---|---|
| 1. `PASEO_HOST` at session open | Yes. On upstream `95542dbf` the hook is named `agent.open.before`. This checkout's docs still say `agent.session_open`. |
| 2. Sender and caller through the SDK | Yes. `sourceAgentId` sets the sender, and the SDK `parent` handle supplies the caller on create. |
| 3. What `injectIntoAgents: false` removes | The internal MCP server and the native Paseo catalogs, including the conditional `speak` and browser tools. The plugin's `paseo-acl` server stays. |
| 4. Codex sandbox | `workspace-write` returns `EPERM` by default. `sandbox_workspace_write.network_access=true` allows the socket, which also opens Codex's network. |
| 5. CLI protocol | Traced for `send`, `run`, `ls`, `logs` and `wait`. The broker implements text send and wait-for-finish. |
| 6. Sidecar memory | Eight idle sidecar processes: 124.7 MiB PSS. Eight listeners in one process: 16.9 MiB. One sidecar process for all agents is the better design. |

Open before design: the live forge trials and their control; voice `speak` and the browser tools, which the plugin must provide again; Codex's network opening; Claude (HTTP 402, exe credits).

