---
id: rk8dekycjb4ef0yhymh07zvp
title: "Prototype: access control by the sending agent in the daemon and the CLI"
status: backlog
source: MetaFO for CL, 2026-11-18
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate: agent-identity-acl
---

A prototype, not a design document. It finds out whether the daemon can know which agent sent a request, and whether it can refuse that request on that basis.

## Mandate

- **Aim:** three answers, each with evidence from a running daemon.
  1. Where the identity of the sender comes from, for a CLI call and for a call to the agent tool endpoint (`/mcp/agents`).
  2. Whether an agent can forge that identity. Prove it with one test in which an agent tries.
  3. The one point in the daemon that can refuse a request, and the smallest rule there, for example "an agent can direct only the agents that it started". Show the rule refusing one request and allowing one.
- **Stop line:** the answer to question 2, with its test. If forging is possible, question 3 is the design of the fix and a prototype only if the day allows. Stop and report at the end of the budget even if question 3 is open.
- **Budget:** one working day of one agent.
- **Where:** a clean VM on exe.dev. Not on CL's Mac: no daemon on this Mac is started, stopped or changed.
- **Approval:** CL or MetaFO approves this mandate, the VM and its cost before it starts.

## Starting points in the source

Read from this checkout at upstream `2c23cd492`. These are leads for the prototype, not findings.

- CLI identity: `packages/cli/src/utils/caller-agent.ts` reads `PASEO_AGENT_ID` from the environment of the shell and checks only that such an agent exists. The daemon sets that variable when it starts an agent: `packages/server/src/server/agent/agent-manager.ts:5569`. Some commands read it directly: `packages/cli/src/commands/agent/send.ts:202`, `packages/cli/src/commands/schedule/shared.ts:127`.
- CLI authority: `packages/cli/src/utils/client.ts:174` authenticates with the local credential file in `PASEO_HOME` (`packages/server/src/server/local-credential.ts`). Any process that can read that file gets the same authority.
- Tool endpoint identity: `packages/server/src/server/agent/runtime-mcp-config.ts:50` puts `?callerAgentId=<id>` in the MCP URL that each agent receives. `packages/server/src/server/bootstrap.ts:1582` and the request handler after it take `callerAgentId` from the query string. The endpoint checks one capability token for each daemon run (`bootstrap.ts:695`, `isAgentMcpRequestAuthorized` in `packages/server/src/server/auth.ts:136`), and that token is the same for all agents.
- Tool handlers that use the caller: `packages/server/src/server/agent/tools/paseo-tools.ts` (for example the parent lookup near line 853 and `requireParentOwnership` near line 700).
- Authorization today: `packages/server/src/server/authorization/index.ts` (`SessionAuthorization`, daemon-wide permissions), checked for each WebSocket message at `packages/server/src/server/session.ts:2208`. `docs/permissions.md` describes the model: permissions are for each principal, not for each agent.

## Acceptance criteria

**AC-1 — The source of identity is named for both paths.**
Verified by: a request log or debugger output from the VM daemon that shows the identity field on one CLI call and one tool-endpoint call.

**AC-2 — The forgery test has a result.**
Verified by: a script that runs as agent A and directs agent B, which A did not start, by a changed `PASEO_AGENT_ID` or `callerAgentId`; its output and the daemon's response. The test fails if the daemon refuses.

**AC-3 — One refusal point and one rule are shown or designed.**
Verified by: a patch on a branch in the VM, with the forgery test from AC-2 refused and a legal request from A to its own child allowed. If the day ends first: the file and line of the refusal point and the rule in one paragraph.

## Out of scope

- A complete permission design, a UI, or a change to `packages/protocol`.
- Any push, pull request or issue upstream.
