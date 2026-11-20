// From the candidate root: PASEO_DESKTOP_BROWSER_E2E_ARTIFACT_DIR=<empty-dir> node <this file>
// Reuse the repository's isolated local daemon, main process, renderer, and workspace fixtures.
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function menus({ page, openWorkspace, artifactDir, workspaceIds, serverId, url, inspect }) {
  const assert = (await import("node:assert/strict")).default;
  const { writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const result = { duplicate: [], views: [] };
  const picker = page.locator('[data-testid="browser-profile-picker"]:visible');
  const surface = page.locator('[data-menu-surface="true"]:visible');
  const groups = surface.getByRole("group");
  const group = (name) => surface.getByRole("group", { name, exact: true });
  const shared = "Shared";
  const project = ["Desktop browser project 1", "Desktop browser project 1", "Desktop browser project 3"];
  const workspace = (i) => "Café " + (i + 1);
  const submitted = ["Validation shared", "Original project only", "Foreign project only"];
  const sharedAction = "Create new shared profile…";
  const projectAction = "Create new workspace profile…";
  async function blank(i) {
    await openWorkspace(page, serverId + ":" + workspaceIds[i]);
    const button = page.locator('[data-testid="workspace-new-tab-browser"]:visible').first();
    if (await button.isVisible()) await button.click();
    else {
      await page.locator('[data-testid="workspace-new-tab-button"]:visible').first().click();
      await page.getByTestId("workspace-new-tab-menu-browser").click();
    }
    await picker.waitFor({ timeout: 15_000 });
  }
  async function submit(name, target, collision) {
    const previous = await picker.getAttribute("aria-label");
    await picker.click();
    await group(target).getByText(target === shared ? sharedAction : projectAction, { exact: true }).click();
    await page.getByTestId("browser-create-profile-input").fill(name);
    await page.getByTestId("browser-create-profile-submit").click();
    if (collision) {
      const error = page.getByTestId("browser-create-profile-error");
      await error.waitFor();
      const message = await error.innerText();
      assert.equal(message, "A profile with this name already exists in this group.");
      await page.getByTestId("browser-create-profile-cancel").click();
      await picker.waitFor();
      const after = await picker.getAttribute("aria-label");
      assert.equal(after, previous);
      result.duplicate.push({ name, target, message, previous, after });
    } else {
      await page.getByTestId("browser-create-profile-input").waitFor({ state: "hidden" });
      await page.waitForFunction(expected =>
        [...document.querySelectorAll('[data-testid="browser-profile-picker"]')]
          .some(el => el.getBoundingClientRect().width && el.getAttribute("aria-label")?.endsWith(expected)),
        target + " › " + name,
      );
    }
  }
  await blank(0);
  await submit(submitted[0], shared, false);
  await submit(submitted[1], project[0], false);
  await blank(0);
  for (const name of [workspace(0), workspace(1).toUpperCase(), submitted[1].toUpperCase()]) {
    await submit(name, project[0], true);
  }
  await submit(submitted[0].toUpperCase(), shared, true);
  await blank(2);
  await submit(submitted[2], project[2], false);
  for (const i of [0, 1, 2]) {
    await blank(i);
    await picker.click();
    await group(project[i]).waitFor();
    const labels = await groups.evaluateAll((els) => els.map(el => el.getAttribute("aria-label")));
    assert.deepEqual(labels, [shared, project[i]]);
    const rows = async (name) => (await group(name).getByRole("menuitem").allInnerTexts()).map(text => text.trim());
    const sharedRows = await rows(shared);
    const projectRows = await rows(project[i]);
    assert.deepEqual(sharedRows, ["default", submitted[0], sharedAction]);
    assert.deepEqual(projectRows, [workspace(i), submitted[i === 2 ? 2 : 1], projectAction]);
    const selected = await surface.locator('[aria-checked="true"]').allInnerTexts();
    assert.deepEqual(selected.map(s => s.trim()), [workspace(i)]);
    const allRows = (await surface.getByRole("menuitem").allInnerTexts()).map(s => s.trim());
    assert.deepEqual(allRows, [...sharedRows, ...projectRows]);
    result.views.push({ workspace: workspaceIds[i], labels, sharedRows, projectRows, selected });
    await page.keyboard.press("Escape");
  }
  // The same accented workspace name can be pasted in composed or decomposed Unicode.
  // Observe both accepted and refused outcomes through the normal create dialog.
  await blank(0);
  const autoName = workspace(0);
  const equivalentName = autoName.normalize("NFD");
  assert.notEqual(autoName, equivalentName);
  assert.equal(autoName.normalize("NFC"), equivalentName.normalize("NFC"));
  const label = page.locator('[data-testid="browser-profile-label"]:visible');
  const active = page.locator('[data-paseo-browser-surface][aria-hidden="false"] webview');
  async function visit(account, signIn) {
    const address = page.getByRole("textbox", { name: "Browser URL" });
    await address.fill(url);
    await address.press("Enter");
    await label.waitFor();
    await page.waitForFunction(async () => {
      const view = document.querySelector('[data-paseo-browser-surface][aria-hidden="false"] webview');
      return view?.executeJavaScript("!!document.querySelector('#account')").catch(() => false);
    });
    if (signIn) await active.evaluate(v => v.executeJavaScript("document.querySelector('button').click()"));
    const values = await active.evaluate(async v => ({
      id: v.dataset.paseoBrowserId, partition: v.getAttribute("partition"),
      ...await v.executeJavaScript("({account:document.querySelector('#account').textContent,cookie:document.cookie,storage:localStorage.getItem('account')})"),
    }));
    assert.equal(values.account, account);
    const screenshot = signIn ? "unicode-automatic.png" : "unicode-named.png";
    const marker = (signIn ? "238523ff" : "5d635dff").repeat(8);
    for (let i = 0; i < 75; i++) {
      const png = await inspect('return win.capturePage().then(image => image.toBitmap().includes(Buffer.from(' + JSON.stringify(marker) + ',"hex")) ? image.toPNG().toString("base64") : null);');
      if (png) {
        await writeFile(join(artifactDir, screenshot), Buffer.from(png, "base64"));
        return { ...values, label: await label.innerText(), screenshot };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Account page did not paint " + screenshot);
  }
  const original = await visit("Alice", true);
  await blank(0);
  await picker.click();
  await group(project[0]).getByText(projectAction, {exact: true}).click();
  await page.getByTestId("browser-create-profile-input").fill(equivalentName);
  await page.getByTestId("browser-create-profile-submit").click();
  const input = page.getByTestId("browser-create-profile-input");
  const error = page.getByTestId("browser-create-profile-error");
  const decision = await Promise.race([
    input.waitFor({ state: "hidden" }).then(() => "created"),
    error.waitFor().then(() => "rejected"),
  ]);
  const unicode = { autoName, equivalentName, decision, original };
  if (decision === "created") {
    await picker.click();
    unicode.rows = (await group(project[0]).getByRole("menuitem").allInnerTexts())
      .filter(name => name.normalize("NFC") === autoName);
    assert.deepEqual(unicode.rows, [autoName, equivalentName]);
    await group(project[0]).evaluate(async el => {
      for (let n = el; n; n = n.parentElement) await Promise.all(n.getAnimations().map(a => a.finished));
    });
    const png = await inspect('return win.capturePage().then(image => image.toPNG().toString("base64"));');
    await writeFile(join(artifactDir, "unicode-menu.png"), Buffer.from(png, "base64"));
    await page.keyboard.press("Escape");
    unicode.other = await visit("Signed out", false);
    assert.equal(unicode.original.label.normalize("NFC"), unicode.other.label.normalize("NFC"));
    assert.notEqual(unicode.original.partition, unicode.other.partition);
  } else unicode.message = await error.innerText();
  result.equivalentWorkspaceName = unicode;
  await writeFile(join(artifactDir, "independent-menus.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  return result;
}
const runner = pathToFileURL(resolve("packages/desktop/e2e/browser-tabs.e2e.mjs")).href;
const fixture = pathToFileURL(resolve("packages/desktop/e2e/browser-profiles.electron.mjs")).href;
const callback = "data:text/javascript," + encodeURIComponent(
  "export { accountFixture } from " + JSON.stringify(fixture) + ";\nexport const runProfileJourney = " + menus.toString(),
);
registerHooks({
  load(url, context, next) {
    const file = next(url, context);
    if (url !== runner) return file;
    // Only change the three synthetic workspace display names seeded by the runner.
    const source = Buffer.from(file.source).toString().replaceAll(
      "Desktop browser workspace ${index + 1}", "Café ${index + 1}",
    );
    if (source === Buffer.from(file.source).toString()) throw new Error("workspace seed was missing");
    return { ...file, source };
  },
  resolve(specifier, context, next) {
    if (context.parentURL === runner && specifier === "./browser-profiles.electron.mjs")
      return { url: callback, shortCircuit: true };
    return next(specifier, context);
  },
});
process.env.PASEO_DESKTOP_BROWSER_PROFILES_ONLY = "1";
await import(runner);
