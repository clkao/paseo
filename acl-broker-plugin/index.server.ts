import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { Credentials, Denied } from "./server/credentials";
import { dispatch } from "./server/policy";

export default function contribute(server: PluginServerContext) {
  const directory = process.env.PASEO_ACL_PLUGIN_DIR;
  if (!directory || !path.isAbsolute(directory))
    throw new Error("Set PASEO_ACL_PLUGIN_DIR on the daemon");
  const root = mkdtempSync(path.join(tmpdir(), "paseo-acl-"));
  const sessions = new Map<string, () => void>();
  const credentials = new Credentials();
  const providers = new Set(
    (process.env.PASEO_ACL_WRAPPED_PROVIDERS ?? "codex,claude")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );

  server.addHook("agent.open.before", async ({ request }, { paseo, signal }) => {
    if (request.purpose !== "interactive") return;
    if (!providers.has(request.provider)) throw new Denied("PROVIDER_DENIED");
    const id = request.agentId;
    sessions.get(id)?.();
    const socket = path.join(root, randomUUID() + ".sock");
    const { token, revoke: invalidate, active } = credentials.issue(id);
    const child = spawn(process.execPath, [path.join(directory, "server/sidecar.cjs"), socket], {
      stdio: ["pipe", "pipe", "inherit"],
      env: {},
    });
    function revoke() {
      invalidate();
      if (sessions.get(id) === revoke) sessions.delete(id);
      child.stdin.destroy();
      child.kill();
      rmSync(socket, { force: true });
    }
    sessions.set(id, revoke);
    // The token and correlated replies use the private stdin pipe. EOF ends an orphan.
    child.stdin.on("error", revoke);
    child.stdin.write(JSON.stringify({ token }) + "\n");
    const lines = createInterface({ input: child.stdout });
    async function serve(line: string) {
      const frame = JSON.parse(line);
      let reply;
      try {
        const verified = credentials.verify(frame.token);
        if (verified !== id) throw new Denied("INVALID_TOKEN");
        const result = await dispatch(
          { id: verified, cwd: request.cwd, providers, paseo },
          frame.operation,
          frame.args,
          active,
        );
        reply = { seq: frame.seq, result };
      } catch (error) {
        let code = "DAEMON_ERROR";
        if (error instanceof Denied) code = error.message;
        else if (error instanceof Error && error.name === "ZodError") code = "INVALID_ARGUMENT";
        reply = { seq: frame.seq, error: code };
      }
      if (child.stdin.writable) child.stdin.write(JSON.stringify(reply) + "\n");
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const fail = () => reject(new Error("ACL sidecar failed before ready"));
        child.once("error", fail);
        child.once("exit", () => {
          revoke();
          fail();
        });
        signal.addEventListener("abort", fail, { once: true });
        lines.once("line", (greeting) => {
          if (greeting !== "ready" || signal.aborted) return fail();
          signal.removeEventListener("abort", fail);
          lines.on("line", (line) => {
            void serve(line).catch(revoke);
          });
          resolve();
        });
      });
    } catch (error) {
      revoke();
      throw error;
    }
    return {
      ...request,
      env: { ...request.env, PASEO_HOST: "unix://" + socket },
      mcpServers: {
        ...request.mcpServers,
        "paseo-acl": {
          type: "stdio" as const,
          command: "/usr/bin/python3",
          args: [path.join(directory, "bin/bridge.py"), socket],
        },
      },
    };
  });
  server.addHook("agent.close.after", async ({ agent }) => {
    sessions.get(agent.id)?.();
  });
  return () => {
    for (const revoke of sessions.values()) revoke();
    rmSync(root, { recursive: true, force: true });
  };
}
