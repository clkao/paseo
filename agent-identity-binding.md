---
id: w56cr94dn8j8scsp9hwc6s42
title: "Bind the caller identity of each agent to a credential the daemon issues"
status: backlog
source: Result of agent-identity-acl, 2026-11-18
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate:
---

The daemon cannot know which agent sent a request. Each agent states its own ID, and any agent can state another agent's ID (`agent-identity-acl/index.md`, Result, question 2). The parent-only rule on branch `acl/agent-identity` of `clkao/paseo` refuses an honest agent, but it cannot refuse a forged or omitted identity. This task makes the identity something the daemon issues and checks.

## Problem

- The CLI sends `PASEO_AGENT_ID` from the environment. The tool endpoint reads `callerAgentId` from the query string. Neither value is bound to the process that sends it.
- Agents authenticate with the operator's authority: the local credential file in `PASEO_HOME`, and one capability token for each daemon run (none at all when no password is set). An agent that leaves out its ID is treated as the operator.
- A connected host trusts the caller that the first daemon forwards, so the identity on the first daemon decides what the caller can do on every host.

## Proposed approach

First candidate: the capability pattern in `.spacedock/repo/notes/agent-access-capability-pattern.md` (main of the spec repository). Use it, or say why it does not fit. Applied here:

- **Identity from the channel.** When the daemon starts an agent, it creates a credential for that agent alone. The daemon takes the caller's identity from the credential and ignores `callerAgentId` and `sourceAgentId` when they disagree with it. That credential could be an MCP bearer for each agent, and a CLI credential put in the agent's environment in place of the shared local credential.
- **The secret stays at the edge.** The operator credential must be out of the agent's reach. Agents run as the daemon's own user, so this needs a sandbox (for example Safehouse) or a separate home. Find out how much of this Paseo can do by itself and how much needs the sandbox.
- **Grant as a relation.** First grant: an agent directs the agents it started, compared on the (server ID, agent ID) pair. The rule from `acl/agent-identity` is the starting point.
- **Routed calls.** The origin daemon sends the bound identity, and the destination accepts it under the authority of the link only.

## Risk evidence

The riskiest unknown is whether an agent can be kept away from the operator credential without a sandbox. The `docs/permissions.md` model, with a principal, credentials and attenuated sessions, can possibly give each agent a principal or a session.

Also check one possible boundary crossing. Find out if the `/mcp/agents` bearer token or the local credential is visible to other OS users, for example in the process arguments of an agent (`ps`). `SECURITY.md` says the password protects against other OS users. If another user can read the token, that breaks a stated promise, and CL must report it to the Paseo project privately.

## Acceptance criteria

**AC-1: A forged identity is refused.**
Verified by: `agent-identity-acl/result/tests/forge-identity.py` runs again against a daemon with this change. The three cases (CLI, `/mcp/agents`, connected host) are refused. Removing the binding makes the test pass again.

**AC-2: An omitted identity is not operator authority.**
Verified by: an agent process that unsets `PASEO_AGENT_ID` or omits `callerAgentId` cannot direct an agent that it did not start.

**AC-3: Honest calls still work.**
Verified by: a parent directs its own child through the CLI, through `/mcp/agents` and on a connected host. The operator's CLI and the app keep working.

**AC-4: The token is not visible to other OS users.**
Verified by: `ps` run as a second OS user, while an agent is running, shows no bearer token or credential.

## Test plan

Run on an exe.dev VM, as in `agent-identity-acl`, with test daemons on their own ports and homes. Run one test file at a time.

### Feedback Cycles

## Out of scope

- Grants beyond "an agent directs the agents that it started", such as labels, projects, a time limit or step-up.
- An upstream pull request. That is a separate decision of CL after validation.
