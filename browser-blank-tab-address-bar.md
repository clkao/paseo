---
title: "A blank browser tab keeps the typed URL after a failed first load, and does not drop an early Enter"
status: backlog
source: "CL, 2026-11-21. Follow-up from the Gemini 4 Neon review of browser-profile-selector (finding 7, .spacedock/repo/reviews/browser-profile-selector-neon.md)."
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate:
id: k7pm75bx30hhx7z27928fmte
---

## Problem

On a blank tab, two things lose what the user typed:
1. When the first navigation fails or is aborted, for example `localhost:3000` before the dev server starts, the tab returns to the pristine `about:blank` state and the address bar is cleared (`resident-webviews.ts:348-360`, `pane/index.electron.tsx:736-741`). The user cannot edit the URL or press Enter to retry.
2. An Enter pressed before the tab has registered its profile is ignored without feedback (`pane/index.electron.tsx:1012-1019`).

## Proposed approach

Draft for ideation:
- Keep the typed URL when a failed first load returns the tab to pristine. Clear the address bar only on the first blank mount.
- Queue a submitted URL until the profile registration completes, or show a pending state.

## Acceptance criteria

Written in ideation.
