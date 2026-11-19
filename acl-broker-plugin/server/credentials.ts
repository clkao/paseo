import { createHash, randomBytes } from "node:crypto";

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export class Denied extends Error {}

export class Credentials {
  private readonly active = new Map<string, string>();

  issue(agentId: string) {
    const token = "pacl_v1_" + randomBytes(32).toString("hex");
    const key = digest(token);
    this.active.set(key, agentId);
    return { token, revoke: () => this.active.delete(key), active: () => this.active.has(key) };
  }

  verify(token: unknown) {
    const id = typeof token === "string" && this.active.get(digest(token));
    if (!id) throw new Denied("INVALID_TOKEN");
    return id;
  }
}
