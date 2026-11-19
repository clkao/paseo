---
id: pxtsensqs4cvrks95q1regca
title: "Prototype: the agent broker as a Paseo plugin (sidecar holds the token)"
status: implementation
source: CL, 2026-11-19
started: 2026-11-19
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate: agent-broker-plugin
---

The design in `.spacedock/repo/notes/agent-identity-and-grants.md` can be built as a plugin on today's plugin system, if a sandbox does the isolation and the daemon runs with `injectIntoAgents: false`. This prototype checks that on the VM.

## Mandate

- **Aim:** a Paseo plugin that is the only route from an agent to the daemon.
  - At `agent.session_open`, the plugin creates a token for the agent and starts a sidecar that holds the token. It sets `PASEO_HOST` to the sidecar's Unix socket and adds an MCP server (`paseo-acl`) whose tools match the built-in ones the tests need. The MCP server is a stdio bridge to the sidecar.
  - The sidecar adds the token to each request. The plugin's endpoint verifies the token, ignores claimed IDs, applies grants (rule 1: an agent directs only the agents it started), and forwards allowed requests over the plugin's own daemon session with the verified caller as sender.
- **Stop line:** AC-1 to AC-5 pass, and every open item below has an answer. AC-6 comes after the stop line.
- **Budget:** one working day of one agent. Push access to `clkao/paseo` ends at about 2026-11-20 19:20 UTC, so push before 19:00 UTC.
- **Where:** VM `paseo-acl-prototype`, workspace `agent-identity-acl` (`wks_d70f4643277e6dda`). Code goes on branch `acl/broker-plugin` of `clkao/paseo`, in the top-level directory `acl-broker-plugin/`. The report goes to `~/acl-result/broker-plugin/` on the VM.
- **Approval:** CL asked for this on 2026-11-19.

## Acceptance criteria

The forge tests are scripts the harness runs from inside agent A's sandbox. They are not requests to a model.

- **AC-1 Forge refused.** From A, through the broker:
  - the CLI with `PASEO_AGENT_ID` set to P's ID, directing B (P's child);
  - a `paseo-acl` tool call that claims P;
  - a request with no caller ID.

  Each is refused with a reason code. **Control:** a test-only switch that makes the plugin trust claimed IDs lets the first two through.
- **AC-2 No route around the broker.** From inside A's sandbox: connecting to the test daemon's listener, reading the test daemon's `PASEO_HOME`, and connecting to P's sidecar socket all fail.
- **AC-3 Honest calls work.** P directs its own child B through the CLI and through the `paseo-acl` tools, and B's timeline records P as the sender. The tokens never appear in an agent's environment or in an agent's transcript (grep the stored timelines).
- **AC-4 Parentage.** A child that P creates through the broker carries `paseo.parent-agent-id` = P. An agent's attempt to set or change `paseo.parent-*` labels through the broker is stripped or refused.
- **AC-5 Lifecycle.**
  - After the plugin reloads, the old sidecar sockets fail. They work again once the session reopens.
  - After an agent restarts, the old token is refused.
- **AC-6 (after the stop line).** One grant for a connected host, or `ask` routed to an operator permission request.

## Open items to answer

1. Can `agent.session_open` set `PASEO_HOST` in the agent's launch environment?
2. Can the plugin's SDK session set the sender on a send (`sourceAgentId`) and the caller on a create (`callerAgentId`), so that the daemon stamps the right parent?
3. What does `injectIntoAgents: false` remove? Voice mode's `speak` tool is expected to go. List what else goes.
4. Does Codex's own sandbox (workspace-write) block the sidecar socket? Which setting allows it?
5. How much of the CLI's WebSocket protocol is needed for `paseo send`, `run`, `ls`, `logs` and `wait`? Measure what the broker must carry.
6. Measure the memory of one sidecar per agent against one sidecar process for all agents.

## Sandbox stand-in

The design leaves isolation to a sandbox. On the VM, the provider command is a wrapper (`docs/custom-providers.md`, custom binaries) that runs the agent in a stand-in. Use `bubblewrap` if it is installed, or install it with apt (approved). The stand-in:
- hides the test daemon's socket directory and `PASEO_HOME`;
- binds only that agent's sidecar socket into the agent;
- keeps network access for the LLM gateway.

Identity must come only from the token, never from a UID or PID. State the stand-in in the report.

## Result

To be written: each AC with its command and output, the answer to each open item, the branch and its head commit, and what is still open.
