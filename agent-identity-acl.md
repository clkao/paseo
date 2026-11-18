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
  2. Whether an agent can forge that identity. Prove it with one test in which an agent tries. Then answer whether a forged identity reaches a connected host: `docs/connected-hosts.md` says that the daemon that saves a host forwards the grants of the caller, and that the destination admits each session under the identity of the one link. So a forged caller on the first daemon possibly operates on every connected host.
  3. The one point in the daemon that can refuse a request, and the smallest rule there, for example "an agent can direct only the agents that it started". Show the rule refusing one request and allowing one.
- **Stop line:** the answer to question 2, with its test. If forging is possible, question 3 is the design of the fix and a prototype only if the day allows. Stop and report at the end of the budget even if question 3 is open.
- **Budget:** one working day of one agent.
- **Approval:** CL approved the next step on 2026-11-18. CL starts the VM. MetaFO starts the mandate agent. The first officer here does not start it.

## Environment

- **VM:** `paseo-acl-prototype` on exe.dev. Its exe.dev comment: "paseo: access control prototype, first mandate; remove: when the mandate stops, or 2 days after the start".
- **Paseo on the VM:** Shelley, the exe.dev agent, installs Paseo from a prompt. The daemon listens on port 6767 and starts at boot. It has no password, because the exe.dev proxy does the authentication. The mandate agent runs on this daemon, so it must not stop, restart or reconfigure it.
- **Models:** agents on the VM use the exe.dev LLM gateway, paid with exe credits: Claude through `https://llm.int.exe.xyz`, Codex through `https://llm.int.exe.xyz/openai/v1`. The VM holds no provider key and no Claude account of CL.
- **Source:** the same prompt clones `getpaseo/paseo` to `~/paseo` with the remote name `upstream`, and does not build it.
- **Connection:** CL registers the VM as a host on the daemon of CL's Mac. MetaFO starts the mandate agent on the VM through that daemon and passes its reports to the first officer here. No SSH key is used.
- **Test daemons:** run every test on daemons that the mandate agent starts on the VM, with their own `PASEO_HOME` and port (for example 7801 and 7802), never on 6767. Two test daemons, the second registered as a connected host of the first, answer the connected-host part of question 2. Copy the gateway provider settings from the 6767 daemon's config so that test agents can run.
- **Build:** AC-3 needs a daemon built from `~/paseo`. That needs `npm ci` on the VM. This is a download on the VM and needs CL's approval with the mandate.

## Result

The mandate agent writes everything to `~/acl-result/` on the VM:

- `REPORT.md`: the answers to questions 1 to 3, each with the commands that were run and their output, and the upstream commit that `~/paseo` was at.
- `*.patch`: `git format-patch upstream/main` from the prototype branch in `~/paseo`, if a patch exists.
- `tests/`: the forgery scripts and the daemon log excerpts that they cite.

Before CL removes the VM, MetaFO copies `~/acl-result/` to `.spacedock/results/agent-identity-acl/` in the Paseo checkout on CL's Mac. `.spacedock/` is excluded from the code tree.

## Starting points in the source

Read from the Mac checkout at upstream `2c23cd492`. Line numbers can differ on the VM clone. These are leads for the prototype, not findings.

- CLI identity: `packages/cli/src/utils/caller-agent.ts` reads `PASEO_AGENT_ID` from the environment of the shell and checks only that such an agent exists. The daemon sets that variable when it starts an agent: `packages/server/src/server/agent/agent-manager.ts:5569`. Some commands read it directly: `packages/cli/src/commands/agent/send.ts:202`, `packages/cli/src/commands/schedule/shared.ts:127`.
- CLI authority: `packages/cli/src/utils/client.ts:174` authenticates with the local credential file in `PASEO_HOME` (`packages/server/src/server/local-credential.ts`). Any process that can read that file gets the same authority.
- Tool endpoint identity: `packages/server/src/server/agent/runtime-mcp-config.ts:50` puts `?callerAgentId=<id>` in the MCP URL that each agent receives. `packages/server/src/server/bootstrap.ts:1582` and the request handler after it take `callerAgentId` from the query string. The endpoint checks one capability token for each daemon run (`bootstrap.ts:695`, `isAgentMcpRequestAuthorized` in `packages/server/src/server/auth.ts:136`), and that token is the same for all agents.
- Tool handlers that use the caller: `packages/server/src/server/agent/tools/paseo-tools.ts` (for example the parent lookup near line 853 and `requireParentOwnership` near line 700).
- Authorization today: `packages/server/src/server/authorization/index.ts` (`SessionAuthorization`, daemon-wide permissions), checked for each WebSocket message at `packages/server/src/server/session.ts:2208`. `docs/permissions.md` describes the model: permissions are for each principal, not for each agent.

## Acceptance criteria

**AC-1 — The source of identity is named for both paths.**
Verified by: a request log or debugger output from the VM daemon that shows the identity field on one CLI call and one tool-endpoint call.

**AC-2 — The forgery test has a result.**
Verified by: a script that runs as agent A and directs agent B, which A did not start, by a changed `PASEO_AGENT_ID` or `callerAgentId`; its output and the daemon's response. The test fails if the daemon refuses. A second run on the connected-host pair shows whether the forged caller reaches the second daemon.

**AC-3 — One refusal point and one rule are shown or designed.**
Verified by: a patch in `~/acl-result/` from a branch in `~/paseo` on the VM, with the forgery test from AC-2 refused and a legal request from A to its own child allowed. If the day ends first: the file and line of the refusal point and the rule in one paragraph.

## Out of scope

- A complete permission design, a UI, or a change to `packages/protocol`.
- Any push, pull request or issue upstream.

## First prompt for the mandate agent on the VM

MetaFO sends this text unchanged.

```text
You are the agent of the mandate agent-identity-acl on the exe.dev VM paseo-acl-prototype. CL approved it. Budget: one working day. Write everything to ~/acl-result/ (REPORT.md, *.patch, tests/). Nothing leaves the VM in another way: no push, pull request, issue or comment.

Aim, three answers, each with evidence from a running daemon:
1. Where does the daemon get the identity of the agent that sends a request, for a CLI call (`paseo ...` from an agent's shell) and for a call to the agent tool endpoint /mcp/agents?
2. Can an agent forge that identity? Test it once: agent A directs agent B, which A did not start, by a changed PASEO_AGENT_ID or callerAgentId. Then test whether the forged caller also operates on a connected host. docs/connected-hosts.md says the saving daemon forwards the caller's grants and the destination admits each session under the one link's identity.
3. Name the one point in the daemon that can refuse such a request, and the smallest rule there, for example "an agent can direct only the agents that it started". Prototype it as a branch in ~/paseo if the day allows: the test from 2 refused, a request from A to its own child allowed.

Stop line: the answer to 2 with its test. At the end of the budget, write REPORT.md and stop, even if 3 is open.

Rules:
- The daemon on port 6767 runs you. Do not stop, restart or reconfigure it. Run every test on daemons that you start, each with its own PASEO_HOME and port (7801, 7802). For the connected-host test, register 7802 as a host on 7801. Copy the LLM gateway provider settings from the 6767 config so that test agents can run. Use only the exe.dev gateway; there is no provider key on this VM.
- ~/paseo is a clone of getpaseo/paseo, remote upstream, not built. You may run `npm ci` and build in ~/paseo for question 3.
- Leads, to check, not to trust: packages/cli/src/utils/caller-agent.ts (reads PASEO_AGENT_ID from the environment); packages/server/src/server/agent/runtime-mcp-config.ts (puts ?callerAgentId= in the MCP URL); packages/server/src/server/bootstrap.ts, the /mcp/agents handler (takes callerAgentId from the query string; one capability token per daemon run, shared by all agents); packages/server/src/server/agent/tools/paseo-tools.ts; packages/server/src/server/authorization/index.ts and session.ts (daemon-wide permissions for each principal); docs/permissions.md; docs/connected-hosts.md.
- REPORT.md: each answer with the commands and their output, the upstream commit of ~/paseo, and what is still open. Patches: `git format-patch upstream/main` into ~/acl-result/. Test scripts and the log excerpts they cite go in ~/acl-result/tests/.
```
