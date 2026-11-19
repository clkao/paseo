---
commissioned-by: spacedock@0.29.0-pre0
entity-type: task
entity-label: task
entity-label-plural: tasks
id-style: sd-b32
state: .spacedock-state
state-branch: dev-state
stages:
  defaults:
    worktree: false
    concurrency: 2
  states:
    - name: backlog
      initial: true
    - name: ideation
      gate: true
    - name: implementation
      worktree: false  # the stage worktree is ~/worktrees/{slug} on the VM; see "Remote execution"
      context-sections:
        - Review-finding disposition
    - name: validation
      worktree: false  # the stage worktree is ~/worktrees/{slug} on the VM; see "Remote execution"
      fresh: true
      feedback-to: implementation
      gate: true
      context-sections:
        - Review-finding disposition
    - name: done
      terminal: true
---

# Changes to our fork of Paseo

Each task is one change to Paseo, with value a Paseo user can see, that we carry in our fork of `getpaseo/paseo`. Work that can ship as a plugin outside Paseo is not a task here either. It belongs to the project that owns the plugin, and only the core changes it needs become tasks here. Exploring an approach is not a task. An approach is filed as a task once it is chosen, and the exploration behind it is kept in `research/` of this repository. A task moves from backlog through ideation (CL approves the design), implementation in a worktree, independent validation (CL approves the result), and done.

This workflow lives off the tree of the fork. The code checkout excludes `.spacedock/` and `.worktrees/` through `.git/info/exclude`. This README is on `main` of the spec repository `.spacedock/repo`. The task files are on its orphan branch `dev-state`, checked out at `.spacedock/dev/.spacedock-state`. Run `overlay-setup.sh` from this repository on a new machine to restore the layout.

## Remotes

- `upstream` is `getpaseo/paseo`. Read only.
- `origin` is our fork `clkao/paseo`. The VM reaches it as `https://github.int.exe.xyz/clkao/paseo.git`.
- **The workflow lives on two branches of the fork.**
  - `spacedock-spec` holds this README and the setup script. It is checked out at `.spacedock/repo`.
  - `dev-state` holds the task files. It is checked out at `.spacedock/dev/.spacedock-state`.
  - Both are public, like the fork. Neither branch shares history with `main`.
- **Moving the workflow between machines.** One first officer at a time owns the workflow and pushes these branches. To hand over, the giving machine pushes both branches. The receiving machine fetches them before its first state command. A machine that cannot push (this Mac's sandbox) works read-only, or ships its commits through a push that CL runs.

## File Naming

Each task is a flat file `{slug}.md`, or a folder `{slug}/index.md` when the task keeps sibling artifacts such as logs or test scripts. Slugs are lowercase with hyphens.

## Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | SD-B32 stored ID from `spacedock status --next-id --id-seed <slug>` |
| `title` | string | Task name |
| `status` | enum | backlog, ideation, implementation, validation, done |
| `source` | string | Who asked for the task |
| `started` | ISO 8601 | When work began |
| `completed` | ISO 8601 | When the task reached done |
| `verdict` | enum | PASSED or REJECTED, set at validation |
| `score` | number | Priority, 0.0–1.0, optional |
| `worktree` | string | Worktree path while work is active |
| `issue` | string | Upstream issue reference (`getpaseo/paseo#N`), optional |
| `pr` | string | Pull request reference (`owner/repo#N`), set when a PR exists |
| `mod-block` | string | Pending mod action, unused until a mod is installed |
| `mandate` | string | Mandate name when the work runs as a mandate in its own workspace |

## Stages

### `backlog`

A proposed change or prototype with a seed description. The first officer moves a task to ideation when CL or MetaFO asks for it.

- **Inputs:** The request from CL or MetaFO.
- **Outputs:** A task file with the problem, the scope and the proof that decides whether design starts.

### `ideation`

Design the change against the current Paseo source and the `docs/` directory of the checkout.

- **Inputs:** The task file, `docs/` (start with the docs that `CLAUDE.md` lists for the subject), the source files the change touches.
- **Outputs:** The approach, the files and the estimated lines with a tolerance, acceptance criteria with `Verified by:` clauses, a test plan, and the platforms the change touches (iOS, Android, web, Electron, daemon, CLI). A change to `packages/protocol` states how it stays backward-compatible (`docs/protocol-compatibility.md`).
- **Good:** Each criterion names a check that can fail. The plan names the specific test files to run.
- **Bad:** A design that needs a new dependency without saying so. A plan that runs the full test suite.
- **Prototype:** when the design depends on a mechanism that is not proven, ideation may run a bounded prototype. The task body states its aim, stop line and budget, and the result feeds the design. CL or MetaFO approves the prototype before it starts.
- **Gate content:** CL reads the approach, the expected surface, the acceptance criteria with their proof, and any act that needs approval (a download, `npm install`, a VM, spend). Approval starts implementation.

### `implementation`

Build the change on a branch named `task/{slug}`, in a worktree on the machine that runs the stage (see "Remote execution"). Base the branch on `upstream/main` when the change will go upstream, otherwise on the fork's `main`.

- **Inputs:** The approved design.
- **Outputs:** Commits on the branch. `npm run typecheck`, `npm run lint` and `npm run format` pass. The tests that the plan names pass, run one file at a time (`npx vitest run <file> --bail=1`).
- **Good:** The smallest change that meets the criteria.
- **Bad:** Running the full suite. Starting, stopping or restarting the daemon on port 6767. A build that installs Paseo on this Mac. `npm install` or a download without approval.

### `validation`

A fresh agent checks the change against the acceptance criteria. It reproduces each `Verified by:` clause and does not trust the implementation report.

- **Inputs:** The branch, the acceptance criteria, the implementation report.
- **Outputs:** A report with each criterion, the command that was run, and its output. A recommendation of PASSED or REJECTED.
- **Good:** Scale the checks to the size of the change.
- **Bad:** Proving a behavior by reading the code or by a grep of prose.
- **Gate content:** CL reads the report, the evidence for each criterion and the findings. Approval sends the task to done. Rejection sends it back to implementation with the findings.

### `done`

CL approved the validation. The first officer merges the branch into local `main` and archives the task. When the fork exists, merging happens through a pull request on the fork, and a change for upstream also gets a pull request that CL opens or approves.

## Review-finding disposition

The reviewer reports a finding. The worker investigates it without changing the branch and proposes one of: material (fix), deferred risk, polish, or needs decision. The first officer authorizes the fix, the decline, or the escalation. Only CL changes the scope or the acceptance criteria. A material finding at validation sends the task back to implementation.

## Workflow-specific rules

- Read the checkout's `CLAUDE.md` before work in the code. Its critical rules apply to every stage.
- No push, pull request, issue, comment or fork without CL's approval. No download and no `npm install` without approval.
- Stop if the free disk space on this Mac is less than 1.5 GiB.
- A task that runs as a mandate names its aim, its stop line and its budget in the task body. CL or MetaFO approves the mandate before it starts.
- **First officer.** The first officer is the session that runs the workflow: on the VM a Codex agent (`spacedock codex`), on the Mac the paseo project manager. Load the first-officer contract before the first status change or dispatch.
  - On the VM, the first officer dispatches ensigns with its runtime's own subagents. Ensigns write their stage reports into the state checkout themselves.
  - On the Mac, the first officer launches each ensign as a Paseo agent, labelled `role=worker repo=paseo`, and waits with `paseo wait`. A Paseo agent cannot message "main", so it ends with a final message that carries the completion line.
- **Remote execution.** This Mac cannot hold a monorepo `npm install`. It has under 2 GiB free, against the 1.5 GiB stop line. So implementation and validation run on the VM `paseo-acl-prototype` (workspace `wks_d70f4643277e6dda`), with the first officer there.
  - CL approved the following on the VM: `npm install`, `apt install`, installing Spacedock, and pushes of `task/*`, `spacedock-spec` and `dev-state` to the fork. Never push `main`, and open no pull request, issue or comment without CL.
  - The code checkout is `~/paseo`, and stage worktrees are `~/worktrees/{slug}`.
  - The VM's push access ends about 2026-11-20 19:20 UTC. Before that, the VM first officer pushes `dev-state` and `spacedock-spec` a last time and stops. The Mac takes the workflow back from the fork.
- To sync with upstream: `git fetch upstream`, then merge `upstream/main` into `main`. Merge keeps every commit that a stage report cites reachable.

## Workflow State

```bash
spacedock status --workflow-dir .spacedock/dev
```

## Task Template

```yaml
---
id:
title: Task title here
status: backlog
source:
started:
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

## Proposed approach

## Acceptance criteria

**AC-1 — {End-state property.}**
Verified by: {a check that can fail}

## Test plan

### Feedback Cycles

## Out of scope
```
