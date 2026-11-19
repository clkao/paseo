# Design note: agent identity and task envelopes inside the Paseo daemon

Status: proposal for CL, 2026-11-19. It replaces the external broker of `agent-identity-binding` as the direction for the next prototype. The target is an upstream pull request to `getpaseo/paseo`.

## Assumption

Each agent runs in a sandboxed or ephemeral place where it cannot read another agent's credential or the operator's credential. Paseo does not create OS accounts and does not depend on how the sandbox is built. It needs one thing from the sandbox: a private place where the daemon can put one agent's credential.

## Decisions from CL (2026-11-19)

- **Upstream.** The protocol stays backward-compatible, and the feature is gated.
- **Authority comes from explicit grants.** An agent that the user starts is a normal agent. It has authority beyond itself only through grants that the user defines. Applied as a recommendation: the agent may act on itself and on the agents that it started without a grant.
- **No sandbox: still issue credentials.** The daemon issues credentials in every case. The docs state what true isolation requires: the agent cannot read another agent's credential, the operator credential (`local-credential`, the daemon password) or `$PASEO_HOME`, and cannot reach the daemon except with its own credential.

## What changes, by area

| Area | Files | Change |
|---|---|---|
| Protocol | `packages/protocol/src/messages.ts` (hello `auth`) | New optional auth kind `agentCredential`. It is safe for old daemons, because only a daemon that issues credentials gives an agent one. |
| Spawn | `packages/server/src/server/agent/agent-manager.ts` (launch context, about line 5569), `agent/runtime-mcp-config.ts` | The daemon creates a credential for each runtime launch. It puts the credential in the agent's environment (`PASEO_AGENT_CREDENTIAL`) and as the MCP bearer, in place of the shared token. |
| Admission | `session-admission-auth.ts`, `auth.ts` (`isAgentMcpRequestAuthorized`), `bootstrap.ts` (`/mcp/agents` handler) | The credential resolves to the principal `agent:<id>` with its envelope. `callerAgentId` and `sourceAgentId` are ignored or must match. |
| Native tools | `agent/tools/paseo-tools.ts`, the OpenCode bridge (`providers/opencode/bridge.ts`) | In-process tool catalogs are already bound to one agent. The bridge token is one for each daemon and becomes one for each agent. |
| Decision | `authorization/` (new `decide()` next to `SessionAuthorization`), call sites in `session.ts` and `paseo-tools.ts` | One function for each request from an agent. It denies by default, records each decision, and does not read content. |
| Parentage | `agent/tools/paseo-tools.ts` (`create_agent` and `update_agent` accept any labels), `agent/lifecycle-command.ts` | Today any caller can set `paseo.parent-agent-id` and adopt any agent. The `paseo.*` labels become daemon-owned: only the daemon writes them, from the verified creator. |
| Connected hosts | `agent/host-operations/index.ts` (routes with `OWNER_PERMISSIONS`), `connected-hosts/session.ts` | Forward the verified agent and the scope narrowed for that request. The destination intersects it with the link's authority. |
| CLI | `packages/cli/src/utils/client.ts`, `utils/caller-agent.ts` | When `PASEO_AGENT_CREDENTIAL` is present, send it and not the local credential. Stop sending `PASEO_AGENT_ID` as the identity. |
| App, CLI | grants editor | List, add and revoke grants, behind `access.manage`. |
| Docs | `docs/permissions.md`, `SECURITY.md`, `docs/data-model.md` | Agent principals, envelopes, grants, and the isolation requirement. |

## Where it is stored

| Data | Where | Lifetime |
|---|---|---|
| Agent credential (secret) | Not on disk. The daemon keeps only a hash in memory. The agent receives the secret in its environment, or in its private place when it has one. | One runtime launch |
| Envelope | New optional field `envelope` on the agent record, `$PASEO_HOME/agents/{dir}/{agentId}.json`. Frozen at creation. | The life of the agent, kept after archive for audit |
| Parentage | The `paseo.parent-agent-id` and `paseo.parent-server-id` labels on the same record, written only by the daemon | The life of the agent |
| Grants | New store `$PASEO_HOME/access/grants.json`, owned by the operator, written atomically | Until the user revokes them |
| Decisions | The daemon log (`daemon.log`) | Log rotation |

The effective authority for a request is the agent's envelope intersected with the current grants. When the user revokes a grant, it takes effect on the next request. A widened grant does not widen a child, because the child's envelope is frozen.

## Restarts

- **Daemon restart.** Provider runtimes end, and their records become `closed`, as today. Credentials existed only in daemon memory, so every credential is invalid. When an agent resumes (`ensureAgentLoaded()`), it starts with a new credential. Envelopes, parentage and grants are on disk, so they are unchanged. A process left over from an agent's shell holds a dead credential and is refused. It does not fall back to the operator. Links to connected hosts reconnect, and the scope is sent again with each request.
- **Agent process restart** (reload, idle cleanup and resume, a provider crash). The new launch gets a new credential, and the daemon revokes the old one when it releases the runtime. The agent ID, the envelope and the parentage stay the same.
- **Archive and unarchive.** Archive revokes the credential and keeps the envelope. Unarchive resumes with a new credential under the same envelope.
- **Connected host restart.** The destination keeps its own records and the envelopes of its remote children. The origin's verified identity arrives again with each routed request after the link reconnects.

## Recommendation for upstream adoption

- **Part 1, always on:** the credential, ignoring claimed IDs, and daemon-owned parentage. These fix attribution and break no workflow.
- **Part 2, opt-in:** enforcement, set in the daemon config, for example `agents.access: open | granted`. Today's behavior equals one default grant, "every agent may act on every agent", so `open` changes nothing. A later release can change the default.

## Design

The daemon is the authority for identity, for scope and for decisions. No separate broker process is needed.

### 1. Identity: a credential that the daemon issues at spawn

- When the daemon starts an agent, it creates a random credential for that agent alone and puts it in the agent's private place. The daemon stores only a hash of it, mapped to the agent ID and the agent's envelope.
- The agent uses that credential on every route to the daemon:
  - as the bearer on `/mcp/agents`, in place of the capability token that every agent shares today;
  - as the CLI credential, in place of `local-credential`.
- The daemon takes the sender from the credential and ignores `callerAgentId`, `sourceAgentId` and `PASEO_AGENT_ID`. A claimed ID that disagrees with the credential is refused.
- A request from an agent route without a valid credential is refused. It does not fall back to operator authority.
- The credential ends when the agent is archived, or when its envelope expires.

### 2. Scope: an immutable task envelope for each agent

This is taken from shisad (sources below). When the daemon creates an agent, it also creates that agent's envelope and freezes it. The envelope holds:

- **subject:** the agent, its parent, and the operator principal that owns the tree;
- **acts and resources:** tools, agents (default: the agents it starts), workspaces, connected hosts;
- **credential refs:** the names of the credentials it may cause the daemon to use, such as a host link or a forge token. A tool grant does not imply a credential grant. The agent never receives the secret; the daemon resolves the ref at the edge;
- **limits:** expiry (for example a mandate's stop line), the maximum number of children;
- **untrusted-trigger policy:** what happens when a message from another agent, or a schedule, starts work. This field is reserved for later.

**Narrow only.** A child's envelope is the parent's envelope intersected with what the parent asks for:
- allow-lists intersect;
- deny-lists combine;
- numeric limits take the minimum;
- an omitted field inherits the parent's value.

Only the operator widens a scope, through daemon configuration. This is the Macaroons attenuation rule, but the daemon keeps the envelope, so a local envelope needs no signature.

### 3. Decision: one enforcement point

Every request from an agent, on both the CLI WebSocket and `/mcp/agents`, passes one function in the daemon: `decide(envelope, act, resource) → allow | deny`.
- The function does not read prompt text. It decides from the act, the resource IDs and the relations between agents.
- It denies by default and records each decision.
- Rule 1 is the parent relation: an agent may direct the agents it started. Rule 2 is a grant for one connected host.

### 4. Connected hosts

- The origin daemon sends the verified agent ID and the narrowed scope for that request across the link. It never sends the agent's credential.
- The destination intersects that scope with the link's authority, which it already does for grants. A child created on the destination gets an envelope that is narrower than or equal to the forwarded scope.
- Open: whether the forwarded scope must be signed (a macaroon) or whether the authenticated link is enough. The link already authenticates the origin daemon. A signature would matter only for routes with more than one hop, and Paseo does not allow those today.

## What carries over from the prototypes

- **From `acl/agent-identity`:** the location of the enforcement point (`paseo-tools.ts`, `session.ts`), and rule 1 by `paseo.parent-agent-id`, extended to the pair of server ID and agent ID.
- **From `acl/broker`:**
  - the policy model and the default-deny filter (`policy.mjs`);
  - the overwrite of the claimed sender;
  - a launcher that acts before the agent runs. The daemon is now that launcher.
- **Not used:** the OS user for each agent, `/proc/net/tcp`, sudo and nftables.

## Acceptance tests for the prototype

1. `forge-identity.py`: the three cases (CLI, `/mcp/agents`, connected host) are refused, and the same run with the decision function disabled lets them pass. The second run is the control that the broker run did not do.
2. An agent request with no credential is refused on the CLI and on `/mcp/agents`.
3. A parent directs its own child on the CLI, on `/mcp/agents`, and on a connected host. The parent needs a host grant for the connected host. Without that grant it is refused there.
4. A child cannot get an envelope wider than its parent's, and the attempt is refused and recorded.
5. The operator's CLI and the app work as before.

On the VM, the stand-in for the private place is one directory for each test agent, given only to that agent's process. The test does not try to read across those directories, because the sandbox is assumed.

## Owner

`paseo`. Everything is in `packages/server`, `packages/cli` and `packages/protocol`, with optional protocol fields only. paseo-safehouse only provides the private place.

## Protocol

- New fields are optional.
- The feature is gated on `server_info.features` (`docs/protocol-compatibility.md`).
- An old CLI without a credential still works as the operator. It works as an agent only where the daemon does not run the agent through this feature.

## Sources

The shisad documents were read with a web fetch tool that returns summaries, so the wording below is close but not verbatim.

- shisad, `docs/SECURITY.md`:
  - The task envelope is part of the trust boundary. It carries capability scope, `credential_refs`, resource scope and the untrusted-trigger policy.
  - Credential refs are an allow-list that fails closed.
  - Broker credentials are resolved at the HTTP proxy, on the outbound hop.
  - "Tool grants do not imply credential grants."
- shisad, `docs/adr/ADR-command-task-architecture.md`:
  - COMMAND creates the envelope when it dispatches a TASK.
  - `credential_refs` cannot change after the envelope is created.
  - "Capability scope must narrow at each level."
  - Parameters that cannot be attributed to a source are blocked.
- shisad, `docs/adr/ADR-policy-source-authority.md`:
  - Policy is merged as `merge(server, caller)`, and the result is at least as restrictive as the server floor.
  - The rules for each kind of field: intersection, union, minimum, and omitted means inherited.
- `.spacedock/repo/notes/agent-access-capability-pattern.md`: the exe.dev, Macaroons, Zanzibar and Tailscale background.
