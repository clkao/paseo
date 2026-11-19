import { expect, test } from "vitest";
import { resolveBrowserPartition } from "./session-scope";

test("scopes persistent partitions by server and project or workspace", async () => {
  const project = await resolveBrowserPartition("project", "server", "a", "one");
  expect(project).toBe("persist:paseo-browser-scope-dee6ded3a743c0d6e80cf6796766f2fe");
  expect(await resolveBrowserPartition("shared", "server", "a", "one")).toBe(
    "persist:paseo-browser",
  );
  expect(await resolveBrowserPartition("project", "server", "a", "two")).toBe(project);
  expect(await resolveBrowserPartition("project", "server", "b", "one")).not.toBe(project);
  expect(await resolveBrowserPartition("project", "other", "a", "one")).not.toBe(project);
  const workspace = await resolveBrowserPartition("workspace", "server", "a", "one");
  expect(await resolveBrowserPartition("workspace", "server", "a", "two")).not.toBe(workspace);
  expect(await resolveBrowserPartition("workspace", "server", "b", "one")).toBe(workspace);
  expect(await resolveBrowserPartition("project", "a", "bc", "x")).not.toBe(
    await resolveBrowserPartition("project", "ab", "c", "x"),
  );
});
