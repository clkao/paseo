# Explored: a broker with one OS user per agent (2026-11-18/19)

This is an explored approach, not a workflow task. It serves the task `agent-broker-plugin`.

A prototype of a broker that is the only route from an agent to the Paseo daemon. The broker knows which agent calls it without a claim from the agent, and it applies grants before it forwards a request. A rule inside the daemon has no value while the caller names itself (`research/forged-caller-identity/README.md`, Result). Any agent can direct any other agent today, and that is the reason for the broker.

## Mandate

- **Aim:** a broker process in front of a test daemon that does three things.
  1. **Only route.** An agent cannot reach the daemon socket or port, or the daemon's credentials, except through the broker.
  2. **Identity without a claim.** The broker knows the calling agent from something that the agent cannot copy from another agent. Agent A cannot use the identity of agent P. Show one of two candidates:
     - a credential that the launcher gives to one agent at its start, which the broker can verify;
     - a separate channel for each agent, for example one socket for each agent, or a peer check of the socket (uid or pid and the process tree).
  3. **Grants.** A grant is a subject (agent, label, project), a resource (agent, workspace, host, tool) and the permitted acts. Rule 1: an agent can direct only the agents that it started. Rule 2: a grant for one connected host. The broker also stands in front of the link to a connected host, because the forged identity passed through that link.
- **Stop line:** the acceptance test below passes for rule 1, with the stand-in for the sandbox stated. Rule 2 and the connected-host grant come after that, if the day allows. At the end of the budget, write the report and stop.
- **Budget:** one working day of one agent.
- **Model:** Claude Opus 5.5 in auto mode. In `agent-identity-acl` the Codex model refused the forge test.
- **Approval:** CL approved a prototype with this direction on 2026-11-18. MetaFO starts the agent. The first officer here does not start it.

## Design inputs

- **Grant model:** `.spacedock/repo/notes/agent-access-capability-pattern.md`. The broker is the "secret at the edge": it holds the daemon credential, and the agents do not.
- **Known weak points that the prototype must answer:**
  - Agents run as the daemon's OS user today. A process of the same user can read the local credential in `PASEO_HOME`, and on Linux it can read the environment of another process of that user (`/proc/<pid>/environ`). A token in the environment of agent P is therefore readable by agent A if both run as one user. The prototype must say why A cannot get P's credential or open P's channel.
  - The daemon sets the parent of a new agent from the caller ID that it receives. Through the broker, that ID must be the one the broker verified. The broker removes or overwrites `callerAgentId` and `sourceAgentId` from the agent.
  - A request with no caller ID is operator authority today. Through the broker, an agent has no route that leaves its identity out.
  - The daemon injects into each agent an MCP URL that points at the daemon itself (`packages/server/src/server/agent/runtime-mcp-config.ts`). The prototype must point the agents at the broker instead, for example with `mcpInjectIntoAgents: false` and a provider wrapper that adds the broker as the MCP server.
- **Stand-in for the sandbox:** the VM has no Safehouse. The report states what stands in for the limit. One possibility: the daemon and the broker run as one OS user, with the daemon on a socket or a port that only that user can reach. The provider command is a wrapper (see `docs/custom-providers.md`, custom binaries) that registers the agent with the broker and then runs the agent as another OS user, one user for each test agent. The agent may choose another stand-in if it states it and tests it.
- **Not decided here:** which project owns the broker later, `paseo` or `paseo-safehouse`. That is a question for CL. The prototype runs in this project.

## Where

- **VM:** `paseo-acl-prototype`, which still exists. `~/paseo` is the clone of the fork, and the earlier tests are in `~/acl-result/tests/`. Push access to `clkao/paseo` ends at about 2026-11-20 19:20 UTC.
- **Code:** branch `acl/broker` of `clkao/paseo`, based on `upstream/main`. The broker is in its own top-level directory `acl-broker/` on that branch. A change in `packages/` is permitted only when the broker cannot work without it, and the report lists each one.
- **Result:** `~/acl-result/broker/` on the VM (`REPORT.md`, `tests/`). The earlier files in `~/acl-result/` stay as they are. MetaFO copies `~/acl-result/broker/` to the first officer, who puts it in this task's folder.

## Acceptance criteria

**AC-1: The forge is refused.**
Verified by: `forge-identity.py` from `~/acl-result/tests/`, adapted to run each case from a process with agent A's identity (A's OS user or A's channel), through the broker. All three cases are refused: the CLI with `PASEO_AGENT_ID` of P, `/mcp/agents` with `callerAgentId` of P, and the connected host. Removing the broker's identity check makes them pass again.

**AC-2: A request with no caller ID is refused.**
Verified by: from A's identity, a request without `PASEO_AGENT_ID` or `callerAgentId` to direct agent B (which A did not start) is refused, or is treated as A and refused by rule 1.

**AC-3: The daemon cannot be reached directly.**
Verified by: from A's identity, a direct connection to the daemon socket or port fails, and a read of the daemon's credential file fails.

**AC-4: Honest calls work.**
Verified by: P directs its own child B through the broker by the CLI and by `/mcp/agents`, and the recipient records P as the sender.

**AC-5 (after the stop line): a grant for one connected host.**
Verified by: P, with a grant for host 7802, directs its own child RC on 7802. A, without the grant, cannot reach 7802 through the broker.

## Result (2026-11-19, stop line reached in part)

A Claude agent built the broker and stopped when the exe.dev credits ran out. A Codex agent continued from its working tree and wrote the report. Report and tests: `result/` (`REPORT.md`, `tests/`). Code: branch `acl/broker` of `clkao/paseo`, head `eeb18af3b`. It is two commits on upstream `d8c98400` and touches only `acl-broker/` (`src/broker.mjs`, `peer.mjs`, `policy.mjs`, `directory.mjs`, `bin/agent-launch`, `test/`). The GitHub compare against the fork's `main` (`8edccf0`) also lists files in `packages/`, but those come from the upstream commits, not from the broker.

Claims as reported: AC-2, AC-3 and AC-4 pass, AC-1 is partial, AC-5 is deferred. The first officer checked them against `tests/*.log`, `tests/audit.jsonl` and the branch code, read through the GitHub web API.

### 1. Identity method, and why A cannot copy P's identity

The identity comes from the channel: one Linux user for each agent, and the kernel reports which user opened a connection.

- The provider command is the wrapper `acl-broker/bin/agent-launch`. It reads `PASEO_AGENT_ID` before any agent code runs, because the daemon sets that value at spawn. The wrapper registers the agent with the broker's admin socket, which only the operator can reach, as a pair of agent ID and OS user (`acl-ag1` to `acl-ag8`). Then it starts the agent with `sudo -u` and an empty environment (`env -i`).
- For each loopback TCP connection, `peer.mjs` finds the socket in `/proc/net/tcp` and reads the UID of its owner, which the kernel records. The broker maps that UID to the agent.
- The broker replaces or rejects `callerAgentId` and `sourceAgentId` that disagree with the mapping. It also replaces the CLI `hello` with its own session.

A cannot use P's identity because A runs as another user. A cannot open a socket as P's user. A also cannot read P's environment or home, the daemon socket, or the local credential, all of which return EACCES in `AC-3.log`. A token is not involved.

### 2. What depends on the OS-user stand-in and has no equivalent in Safehouse on a Mac

- **One OS user for each agent, created with sudo.** This is the whole identity method. Safehouse runs every agent as CL's one user, so the UID would be the same for every agent.
- **`/proc/net/tcp` for the peer UID.** This is Linux only. macOS has `getpeereid` and `LOCAL_PEERPID` on Unix sockets. The PID could be mapped to an agent through the process tree, but nobody has tested that.
- **File permissions as the barrier** (a 0700 test root, a 0600 credential, socket permissions for each user). In Safehouse the barrier is the sandbox profile. Safehouse already denies `~/.paseo` to this session.
- **An nftables rule for each UID** that blocks every loopback port except the broker. The daemon opened extra loopback ports, such as the OpenCode bridge, which has its own token and is a second route to the Paseo tools. A sandbox-exec profile can probably filter by port, but Safehouse's daemon switch is all or nothing today.
- Separate environments between agents (`/proc/<pid>/environ`) also come from the separate UIDs.

What carries over to the Mac: the broker as the only route, holding the daemon credential (the secret at the edge), the wrapper that registers before the agent runs, the policy in `policy.mjs`, and the default-deny filter for WebSocket messages. A Mac design still needs a channel for each agent, for example one Unix socket for each agent that only that agent's sandbox profile may open.

### 3. What is not proved

1. **The AC-1 control.** No run shows the three requests succeeding with the identity check off. A broker that refused everything would also pass AC-1. AC-4 shows that the local path allows honest calls, which reduces this risk for the local cases only.
2. **The connected host, in both directions.** The routed AC-1 request was refused at the identity check, before any host logic ran. Its target R was started by the operator, so even P would have been refused. No routed request was ever allowed. That the broker stands in front of the link is shown only by the link registration (`link.log`).
3. **Rule 1 on the CLI path.** Rule 1 refused an agent only on `/mcp/agents` (AC-2). On the WebSocket path every refusal was the identity check. A CLI send with no `PASEO_AGENT_ID` was not tested.
4. **Grants beyond rule 1.** Grants by label, by project and by host exist in `policy.mjs`, but the live run used an empty grant list (AC-5 deferred).
5. **Normal agent work.** The WebSocket filter denies every RPC except sending a message and waiting for finish, and creating an agent is limited to Codex. So most of the agent's `paseo` CLI (for example `ls` and `run`) does not work through the broker. The tests used the agent's UID with fixed scripts, not the agent itself, except for one `list_hosts` call by P's Codex session.
6. **Other limits.**
   - Only the Codex provider ran; Claude was not tested.
   - The daemons were the installed 0.16.2, not the branch base.
   - UIDs come from a fixed pool of 8 and are never retired.
   - The OpenCode bridge was blocked by the firewall rule; the broker does not handle it.

### 4. Recommendation

- **Next step:** a spike on the Mac in Safehouse, before more work on the VM. The question: can Safehouse give each agent a channel that only that agent can open, for example a Unix socket that only that agent's profile allows, with the daemon denied? Can it also keep A from reading P's environment and process information? The method in this prototype depends on that answer. The open VM items are items 1 to 3 above and AC-5. They are deterministic and cheap, but the daemons start Codex agents, so they need exe credits again, and push access ends at about 2026-11-20 19:20 UTC.
- **Owner: paseo-safehouse.** Its guarantee comes from the launcher and the confinement: Safehouse starts the agent and decides what the agent can reach. The broker also has no code in Paseo's `packages/`. Paseo's own trust boundary (`SECURITY.md`) treats processes of the same user as fully trusted, so a broker inside the daemon would add nothing without the sandbox. The broker does parse Paseo's protocol. Paseo, in our fork, then owns only the hooks the broker needs, each as a small change. One example is pointing the injected MCP URL at the broker. The coupling to the protocol is a cost of this choice: a Paseo upgrade can break the WebSocket filter.

## Out of scope

- Safehouse integration, the app UI, and a change to `packages/protocol`.
- A push to `main`, and any pull request, issue or comment on `clkao/paseo` or `getpaseo/paseo`.

## First prompt for the mandate agent on the VM

MetaFO sends this text unchanged to a Claude Opus 5.5 agent in auto mode on `paseo-acl-prototype`.

```text
You are the agent of the mandate agent-broker on the exe.dev VM paseo-acl-prototype. CL approved it. Budget: one working day. CL owns this VM and the fork clkao/paseo. Every agent and daemon in your tests is one that you start on this VM, so the forge tests are authorized checks of an access control.

Background: the earlier mandate (~/acl-result/REPORT.md) showed that any agent can claim another agent's identity: PASEO_AGENT_ID for the CLI, ?callerAgentId= for /mcp/agents, and through a connected host. A rule inside the daemon does not help while the caller names itself. Build a broker instead.

Aim: a broker, as a separate process in front of a test daemon, that
1. is the only route from an agent to the daemon: an agent cannot open the daemon socket or port or read the daemon's credentials;
2. knows the calling agent without a claim, so that agent A cannot use agent P's identity. Use one of two ways: a credential that the launcher gives to one agent at its start and that the broker can verify, or one channel for each agent (for example one socket for each agent, or a peer check of uid, pid and process tree). Processes of one OS user can read each other's environment in /proc, so a token in the environment is not enough if A and P run as one user;
3. applies grants (subject: agent, label or project; resource: agent, workspace, host or tool; permitted acts). Rule 1: an agent can direct only the agents that it started. Rule 2, after the stop line: a grant for one connected host. The broker also stands in front of the link to a connected host.
The broker removes or overwrites callerAgentId and sourceAgentId with the identity it verified, so the daemon records the right parent. Agents must reach Paseo tools through the broker, not through the MCP URL that the daemon injects (see packages/server/src/server/agent/runtime-mcp-config.ts; mcpInjectIntoAgents: false and a provider wrapper are one way).

There is no Safehouse on this VM. Choose a stand-in for the sandbox limit, state it in the report and test it. One possibility: the daemon and the broker run as one OS user, with the daemon on a socket or port only that user can reach. The provider command is a wrapper (docs/custom-providers.md, custom binaries) that registers the agent with the broker and then runs it as another OS user, one user for each test agent.

Acceptance test (the stop line is AC-1 to AC-4):
- AC-1: adapt ~/acl-result/tests/forge-identity.py to run each case from a process with A's identity, through the broker. All three cases are refused: CLI with P's PASEO_AGENT_ID, /mcp/agents with P's callerAgentId, connected host. Removing the broker's identity check makes them pass again.
- AC-2: from A's identity, a request with no caller ID that directs B (which A did not start) is refused.
- AC-3: from A's identity, a direct connection to the daemon and a read of its credential file both fail.
- AC-4: P directs its own child B through the broker by CLI and by /mcp/agents, and B records P as the sender.
- AC-5, only after the stop line: P, with a grant for host 7802, directs its child RC on 7802; A without the grant cannot reach 7802.

Rules:
- The daemon on port 6767 runs you. Do not stop, restart or reconfigure it. Run tests on daemons that you start, each with its own PASEO_HOME and port or socket. Copy the LLM gateway provider settings from the 6767 config. Use only the exe.dev gateway.
- You may create OS users with sudo on this VM for the stand-in.
- Code: in ~/paseo, create the branch acl/broker from upstream/main (git fetch upstream first). Put the broker in its own top-level directory acl-broker/. Change files in packages/ only when the broker cannot work without the change, and list each change in the report. Push acl/broker to origin before the budget ends and before 2026-11-20 19:00 UTC. Never push to main. Open no pull request, issue or comment, on the fork or on getpaseo/paseo. Each push shows as CL's GitHub user.
- Report: ~/acl-result/broker/REPORT.md and ~/acl-result/broker/tests/. Do not change the earlier files in ~/acl-result/. REPORT.md gives the stand-in for the sandbox, the identity method and why A cannot copy P's identity, each AC with its command and output, the branch and head commit, the upstream/main commit, each change in packages/, and what is still open.
- At the stop line or at the end of the budget, write the report, push, and stop.
```
