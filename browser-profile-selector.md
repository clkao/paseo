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
gates:
    version: 1
    records:
        - id: gate:vb7f0c31h72remcb4fypyeqg:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:vb7f0c31h72remcb4fypyeqg-ideation-1
              briefing:
                id: briefing:vb7f0c31h72remcb4fypyeqg:ideation:attempt-1:revision-1
                digest: sha256:f4b4bf955576daa4126421426a58be2875debbfa346c78622741249422be333b
                room-ref: '@review/ideation/briefing-1'
---

## Problem

Since PR #2089, every browser tab in every project shares one Electron session. A user cannot keep two accounts on one site apart, and an agent in one project uses the sign-ins of every other project. An upstream maintainer proposed a per-tab profile selector instead of a global setting.

## Proposed approach

Place a labelled dropdown beside the URL field in the Electron browser toolbar. Its closed state identifies the attached guest as `Shared › default`, `Shared › Work`, or `<project display name> › <profile display name>`. Keep the full name accessible at narrow widths. The menu checks the active row and supports keyboard selection. Choosing the active row preserves the page. Choosing another profile reloads the current safe URL in that profile and resets the tab’s navigation history. Other tabs keep their pages.

- List **Shared** first, with the built-in `default`, named shared profiles such as `global-messy`, and **Create new shared profile…**. Then list one group per current project from the app’s project list, with its display name, named profiles and **Create new workspace profile…**. That action creates a project-owned profile available across workspaces of that project. The active workspace’s automatically provisioned profile appears under its owning project. Disambiguate identical group labels with the host or project path. Creation selects the new profile in the invoking tab.
- Use `persist:paseo-browser` for the built-in **Shared › default**, preserving existing cookies in place. Named shared profiles use `persist:paseo-shared-<slug>`. Project-owned profiles use `persist:paseo-project-<scopeId>-<slug>`, where `scopeId` is the first 16 bytes of SHA-256 of UTF-8 JSON for `["v1","project",serverId,projectId]`, encoded as 32 lowercase hex characters. The automatic profile uses reserved slug `ws-<32 hex>` from the same versioned tuple encoding of server, project and workspace IDs. Display-name or path changes preserve both keys.
- Trim display names and limit to 80 characters. For named profiles, fold case and accents, replace runs outside ASCII letters and digits with a hyphen, trim separators, and bound the resulting slug to 48 characters. Keep the original trimmed display name. Use an allocated `profile-<suffix>` for an empty transliteration. Reject blank names, reserved names (`default` in Shared and `ws-` for project entries), and same-group display-name duplicates with an inline message. Resolve distinct names with the same slug using a bounded suffix inside the length limit, under the catalog writer’s lock. Allow the same name in different groups.
- **Profile catalog.** Electron main owns a versioned `<userData>/browser-profiles.json` containing each named profile’s group (shared or server-qualified project), immutable slug and display name. Expose narrow list/create operations on the existing desktop browser bridge. Main validates inputs and serializes the entire read/allocate/write operation using temp-file rename. Read the current catalog on menu open or restore. Generate the built-in and workspace entries from identity and current project/workspace labels. Electron itself owns cookies and origin storage under its usual persistent partitions. Clearing site data retains the catalog.
- **Per-tab choice.** Keep one profile reference in `workspace-browser-store` at `browsersById[browserId]`, persisted by the existing Zustand/AsyncStorage store alongside URL and title. The layout already points to that browser ID. New records start with an explicit “workspace default pending resolution” marker, so existing synchronous UI and plugin entry points still work. Before any guest attaches, the pane or background agent resolver uses the destination workspace to resolve and store the concrete profile (scope IDs, slug, display-name snapshot). Both entry points read the same record and converge on the same key. A hydrated pre-feature record missing the field resolves to Shared › default. Wait for hydration before distinguishing old and new tabs. If workspace identity is unavailable, do not create an agent tab or attach a guest; offer retry in the pane. A malformed explicit selection or catalog read error also leaves the guest unattached and exposes recovery. Keep valid sibling records when decoding a damaged entry.
- **Switch lifecycle.** Keep browser ID, workspace tab ID, URL and viewport. Serialize changes per browser ID, put the pane in a switching state, detach old listeners, unregister the old guest and dispose its resident element/surface. Create a fresh guest with the selected partition set before attachment/navigation. Reuse the reference’s first readable guest registration after attach and main’s actual-session and sender checks. Only the replacement guest may complete this switch or receive subsequent automation. Persist the choice and show its name as active after registration. On failure, show retry and retain the last committed choice for recovery. Suppress stale attach/navigation callbacks and prevent rapid switches from re-parking an old guest. A normal pane hide/show still reuses the resident guest.
- UI launches, ordinary links routed to new workspace tabs, plugin navigation and an agent’s `browser_new_tab` all use the destination workspace’s automatic profile. Existing agent calls continue targeting the selected guest by browser ID. Native OAuth/named child popups keep their opener’s actual Electron session and hardened window options. The main attach guard accepts the single legacy shared literal and the two complete bounded grammars, with the existing URL policy. Clear browser data enumerates matching profile directories even for closed tabs, includes the existing legacy per-tab clear path, clears matched sessions and reloads their live guests. Keep unrelated partitions intact.

**For CL at the gate.** Approve project-list visibility (all current projects selectable, with the automatic entry in the active workspace’s group), ordinary link opens taking the workspace default, and switching in place at the current URL with fresh history. A later ACL can use the shared/project partition prefixes. Shared › default is the explicit legacy exception. Agent grants, cookie injection, global mode, catalog management beyond creation, and cross-device sync are outside this change.

## Reference

Branch `task/browser-session-scope` at `66805baf` on the fork, and the [archived task and validation report](_archive/browser-session-scope.md). It already proves:

- the anchored attach gate;
- popups using the opener's session;
- the partition plumbing into resident webviews;
- Clear browser data over every scoped session on disk;
- harness checks for isolation and restart persistence.

Ideation decides what to reuse.

## Evidence and expected surface

Local `upstream/main` is `95542dbfe`, the exact parent of `66805baff`. Independent Linux/Electron validation of the reference recorded six passing harness checks, including scoped isolation, restart persistence and opener-session popups, plus unit/browser checks for the attach guard, registration, resident webviews and disk discovery. Its screenshots show the earlier global control. This design’s names, catalog, toolbar, hot switch and restored visible labels still require implementation and the checks below. [Archived results](_archive/browser-session-scope/validation/results.json) · [Archived report](_archive/browser-session-scope.md)

Estimate against `upstream/main`, including tests, translations and docs. Net means additions minus deletions. The reference was +451 net over 38 files. Reuse its components selectively and omit the global Settings selector.

| Work | Expected files | Net lines |
| --- | --- | ---: |
| Reuse opener session, registration, first readable guest ID, bridge plumbing and test assertions from 66805baff | `packages/desktop/src/features/browser-webviews/{index.ts,index.test.ts,window-open.ts}`, `packages/desktop/src/{main,preload}.ts`, `packages/app/src/desktop/host.ts` (these bridge files also host catalog operations) | +80 |
| Adapt anchored allowlist, clear-all and two-process harness to both new name grammars | `packages/desktop/src/features/browser-profile{,.test}.ts`, `packages/desktop/capture-harness/{index.html,main.js}` | +165 |
| Adapt partition plumbing and add safe replacement/agent defaults | `packages/app/src/desktop/browser/{resident-webviews.ts,resident-webviews.browser.test.ts,automation/handler.ts,automation/handler.test.ts,panel.tsx,pane/index.electron.tsx,pane/index.web.tsx,pane/index.tsx}` | +165 |
| New main-owned catalog and concurrent allocation tests | `packages/desktop/src/features/browser-profile-catalog{,.test}.ts` | +160 |
| New resolver (reuse SHA-256 tuple technique), tab persistence, toolbar/menu and create dialog | `packages/app/src/desktop/browser/{profiles.ts,profiles.test.ts,store/index.ts,store/state.ts,store/state.test.ts,pane/profile-selector.electron.tsx}` | +230 |
| New UI strings, real toolbar/restart journey, revised user-visible behavior in docs | `packages/app/src/i18n/resources/{ar,en,es,fr,ja,ko,pt-BR,ru,zh-CN}.ts`, `packages/desktop/e2e/browser-tabs.e2e.mjs`, `docs/{architecture,browser-capture-harness}.md` | +200 |
| **Total (about 38 files)** | **±25%**, chiefly switch lifecycle and full-app relaunch fixture | **+1,000 net (750–1,250)** |

Electron on Linux, Windows and macOS gains the selector and local storage behavior. Shared record/schema and pane prop changes must compile on iOS, Android and ordinary web, which retain their existing fallback panes. The renderer/main IPC is local to the packaged desktop app. The daemon, CLI, `packages/protocol` and plugin API require no changes. Existing agent requests and responses keep their wire shapes. No new dependency, download or prototype is proposed.

## Acceptance criteria

**AC-1 — Two tabs at one origin have independently chosen profiles, retain different sign-ins across an Electron restart, and identify their actual profiles in the toolbar.**

Verified by: extend `packages/desktop/e2e/browser-tabs.e2e.mjs`. Open two tabs of one workspace on the same fixture URL, select Shared › Work and a named project profile, and sign in as Alice and Bob using the same cookie and local-storage keys. Record browser/tab IDs and each selector’s visible label beside the fixture’s account. Quit Electron fully, relaunch with the same isolated user data, renderer origin and workspace, and reopen the restored tabs without reselecting or signing in. Both original IDs, both labels, both page identities and each guest’s exact cookie/local-storage values must agree before and after restart. Save paired screenshots and machine-readable assertions.

**AC-2 — Shared and project groups show their profiles, their creation actions and the owning workspace’s automatic profile in the correct place.**

Verified by: the full-app journey creates entries in both groups, opens the menu in another workspace of the same project and one in another project, checks group membership, checked row and visible label, and selects by keyboard. Cancel leaves the active selection intact. `browser-profile-catalog.test.ts` reopens the catalog from disk, exercises concurrent creates and accent/length collisions, rejects blank, reserved and duplicate names, and checks that distinct valid entries keep distinct keys.

**AC-3 — New UI, plugin and agent tabs select the destination workspace; pre-feature tabs and Shared › default retain existing shared cookies.**

Verified by: `store/state.test.ts` decodes a saved record without a profile and round-trips an explicit choice and pending marker. `automation/handler.test.ts` distinguishes two workspaces of one project, checks background guest partition equals the persisted choice, and checks unknown workspaces leave no tab or guest. The full-app journey opens via the workspace launcher, ordinary link and existing plugin navigation fixture, then restores a pre-feature record with a seeded `persist:paseo-browser` sign-in.

**AC-4 — Profile identity survives project renames and separates same-named projects on different servers and workspaces within a project.**

Verified by: `profiles.test.ts` checks exact partition strings for fixed identity tuples, renamed labels, equal display names on different servers, two workspace IDs and same-group vs cross-group slugs. The default alias equals the old literal exactly.

**AC-5 — A switch replaces only that tab’s guest; the tab, URL, viewport and automation target remain usable.**

Verified by: `resident-webviews.browser.test.ts` checks the old guest is removed, the new element’s partition is set before attachment and normal re-presentation reuses it. In the full app switch A→B→A, observe each account and a new guest ID on each switch, call an existing browser tool against the original browser ID, and check a second tab retained its guest and session. Simulate registration failure and a late old event; verify pending/error/retry, no stale success label, and recovery to the requested selection.

**AC-6 — Only approved guest URLs and exact Paseo name forms attach, registrations match the actual session and sender, and child popups use their opener.**

Verified by: `browser-webviews/index.test.ts` exercises allowed and malformed/foreign names, invalid lengths, URL rejection, sender and session mismatch. The Electron harness opens a child from a non-default named profile and checks the actual session and both origin values match the opener.

**AC-7 — Clear browser data signs all profiles out, including closed ones, while preserving profile names and tab choices.**

Verified by: `browser-profile.test.ts` checks directory discovery and live guest reload for shared, named project, auto-workspace and legacy profiles while excluding an unrelated directory. The real Electron checks seed same-origin storage in an open and a closed profile, clear through Settings, revisit both, assert empty cookie/local storage, retain their toolbar labels and catalog rows, and verify an unrelated Electron session’s sentinel survives.

## Test plan

Implementation and independent validation run the following files individually. In `packages/app` run `npx vitest run <file> --bail=1` for `src/desktop/browser/profiles.test.ts`, `src/desktop/browser/store/state.test.ts` and `src/desktop/browser/automation/handler.test.ts`. Use `npx vitest run --project browser src/desktop/browser/resident-webviews.browser.test.ts --bail=1` for Chromium. In `packages/desktop` run one file at a time for `src/features/browser-profile-catalog.test.ts`, `src/features/browser-profile.test.ts` and `src/features/browser-webviews/index.test.ts`.

From the root, build desktop main with the existing script. Run `PASEO_CAPTURE_HARNESS_GROUP=browser-profile npm run capture-harness --workspace=@getpaseo/desktop` with the adapted two-process fixture, then `npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` for the production selector journey in `packages/desktop/e2e/browser-tabs.e2e.mjs`. Use the existing isolated test environment with two successive Electron processes and retain the same fixture origin. Record Linux screenshots of menu, both tabs, and post-restart labels alongside fixture accounts, JSON and command output. Record macOS/Windows coverage available at validation. Run `npm run typecheck`, `npm run lint` and `npm run format`. No product tests or prototype were run in ideation.

### Feedback Cycles

## Out of scope

The agent access control itself, and plugin cookie injection.

## Stage Report: ideation

- DONE: Finalize the per-tab toolbar design, including where named profiles and each tab’s choice are stored and restored, and the scope/default rules in CL’s brief.
  Proposed approach specifies the main-owned catalog, persisted browser record, Shared › default alias, workspace defaults and profile switching.
- DONE: Give the expected files and net lines with a tolerance, distinguishing reuse from 66805baf, adaptations, and new work. State platform and protocol effects.
  Evidence and expected surface compares upstream/main 95542dbfe with 66805baff and budgets +1,000 net lines ±25% across Electron, shared types, tests and docs.
- DONE: Write **AC-N** acceptance criteria with falsifiable Verified by clauses and a test plan naming specific files. Prove the end-user outcome in the plan: two profiles on one site remain separate across restart, and each tab shows the profile it uses.
  AC-1 requires the same restored IDs, toolbar names and independent account values through a real process relaunch; AC-2 through AC-7 cover creation, defaults, identity, switching, attachment and clearing.

### Summary

The design keeps named profile metadata on the desktop and records each tab’s choice with its browser ID. The reference proves the older partition mechanisms. CL’s gate covers project-list visibility, new-tab defaults for ordinary links, and the reload/history behavior when a user switches profiles.
