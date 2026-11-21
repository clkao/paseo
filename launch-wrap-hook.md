---
id: 86k2tpskkhrpqw7z4z1rrt9w
title: "Plugins can wrap an agent's launch command (agent.open.before wrap), fail-closed"
status: ideation
source: CL, 2026-11-21, contract agreed by the spacedock-v1 first officer and the paseo-safehouse manager
started: 2026-11-21T19:22:06Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate:
---

## Problem

A sandbox plugin such as Safehouse can only confine agents today through its own `safehouse-*` providers, one wrapper provider per real provider. A user who wants a provider's agents sandboxed needs a matching wrapper provider. Every provider change has to be mirrored, and a plugin cannot sandbox a provider it did not wrap.

If a plugin could choose, for each session, a launch wrapper that the daemon puts in front of the provider's command, one sandbox plugin would cover every provider that supports wrapping. The plugin must never lose the wrapper silently: an older host that ignores `wrap`, or a provider that cannot apply it, must fail the open instead of starting an unsandboxed agent.

## Proposed approach

Draft, from the agreed contract. Ideation finalizes it against current upstream main.

**`agent.open.before` request and result**
- The request tells the hook whether the target provider supports launch wrapping, for example `request.launchWrap: boolean`. A plugin can then choose a wrap, refuse, or keep a `safehouse-*` provider during the transition, and it can detect that the host supports wrapping at all.
- The result may carry `wrap?: readonly [executable: string, ...args: string[]]`:
  - an absolute executable path on the daemon host, with literal args;
  - run as a direct argv exec, with no shell;
  - used only for this launch, and never stored in the agent's config.
- One selection per open, no nesting:
  - a later hook that omits `wrap` keeps it;
  - an identical value passes;
  - a different value fails the open.

  This holds across both intra-plugin and inter-plugin hook merges.
- It applies to `interactive` and `history` opens.

**Fail-closed admission, before any process starts**
- Core providers: an internal opt-in, default false, forwarded by registry aliases. The manager rejects a wrapped open before create, resume, import or refresh-close, and detaches any attached tools on failure.
- Plugin providers: a capability `session.launch_wrap`, negotiated on the connection and checked on the live connection before `session.open`.
- An unsupported provider fails before any spawn, with a stable error code or type that plugins can detect.

**First pull request scope**
- The Plugin SDK's command-based ACP branch: `runAcpProvider`'s command branch only, not the connector branch. This covers Antigravity, Goose, Fx and Hoplite.
- Codex: `prepareAppServerSpawn`, covering create, resume, history, reconnect and import.
- Every other provider rejects wrapped opens until its own follow-up pull request.

**Separate commit: `requiresPlugin`**
`agent.create.before` can record a durable requirement on the agent, for example `requiresPlugin: "paseo-safehouse"`. Paseo refuses to open that agent while the required plugin is inactive or stopped, so moving from `safehouse-*` providers to `wrap` stays fail-closed when the plugin exits.

## Acceptance criteria

Draft checks from the paseo-safehouse manager. Ideation restates them as **AC-N** with `Verified by:` clauses.

1. **Old-host safety.** A plugin can detect host support (`request.launchWrap === true`) before it returns `wrap`, or an unsupported host fails closed. `wrap` is never dropped silently.
2. **Antigravity through `runAcpProvider`.** The spawn argv is `[...wrap, agy, acp, --disable-telemetry]`, with the final merged hook env, ZeroSub account variables included. Two concurrent opens on one plugin connection, one wrapped and one not, observe distinct argv.
3. **Hook composition order.** A later plugin (for example `zerosub` after `paseo-safehouse`) that returns no `wrap` preserves the selection, and a conflicting `wrap` fails the open.
4. **History opens are wrapped,** including Codex ordinary and archived resume.
5. **Unsupported providers and a missing launcher.** An unsupported provider rejects before spawn with a stable error. A missing launcher fails with zero bare retries.
6. **`requiresPlugin`.** Stopping `paseo-safehouse` prevents an agent that requires it from opening.

## References

The contract was agreed between the spacedock-v1 first officer (`846d9a2c`) and the paseo-safehouse manager (`7d469e54`). Its source documents live in the paseo-safehouse project and are not readable from this project:
- the proposal, `docs/dev/.spacedock-state/_handoff/paseo-launch-wrap-proposal.md`;
- the GPT-6.2-Astra review, `.local/launch-wrap-proposal/review-astra.md`.

If copies arrive, they go in `.spacedock/repo/handoff/launch-wrap/`. The contract was anchored to upstream main `0c02cfd`. Ideation works against current upstream main.

## Test plan

Written in ideation.

### Feedback Cycles

## Out of scope

- Wrapping for providers other than ACP command-based and Codex. Each gets its own follow-up pull request.
- The `runAcpProvider` connector branch.
- Safehouse's own changes that adopt `wrap`. Those belong to the paseo-safehouse project.
