// Run at the candidate root after npm run build:main --workspace=@getpaseo/desktop.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const module = pathToFileURL(resolve("packages/desktop/dist/features/browser-profile-catalog.js"));
const { createBrowserProfileCatalog } = await import(module);
const directory = await mkdtemp(join(tmpdir(), "profile-catalog-unicode-"));
try {
  const catalog = createBrowserProfileCatalog(directory);
  const workspaceNames = ["Café 1"];
  const group = { serverId: "server", projectId: "project" };
  const before = await catalog.list();
  const names = [workspaceNames[0], workspaceNames[0].normalize("NFD"), "Café", "Cafe\u0301"];
  const result = [];
  for (const name of names) {
    try {
      const entry = await catalog.create({ group, name, workspaceNames });
      result.push({ name, normalized: name.normalize("NFC"), decision: "created", slug: entry.slug });
    } catch (error) {
      result.push({ name, normalized: name.normalize("NFC"), decision: "rejected", error: error.message });
    }
  }
  assert.equal(names[0].normalize("NFC"), names[1].normalize("NFC"));
  assert.equal(names[2].normalize("NFC"), names[3].normalize("NFC"));
  const after = await createBrowserProfileCatalog(directory).list();
  console.log(JSON.stringify({ before, result, after }, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
