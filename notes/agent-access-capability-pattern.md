# Design note: a capability pattern for agent access control in Paseo

Input for the design step after the prototype `agent-identity-acl`. The prototype does not change. Its question 2, whether an agent can forge its identity, comes first. Each part of the design below depends on the daemon knowing which agent sent a request.

**What CL asks of the design:** use this pattern as the first candidate, or say why it does not fit.

**Read first:** the exe.dev integration docs, the Macaroons paper and the Tailscale grants docs (sources 1, 5 and 6 below).

## The pattern, as exe.dev integrations do it

1. **The secret stays at the edge.** A VM sends its request through a proxy, and the proxy adds the credential. The VM cannot extract it.
2. **The network position gives the caller's identity.** The integration acts for the VM that sent the request. The VM does not claim an identity.
3. **A grant is a relation.** An integration is attached to `vm:<name>`, `tag:<name>` or `auto:all`.
4. **A grant can be narrower.** It can cover one repository (`--repository`), be read-only (`--readonly`), have a time limit (`integrations attach … --for 2h`), or need an approval for each VM (`--step-up`).

## How it maps to Paseo

- **Identity.** The daemon starts each agent. So it can give each agent its own channel or token at start, and then the daemon knows the sender, as exe.dev knows the VM. Today the agent claims its own identity. The CLI reads `PASEO_AGENT_ID` from its environment (`packages/cli/src/utils/caller-agent.ts`). The tool endpoint `/mcp/agents` takes `callerAgentId` from the query string, behind one capability token that all agents of a daemon run share (`packages/server/src/server/bootstrap.ts`, `runtime-mcp-config.ts`). This is the forge risk that question 2 tests.
- **Grant.** A grant is a relation of a subject (`agent:`, `label:`, `project:`), a resource (agent, workspace, host, tool) and the acts that it permits. Today the daemon grants permissions to each principal, for the whole daemon (`docs/permissions.md`), and has no grant for each agent. The Safehouse label `paseo-safehouse.paseo-access=daemon` acts as one grant for all resources. That label belongs to the Safehouse wrapper, not to the Paseo source.
- **Routing to a sub-resource.** A connected host is a resource, as a repository is for exe.dev. "Agents with the label `repo=paseo` can direct agents on the host `paseo-acl-prototype`" has the same form as "this VM can push to `clkao/paseo`". Today the daemon that saves a host forwards the caller's grants, and the destination admits each session under the identity of the one link (`docs/connected-hosts.md`, "Ownership and authority"). So the identity on the first daemon decides what a caller can do on every connected host.
- **Narrower.** A manager gives its worker a part of its own grant and no more. `docs/permissions.md` already states this rule for principals and sessions. A time limit ends a mandate's grant at its stop line.

## Sources

Each source was read on 2026-11-18 unless the line says otherwise. The general name of the pattern is capability-based security.

| # | Source | What it supports | Checked |
|---|--------|------------------|---------|
| 1 | exe.dev, [What are Integrations?](https://exe.dev/docs/integrations) | Secrets are injected on the network. "The VM — and any agent running on it — can use the integration but can never read the secret." | Read |
| 2 | exe.dev, [Attaching Integrations](https://exe.dev/docs/integrations-attach) | `integrations attach blog vm:my-vm`, `… tag:prod`, `… auto:all` | Read |
| 3 | exe.dev, [GitHub Integration](https://exe.dev/docs/integrations-github), [Step-up Approval](https://exe.dev/docs/integrations-step-up), [Give agents API access without giving them the keys](https://exe.dev/deploy/agent-secrets) | `--repository`, `--readonly`, `GH_HOST=github.int.exe.xyz`. `--step-up`: a VM is served only after the owner approves that VM, for a period the owner chooses. `integrations attach … --for 2h` "lapses by itself". The attach and GitHub pages do not list `--for`. Only the deploy guide shows it. | Read |
| 4 | Pang et al., [Zanzibar: Google's Consistent, Global Authorization System](https://www.usenix.org/system/files/atc19-pang.pdf), USENIX ATC 2019 | §2.1: ACLs are relation tuples `⟨object⟩#⟨relation⟩@⟨user⟩`, and a user can be a userset `⟨object⟩#⟨relation⟩` (groups, nesting). | Read |
| 5 | Birgisson et al., [Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud](https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/), NDSS 2014 | §II: a bearer can derive a macaroon that attenuates its authority with caveats. Third-party caveats require holder-of-key proofs from another service, for example authentication or audit, before a request is authorized. This matches `--step-up`. | Read, pages 1–3 |
| 6 | Tailscale, [Grants](https://tailscale.com/kb/1324/grants) and [Group devices with tags](https://tailscale.com/kb/1068/tags) | A grant is `src`, `dst` and capabilities (`ip`, `app`). "Only owners of a tag can apply that tag to devices." A tagged device has no user identity. | Read |
| 7 | Fly.io, [Tokenizer](https://github.com/superfly/tokenizer) | "An HTTP proxy that injects third party authentication credentials into requests." The client holds a sealed secret that only the proxy can open. | Read README |
| 8 | CyberArk, [Secretless Broker](https://github.com/cyberark/secretless-broker) | It "relieves client applications of the need to directly handle secrets to target services". | Read README |
| 9 | [SPIFFE overview](https://spiffe.io/docs/latest/spiffe-about/overview/) | The platform issues identities (SVIDs) after it attests the node or the workload. The page does not contrast this with an identity that the workload claims. That contrast is our reading. | Read |
| 10 | OpenFGA, SpiceDB | Open-source authorization engines modelled on Zanzibar. | Secondary sources only, not the projects' own pages |
