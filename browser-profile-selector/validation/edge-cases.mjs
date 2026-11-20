// Run from the candidate worktree after building desktop main.
// Only the journey callback changes. The production application and isolated E2E fixture are unchanged.
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function extraJourney({
  page,
  inspect,
  openWorkspace,
  artifactDir,
  url,
  workspaceIds,
  serverId,
  tool,
}) {
  const assert = (await import("node:assert/strict")).default;
  const { createServer } = await import("node:http");
  const { writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { setTimeout: delay } = await import("node:timers/promises");
  const result = {};
  const save = () =>
    writeFile(join(artifactDir, "edge-results.json"), JSON.stringify(result, null, 2));
  const snap = async (filename) => {
    // The screenshot contains native guest content, which can lag behind DOM assertions.
    const marker = { "automatic-account.png": "238523ff", "named-account.png": "5d635dff" }[
      filename
    ];
    const start = Date.now();
    while (Date.now() - start < 10000) {
      const data = await inspect(`return win.capturePage().then(image => {
        const marker = Buffer.from(${JSON.stringify((marker || "").repeat(8))}, "hex");
        return (!marker.length || image.toBitmap().includes(marker)) ? image.toPNG().toString("base64") : null;
      });`);
      if (data) return writeFile(join(artifactDir, filename), Buffer.from(data, "base64"));
      await delay(100);
    }
    throw new Error("No matching desktop frame for " + filename);
  };
  const picker = page.locator('[data-testid="browser-profile-picker"]:visible');
  const label = page.locator('[data-testid="browser-profile-label"]:visible');
  const active = page.locator('[data-paseo-browser-surface][aria-hidden="false"] webview');
  const current = () =>
    active.evaluate(async (view) => ({
      id: view.dataset.paseoBrowserId,
      partition: view.getAttribute("partition"),
      data: await view.executeJavaScript(
        "({account:document.querySelector('#account')?.textContent,cookie:document.cookie,storage:localStorage.getItem('account')})",
      ),
    }));
  async function blank() {
    const launch = page.locator('[data-testid="workspace-new-tab-browser"]:visible').first();
    if (await launch.isVisible()) await launch.click();
    else {
      await page.locator('[data-testid="workspace-new-tab-button"]:visible').first().click();
      await page.getByTestId("workspace-new-tab-menu-browser").click();
    }
    await picker.waitFor({ timeout: 15000 });
  }
  async function navigate() {
    const address = page.getByRole("textbox", { name: "Browser URL" });
    await address.fill(url);
    await address.press("Enter");
    await label.waitFor();
    await page.waitForFunction(async () => {
      const v = document.querySelector('[data-paseo-browser-surface][aria-hidden="false"] webview');
      return v?.executeJavaScript("!!document.querySelector('#account')").catch(() => false);
    });
  }
  await openWorkspace(page, serverId + ":" + workspaceIds[0]);

  // Observe the attribute order on newly created webview elements, including before they are attached.
  await page.evaluate(() => {
    window.profilesObserved = [];
    const create = document.createElement.bind(document);
    document.createElement = function (...args) {
      const view = create(...args);
      if (args[0] === "webview") {
        const events = [];
        window.profilesObserved.push(events);
        new MutationObserver((records) => {
          for (const event of records)
            events.push({ attr: event.attributeName, id: view.dataset.paseoBrowserId });
        }).observe(view, { attributes: true, attributeFilter: ["partition", "src"] });
      }
      return view;
    };
  });

  // A request to an ordinary HTTP server holds its first response for eight seconds.
  // Observe whether browser_new_tab can return its ID while the page is still loading.
  let firstRequestAt = null;
  let responseAt = null;
  const slow = createServer((req, res) => {
    if (firstRequestAt === null) firstRequestAt = Date.now();
    setTimeout(() => {
      if (responseAt === null) responseAt = Date.now();
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end("<title>Slow fixture</title><p>Loaded</p>");
    }, 8000);
  });
  await new Promise((resolve) => slow.listen(0, "127.0.0.1", resolve));
  const slowUrl = "http://127.0.0.1:" + slow.address().port + "/slow-first-document";
  const before = await tool("browser_list_tabs", {});
  const start = Date.now();
  try {
    let returned = null;
    let error = null;
    try {
      returned = await tool("browser_new_tab", { url: slowUrl });
    } catch (e) {
      error = String(e);
    }
    const elapsed = Date.now() - start;
    const beforeResponse = responseAt === null;
    // Wait until the server actually sends the response before inspecting the resulting tab.
    const deadline = Date.now() + 15000;
    while (responseAt === null && Date.now() < deadline) await delay(100);
    assert.ok(responseAt !== null, "Slow fixture did not send its first response");
    let late = await tool("browser_list_tabs", {});
    while (late.tabs.length === 0 && Date.now() < deadline) {
      await delay(100);
      late = await tool("browser_list_tabs", {});
    }
    result.registration = {
      before,
      returned,
      error,
      elapsed,
      beforeResponse,
      receivedAfterMs: firstRequestAt - start,
      respondedAfterMs: responseAt - start,
      late,
    };
    await save();
  } finally {
    slow.closeAllConnections();
    await new Promise((resolve) => slow.close(resolve));
  }

  // Two users choose profiles through the normal desktop menu. Record the account attached to each caption.
  const workspaceName = "Desktop browser workspace 1";
  await blank();
  await navigate();
  await active.evaluate((v) => v.executeJavaScript("document.querySelector('button').click()"));
  const original = { label: await label.innerText(), ...(await current()) };
  assert.equal(original.data.account, "Alice");
  await snap("automatic-account.png");
  await blank();
  await picker.click();
  const group = page
    .locator('[data-menu-surface="true"]:visible')
    .getByRole("group", { name: "Desktop browser project 1", exact: true });
  await group.getByText("Create new workspace profile…", { exact: true }).click();
  await page.getByTestId("browser-create-profile-input").fill(workspaceName);
  await page.getByTestId("browser-create-profile-submit").click();
  const inlineError = page.getByTestId("browser-create-profile-error");
  const decision = await Promise.race([
    inlineError.waitFor({ timeout: 10000 }).then(() => "rejected"),
    page
      .getByTestId("browser-create-profile-input")
      .waitFor({ state: "hidden", timeout: 10000 })
      .then(() => "created"),
  ]);
  if (decision === "rejected") {
    result.duplicate = { decision, message: await inlineError.innerText(), original };
  } else {
    await picker.waitFor();
    await picker.click();
    await group.waitFor();
    const rows = await group.getByText(workspaceName, { exact: true }).allTextContents();
    await group.evaluate(async (element) => {
      for (let node = element; node; node = node.parentElement) {
        await Promise.all(node.getAnimations().map((animation) => animation.finished));
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await snap("duplicate-menu.png");
    await page.keyboard.press("Escape");
    await navigate();
    const other = { label: await label.innerText(), ...(await current()) };
    result.duplicate = { decision, rows, original, other };
    await snap("named-account.png");
  }
  result.attributeOrder = await page.evaluate(() => window.profilesObserved);
  await save();
  console.log(
    JSON.stringify({ registration: result.registration, duplicate: result.duplicate }, null, 2),
  );
  return result;
}

const journeyFile = pathToFileURL(
  resolve("packages/desktop/e2e/browser-profiles.electron.mjs"),
).href;
const runnerFile = pathToFileURL(resolve("packages/desktop/e2e/browser-tabs.e2e.mjs")).href;
const testModule =
  "data:text/javascript," +
  encodeURIComponent(
    "export { accountFixture } from " +
      JSON.stringify(journeyFile) +
      ";\nexport const runProfileJourney = " +
      extraJourney.toString(),
  );
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === runnerFile && specifier === "./browser-profiles.electron.mjs")
      return { url: testModule, shortCircuit: true };
    return next(specifier, context);
  },
});
process.env.PASEO_DESKTOP_BROWSER_PROFILES_ONLY = "1";
await import(runnerFile);
