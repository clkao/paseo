---
title: "Per-tab browser profile selector"
status: ideation
source: CL, via the paseo project manager, 2026-11-20
started: 2026-11-20T04:09:03Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate:
id: vb7f0c31h72remcb4fypyeqg
---

## Problem

Since PR #2089, every browser tab in every project shares one Electron session. A user cannot keep two accounts on one site apart, and an agent in one project uses the sign-ins of every other project. An upstream maintainer proposed a per-tab profile selector instead of a global setting.

## Proposed approach

Draft, for ideation. Ideation finalizes it.

- The tab toolbar gets a profile selector. Profiles are listed by group:
  - "Shared": shared profiles, for example `default` and `global-messy`, then "Create new shared profile…";
  - one group per current project, under the project's display name: that project's named profiles, plus one profile created automatically for the current workspace, then "Create new workspace profile…" (it creates a profile in that project's group).
- Partition names carry the scope in their prefix, so a later agent access control can grant by prefix:
  - `persist:paseo-shared-<slug>`;
  - `persist:paseo-project-<scope id>-<slug>`, where the scope id is the hashed serverId and projectId, never the project's display name.

  Slugs are sanitized and limited in length, and display names are stored beside them.
- Today's `persist:paseo-browser` becomes "Shared › default", with no migration.
- Default for a new tab, and for an agent's browser_new_tab: the current workspace's profile.

## Reference

Branch `task/browser-session-scope` at `66805baf` on the fork, and the [archived task and validation report](_archive/browser-session-scope.md). It already proves:

- the anchored attach gate;
- popups using the opener's session;
- the partition plumbing into resident webviews;
- Clear browser data over every scoped session on disk;
- harness checks for isolation and restart persistence.

Ideation decides what to reuse.

## Acceptance criteria

Ideation will define the criteria, including evidence that two profiles of one site stay apart, survive a restart, and are identified in the tab.

## Test plan

Ideation will name the specific files and checks.

### Feedback Cycles

## Out of scope

The agent access control itself, and plugin cookie injection.
