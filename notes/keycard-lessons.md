# Keycard: what applies to Paseo agent identity and grants

Read on 2026-11-19 for `notes/agent-identity-and-grants.md`. The pages were read with a web fetch tool that returns summaries, so the quotes are short and the wording is close to the source, not exact.

## What is open source

- **[keycardai/egress-proxy](https://github.com/keycardai/egress-proxy)** (Apache-2.0, early beta). A forward proxy beside the workload. It intercepts outbound HTTPS, applies an allow-list and injects credentials, so "the agent never holds the GitHub token". The README says it "has not yet had an independent security review".
- **SDKs:** TypeScript, Python and Go, covering OAuth, MCP and A2A. There is also a Terraform provider and a GitHub Action. The [A2A delegation](https://docs.keycard.ai/sdk/agent-to-agent/) uses an RFC 8693 token exchange, with tokens bound to the audience of the receiving agent.
- **Keycard for Coding Agents** (`keycard run`) is the commercial platform, not open source. It logs each tool call against the agent, developer, runtime and task, and asks the developer to approve sensitive actions in real time.

## How egress-proxy is built

| Part | egress-proxy | Paseo design |
|---|---|---|
| Who is calling | The platform attests it: the pod's ServiceAccount token, signed by the API server. One sidecar per workload. | The OS attests it: peer PID and parent chain to a launch root. One daemon for all agents. |
| Enforcement | A different uid for the workload, no capabilities, and iptables redirect plus drop. The doc states: "traffic capture is not a boundary on its own." | The sandbox keeps agents off the operator listener and `$PASEO_HOME`. |
| Checking the isolation | An init container sets the rules, checks them, and writes a receipt. The sidecar checks the receipt at start-up. | Not designed. |
| Policy | One YAML document of endpoints, denying by default. Every decision is ordered and fails closed with a named reason (`no_matching_endpoint`, `exchange_denied`, …). | `decide(agent, act, target)` denies by default. No reason codes are defined. |
| Audit | One JSON line per decision on stdout, with the digest of the policy document. | Decisions go to `daemon.log`, in no defined format. |
| Values the agent supplies | "The placement wins": the proxy overwrites whatever value the agent put there. | A claimed sender that disagrees with the resolved one is refused. |
| Stated gaps | Responses are not filtered, so an upstream that echoes a token leaks it. "Not a sandbox." | Read APIs could return another agent's data, for example the OpenCode bridge context returns the agent's environment. |

## Lessons for the Paseo design

1. **A receipt for isolation.** Paseo cannot tell whether an agent is really isolated. At launch, the sandbox, or a probe the daemon runs inside it, should report whether the agent can reach the operator listener and `$PASEO_HOME`. The daemon stores `isolated: true | false` on the launch root, and the app shows it on the agent. The user can then see which agents the grants actually bind.
2. **Reason codes for denials, and an audit format.** `decide` returns one named reason for each denial, for example `unknown_peer`, `identity_mismatch`, `no_grant`, `host_not_granted` or `policy_unavailable`. Each decision is one JSON line that includes the digest of the grants document, so any decision can be traced to the exact policy behind it.
3. **Reads need grants too.** The gap egress-proxy states for its responses applies to Paseo's read operations (`read`: status, activity, logs, timelines). Without a `read` grant, an agent reads only itself. The OpenCode context endpoint is already on the list of changes.
4. **"Ask" as a third answer.** Keycard's real-time approval is the same thing as exe.dev's `--step-up`. The policy hook could return `ask` as well as allow and deny. `ask` raises an ordinary Paseo permission request to the operator, a surface the app already has. This should come after the first release.
5. **Delegation stays audience-bound.** A2A tokens are bound to the receiving agent. In Paseo, the forwarded address `agent:P@srv_H1` is valid only on the link to the host it names. This holds already, because the destination accepts it only from `srv_H1`'s link. Write that down as a rule.
6. **Keep isolation out of Paseo.** egress-proxy says outright that it is not a sandbox, and it leaves pod-spec correctness to a separate chart. This supports the split in the design: Paseo owns identity and policy; the sandbox (Safehouse or a container) owns isolation, and the receipt connects the two.

## Not applicable

- **One proxy per workload as the identity unit.** It fits containers. For many agents on one machine, the peer check is simpler.
- **TLS interception with a minted CA.** Paseo's agent channel is local and needs no TLS.
