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

## Result

To be written by the worker: the filled table, then a recommendation in 5 lines or fewer. Mark each cell as observed (with its log file) or as documented or inferred.
