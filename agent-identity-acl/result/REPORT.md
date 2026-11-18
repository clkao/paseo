# Paseo agent caller identity

**Mandate** `agent-identity-acl` · `paseo-acl-prototype` · 2026-11-18 UTC

The daemon accepts an agent ID supplied by the CLI or MCP request. The inspected paths authenticate at daemon or link scope and use the agent ID for message attribution, with no check that the ID belongs to the requesting process or that the caller started the target. A genuine parent delivered prompts through both paths locally and through MCP to its own child on a connected host. **The live test is now done (section 2): an unrelated agent A, by setting `PASEO_AGENT_ID`/`callerAgentId` to parent P's id, directed P's child B — which A did not start — over both the CLI and `/mcp/agents`, and directed P's child RC across the connected host 7802. Every case was accepted and the recipient recorded the forged sender P. The caller identity is forgeable, locally and across the link.**

## Revision and test environment

The existing checkout already had the requested remotes. I fetched upstream. The source references below use `upstream/main` at `8edccf05030fcfe4c9bdac523a937bc6ecac5720`. The live tests used the installed Paseo CLI and daemon **0.16.2**. Its release tag resolves to `2ee30f4164af42ba209236ab3a31bf9532592fc3`. For example, message queue behavior has changed since the tag. The CLI send identity field and the routed send identity fields are the same in both revisions. [Environment transcript](tests/environment.log)

```console
$ git -C ~/paseo fetch upstream
$ git -C ~/paseo rev-parse upstream/main
8edccf05030fcfe4c9bdac523a937bc6ecac5720
$ paseo --version
0.16.2
```

Both daemons bound to loopback with separate homes under `/tmp/paseo-acl-mw0tsmte`. The test config copied `agents.providers` from the 6767 config, used the exe.dev Claude gateway with `claude-sonnet-5-5`, enabled agent MCP, and disabled the relay. Both test daemons were passwordless. I restarted 7801 for HTTP request logging during the original controls. I brought both isolated homes back up for the follow-up fixture check and stopped them after collection. [Setup](tests/setup.py) · [Start commands and output](tests/environment.log)

## 1. Where the sending agent ID comes from

**CLI.** The daemon places `PASEO_AGENT_ID` in the agent process environment. For `paseo send`, the CLI reads it directly and sends it as `sourceAgentId`. The receiving WebSocket handler uses that field as the message sender. For `paseo run` and `workspace create`, the CLI first checks that the ID resolves on the selected daemon and passes the result as `callerAgentId`. That lookup checks existence. CLI connection authentication is separate and can use the selected home's local credential or a daemon password. [Shell environment](../paseo/packages/server/src/server/agent/agent-manager.ts) · [CLI send](../paseo/packages/cli/src/commands/agent/send.ts) · [Caller lookup](../paseo/packages/cli/src/utils/caller-agent.ts) · [CLI connection](../paseo/packages/cli/src/utils/client.ts)

The parent ran the following helper in its own shell. Its stdout and the subsequent child timeline agree on the ID. The table shows selected fields from the transcripts. [Shell helper](tests/own-child.sh) · [Parent-send test](tests/parent-send.py) · [Daemon and timeline excerpts](tests/daemon-evidence.jsonl)

| Command or observation | Output |
| --- | --- |
| `bash ./own-child.sh` in the parent | `Shell caller 022f4109-b9e0-462f-a9c3-98ce57635803` |
| `paseo run` inside that helper | Child `b652a8d5-1f46-4a09-97ef-dc1a23b73861`. Its stored `paseo.parent-agent-id` equals the shell caller |
| `paseo send --home "$root/7801" --no-wait "$child" "Reply ACL_CLI_OK only. Use no tools."` in the parent | `queued` |
| `paseo logs --home "$root/7801" "$child" --json` | Sender `022f4109-b9e0-462f-a9c3-98ce57635803`, child reply `ACL_CLI_OK` |

**Agent MCP over HTTP.** The daemon builds each runtime's MCP URL with its assigned agent ID. After endpoint admission, the HTTP handler reads the query's `callerAgentId` and constructs the tool context for that request. The local prompt tool uses the context ID as the message sender. The endpoint capability is generated once per daemon run. With a daemon password configured, the handler accepts that shared capability or a valid password bearer. On a passwordless daemon the endpoint authorization helper permits the request without checking a bearer. Neither branch binds that query value to an individual agent. [Runtime URL](../paseo/packages/server/src/server/agent/runtime-mcp-config.ts) · [HTTP handler](../paseo/packages/server/src/server/bootstrap.ts) · [Endpoint authorization](../paseo/packages/server/src/server/auth.ts)

The local MCP receipt below matched the message ID in the child's timeline. Later, 7801's debug log recorded the same parent's actual HTTP request during the routed test. [Collected evidence](tests/daemon-evidence.jsonl)

```text
7801 local send_agent_prompt    deliveryStatus=queued  messageId=1c9516e2-b095-4351-b3b2-b2ab3ddc514d
7801 child timeline            paseo-agent-message:1c9516e2-b095-4351-b3b2-b2ab3ddc514d
                               sender.id=022f4109-b9e0-462f-a9c3-98ce57635803  reply=ACL_MCP_OK
7801 HTTP request              POST /mcp/agents?callerAgentId=022f4109-b9e0-462f-a9c3-98ce57635803
                               JSON-RPC method=tools/call
```

## 2. Can the caller identity be forged?

**Source finding: yes, for agent attribution by an admitted caller.** Neither the CLI send handler nor the HTTP tool context verifies that the supplied ID belongs to the requesting process. The send path checks the session's operation permissions. Its agent-attributed branch builds the sender from the request. The inspected local and routed prompt paths contain no mandatory check that the sender created the target. Changing attribution does not itself grant a missing daemon permission. The code therefore predicts that an admitted sender with the required authority can direct an unrelated agent under a different attribution. **That outcome is unverified in a live impersonation test.** [Session handler](../paseo/packages/server/src/server/session.ts) · [Tool handler](../paseo/packages/server/src/server/agent/tools/paseo-tools.ts) · [Operation permissions](../paseo/packages/server/src/server/authorization/operation-permissions.ts)

**Live CLI session check.** The operator created the parent. Later the parent created its own child from its shell. The two `Created agent` log events had the same CLI client ID and daemon session ID. In this run, even the admitted session could not distinguish operator creation from agent creation. Both calls used their normal attribution. [Evidence collector](tests/evidence.py) · [Session log excerpts](tests/daemon-evidence.jsonl)

```text
                                      clientId                              sessionId
operator CLI created acl-parent       cid_a819f24451f6404d9520d6a44496b4f5  e3afadde-0e68-4d06-9d21-f5aa25871ef6
parent CLI created acl-own-child      cid_a819f24451f6404d9520d6a44496b4f5  e3afadde-0e68-4d06-9d21-f5aa25871ef6
```

**Connected host.** Ordinary routed SDK sessions forward the origin session's permissions. The agent MCP adapter specifically opens routes with `OWNER_PERMISSIONS` and source `mcp`. The destination admits each virtual session under the physical link principal and intersects that authority with the forwarded permissions. For an agent prompt, the adapter carries the origin server ID and caller agent ID as message metadata. This explains how the destination can display a qualified sender while authorizing the link. The test used an ordinary local link and did not measure a reduced grant set. [MCP route creation and send](../paseo/packages/server/src/server/agent/host-operations/index.ts) · [Origin session routing](../paseo/packages/server/src/server/connected-hosts/session.ts) · [Destination admission](../paseo/packages/server/src/server/websocket-server.ts)

I registered 7802 on 7801. Through its normal MCP endpoint, the parent listed destination workspaces, created its own remote child, and sent it a second prompt. The remote child's reply verifies delivery beyond the origin's queue receipt. An initial creation attempt without an initial prompt failed schema validation. The corrected call and both results are in the evidence. [Remote-child test](tests/remote-child.py) · [Destination timeline and creation log](tests/daemon-evidence.jsonl)

| Command or observation | Selected output |
| --- | --- |
| `paseo host add 127.0.0.1:7802 --label acl-destination --home "$root/7801" --json`, followed by `host ls` | `online`, destination `srv_kdywteO9s7jm`, target `tcp://127.0.0.1:7802` |
| Parent's routed `create_agent` | Child `e9e69983-a757-4c17-bfe6-d231a8c59dd4` |
| 7802 creation log | Virtual client `link-12d49cad22446e1eebe7ef9b30c8ce6ba612bb2a5efc315b5f780431f73d86c9` |
| Parent's routed `send_agent_prompt` | `success=true`, `deliveryStatus=queued` |
| `paseo logs --home "$root/7802" "$remote_child" --json` | Sender `022f4109-b9e0-462f-a9c3-98ce57635803` on `srv_WL-v6Wx7p-wq`, child reply `ACL_ROUTED_OK` |

### Live impersonation test — executed (stop line)

> **Changed from the Codex draft.** The earlier draft left steps 2–4 unexecuted and
> declined the reproduction. CL owns this VM and the fork and approved this test; every
> actor is a test agent on the two isolated daemons this harness starts; nothing outside
> them is a target. The test is a benign, authorized check for a missing authorization
> control. I ran it. The result below replaces the three "Unexecuted" rows. Sections 1
> and 3 and the genuine-caller controls above are kept from the Codex draft where correct.

**Fixture (fresh run).** New homes under `/tmp/paseo-acl-lr9z8q0t`; daemons 7801 and 7802; agents, all confirmed live:

| Role | Id | Daemon | Relationship |
| --- | --- | --- | --- |
| P (`acl-parent`) | `56aa2d17-a588-47f4-8984-b09ecb301b95` | 7801 | top-level |
| B (`acl-child-of-P`) | `7a8c2b5c-82ff-4ed4-98bf-7ff3625b1ca8` | 7801 | child of P; **A did not start it** |
| A (`acl-independent-A`) | `a61b9b1c-778a-486c-af1d-8f5f46ad4f27` | 7801 | top-level, unrelated — the forging caller |
| RC (`acl-remote-child-of-P`) | `d0ca9e0a-1636-48b6-9b0d-b7d629c61d14` | 7802 | child of P (`paseo.parent-server-id` = `srv_jTUVeRrgTWIO`) |

7802 (`srv_SD98eQSuku8l`) was registered on 7801 and reported `online`. [Forge script](tests/forge-identity.py) · [Full run JSONL](tests/forge-evidence.jsonl) · [Recipient-timeline excerpt](tests/forge-daemon-excerpt.log)

**The forge.** A shell whose genuine agent is A authenticates to the daemon with the home's shared local credential (readable by any agent shell) and asserts a *different* caller — P's id — via `PASEO_AGENT_ID` (CLI) or the `?callerAgentId=` query value (`/mcp/agents`). The test daemons are passwordless, so `/mcp/agents` needs no bearer at all (`auth.ts:141`); on a password-protected production daemon the same request would still be admitted by the daemon-wide capability token injected into every agent's MCP config, so the forge is not an artifact of the passwordless setup.

| Requested case | Command / endpoint | Daemon decision | Sender the recipient recorded |
| --- | --- | --- | --- |
| Step 2. Local CLI, A claiming P → B | `paseo send` with `PASEO_AGENT_ID=`P → B | **Accepted**, `queued` | **P** `56aa2d17…` (`acl-parent`) — msg `180bc2b8…` |
| Step 3. Local MCP, A claiming P → B | `POST /mcp/agents?callerAgentId=`P, `send_agent_prompt` → B | **Accepted**, `success=true` | **P** `56aa2d17…` (`acl-parent`) — msg `c3f171ec…` |
| Step 4. Connected host, A claiming P → RC | `POST 7801/mcp/agents?callerAgentId=`P, `send_agent_prompt serverId=`7802 → RC | **Accepted**, `success=true` | **P** `56aa2d17…` on `srv_jTUVeRrgTWIO` — msg `c1dcf79c…` |

```text
case2 cli result   returncode=0  "7a8c2b5c… queued  Message queued for delivery"
case3 mcp result   {"success":true,"deliveryStatus":"queued","messageId":"c3f171ec-…","serverId":"srv_jTUVeRrgTWIO"}
case4 routed result{"success":true,"deliveryStatus":"queued","serverId":"srv_SD98eQSuku8l"}

B (7801) timeline   msg 180bc2b8…  sender.id=56aa2d17…  "Reply ACL_FORGE_CLI_OK only…"   reply ACL_FORGE_CLI_OK
                    msg c3f171ec…  sender.id=56aa2d17…  "Reply ACL_FORGE_MCP_OK only…"
RC (7802) timeline  msg c1dcf79c…  sender.id=56aa2d17…  sender.serverId=srv_jTUVeRrgTWIO  reply ACL_FORGE_ROUTED_OK
```

**Result. The caller identity is forgeable, and the forged caller operates across the connected host.** In all three cases the daemon accepted the request with no refusal, and the recipient's daemon-persisted timeline attributed the message to the forged sender P — although the real initiator was A's shell, unrelated to both B and RC. No step verified that the caller is the target's creator; `PASEO_AGENT_ID` / `callerAgentId` are unbound self-assertions authenticated only at daemon/link scope. The routed case shows docs/connected-hosts.md working as written: 7801 forwarded the (forged) caller and 7802 admitted the virtual session under the one link's identity and recorded sender P on `srv_jTUVeRrgTWIO`.

**Caveat on daemon-side logging.** `paseo daemon start` spawns a detached daemon that does not inherit `MCP_DEBUG`, so the `/mcp/agents` request line was not capturable from the installed 0.16.2 daemon. The daemon-generated success receipts (with daemon-minted `messageId`s) and the daemon-persisted recipient timelines read back through `paseo logs` are the daemon-side record of attribution; the exact forged request URLs are recorded by the harness in `forge-evidence.jsonl`.

**Cleanup.** All three test daemons started for this work — 7801 and 7802 (the forge fixture) and 7811 (the patched source daemon for question 3) — were stopped at the end of the run. The daemon on 6767 was not touched.

## 3. Where a parent-only rule could refuse a prompt

**For agent-attributed directives, enforce the rule at the recipient daemon before `AgentMessageDelivery.enqueue` returns a queued receipt.** The local MCP tool calls it at `paseo-tools.ts:2020`. CLI sends and routed sends reach it through `session.ts:8997`. A check only in the origin's MCP handler misses a direct CLI send. The current WebSocket operation gate accepts `workspace.write` or `hub.execute` for the message RPC. The local MCP path enters delivery directly. Completion notifications also use the queue and have their own relationship semantics. [Common queue entry](../paseo/packages/server/src/server/agent/agent-messages/delivery.ts) · [Session authorization](../paseo/packages/server/src/server/authorization/index.ts) · [Finish notifications](../paseo/packages/server/src/server/agent/finish-subscriptions/index.ts)

The smallest decision for an agent directive is **allow when the authenticated caller's (server ID, agent ID) equals the recipient's daemon-recorded creator address. Refuse other agent directives before acknowledging or dispatching them**. The remote child's actual parent labels held both IDs. The local child's record held the parent agent ID, with its own server implicit. [Parent address representation](../paseo/packages/protocol/src/agent-labels.ts) · [Live records](tests/daemon-evidence.jsonl)

That comparison needs trusted inputs. The ingress must derive agent scope and identity from an agent-bound credential, including when a request omits sender metadata. A routed session needs an origin-authenticated agent assertion bound to its link. Creator provenance must be protected when saved and updated. An agent shell with access to the operator's daemon credential must also be separated from that authority for the rule to hold. Comparing the present request fields with the present labels would leave the caller-binding problem open.

**Prototype status — built, tested, pushed.** Branch **`acl/agent-identity`** (based on `upstream/main` `8edccf0`), head **`5297d0ccd2f9328b6026054a0a0bd1f343948fe8`**, pushed to `origin` (the fork `clkao/paseo`). No PR, issue, or comment was opened.

The patch adds `assertAgentDirectionAllowed` and enforces it on both entry points that build an agent-message source: the agent MCP `send_agent_prompt` tool (`paseo-tools.ts`) and the WebSocket/CLI send path (`session.ts`). The rule: when the directive is agent-attributed, the recipient's `paseo.parent-agent-id` must equal the claimed caller; operator/UI sends carry no caller id and are unconstrained. [Patch diff](tests/q3-patch.diff)

I built the server from source (`npm run build:server`, clean typecheck + lint + format via the repo pre-commit hooks) and ran the patched daemon on a fresh home at `127.0.0.1:7811`. Fixture: P top-level; B child of P; A top-level unrelated; AC child of A. Each case run over both transports. [Test script](tests/q3-prototype-test.py) · [Result](tests/q3-prototype-result.txt)

| Case | Expected | CLI result | MCP result |
| --- | --- | --- | --- |
| P → B (B started by P) | allow | **accepted** | **accepted** |
| A → AC (AC started by A) — "A to its own child" | allow | **accepted** | **accepted** |
| A → B, honest caller id A (B not A's child) | refuse | **refused** | **refused** |
| A → B, caller **claims P** (the Q2 forge) | — | accepted | accepted |

The refusal message is `Agent <A> may direct only the agents it started; <B> was started by <P>.`

**What the prototype does and does not close.** It refuses an agent directing an agent it did not start under its own identity — the parent-only rule the mandate names — and allows a parent to direct its own child, on both the CLI and MCP paths and (by running on the target-owning daemon) on routed sends. It does **not** by itself defeat the Q2 impersonation: `callerAgentId` / `PASEO_AGENT_ID` are still self-asserted, so a caller that claims the real parent P's id passes the comparison (last row). Closing that is the "trusted inputs" precondition above: bind the caller to a per-agent credential — a per-agent MCP token instead of the one daemon-wide capability token, and a per-agent CLI credential instead of the shared home credential — and isolate agent homes so one agent cannot read another's token. The parent-only rule is the authorization half; caller-identity binding is the authentication half, and both are needed to refuse the Q2 forge. That binding is the open follow-up.

## Repeating the recorded controls

The transcript gives the invocation order, including the change to debug logging on 7801. Use a fresh directory from `setup.py` for each run. The agents used the provider's default permission mode. When a tool paused, I inspected the isolated parent's pending request and allowed that individual operation on 7801. Wait for each agent turn to finish before starting the next step. Run `evidence.py` with both test daemons up and the child replies present. It checks the stored relationships, sender IDs, reply markers, host status, and observed MCP URL. [Environment transcript](tests/environment.log) · [Evidence collector](tests/evidence.py)
