# Explored: forged caller identity in the daemon and the CLI (2026-11-18)

This is an explored approach, not a workflow task. It serves the task `agent-broker-plugin`.

A prototype, not a design document. It finds out whether the daemon can know which agent sent a request, and whether it can refuse that request on that basis.

## Mandate

- **Aim:** three answers, each with evidence from a running daemon.
  1. Where the identity of the sender comes from, for a CLI call and for a call to the agent tool endpoint (`/mcp/agents`).
  2. Whether an agent can forge that identity. Prove it with one test in which an agent tries. Then answer whether a forged identity reaches a connected host: `docs/connected-hosts.md` says that the daemon that saves a host forwards the grants of the caller, and that the destination admits each session under the identity of the one link. So a forged caller on the first daemon possibly operates on every connected host.
  3. The one point in the daemon that can refuse a request, and the smallest rule there, for example "an agent can direct only the agents that it started". Show the rule refusing one request and allowing one.
- **Stop line:** the answer to question 2, with its test. If forging is possible, question 3 is the design of the fix and a prototype only if the day allows. Stop and report at the end of the budget even if question 3 is open.
- **Budget:** one working day of one agent.
- **Approval:** CL approved the next step on 2026-11-18. CL starts the VM. MetaFO starts the mandate agent. The first officer here does not start it.

## After the prototype

The design step after question 2 starts from the design note `.spacedock/repo/notes/agent-access-capability-pattern.md`, which lives on `main` of the spec repository. The note describes the exe.dev integration pattern: the secret stays at the edge, the channel gives the caller's identity, a grant is a relation, and a grant can be narrower. The design uses this pattern as its first candidate, or says why it does not fit. The prototype does not change.

## Environment

- **VM:** `paseo-acl-prototype` on exe.dev. Its exe.dev comment: "paseo: access control prototype, first mandate; remove: when the mandate stops, or 2 days after the start".
- **Paseo on the VM:** Shelley, the exe.dev agent, installs Paseo and the gateway setup from a prompt that is the same for each VM. The daemon listens on port 6767 and starts at boot. It has no password, because the exe.dev proxy does the authentication. The mandate agent runs on this daemon, so it must not stop, restart or reconfigure it.
- **Models:** agents on the VM use the exe.dev LLM gateway, paid with exe credits: Claude through `https://llm.int.exe.xyz`, Codex through `https://llm.int.exe.xyz/openai/v1`. The VM holds no provider key and no Claude account of CL.
- **Source:** the VM has no Paseo source. The mandate agent's first step clones the fork `clkao/paseo` to `~/paseo` as `origin` (on the VM: `https://github.int.exe.xyz/clkao/paseo.git`) and adds `https://github.com/getpaseo/paseo.git` as `upstream`.
- **Push access:** an exe.dev integration gives the VM push access to `clkao/paseo` only, for 48 hours. Each push shows as CL's GitHub user. `gh` on the VM needs `GH_HOST=github.int.exe.xyz`. The agent pushes only to branches named `acl/...` on `origin`. It never pushes to `main`, and it opens no pull request, issue or comment on the fork or on `getpaseo/paseo`.
- **Connection:** CL registers the VM as a host on the daemon of CL's Mac. MetaFO starts the mandate agent on the VM through that daemon and passes its reports to the first officer here. No SSH key is used.
- **Test daemons:** run every test on daemons that the mandate agent starts on the VM, with their own `PASEO_HOME` and port (for example 7801 and 7802), never on 6767. Two test daemons, the second registered as a connected host of the first, answer the connected-host part of question 2. Copy the gateway provider settings from the 6767 daemon's config so that test agents can run.
- **Build:** AC-3 needs a daemon built from `~/paseo`. That needs `npm ci` on the VM. This is a download on the VM and needs CL's approval with the mandate.

## Result

The mandate agent writes everything to `~/acl-result/` on the VM:

- `REPORT.md`: the answers to questions 1 to 3, each with the commands that were run and their output, and the commit of `upstream/main` that the work is based on.
- The prototype code is not in this directory. It is on the branch `acl/agent-identity` of `clkao/paseo`, and `REPORT.md` names the branch and its head commit.
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
Verified by: the branch `acl/agent-identity` on `clkao/paseo`, with the forgery test from AC-2 refused and a legal request from A to its own child allowed. If the day ends first: the file and line of the refusal point and the rule in one paragraph.

## Result (2026-11-18, stop line reached)

Two agents on `paseo-acl-prototype` did the work: a Codex agent answered questions 1 and 3 from the source and declined the forge test, and a Claude agent ran the forge test and the prototype. Their report and test scripts are in `result/` (`REPORT.md`, `tests/`). MetaFO copied them from the VM.

1. **Identity source.** The CLI sends `PASEO_AGENT_ID` from the agent's environment as `sourceAgentId`. The tool endpoint takes `callerAgentId` from the query string. The daemon authenticates the connection, not the agent: the CLI uses the local credential file that any process of the same user can read, and `/mcp/agents` uses one capability token for each daemon run. A daemon with no password does not check even that token.
2. **Forge: yes, in all three cases** (live, test daemons 7801/7802, installed Paseo 0.16.2). Agent A claimed parent P and directed P's child B through the CLI and through `/mcp/agents`, and directed P's child RC on the connected host 7802. Each request was accepted, and each recipient recorded P as the sender. Evidence: `result/tests/forge-evidence.jsonl`, `result/tests/forge-daemon-excerpt.log`.
3. **Refusal point and rule.** The rule sits where a message from an agent enters the delivery queue on the daemon that owns the recipient. The local tool path reaches it in `paseo-tools.ts`, and the CLI and routed sends reach it in `session.ts`. Prototype: branch `acl/agent-identity` on `clkao/paseo`, head `5297d0c`, one commit on `upstream/main` `8edccf0`. A daemon built from that branch refused an honest A→B request and allowed P→B and A→its own child, on both paths. The forged A-as-P request still passed. Evidence: `result/tests/q3-patch.diff`, `result/tests/q3-prototype-result.txt`.

**Checked by the first officer against the Mac checkout (`2c23cd492`):**

- **Matches the source:**
  - `send.ts:202` reads `PASEO_AGENT_ID`, and `session.ts` takes the sender from `msg.sourceAgentId`.
  - `auth.ts:141` returns `true` when no password is set.
  - Routed tool calls open routes with `OWNER_PERMISSIONS` (`agent/host-operations/index.ts:99`).
  - `session.ts` already imports `getParentAgentIdFromLabels`, so the diff is complete for that file.
- **Not checked here:** whether the branch on GitHub matches `q3-patch.diff`, because this sandbox cannot fetch. MetaFO confirmed the branch and its files.
- **Gaps in the report:**
  1. The patch exempts every request with no caller ID, so an agent can avoid the rule with no forging at all: it unsets `PASEO_AGENT_ID` or calls `/mcp/agents` without `callerAgentId`. No test covers this case.
  2. The report proposes to compare the (server ID, agent ID) pair, but the patch compares only the agent ID.
  3. The forge ran on daemons with no password. That the result is the same with a password rests on reading the source: every agent receives the same token.
  4. The forge ran on the 0.16.2 release, and the prototype ran on `8edccf0`.
  5. In section 2, `REPORT.md` line 48 still says the forge is "unverified". That text is left from the Codex draft, and the live result below it supersedes it.

**Security assessment:** under Paseo's stated trust boundary, this is not a vulnerability. `SECURITY.md` ("Local daemon trust boundary") says that with no password anything that can reach the daemon controls it, and that the password does not protect against processes of the daemon's own user. `docs/permissions.md` says that the daemon does not claim isolation between agents. The forge stays inside that boundary. It shows that a feature is missing, not that a promise is broken.

**Next:** the identity binding is the task `agent-identity-binding`.

## Out of scope

- A complete permission design, a UI, or a change to `packages/protocol`.
- A push to `main`, and any pull request, issue or comment, on `clkao/paseo` or on `getpaseo/paseo`.

## First prompt for the mandate agent on the VM

MetaFO sends this text unchanged.

```text
You are the agent of the mandate agent-identity-acl on the exe.dev VM paseo-acl-prototype. CL approved it. Budget: one working day. Write the report to ~/acl-result/ (REPORT.md, tests/). Push code only to branches named acl/... on origin (the fork clkao/paseo). Never push to main. Open no pull request, issue or comment, on the fork or on getpaseo/paseo. Each push shows as CL's GitHub user.

Aim, three answers, each with evidence from a running daemon:
1. Where does the daemon get the identity of the agent that sends a request, for a CLI call (`paseo ...` from an agent's shell) and for a call to the agent tool endpoint /mcp/agents?
2. Can an agent forge that identity? Test it once: agent A directs agent B, which A did not start, by a changed PASEO_AGENT_ID or callerAgentId. Then test whether the forged caller also operates on a connected host. docs/connected-hosts.md says the saving daemon forwards the caller's grants and the destination admits each session under the one link's identity.
3. Name the one point in the daemon that can refuse such a request, and the smallest rule there, for example "an agent can direct only the agents that it started". Prototype it on the branch acl/agent-identity if the day allows: the test from 2 refused, a request from A to its own child allowed.

First step: git clone https://github.int.exe.xyz/clkao/paseo.git ~/paseo, then git -C ~/paseo remote add upstream https://github.com/getpaseo/paseo.git and git -C ~/paseo fetch upstream. Record the commit of upstream/main in REPORT.md. For gh, set GH_HOST=github.int.exe.xyz.

Stop line: the answer to 2 with its test. At the end of the budget, write REPORT.md and stop, even if 3 is open.

Rules:
- The daemon on port 6767 runs you. Do not stop, restart or reconfigure it. Run every test on daemons that you start, each with its own PASEO_HOME and port (7801, 7802). For the connected-host test, register 7802 as a host on 7801. Copy the LLM gateway provider settings from the 6767 config so that test agents can run. Use only the exe.dev gateway; there is no provider key on this VM.
- ~/paseo is not built. You may run `npm ci` and build in ~/paseo for question 3.
- Leads, to check, not to trust: packages/cli/src/utils/caller-agent.ts (reads PASEO_AGENT_ID from the environment); packages/server/src/server/agent/runtime-mcp-config.ts (puts ?callerAgentId= in the MCP URL); packages/server/src/server/bootstrap.ts, the /mcp/agents handler (takes callerAgentId from the query string; one capability token per daemon run, shared by all agents); packages/server/src/server/agent/tools/paseo-tools.ts; packages/server/src/server/authorization/index.ts and session.ts (daemon-wide permissions for each principal); docs/permissions.md; docs/connected-hosts.md.
- REPORT.md: each answer with the commands and their output, the upstream commit of ~/paseo, and what is still open. Prototype code: on the branch acl/agent-identity, based on upstream/main, pushed to origin; name the branch and its head commit in REPORT.md. Push before the budget ends, because push access ends 48 hours after the VM started. Test scripts and the log excerpts they cite go in ~/acl-result/tests/.
```
