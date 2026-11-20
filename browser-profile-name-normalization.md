---
title: "Compare browser profile display names using Unicode NFC"
status: backlog
source: "CL, 2026-11-20, via the paseo project manager. Follow-up to browser-profile-selector validation cycle 2."
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
mandate:
id: hp3car3cqz824bad4ehdk6zf
---

## Problem

The desktop browser can show the same profile label for two different sessions in one project. Cycle 2 reproduced this with an automatic workspace profile named Café 1 and a named profile entered with a combining accent. Their toolbar labels rendered identically while one tab showed Alice signed in and the other was signed out.

[Duplicate menu](browser-profile-selector/validation-cycle-2/unicode-menu.png) · [Automatic profile](browser-profile-selector/validation-cycle-2/unicode-automatic.png) · [Named profile](browser-profile-selector/validation-cycle-2/unicode-named.png) · [Caption comparison](browser-profile-selector/validation-cycle-2/unicode-captions.txt)

## Proposed approach

Use Unicode NFC for display-name comparisons in both the same-group duplicate check and the rule that disambiguates an automatic workspace label when a named profile already has the same display name.

## Acceptance criteria

**AC-1 — Canonically equivalent spellings count as the same display name within a group.**
Verified by: a creation regression submits U+0065 U+0301 (e plus combining acute) against an existing U+00E9 (é), then reverses the spellings. Cover an existing named profile and the automatic workspace row.

**AC-2 — Automatic-label qualification recognizes an existing canonical-equivalent name.**
Verified by: load the cycle-2 collision and check that the automatic and named profiles have distinguishable labels and retain their original sessions.

**AC-3 — Café and Cafe remain distinct.**
Verified by: create both names in one group and confirm that each is accepted and selectable.

## Test plan

Add the creation regression to the profile catalog tests and cover automatic-label qualification in the profile resolver tests. Use the cycle-2 evidence above as the reproduction.

### Feedback Cycles

## Out of scope

Delivery of the parent task through a pull request remains pending CL.
