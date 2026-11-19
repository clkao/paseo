# Design note: agent identity and task envelopes inside the Paseo daemon

Status: proposal for CL, 2026-11-19. It replaces the external broker of `agent-identity-binding` as the direction for the next prototype.

## Assumption

Each agent runs in a sandboxed or ephemeral place where it cannot read another agent's credential or the operator's credential. Paseo does not create OS accounts and does not depend on how the sandbox is built. It needs one thing from the sandbox: a private place where the daemon can put one agent's credential.

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

`paseo`. All of this is in `packages/server`, plus optional protocol fields. paseo-safehouse only provides the private place.

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
