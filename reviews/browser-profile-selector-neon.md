# Code Review: Per-Tab Browser Profile Selector (PR #10357)

**Branch:** `task/browser-profile-selector` (`cba515ef7..91b914567`, 40 files, +1,934 / −213)  
**Reviewer:** Neon (read-only review against Paseo upstream standards)

## Verdict

The core isolation and security model is sound: the anchored partition allowlist, main-process guest session/host verification, opener-session popup inheritance, domain-separated SHA-256 scope hashing, atomic catalog writes, and fail-closed legacy/corrupt store restoration all hold up under scrutiny. However, the PR is **not ready to open upstream as-is** due to four material issues: the profile query in `BrowserPane` tears down and re-parks the live `<webview>` on workspace title updates (and double-fetches `listProfiles()` on every new tab); Clear browser data both misses live sessions not yet flushed to disk and creates permanent phantom `paseo-browser-<id>` directories for every modern tab; user-facing errors leak raw Electron IPC messages and display `"Unable to load desktop settings."` inside the browser pane; and `ProfileSelector` violates Paseo's menu/design-system rules and truncates away its dropdown chevron on long project/workspace names. Beyond those fixes, two pre-upstream decisions remain on trimming the 512-line E2E runner (which doubles `browser-tabs.e2e.mjs` cold-boot cost) and resolving the "workspace profile" label mismatch plus the 2-line Unicode NFC normalization gap.

---

## Findings

### Material

#### 1. `BrowserPane` query key causes live webview re-parking on workspace title changes and double IPC on every new tab
- **File & line:** `packages/app/src/desktop/browser/pane/index.electron.tsx:611-654, 782-985`
- **Problem:** `useFetchQuery` uses `queryKey: ["browser-profile", browserId, stored, serverId, projectId, workspaceId, workspaceName]` with `dataShape: "value"` and `gcTime: 0`, and feeds `resolved?.partition` into the webview lifecycle `useEffect` (`[browserId, onFocusPane, partition]`). Because `panel.tsx:63` passes `workspaceName = w.title || w.name`, any workspace title/rename update changes `queryKey`, drops `resolved` and `partition` to `undefined` while `listProfiles()` re-runs, and triggers the effect cleanup — parking the visible `<webview>` to 1×1, detaching all 11 event listeners, and cancelling any active element selector before re-presenting on the next frame. The same churn happens on every new tab (`stored === "pending"` -> first query -> `useEffect` writes `resolved.selected` -> `queryKey` changes -> second `listProfiles()` IPC round-trip before the `<webview>` attaches), and any transient catalog read error on menu refresh sets `partitionError`, dropping `partition` to `undefined` on a live tab.
- **Why it matters to the maintainer:** Parking a presented webview resets its compositor surface geometry (`docs/browser-capture-harness.md`), causes visible flicker/selector cancellation when a workspace auto-titles, and adds unnecessary IPC latency to every tab open.
- **Suggestion:** Share one React Query cache for the catalog (`queryKey: ["browser-profiles"]` with a normal `staleTimeMs`) instead of a per-pane `gcTime: 0` query. Compute the tab's immutable `partition` purely from `(serverId, projectId, workspaceId)` and `(stored.group, stored.slug)` once resolved (never keyed on `workspaceName` or cleared by a subsequent menu-refresh failure), and resolve `"pending"` directly from `workspaceProfile(...)` without waiting on a second `listProfiles()` round-trip.

#### 2. Clear browser data can miss unflushed live sessions and permanently leaks empty legacy partition directories
- **File & line:** `packages/desktop/src/features/browser-profile.ts:106-129`, `packages/desktop/src/main.ts:512-530`
- **Problem:** Two issues interact in `paseo:browser:clear-profile`:
  1. `profileSessions` and `sessionsToReload` are built solely from `<userData>/Partitions` directory names, `PASEO_BROWSER_PROFILE_PARTITION`, and `legacyBrowserIds`. If a live tab or popup uses a freshly created profile whose `Partitions/<name>` directory has not yet been written to disk, its session is absent from both `profileSessions` and `sessionsToReload` — so it is neither cleared nor reloaded.
  2. `browser-data-section.tsx:42` passes every current `browserId` in `browsersById` as `rawLegacyBrowserIds`, and `getPaseoBrowserProfileSessions` unconditionally calls `sessions.fromPartition("persist:paseo-browser-" + browserId)`. Modern tabs never used legacy per-tab partitions (`will-attach-webview` rejects them), yet `fromPartition` instantiates a persistent partition and creates `<userData>/Partitions/paseo-browser-<id>` on disk. Because this PR added `listBrowserPartitionDirectories` to fold all on-disk `paseo-browser-*` directories back into `legacyIds`, those phantom empty directories accumulate indefinitely and are re-opened and re-cleared on every future Clear browser data.
- **Why it matters to the maintainer:** Live tabs must never survive Clear browser data signed in, and Settings → Clear browser data must not leak unbounded empty directories under `<userData>/Partitions`.
- **Suggestion:** Only open legacy `persist:paseo-browser-<id>` partitions that already exist in `directories` (no live guest can attach to a legacy partition anymore, so any real legacy data is already on disk). Separately, union `profileSessions` / `sessionsToReload` with the `.session` of every live registered Paseo browser guest (from `browserRegistry` / `webContents.getAllWebContents()`).

#### 3. Raw Electron IPC errors and unrelated "desktop settings" copy surface in user-facing UI
- **File & line:** `packages/app/src/desktop/browser/pane/profile-selector.electron.tsx:92, 100-107`, `packages/app/src/desktop/browser/pane/index.electron.tsx:801, 1651`, `packages/app/src/desktop/browser/resident-webviews.ts:93`, `packages/desktop/src/features/browser-profile-catalog.ts:50-54`
- **Problem:**
  - `profile-selector.electron.tsx:102` only maps errors ending with `"Duplicate profile name"`. Entering a reserved name (`default` in Shared or `ws-foo` in a project) or hitting a catalog read/write error throws Electron's raw `"Error invoking remote method 'paseo:browser:create-profile': Error: Reserved profile name"` directly into `<AdaptiveRenameModal>`'s inline error text.
  - `pane/index.electron.tsx:801, 1651` and `profile-selector.electron.tsx:92` reuse `t("desktop.settings.loadFailed")`, which displays `"Unable to load desktop settings."` inside the browser pane.
  - `resident-webviews.ts:93` writes `String(error)` directly to `lastError`, exposing raw IPC error strings in the browser error banner.
- **Why it matters to the maintainer:** Violates `docs/coding-standards.md` ("Throw typed error classes... Separate user-facing copy from log/debug strings") and `docs/testing.md#fallible-user-actions`, and shows misleading or unlocalized technical copy on normal validation failures.
- **Suggestion:** Return a structured discriminated result (or typed error code) from `createProfile` (e.g., `duplicate` | `reserved` | `invalid` | `io`), add dedicated `workspace.browser.profiles.*` translation keys for reserved names, catalog load failure, and attachment failure, and map every failure mode to localized copy instead of `endsWith(...)`, `String(error)`, or `desktop.settings.loadFailed`.

#### 4. `ProfileSelector` violates Paseo's menu/design-system patterns and truncates its dropdown chevron
- **File & line:** `packages/app/src/desktop/browser/pane/profile-selector.electron.tsx:122-149, 177-185`
- **Problem:**
  - Lines 127–129 render `{label} ▾` inside a single `<Text numberOfLines={1} style={styles.label}>` capped at `maxWidth: 340`. Any project + workspace label exceeding 340px ellipsizes the `▾`, making an editable selector visually indistinguishable from a locked read-only label. It also uses a literal Unicode `▾` rather than `ThemedChevronDown` (already used beside it in `DeviceSizeMenu` at `pane/index.electron.tsx:548`).
  - `DropdownMenuTrigger` passes a static `styles.trigger` with no `height: 28` (`docs/design.md` §4 requires 28px pointer-toolbar controls matching the URL bar and buttons) and no hover/pressed/open `interactionHighlight` background (`MenuTrigger` supports a `{ hovered, pressed, open }` style callback).
  - Line 133 wraps each menu section in a raw HTML `<div role="group">` inside `<DropdownMenuContent>` (plain `<div>` uses `display: block` instead of React Native Web's flex column and drops rows out of `MenuPage` per `docs/menus.md`; sibling grouped menus such as `workspace-new-tab-menu.tsx:114-115` use `<View>` + `<DropdownMenuSeparator />`). There is no `<DropdownMenuSeparator />` between Shared and the project group. Finally, profile items set `showSelectedCheck={true}` while the `"Create new…"` rows set `showSelectedCheck={false}` with no `leading` icon, shifting the action labels ~24px left off the label rail (`docs/design.md` §8).
- **Why it matters to the maintainer:** The upstream repo enforces strict component, rail-alignment, and menu-engine consistency (`docs/design.md`, `docs/menus.md`), and losing the chevron on long names breaks a core affordance.
- **Suggestion:** Style `DropdownMenuTrigger` with a state callback applying `height: 28`, `borderRadius.md`, and `interactionHighlight` when `hovered || pressed || open`; place `<Text numberOfLines={1}>` in a flex row beside a non-shrinking `<ThemedChevronDown size={12} />`; replace `<div role="group">` with `<View role="group" aria-label={name}>` separated by `<DropdownMenuSeparator />`; and give the `"Create new…"` items a `leading` plus icon (or `showSelectedCheck`) so every row sits on one label rail.

---

### Needs Decision

#### 5. Full-app E2E adds +512 net lines, doubles `browser-tabs.e2e.mjs` cold boots, and uses fragile pixel matching
- **File & line:** `packages/desktop/e2e/browser-tabs.e2e.mjs:1603-1615`, `packages/desktop/e2e/browser-profiles.electron.mjs:241-287, 289-656`
- **Problem:** Tests are +952 net lines against +769 of production, translations, and docs. The six unit/browser test files (+364) and capture harness (+76) are compact and high-signal, but the full-app E2E accounts for +512 net lines and significantly increases CI cost:
  - `browser-tabs.e2e.mjs:1603-1615` runs `main(false)`, tears down the daemon/Metro/Electron stack, then runs `main(true)` from scratch — paying a second cold Metro/daemon boot plus **three** sequential Electron launches and a hardcoded 8-second `setTimeout` in `checkDelayedRegistration` (`browser-profiles.electron.mjs:255`).
  - `browser-profiles.electron.mjs` (444 lines, 367-line single function) re-tests behaviors already covered by unit/browser tests and `capture-harness` (`file://` blocking, duplicate-name rejection, generic `<DropdownMenu>` keyboard navigation, `localStorage` legacy stripping, `about:blank` revisit lock) and monkey-patches `dialog.showMessageBox` and `app.on("web-contents-created")` via `--inspect`.
  - `screenshot()` (`lines 328-341`) waits for exact raw bitmap bytes (`image.toBitmap().includes(strip)`). This passes on Linux Xvfb only because all three chosen RGB triples are palindromes (`R === B`, masking RGBA vs BGRA), and is fragile under macOS Display P3/sRGB color conversion.
- **Why it matters to the maintainer:** `npm run test:e2e:browser-tabs` is part of the required `desktop-tests` CI leg; doubling its runtime and adding a 444-line monolithic E2E script with main-process monkey-patches will draw immediate pushback in upstream review.
- **Suggestion:** Before opening upstream: (a) replace the 8-second timer in `checkDelayedRegistration` with a server promise released as soon as `browser_new_tab` returns (proving the exact same invariant in <500ms); (b) drop the third Electron launch by running Clear browser data on launch 2 before focusing Bob (or after closing Bob's tab so its session is dormant); (c) trim sub-checks already covered by unit/browser tests (`file://`, menu arrow keys, legacy `localStorage` edit) and remove exact-byte `toBitmap()` polling; and (d) consider running the slimmed profile journey inside the single `main()` boot so CI avoids two cold Metro/daemon starts.

#### 6. "Create new workspace profile…" scope mismatch and deferred 2-line Unicode NFC fix
- **File & line:** `packages/app/src/i18n/resources/en.ts:626` (and 8 sibling locale files), `packages/desktop/src/features/browser-profile-catalog.ts:50`, `packages/app/src/desktop/browser/profiles.ts:33, 36`
- **Problem:**
  1. Under the current **project** group header, the creation item reads `"Create new workspace profile…"`, even though it creates a **project-owned** profile available across all workspaces of that project (while the automatic row is the workspace's own profile). `docs/glossary.md` and `docs/design.md` §10 treat Project and Workspace as distinct concepts.
  2. The PR defers Unicode canonical equivalence (`e`+U+0301 vs `é` producing identical toolbar captions for two different sessions) to a follow-up PR, even though `foldedSlug` (`browser-profile-catalog.ts:24`) already normalizes with `NFKD` and adding `.normalize("NFC")` to the two name-comparison lines (`browser-profile-catalog.ts:50` and `profiles.ts:33, 36`) is a 2-line fix.
- **Why it matters to the maintainer:** Maintainers flag terminology drift ("workspace" vs "project") quickly and generally prefer fixing a 2-line known correctness bug inline rather than tracking a follow-up PR for it.
- **Suggestion:** Decide whether to rename the copy to `"Create new project profile…"` across locales and apply `.normalize("NFC")` directly in this PR (with one regression case in `browser-profile-catalog.test.ts` and `profiles.test.ts`).

---

### Deferred Risk

#### 7. Failed or aborted first navigation wipes the typed URL from the address bar, and early Enter is silently dropped
- **File & line:** `packages/app/src/desktop/browser/resident-webviews.ts:348-360`, `packages/app/src/desktop/browser/pane/index.electron.tsx:736-741, 1012-1019`
- **Problem:** On `did-fail-load` with `isMainFrame && getURL() === "about:blank"`, `resident-webviews.ts:359` updates `{ phase: "pristine", url: "about:blank" }`. `pane/index.electron.tsx:736-741` reacts to `url === "about:blank" && phase === "pristine"` by calling `urlInputRef.current?.replaceText("")` and clearing `draftUrl`. Typing an unreachable local dev URL (e.g., `localhost:3000` before the server starts) or aborting a slow load erases the URL from the address bar so the user cannot edit it or press Enter to retry. Separately, `navigate()` (`lines 1014-1019`) silently returns if `dataset.registeredPartition` is not yet set, dropping an Enter press submitted right after opening a tab.
- **Why it matters to the maintainer:** Erodes everyday local-dev ergonomics on blank browser tabs.
- **Suggestion:** When `did-fail-load` reverts `phase` to `"pristine"`, keep `draftUrl` intact in the address bar (only clear on initial blank mount, not when `lastError` is present). If the user submits a URL before guest registration completes, either queue it until `paseo-profile-registered` fires or surface a disabled/pending state instead of silently ignoring Enter.

#### 8. Missing browser record or missing `projectId` renders an empty pane with no error or recovery UI
- **File & line:** `packages/app/src/desktop/browser/pane/index.electron.tsx:626-646`
- **Problem:** `useFetchQuery` sets `enabled: Boolean(projectId && stored)`. If `workspace-layout-store` has a tab whose `browserId` is missing from `workspace-browser-store` (`browser === null`, `stored === undefined`), or while `projectId` is null, the query stays disabled, `partition` stays `undefined`, and `partitionError` stays `null` — rendering a blank pane with no webview, no profile indicator, and no error/retry action.
- **Why it matters to the maintainer:** Silent blank states violate `docs/coding-standards.md` ("Fail explicitly") and make recovery impossible without closing the tab.
- **Suggestion:** After browser store hydration settles, surface an explicit error state when `browser` or `projectId` is missing rather than leaving `BrowserPane` indefinitely blank.

#### 9. `paseo:browser:retire-pristine` skips IPC input validation, leaves registry teardown async, and lacks unit tests
- **File & line:** `packages/desktop/src/main.ts:386-389`, `packages/desktop/src/features/browser-webviews/index.ts:186-198`, `packages/desktop/src/features/browser-webviews/index.test.ts`
- **Problem:** Unlike sibling IPC handlers in `main.ts` (`readAttachedBrowserInput`, `focus`, `open-devtools`), `paseo:browser:retire-pristine` does not validate `typeof browserId === "string"` or `Number.isInteger(guestId) && guestId > 0`. It is also the only `ipcRenderer.sendSync` handler in `preload.ts`, closes the guest without synchronously removing `guest.id` from `browserRegistry` (leaving a brief window until `"destroyed"` fires), and neither `retirePristineGuest` nor `committedGuests` has unit test coverage in `browser-webviews/index.test.ts`.
- **Why it matters to the maintainer:** Main-process IPC handlers are the security boundary for renderer requests (`docs/coding-standards.md`), and `retirePristineGuest` is the main-side guarantee preventing profile swaps on navigated tabs.
- **Suggestion:** Validate `browserId` and `guestId` at the IPC boundary, unregister `guest.id` synchronously inside `retirePristineGuest` before `guest.close()`, and add unit tests in `browser-webviews/index.test.ts` covering pristine blank, in-flight (`isLoadingMainFrame()`), committed non-blank, and committed-then-revisited `about:blank`.

#### 10. Unexplained `await browserHost?.listProfiles?.()` in `openBrowserTabForRequest` couples automatic agent tabs to the catalog
- **File & line:** `packages/app/src/desktop/browser/automation/handler.ts:384`
- **Problem:** `openBrowserTabForRequest` awaits `browserHost?.listProfiles?.()` and discards its return value, even though agent `browser_new_tab` always opens the workspace's automatic profile (derived purely from `serverId`, `projectId`, and `workspaceId`). If `browser-profiles.json` is corrupt, every agent tab creation fails with `browser_unknown_error` and a raw parse error message.
- **Why it matters to the maintainer:** Looks like leftover code and introduces an untested failure mode (plus an unnecessary IPC hop) on a path that does not read the catalog.
- **Suggestion:** Remove line 384, or if refusing agent tabs on a corrupt catalog is deliberate, document the invariant, return a clear error, and cover it in `handler.test.ts`.

---

### Polish

#### 11. Remove dead `profilePartition` property from preload and host bridge
- **File & line:** `packages/desktop/src/preload.ts:127`, `packages/app/src/desktop/host.ts:164`
- **Problem:** `preload.ts` and `DesktopBrowserBridge` still expose `profilePartition: PASEO_BROWSER_PROFILE_PARTITION`, but nothing reads it after `resident-webviews.ts` switched to explicit per-tab `partition` inputs.
- **Why it matters to the maintainer:** `docs/coding-standards.md` requires migrating all callers and removing old paths in the same refactor (and Electron preload ships atomically with the renderer).
- **Suggestion:** Delete `profilePartition` from `preload.ts` and `host.ts`.

#### 12. Drop unused `validateOnChange` edit to shared `AdaptiveRenameModal` (or wire real validation)
- **File & line:** `packages/app/src/components/rename-modal.tsx:14, 23, 37, 81`, `packages/app/src/desktop/browser/pane/profile-selector.electron.tsx:169`
- **Problem:** `ProfileSelector` passes `validateOnChange` to `AdaptiveRenameModal` without passing a `validate` callback, so the new prop on a shared component only displays `"Name is required"` while typing whitespace (when Submit is already disabled) and does not validate duplicates or reserved names client-side.
- **Why it matters to the maintainer:** Unnecessary modification to a shared primitive (`docs/coding-standards.md` YAGNI / no drive-by edits).
- **Suggestion:** Either pass a real `validate` function in `ProfileSelector` for duplicate/reserved names, or revert the changes to `rename-modal.tsx`.

#### 13. Align `BrowserPane` error-row Retry button inline at `size="sm"`
- **File & line:** `packages/app/src/desktop/browser/pane/index.electron.tsx:1648-1659, 1870-1876`
- **Problem:** `styles.errorRow` has no `flexDirection: "row"` or `alignItems: "center"`, and `<Button variant="ghost">` omits `size="sm"`. The Retry button therefore renders at default 32px height stacked below the error line instead of inline in tight toolbar chrome (`docs/design.md` §4).
- **Why it matters to the maintainer:** Keeps error chrome compact and consistent with `docs/design.md` §4.
- **Suggestion:** Add `flexDirection: "row"`, `alignItems: "center"`, `gap: theme.spacing[2]` to `styles.errorRow`, `flex: 1` to `metaError`, and `size="sm"` to the Retry `<Button>`.

#### 14. Tighten docs changes to preserve invariants and respect doc ownership
- **File & line:** `docs/architecture.md:221`, `docs/browser-capture-harness.md:63-68`
- **Problem:**
  - `docs/architecture.md:221` deletes the reparenting gotcha ("Registration is intentionally repeated because reparenting a retained `<webview>` can replace its guest without replacing the DOM element"), narrates UI placement instead of persistence/security contracts, and omits the partition naming grammar and `<userData>/browser-profiles.json` path.
  - `docs/browser-capture-harness.md:63-68` adds a `test:e2e:browser-tabs` command, duplicating ownership with `docs/testing.md#desktop-browser-regression` (`CLAUDE.md`: "One fact, one doc").
- **Why it matters to the maintainer:** `CLAUDE.md` explicitly warns against documenting UI logic while dropping hard-won invariants and against splitting one subject across two docs.
- **Suggestion:** In `docs/architecture.md`, keep the reparenting-registration gotcha, document the partition prefix grammar and `<userData>/browser-profiles.json` catalog, and trim UI narration; move the `PASEO_DESKTOP_BROWSER_PROFILES_ONLY` command reference from `docs/browser-capture-harness.md` to `docs/testing.md#desktop-browser-regression`.

#### 15. Minor test hygiene in `resident-webviews.browser.test.ts` and `browser-tabs.e2e.mjs`
- **File & line:** `packages/app/src/desktop/browser/resident-webviews.browser.test.ts:488-507`, `packages/desktop/e2e/browser-tabs.e2e.mjs:205-207, 1468-1473`
- **Problem:**
  - `resident-webviews.browser.test.ts:488` places its new `it(...)` outside the `describe("resident browser webviews", ...)` block, skipping `beforeEach`/`afterEach` teardown if an assertion fails mid-test.
  - `browser-tabs.e2e.mjs:205-207` replaces `timeoutMs` (90s) in `settleDesktopStartup` with a hardcoded `300_000` (5-minute) timeout, and `launchDesktop()` already runs `waitForDesktopStatus(opened)` at line 1468 before line 1473 calls it again.
- **Why it matters to the maintainer:** Prevents leaked test state on failure and avoids 5-minute silent hangs in CI.
- **Suggestion:** Move the `it(...)` inside `describe(...)` with `finally` store cleanup, restore `timeoutMs` (or justify an explicit constant), and return `{ page, status }` from `launchDesktop()`.
