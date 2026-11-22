// Time the committed readiness operations without changing their promises, selectors or budgets.
if (process.argv[1]?.endsWith("/e2e/browser-tabs.e2e.mjs")) {
  const {registerHooks} = require("node:module");
  registerHooks({load(url, context, next) {
    const result = next(url, context);
    if (!url.endsWith("/e2e/browser-tabs.e2e.mjs")) return result;
    const s = Buffer.from(result.source).toString()
      .replace("async function launchDesktop() {", 'async function launchDesktop() { const launchedAt = performance.now(); console.log(new Date().toISOString(), "launchDesktop started");')
      .replace("await settleDesktopStartup(opened);", `const sidebarAt = performance.now();
        try { await settleDesktopStartup(opened); }
        finally { console.log(new Date().toISOString(), "launch to sidebar wait end (ms)", Math.round(performance.now()-launchedAt), "sidebar wait (ms)", Math.round(performance.now()-sidebarAt)); }`);
    return {...result, source:s};
  }});
}
