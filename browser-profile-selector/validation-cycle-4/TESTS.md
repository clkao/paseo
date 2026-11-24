# Individual package tests

351 tests passed across 34 files. Each invocation ran alone in the owning workspace. The log for each file records the full command, test names, output and exit code.

| Working directory | Command | Output |
|---|---|---|
| `packages/app` | `../../node_modules/.bin/vitest run src/components/rename-modal.test.tsx --bail=1 --reporter=verbose` | [7 passed](logs/app-src_components_rename-modal.test.tsx.log) |
| `packages/app` | `../../node_modules/.bin/vitest run --project browser src/components/ui/menu/menu-overlay.browser.test.tsx --bail=1 --reporter=verbose` | [4 passed](logs/app-src_components_ui_menu_menu-overlay.browser.test.tsx.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/desktop/browser/automation/handler.test.ts --bail=1 --reporter=verbose` | [14 passed](logs/app-src_desktop_browser_automation_handler.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/desktop/browser/new-tab-requests/index.test.ts --bail=1 --reporter=verbose` | [3 passed](logs/app-src_desktop_browser_new-tab-requests_index.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/desktop/browser/pane/element-selector.electron.test.ts --bail=1 --reporter=verbose` | [3 passed](logs/app-src_desktop_browser_pane_element-selector.electron.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/desktop/browser/profiles.test.ts --bail=1 --reporter=verbose` | [3 passed](logs/app-src_desktop_browser_profiles.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run --project browser src/desktop/browser/resident-webviews.browser.test.ts --bail=1 --reporter=verbose` | [18 passed](logs/app-src_desktop_browser_resident-webviews.browser.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/desktop/browser/store/state.test.ts --bail=1 --reporter=verbose` | [18 passed](logs/app-src_desktop_browser_store_state.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/desktop/browser/use-browser-tab-profile.test.tsx --bail=1 --reporter=verbose` | [2 passed](logs/app-src_desktop_browser_use-browser-tab-profile.test.tsx.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/hooks/use-open-project.test.ts --bail=1 --reporter=verbose` | [7 passed](logs/app-src_hooks_use-open-project.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/i18n/i18next.startup.test.ts --bail=1 --reporter=verbose` | [9 passed](logs/app-src_i18n_i18next.startup.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/i18n/init.test.ts --bail=1 --reporter=verbose` | [1 passed](logs/app-src_i18n_init.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/i18n/locales.test.ts --bail=1 --reporter=verbose` | [15 passed](logs/app-src_i18n_locales.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/i18n/resources.test.ts --bail=1 --reporter=verbose` | [40 passed](logs/app-src_i18n_resources.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/i18n/sync-language.test.ts --bail=1 --reporter=verbose` | [2 passed](logs/app-src_i18n_sync-language.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/keyboard/internal/sources/electron-browser.test.ts --bail=1 --reporter=verbose` | [16 passed](logs/app-src_keyboard_internal_sources_electron-browser.test.ts.log) |
| `packages/app` | `../../node_modules/.bin/vitest run src/screens/settings/browser-tools-config.test.ts --bail=1 --reporter=verbose` | [6 passed](logs/app-src_screens_settings_browser-tools-config.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/desktop-startup.test.ts --bail=1 --reporter=verbose` | [3 passed](logs/desktop-src_desktop-startup.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-automation/ipc.test.ts --bail=1 --reporter=verbose` | [20 passed](logs/desktop-src_features_browser-automation_ipc.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-automation/service.test.ts --bail=1 --reporter=verbose` | [68 passed](logs/desktop-src_features_browser-automation_service.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-automation/snapshot-engine.test.ts --bail=1 --reporter=verbose` | [5 passed](logs/desktop-src_features_browser-automation_snapshot-engine.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-automation/trusted-input.test.ts --bail=1 --reporter=verbose` | [4 passed](logs/desktop-src_features_browser-automation_trusted-input.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-capture.test.ts --bail=1 --reporter=verbose` | [5 passed](logs/desktop-src_features_browser-capture.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-keyboard/index.test.ts --bail=1 --reporter=verbose` | [7 passed](logs/desktop-src_features_browser-keyboard_index.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-keyboard/policy.test.ts --bail=1 --reporter=verbose` | [7 passed](logs/desktop-src_features_browser-keyboard_policy.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-profile-catalog.test.ts --bail=1 --reporter=verbose` | [5 passed](logs/desktop-src_features_browser-profile-catalog.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-profile.test.ts --bail=1 --reporter=verbose` | [8 passed](logs/desktop-src_features_browser-profile.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-webviews/index.test.ts --bail=1 --reporter=verbose` | [10 passed](logs/desktop-src_features_browser-webviews_index.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-webviews/registry.test.ts --bail=1 --reporter=verbose` | [13 passed](logs/desktop-src_features_browser-webviews_registry.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/browser-webviews/window-open.test.ts --bail=1 --reporter=verbose` | [18 passed](logs/desktop-src_features_browser-webviews_window-open.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/features/opener.test.ts --bail=1 --reporter=verbose` | [2 passed](logs/desktop-src_features_opener.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/open-project-routing.test.ts --bail=1 --reporter=verbose` | [4 passed](logs/desktop-src_open-project-routing.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/pending-open-project-store.test.ts --bail=1 --reporter=verbose` | [3 passed](logs/desktop-src_pending-open-project-store.test.ts.log) |
| `packages/desktop` | `../../node_modules/.bin/vitest run src/preload-sandbox.test.ts --bail=1 --reporter=verbose` | [1 passed](logs/desktop-src_preload-sandbox.test.ts.log) |
