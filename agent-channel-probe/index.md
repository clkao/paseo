---
id: 0vcsb252acr02574ejm8ghr5
title: "Probe: a private channel from each agent to the daemon (named socket with a peer check, or an inherited socketpair)"
status: implementation
source: CL, 2026-11-19
started: 2026-11-19
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate: agent-channel-probe
---

The design for agent identity (`.spacedock/repo/notes/agent-identity-envelope.md`, and its review) needs one channel from each agent to the daemon that another agent cannot use. This probe tests the two candidates on CL's Mac, with the real Claude Code and Codex CLIs. It does not use Paseo.

## Mandate

- **Aim:** fill the comparison table below with observed results for two candidates.
  - **Candidate 1, a named socket with a peer check.** The harness plays the daemon. It listens on a Unix socket, reads the peer PID of each connection (macOS `getsockopt(SOL_LOCAL=0, LOCAL_PEERPID=2)`), and accepts the connection only if that PID descends from the agent process that the harness started.
  - **Candidate 2, an inherited socketpair.** The harness creates a socketpair and starts the agent CLI with one end as fd 3 (`PASEO_AGENT_FD=3`). The agent uses the channel only if fd 3 survives every hop.
- **Stop line:** the table is filled, or a blocker is reported with what would remove it.
- **Budget:** about 2 hours of one agent, and at most 12 runs of `claude -p` or `codex exec`, each with a short prompt.
- **Approval:** CL asked for this test on 2026-11-19.

## Questions

1. Does an inherited fd 3 reach:
   - a command that the agent's shell tool runs: the Bash tool of Claude Code, and the shell tool of Codex, including when the Codex sandbox is on;
   - a stdio MCP server that the agent CLI starts?
   First run a baseline with no model: `bash -c`, Node `child_process.spawn`, and Python `subprocess`.
2. Does the peer check accept the agent's own shell commands? Does it refuse:
   - a process that is not a descendant of the agent process (a sibling that the harness starts);
   - an escaped process (`nohup`, `setsid`, double fork)?
   Can the peer check read the process tree inside the Safehouse sandbox at all?
3. For each candidate: does it survive a restart of the agent process, and a restart of the harness, which plays the daemon restarting?

## Comparison table (to fill)

| Property | Named socket and peer check | Inherited socketpair |
|---|---|---|
| CLI from the Claude Code Bash tool | | |
| CLI from the Codex shell tool (sandbox on and off) | | |
| A stdio MCP bridge started by the agent CLI | | |
| A non-descendant process of the same user is refused | | |
| An escaped process (`setsid`, double fork) | | |
| A secret that could leak into a transcript | | |
| Agent restart; daemon (harness) restart | | |
| Linux and Windows notes (from documentation, not tested) | | |
| Size of the change in Paseo (estimate) | | |

## Rules

- Do not start, stop or change any Paseo daemon. Paseo is not used.
- Do not install anything; no npm or pip. Use `python3`, `node`, `bash`, `claude` and `codex` as they are. If a CLI cannot run in your sandbox (for example, its credentials are hidden), record that and continue with what runs.
- Run each `claude -p` or `codex exec` in a scratch directory under `/tmp/agent-channel-probe/`, with only the shell tool allowed.
- Before each step, check the free disk space with `df -h /`. Stop if it is less than 1.5 GiB.
- No push, issue or comment.
- Put the scripts and logs in this task's folder: `.spacedock/dev/.spacedock-state/agent-channel-probe/` (`probe/` and `logs/`). Do not commit.

## Result (2026-11-19)

Two runs did the work:
- the Mac run in Safehouse, by agent `ebd5b5d6`. Its scripts and logs are in this folder (`probe/`, `logs/`).
- the Linux run on `paseo-acl-prototype`, by agent `3dd8c94a`. Its report and logs are on the VM in `~/acl-result/channel-probe/` (`REPORT.md`, `probe/`, `logs/`) and have not been copied here.

`probe/run-all.sh` (the Mac run outside the sandbox) has not run.

| Property | Named socket + peer check | Inherited socketpair (fd 3) |
|---|---|---|
| CLI from the Claude Code Bash tool | Not tested. On Linux, Claude got HTTP 402: the exe credits ran out. | **Fails.** fd 3 absent, Mac, observed (`logs/claude-safehouse.clients.log`) |
| CLI from the Codex shell tool | Sandbox off: accepted. Sandbox on: `EPERM` at connect, because the Codex sandbox blocks the socket. Linux, observed | **Fails.** fd 3 absent with the sandbox on and off. Linux, observed |
| stdio MCP server started by the agent CLI | Accepted under Claude and under Codex, sandbox on and off. Linux, observed | **Fails.** fd 3 absent under Claude (Mac and Linux) and under Codex (Linux), observed |
| Non-descendant process of the same user | Refused. Linux, observed | No fd 3, so no channel. Observed |
| Escaped process | `setsid` and `nohup` accepted: they stay descendants. A double fork is refused after it is reparented to PID 1. Linux, observed | Works while the agent lives; closes when the agent exits. Observed |
| Secret that could leak into a transcript | None. A copied path still meets the peer check | None |
| Agent restart | A new agent is accepted; an orphan of the old agent is refused. Linux, observed | A new pair works; the old fd gets `EPIPE`. Observed |
| Daemon (harness) restart | An agent that is still running reconnects once the daemon restores its record (root PID and start time). Linux, observed | Lost: there is no way to reconnect. Observed |
| Cost of the peer check | 43 µs median, 57 µs p95. If the connecting process has already exited, the check refuses. Linux, observed | None |
| Mac and Safehouse | Inside Safehouse a process cannot bind a Unix socket, and connect is allowed only to listed paths. The daemon (outside) owns the socket, and the profile must allow the agent's path. `ps` and `libproc` stop at the sandbox edge, so the ancestry check must run in the daemon. Observed | Inheritance works in the baseline, but no agent CLI passes fd 3 to its tools |

**Recommendation (first officer).**
1. Drop the socketpair: neither Claude Code nor Codex passes fd 3 to its tools or MCP servers.
2. Use a named socket for each agent, owned by the daemon. The daemon checks the peer process (PID, start time, ancestry back to the agent's root process) and needs no secret.
3. Agents reach Paseo tools through a stdio MCP bridge that connects to that socket; the bridge passed the check under both CLIs.
4. Codex's sandbox and Safehouse each need an allow rule for the agent's socket path.

Still open:
- the Claude Bash path on Linux (needs exe credits);
- the Mac run outside the sandbox (`run-all.sh`);
- a double fork loses access, which is by design but must be documented;
- re-adopting a running agent after a daemon restart needs the root PID and start time saved on the agent's record.
