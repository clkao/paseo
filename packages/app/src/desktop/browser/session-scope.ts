import type { DesktopSettings } from "@/desktop/settings/desktop-settings";

export type BrowserSessionScope = DesktopSettings["browser"]["sessionScope"];

export async function resolveBrowserPartition(
  scope: BrowserSessionScope,
  serverId: string,
  projectId: string,
  workspaceId: string,
): Promise<string> {
  if (scope === "shared") return "persist:paseo-browser";

  const id = scope === "project" ? projectId : workspaceId;
  const tuple = JSON.stringify(["v1", scope, serverId, id]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tuple));
  const suffix = Array.from(new Uint8Array(digest, 0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `persist:paseo-browser-scope-${suffix}`;
}
