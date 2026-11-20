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
              resolution:
                type: Resolution
                id: resolution:spacedock:vb7f0c31h72remcb4fypyeqg:ideation:1
                briefing: briefing:vb7f0c31h72remcb4fypyeqg:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-11-20T04:17:36.065851678Z"
                decision: revise
                reason: 'CL, relayed by the paseo project manager: retain the per-tab selector but allow profile changes only while the new tab is blank before its first navigation. A new tab starts in its workspace''s profile. After the first URL loads, show the profile label read-only. To use another profile, open a new tab; ideation may include Open in new tab with profile for the current URL only if cheap. Drop reload-in-place, navigation-history reset and their tests. Preserve grouping, automatic workspace profiles, prefixes, storage, defaults for user/link/agent tabs, opener-session popups, and restart proof of the visible profile and account. Revise the design, expected surface with a smaller estimate and tolerance, AC-N criteria and named test plan.'
            - id: gate-attempt:vb7f0c31h72remcb4fypyeqg-ideation-2
              briefing:
                id: briefing:vb7f0c31h72remcb4fypyeqg:ideation:attempt-2:revision-1
                digest: sha256:6901daf1a5bcaf7dbddada3e8fbd3d12eb3b60c8f2214b9cd89698cbb1b043fa
                room-ref: '@review/ideation/briefing-2'
---

## Problem

Since PR #2089, every browser tab in every project shares one Electron session. A user cannot keep two accounts on one site apart, and an agent in one project uses the sign-ins of every other project. An upstream maintainer proposed a per-tab profile selector instead of a global setting.

## Proposed approach

A new browser tab without a destination opens blank in its workspace’s automatic profile. Beside the URL field, show a labelled, keyboard-operable selector while the tab is still on its *initial* blank page. Its checked row and closed label show the chosen profile, for example `Shared › Work` or `<project> › Customer`. Once the first site loads, show the same label as read-only text, with its full accessible name at narrow widths. To visit the site in another profile, open a new blank tab, choose a profile, then enter the URL.

- List **Shared** first, with the built-in `default`, named shared profiles such as `global-messy`, and **Create new shared profile…**. Then list one group per current project from the app’s project list, with its display name, named profiles and **Create new workspace profile…**. That action creates a project-owned profile available across workspaces of that project. The active workspace’s automatically provisioned profile appears under its owning project. Disambiguate identical group labels with the host or project path. Creation selects the new profile in the invoking blank tab. If navigation began while the create dialog was open, keep the catalog entry available for other blank tabs and leave this tab’s choice alone.
- Use `persist:paseo-browser` for the built-in **Shared › default**, preserving existing cookies in place. Named shared profiles use `persist:paseo-shared-<slug>`. Project-owned profiles use `persist:paseo-project-<scopeId>-<slug>`, where `scopeId` is the first 16 bytes of SHA-256 of UTF-8 JSON for `["v1","project",serverId,projectId]`, encoded as 32 lowercase hex characters. The automatic profile uses reserved slug `ws-<32 hex>` from the same versioned tuple encoding of server, project and workspace IDs. Display-name or path changes preserve both keys.
- Trim display names and limit to 80 characters. For named profiles, fold case and accents, replace runs outside ASCII letters and digits with a hyphen, trim separators, and bound the resulting slug to 48 characters. Keep the original trimmed display name. Use an allocated `profile-<suffix>` for an empty transliteration. Reject blank names, reserved names (`default` in Shared and `ws-` for project entries), and same-group display-name duplicates with an inline message. Resolve distinct names with the same slug using a bounded suffix inside the length limit, under the catalog writer’s lock. Allow the same name in different groups.
- **Profile catalog.** Electron main owns a versioned `<userData>/browser-profiles.json` containing each named profile’s group (shared or server-qualified project), immutable slug and display name. Expose narrow list/create operations on the existing desktop browser bridge. Main validates inputs and serializes the entire read/allocate/write operation using temp-file rename. Read the current catalog on menu open or restore. Generate the built-in and workspace entries from identity and current project/workspace labels. Electron itself owns cookies and origin storage under its usual persistent partitions. Clearing site data retains the catalog.
- **Tab storage and restore.** In the existing Zustand/AsyncStorage key `workspace-browser-store`, persist each `browsersById[browserId]` record’s profile reference (scope IDs, slug, display-name snapshot) and a navigation phase beside the URL. Workspace layout keeps its existing browser ID. Resolve the workspace default from the destination server/project/workspace once, before attach; an explicit pending-default marker distinguishes a new record awaiting workspace data from an older record. Wait for hydration. Legacy records use their saved profile when present, otherwise **Shared › default**, and are conservatively locked if no phase was saved, even when their saved URL is `about:blank`. Preserve the existing shared cookie jar in place. A missing workspace prevents agent creation and pane attachment. A bad explicit profile or an unreadable catalog gives a retryable pane error without choosing another account or discarding healthy sibling records.
- **First navigation.** Only an explicitly pristine tab can select or create a profile. In `createBrowserRecord` and the agent new-tab handler, represent an omitted destination as `about:blank`; today both paths default to `https://example.com`. The address field begins empty. Leave general URL normalization for supplied addresses intact. Typing a URL or rejecting an unsupported scheme leaves the tab pristine. Serialize profile selection against starting an allowed first top-level navigation: snapshot the selected partition and disable the picker before loading. A successful first nonblank top-level commit sets a sticky locked flag. An aborted or failed request may re-enable selection only if no document committed and the guest remains on its initial blank page. A restored in-flight record retries its saved destination with its recorded profile and stays read-only pending confirmation. Back, redirects, reload, a later visit to `about:blank`, and process restart all preserve a committed lock. Current URL alone never indicates eligibility.
- **Guest identity.** Keep the existing resident guest and agent registration contract, including `browser_new_tab` without a URL. A profile change on a pristine tab attaches a fresh *blank* guest with the selected partition set before `src`. Electron cannot change an attached guest’s partition. Use the existing resident disposal and registration paths, verify the main-side guest is still pristine before retiring it and serialize that operation with navigation. Track first main-frame navigation/commit for parked guests as well as presented ones, and persist that state by browser ID independently of pane focus. Stale picker completions cannot change a locked record. Set the final read-only label from the same persisted choice checked against the attached guest’s actual session. A loaded guest keeps its session for the rest of the tab’s life.
- **Defaults and opener behavior.** Launcher tabs and agent tabs created without a URL start editable in the destination workspace’s automatic profile. Links routed to a new workspace tab, plugin opens and agent creates with a supplied URL resolve the same workspace default *before* navigation and are read-only once loaded. An ordinary link from a tab using a named profile still creates a workspace-default tab. Native named/OAuth child popups inherit their opener’s actual session and secured window options. Main keeps its existing URL checks and accepts exactly the legacy shared literal and the two bounded profile grammars. Clear browser data enumerates matching on-disk profiles (including closed tabs and the existing legacy per-tab clear path), clears their site data and reloads live guests. Their selected profile, lock and catalog survive.

**Gate decision.** Omit “Open in new tab with profile…” for this change. The existing link path accepts a URL and immediately creates a workspace-default tab. A profile-specific shortcut would introduce another create-and-navigate path and another picker on a loaded tab. The ordinary new-tab flow already supports the request. The scoped prefixes remain available for a future ACL, with Shared › default as the legacy exception.

## Reference

Branch `task/browser-session-scope` at `66805baf` on the fork, and the [archived task and validation report](_archive/browser-session-scope.md). It already proves:

- the anchored attach gate;
- popups using the opener's session;
- the partition plumbing into resident webviews;
- Clear browser data over every scoped session on disk;
- harness checks for isolation and restart persistence.

The expected surface below identifies the reference code to carry forward.

## Evidence and expected surface

Local `upstream/main` is `95542dbfe`, the exact parent of `66805baff`. Independent Linux/Electron validation of the reference recorded six passing harness checks, including scoped isolation, restart persistence and opener-session popups, plus unit/browser checks for the attach guard, registration, resident webviews and disk discovery. Its screenshots show the earlier global control. This design’s names, catalog, blank-tab selector, first-navigation lock and restored visible labels still require implementation and the checks below. [Archived results](_archive/browser-session-scope/validation/results.json) · [Archived report](_archive/browser-session-scope.md)

Estimate against `upstream/main`, including tests, translations and docs. Net means additions minus deletions. The reference was +451 net over 38 files. Reuse its components selectively and omit the global Settings selector.

| Work | Expected files | Net lines |
| --- | --- | ---: |
| Reuse opener session, registration, first readable guest ID, bridge plumbing and test assertions from 66805baff | `packages/desktop/src/features/browser-webviews/{index.ts,index.test.ts,window-open.ts}`, `packages/desktop/src/{main,preload}.ts`, `packages/app/src/desktop/host.ts` (these bridge files also host catalog operations) | +80 |
| Adapt anchored allowlist, clear-all and two-process harness to both new name grammars | `packages/desktop/src/features/browser-profile{,.test}.ts`, `packages/desktop/capture-harness/{index.html,main.js}` | +165 |
| Adapt partition plumbing for pristine guests, track first navigation and apply agent defaults | `packages/app/src/desktop/browser/{resident-webviews.ts,resident-webviews.browser.test.ts,automation/handler.ts,automation/handler.test.ts,panel.tsx,pane/index.electron.tsx,pane/index.web.tsx,pane/index.tsx}` | +90 |
| New main-owned catalog and concurrent allocation tests | `packages/desktop/src/features/browser-profile-catalog{,.test}.ts` | +160 |
| New resolver (reuse SHA-256 tuple technique), tab persistence, blank selector/create dialog and read-only label | `packages/app/src/desktop/browser/{profiles.ts,profiles.test.ts,store/index.ts,store/state.ts,store/state.test.ts,pane/profile-selector.electron.tsx}` | +190 |
| New UI strings, real toolbar/restart journey, revised user-visible behavior in docs | `packages/app/src/i18n/resources/{ar,en,es,fr,ja,ko,pt-BR,ru,zh-CN}.ts`, `packages/desktop/e2e/browser-tabs.e2e.mjs`, `docs/{architecture,browser-capture-harness}.md` | +155 |
| **Total (about 38 files)** | **±20%**, chiefly the first-navigation boundary and full-app relaunch fixture | **+840 net (672–1,008)** |

The revised estimate removes 160 net lines from briefing 1: about 75 in guest/navigation handling, 40 in state and UI, and 45 in the full-app journey and copy. The earlier plan included loaded-page replacement, old-guest recovery, history reset and repeated-switch coverage. The new budget includes initial blank guest selection and persistence of the first-navigation lock.

Electron on Linux, Windows and macOS gains the selector and local storage behavior. Shared record/schema and pane prop changes must compile on iOS, Android and ordinary web, which retain their existing fallback panes. The renderer/main IPC is local to the packaged desktop app. The daemon, CLI, `packages/protocol` and plugin API require no changes. Existing agent requests and responses keep their wire shapes. No new dependency, download or prototype is proposed.

## Acceptance criteria

**AC-1 — Two tabs opened blank in one workspace keep different accounts on the same origin and show the correct locked profile names across a full Electron restart.**

Verified by: extend `packages/desktop/e2e/browser-tabs.e2e.mjs`. Open two blank tabs, choose Shared › Work on one and a named project profile on the other, then navigate both to the *same* fixture URL. Sign in as Alice and Bob using the same cookie and local-storage keys. For each browser/tab ID, assert the visible read-only toolbar label, displayed account, and exact cookie and storage values. Quit Electron fully; relaunch with the same isolated user data, renderer origin and workspace. Reopen those same two persisted tabs without selecting a profile or signing in. Repeat all four assertions for both original IDs, saving screenshots and JSON before and after restart.

**AC-2 — Shared and project groups show their profiles, their creation actions and the owning workspace’s automatic profile in the correct place.**

Verified by: the full-app journey creates entries in both groups from blank tabs, opens a pristine tab’s menu in another workspace of the same project and one in another project, checks group membership, checked row and visible label, and selects by keyboard. Cancel leaves the active selection intact. `browser-profile-catalog.test.ts` reopens the catalog from disk, exercises concurrent creates and accent/length collisions, rejects blank, reserved and duplicate names, and checks that distinct valid entries keep distinct keys.

**AC-3 — User, link, plugin and agent tabs take the destination workspace’s profile; older loaded tabs preserve their existing profile.**

Verified by: `automation/handler.test.ts` uses two workspaces of one project, tests agent create with and without a supplied URL, checks the target partition, immediate browser registration and first-page URL, and confirms an unknown workspace leaves no tab or guest. In `browser-tabs.e2e.mjs`, create a no-URL launcher tab and a no-URL agent tab and see the editable workspace default with no request to example.com. Open an ordinary link from a named profile, a plugin link to another workspace and an agent tab with a URL. Each first request uses its destination workspace's cookie jar and its loaded tab shows that workspace’s read-only label. Seed a pre-feature record and a shared sign-in, then restore the same ID and cookie with Shared › default locked. `store/state.test.ts` also restores a saved non-default choice lacking a phase as locked, and preserves valid sibling records.

**AC-4 — Profile identity survives project renames and separates same-named projects on different servers and workspaces within a project.**

Verified by: `profiles.test.ts` checks exact partition strings for fixed identity tuples, renamed labels, equal display names on different servers, two workspace IDs and same-group vs cross-group slugs. The default alias equals the old literal exactly.

**AC-5 — Profile selection is available only on a never-navigated blank tab; once loaded, even a tab displaying about:blank retains its original profile.**

Verified by: `store/state.test.ts` round-trips pristine, in-flight and locked records; rejects late profile writes after first navigation begins; preserves the chosen profile for an old tab with no phase. In `browser-tabs.e2e.mjs`, change the profile while blank, enter an unsupported address and observe the editable choice, then successfully load the fixture. Verify the first request uses the selected account, the label becomes read-only and keyboard or pointer cannot open a picker. Visit `about:blank` in that tab, quit and relaunch, and assert it still has the same read-only label. Keep a separate never-navigated tab across the same restart and assert its chosen profile remains editable. Navigate a parked blank agent tab by browser ID and present it: the attached guest, label and lock agree. `resident-webviews.browser.test.ts` checks the initial partition is set before navigation, a blocked or uncommitted first load cannot unlock a previously loaded tab, and normal pane re-presentation uses the existing guest.

**AC-6 — Only approved guest URLs and exact Paseo name forms attach, registrations match the actual session and sender, and child popups use their opener.**

Verified by: `browser-webviews/index.test.ts` exercises allowed and malformed/foreign names, invalid lengths, URL rejection, sender and session mismatch. The Electron harness opens a child from a non-default named profile and checks the actual session and both origin values match the opener.

**AC-7 — Clear browser data signs all profiles out, including closed ones, while preserving profile names and tab choices.**

Verified by: `browser-profile.test.ts` checks directory discovery and live guest reload for shared, named project, auto-workspace and legacy profiles while excluding an unrelated directory. The real Electron checks seed same-origin storage in an open and a closed profile, clear through Settings, revisit both, assert empty cookie/local storage, retain their read-only toolbar labels and catalog rows (inspect the menu from a new blank tab), and verify an unrelated Electron session’s sentinel survives.

## Test plan

Implementation and independent validation run the following files individually. In `packages/app` run `npx vitest run <file> --bail=1` for `src/desktop/browser/profiles.test.ts`, `src/desktop/browser/store/state.test.ts` and `src/desktop/browser/automation/handler.test.ts`. Use `npx vitest run --project browser src/desktop/browser/resident-webviews.browser.test.ts --bail=1` for Chromium. In `packages/desktop` run one file at a time for `src/features/browser-profile-catalog.test.ts`, `src/features/browser-profile.test.ts` and `src/features/browser-webviews/index.test.ts`.

From the root, build desktop main with the existing script. Run `PASEO_CAPTURE_HARNESS_GROUP=browser-profile npm run capture-harness --workspace=@getpaseo/desktop` with the adapted two-process fixture, then `npm run test:e2e:browser-tabs --workspace=@getpaseo/desktop` for the production selector journey in `packages/desktop/e2e/browser-tabs.e2e.mjs`. Use the existing isolated test environment with two successive Electron processes and retain the same fixture origin. Capture the pristine selector, the first committed page with its read-only label, and both restored accounts with their labels. Exercise a revisited blank and a never-navigated blank across the same relaunch. Save Linux screenshots, JSON assertions and command output. Record macOS/Windows coverage available at validation. Run `npm run typecheck`, `npm run lint` and `npm run format`. No product tests or prototype were run in ideation.

### Feedback Cycles

- Cycle 1: revise — CL, relayed by the paseo project manager, 2026-11-20, ideation briefing 1. Choose the profile on a never-navigated blank tab and show it read-only after the first site loads. The revised design removes switching a loaded tab, its history reset and their tests; it omits the optional new-tab shortcut. The estimate drops from 1,000 net lines ±25% to 840 ±20%. The same ideation ensign revised the design, seven acceptance criteria and file-specific test plan for CL’s review.

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

## Stage Report: ideation (cycle 2)

- DONE: Revise the per-tab design, including persistent lock behavior across restart and blank-page revisits, so profile selection occurs only before first navigation and the attached profile remains visibly read-only afterward. Decide whether the optional new-tab shortcut is cheap.
  Proposed approach covers pristine, in-flight and locked tabs, the older-record rule and guest registration. The optional shortcut is omitted because it adds a second create-and-navigate path.
- DONE: Re-estimate files and net lines with tolerance, identifying the reductions from dropping in-place switching and the mechanisms reused from 66805baf.
  Expected surface budgets +840 net lines ±20% (672–1,008), 160 fewer than briefing 1, and identifies the reusable attach, popup, clear-all and harness mechanisms.
- DONE: Update **AC-N** criteria, Verified by clauses and named tests for blank selection, navigation/lock, user/link/agent defaults and two same-site accounts with the correct labels across restart. Preserve the other approved design inputs.
  AC-1, AC-3 and AC-5 require live visible labels, real same-origin sign-ins, defaults, first navigation and locked versus pristine blank tabs across restart; AC-2, AC-4, AC-6 and AC-7 retain scope, identity, popup and clearing coverage.

### Summary

A tab chooses its profile while blank, then keeps it through navigation and restart. The selector becomes a read-only label after the first site loads. The revised selector and lock are proposed behavior; runtime evidence so far covers the reference commit’s partition mechanisms.
